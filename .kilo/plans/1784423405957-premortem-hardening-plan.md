# Premortem & App Hardening Plan

**Goal:** Before shipping the mortgage band / DOM / provenance work (parent plan `1784423405957-mortgage-dom-data-lineage-quality-plan.md`), run a structured premortem: imagine the app has been live for 2 weeks and has gone wrong — enumerate the most likely failure modes across every surface, then convert them into concrete hardening TODOs. Scope = full codebase hardening, deployment reality = single mini-PC POC (so: hostile-network assumptions for security, single-container restart reality for state, no Kubernetes gold-plating).

**Parent plan:** `/home/aksai/projects/realestate/.kilo/plans/1784423405957-premortem-hardening-plan.md`

## Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Scope | Full hardening across security, reliability, data integrity, observability, scraping — not just mortgage/DOM. |
| 2 | Deployment reality | POC on a single mini-PC, network-reachable. Assume a hostile network (public-facing) BUT avoid gold-plating with K8s/multi-region infra. Prefer config + small code changes over new infrastructure. |
| 3 | JWT_SECRET | Make startup-fatal if unset by env (no random per-restart default). One env var, persisted in `.env`, generated once via a documented command. Existing sessions survive restart. |
| 4 | CORS | Default to **refuse to start** when `CORS_ORIGINS=*` AND `allow_credentials=true` (browsers reject this anyway; current code silently keeps `*`). Production must list explicit origins. |
| 5 | Secrets in code | Remove all hardcoded `realestate_user:realestate_pass@` defaults. Fail-fast if `DATABASE_URL`/`JWT_SECRET`/API keys missing in non-test mode. |
| 6 | Frontend token storage | Move `localStorage.getItem('token')` → `httpOnly` cookie set by `/api/login`. Eliminates the most common XSS token theft path. |
| 7 | Scraping resilience | Add 429/5xx backoff + jitter + per-source concurrency cap to every external fetcher (OnTheHouse already exists; the new T2 Domain/CoreLogic fetcher from the parent plan must inherit it from day one). |
| 8 | Silent failures | Convert `except: pass` in ETL into structured warnings written to `dq_issues` / a `etl_run_log` table. No error stays silent. |
| 9 | DB resilience | Add `pool_timeout`, `connect_timeout`, statement-level query timeout, and a `/health` deep check that exercises the DB. |
| 10 | Observability | Emit JSON structured logs (one line per request) capturing request_id, user_id, route, latency, status, error_class. Keep the existing `record_cache_hit/miss` metrics text endpoint. No new vendor. |
| 11 | Rate limiting | Replace in-process OrderedDict stores with the existing Redis (already in docker-compose) so limits survive restart and span the (future) multi-worker case. Keep auth 20/min, add API-wide 100/min, add per-suburb AI insight 10/min (already exists in code but in-process). |

## Premortem — "It's been live 2 weeks. What went wrong?"

The team gathers and imagines the deployment failed. Each failure below is a plausible, evidence-based scenario traced to real code found during inspection.

### P1 — Every user logged out every time the container restarts
**Evidence:** `backend/main.py:297` `JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))`. The fallback generates a brand-new random secret each process start. Docker healthcheck restarts the container (`docker-compose.yml:37-42`) on any 30s blip — each restart invalidates every JWT issued before it.
**Impact:** Mass logouts, "Invalid token" 401 storm, users lose Buyer-Fit decision snapshots mid-session.
**Root cause class:** Secret management.

### P2 — CORS `*` + `allow_credentials=true` → browsers refuse, or worse, accept
**Evidence:** `backend/main.py:86-98` defaults `CORS_ORIGINS=*`, sets `allow_credentials=True`, `allow_methods=["*"]`. Modern browsers reject credentialed `*` entirely so cookie auth (Decision 6) silently breaks. WORSE, if a future toggle flips `allow_credentials=False`, the API becomes readable from any origin including attacker-supplied pages reading user data via the cookie.
**Impact:** Either broken auth (after token-to-cookie migration) or cross-origin data theft.
**Root cause class:** CORS misconfiguration.

### P3 — DB credentials leak via git or image layer
**Evidence:** 14+ files contain the literal `postgresql://realestate_user:realestate_pass@db:5432/realestate` as the `os.getenv` default. `.env` IS gitignored (verified: `.gitignore:25`), but the defaults themselves are committed to public-source files. If the prod DB password is ever set to anything resembling the default, anyone reading the repo gets in.
**Impact:** Unauthorized DB access if the default password is reused in prod.
**Root cause class:** Secrets in source.

### P4 — The brand-new external scraper gets the IP permanently banned on day 1
**Evidence:** This session: `webfetch` against realestate.com.au returned `429` on the very first batch of 3 requests. The new T2 Domain/CoreLogic fetcher in the parent plan, if built naïvely, will hammer a target with no concurrency cap, no backoff, no jitter. Result: IP ban, no DOM data, and the parent plan's T2 acceptance ("DOM populated ~31") silently fails into NULLs.
**Impact:** No DOM data; possible IP-level block that also kills the existing OnTheHouse scraper for re-scrapes.
**Root cause class:** Scraping resilience.

### P5 — Silent ETL errors produce a quiet, wrong dataset
**Evidence:** `backend/etl_transform_v3.py:107-206` has 15+ `except: pass` blocks. `backend/unpack_json_to_table.py` `extract_metrics` swallows per-metric parse failures. A subtle schema change in OnTheHouse's JSON (e.g. `marketTrends.metrics.House.10` becomes `.11`) makes `extract_metrics` return `{}` for ALL suburbs, the unpack writes nothing, the enrich SQL inserts NULLs, the profile shows `—` everywhere, and no alarm fires.
**Impact:** Whole-suburb profiles silently degenerate to blanks with no DQ signal.
**Root cause class:** Silent failure swallowing.

### P6 — Third-party LLM provider outage cascades into total UX freeze
**Evidence:** `backend/ai_agent.py` picks provider based on which API key env is set; if the chosen provider 5xx's or times out, `/api/insights` returns 500 (catch is broad `except Exception`). Front-end `AIInsightPanel.tsx` shows the spinner indefinitely on 500 (existing UX), no provider fallback, no circuit breaker.
**Impact:** AI insight tab hangs for every user during a provider outage.
**Root cause class:** External dependency cascade.

### P7 — DB connection pool exhaustion under a slow-query/scrape storm
**Evidence:** `main.py:117` `engine = create_engine(..., pool_size=20, max_overflow=30, pool_pre_ping=True)` — pool of 50 connections, `db` Postgres tuned to `max_connections=100` (`docker-compose.yml:107`). A burst of slow `/api/v3/suburbs` calls (each a cold `db.query(SuburbUIV3).all()` on 13k rows without pagination in batch endpoints) plus a concurrent enrichment run can exhaust the pool. No `pool_timeout` or `connect_timeout` set — requests hang until uvicorn's default keepalive.
**Impact:** 504/timeout storm; backend "alive" per healthcheck but unusable.
**Root cause class:** DB pool / query timeouts.

### P8 — XSS in property description text steals Buyer-Fit tokens
**Evidence:** Frontend stores JWT in `localStorage` (`src/components/UserFavoritesTab.tsx:16` `localStorage.getItem('token')`). Suburb `description_raw` and `sales_summary` JSON contain scraped text that is rendered without explicit sanitization in several profile sections (App.tsx long-template). A single malicious or `</script>`-containing description payload yields token theft on any future stored-XSS sink.
**Impact:** Account takeover; the cookie migration in Decision 6 alone does not close this if descriptions render user-content unsanitized.
**Root cause class:** XSS + token storage.

### P9 — The new "computed mortgage" shows a wildly wrong number because the rate env var is unset
**Evidence:** Parent plan T1 makes rate env-configurable. If deployment forgets `DEFAULT_MORTGATE_RATE`, the fallback default is only correct at deploy time — and there is no alert when it drifts. Worse: the env var is read at import time in `models_v3.py` (already), so a `.env` typo silently falls back to the old `6.20%` with no warning.
**Impact:** Stale-but-believed-correct mortgage numbers, which is exactly the bug we're fixing.
**Root cause class:** Config staleness / no validation.

### P10 — Restart wipes in-memory rate-limit and AI contribution memory
**Evidence:** `main.py:104` `_rate_limit_auth = OrderedDict()`; `:293` `_rate_limit_store = BoundedRateLimitStore`. Redis already running (`docker-compose.yml:80`) but not used for rate limiting. On restart, a banned attacker immediately gets 20 fresh attempts (M1) and the AI per-suburb limiter resets (existing `/api/insights` rate cap at `main.py:1204` is also in-process). Scraped-data and advisory state files (`ai_alerts.py:18` `alert_state.json`) survive only because they are files; the in-memory bits do not.
**Impact:** Brute force window on every restart; AI cost runaway on restart.
**Root cause class:** Stateful in-process state.

### P11 — Mortgage estimate silently degrades when median price source lags
**Evidence:** Parent plan T3 stores `external_validation` for median price, but `estimated_mortgage_repayment` is computed off `house_median_price` at enrich time. If OnTheHouse median goes stale (no re-scrape for 90 days), the displayed mortgage number diverges from reality and the only signal is the `last_updated` column that no UI surfaces.
**Impact:** Stale mortgage shown with a confident-looking "/mo".
**Root cause class:** Freshness not surfaced.

### P12 — Postgres OOM killed mid-enrichment corrupts a partial row
**Evidence:** `docker-compose.yml` db `deploy.resources.limits.memory: 2G` and Postgres `work_mem=8MB`. The bulk `INSERT ... ON CONFLICT DO UPDATE` in `enrich_from_unpacked.py` touches every row at once. If OOM-killer strikes mid-statement, the transaction rolls back (good) BUT the `enrich_changed()` variant uses a different SQL that interleaves `last_updated >= unpacked_at` logic — partial state is possible if the connection drops between commits.
**Impact:** Indeterminate subset of suburbs marked enriched; per-row DQ inconsistent with neighbours.
**Root cause class:** Partial-completion in bulk ETL.

### P13 — Scraped external-HTML parser breaks on a layout change, writes NULLs, no alarm
**Evidence:** The parent plan T2 fetcher parses Domain/realestate.com.au HTML with regex/BeautifulSoup. A redesign (sites do these quarterly) silently returns no matches, all DOM fields become NULL, the heuristic takes over, and the only signal is the new `dom_mismatch` DQ check firing on EVERY suburb — a wall of noise that gets ignored.
**Impact:** External source silently dead; DOM reverts to heuristic with no human alert.
**Root cause class:** Brittle parser + noisy alert.

### P14 — Wide `except Exception` in API hides a real bug as a 500
**Evidence:** 30+ `except Exception as e: raise HTTPException(500, str(e))` patterns (`main.py:539, 1302, 1343, 2108…`). `str(e)` is echoed to the caller — often leaking DB internals, connection-string fragments, or file paths. And the underlying exception type/name is never logged structurally, so reproduction is guesswork.
**Impact:** Info leak to client + untraceable server bug.
**Root cause class:** Exception handling + info disclosure.

### P15 — Single uvicorn worker = no horizontal scale + same worker runs CPU-heavy AI
**Evidence:** `Dockerfile:11` `--workers 1`. AI calls (synchronous langchain block) hold the only worker; the whole API stalls during any AI insight request. There is already a 256M memory cap on the front container (`docker-compose.yml:18`) that will OOM-kill a second worker if added naïvely.
**Impact:** UI unresponsive for every other user while one user clicks "AI insights".
**Root cause class:** Concurrency model + resource budget.

## Hardening TODOs (mapped to the P# they close)

Every TODO is file-anchored and has an acceptance test. Priority (🔴 P0 must-do-before-ship · 🟠 P1 · 🟡 P2):

### H1 — P0 · Kill the random-JWT_SECRET foot-gun (closes P1, P10)
- [ ] `backend/main.py:297` — remove `secrets.token_urlsafe(32)` default; require `JWT_SECRET` env (≥32 chars) in non-test mode → if absent, log error and `sys.exit(2)`.
- [ ] Add `conftest.py` exemption: tests set a fake `JWT_SECRET` (already controlled via env in tests, verify) so unit tests still pass.
- [ ] Document one-time generation: `python -c "import secrets; print(secrets.token_urlsafe(48))"` → paste into `.env`. Add this line to a new short `.env.example` (NOT committed with values; only keys).
- [ ] Acceptance: with `JWT_SECRET` unset, container fails to start; with it set, a token minted before restart survives a `docker compose restart backend`.

### H2 — P0 · CORS hardening (closes P2)
- [ ] `backend/main.py:86-98` — when `CORS_ORIGINS` is `*` AND `allow_credentials=True`, raise `RuntimeError` at startup unless an env `ALLOW_INSECURE_CORS=1` is set (escape hatch for local dev).
- [ ] Default `CORS_ORIGINS` to **empty** (fail-closed) rather than `*`.
- [ ] Tighten `allow_methods` to the actual verbs used (`GET, POST, OPTIONS, DELETE`) and `allow_headers` to `Authorization, Content-Type`.
- [ ] Acceptance: prod `.env` without `CORS_ORIGINS` entry → backend refuses to start with a clear error; setting it to the frontend origin unblocks.

### H3 — P0 · Remove all hardcoded DB/API-key defaults (closes P3)
- [ ] Sweep all 14 occurrences of `postgresql://realestate_user:realestate_pass@` in `backend/*.py` (`models_v3.py:29`, `main.py:116`, `models_v2.py:5`, `add_column.py:4`, `add_columns.py:4`, `import_acara.py:14`, `parallel_scraper.py:13`, `migrate_*.py`, `rank_suburbs.py:6`, `migrate_postgis_geom.py:4`, `migrate_history_to_timeseries.py:8`, `warm_cache.py:29`) → replace with `os.environ["DATABASE_URL"]` (KeyError if unset), no default.
- [ ] Same for `docker-compose.yml:75` `tileserv` env `DATABASE_URL=postgres://realestate_user:realestate_pass@...` — move to `${DATABASE_URL}` interpolation from `.env`.
- [ ] Add a startup self-check that warns (not errors) if the DB password matches the historical literal `realestate_pass`.
- [ ] Acceptance: `DATABASE_URL` unset + non-test → every entrypoint refuses to run; `git grep realestate_pass backend` returns zero matches in `.py`.

### H4 — P0 · External-fetch resilience module (closes P4, P6, P13)
- [ ] Create `backend/http_client.py` with a single hardened `get_with_backoff(url, *, retries=5, base_delay=1.0, jitter=0.3, timeout=20, respect_retry_after=True)`. On 429/5xx: exponential backoff honoring `Retry-After` header; on 2xx→return; on terminal failure → `raise` typed `FetchError(source, url, status, attempts)`.
- [ ] Wrap the new T2 external-market fetcher (parent plan) to use it via a `CONFIG[source] = {base_url, concurrency, user_agent, robots_check=True}` registry.
- [ ] Add per-source concurrency cap via a `Semaphore` (default 2 concurrent per source).
- [ ] Acceptance: a unit test simulating a 429 → Retry-After: 5 response asserts the fetcher waits ~5s and retries exactly once before returning 2xx; a 5x-429 sequence raises `FetchError` within ≤30s with a populated DQ issue, never a hang.

### H5 — P0 · Stop swallowing ETL errors (closes P5, P12)
- [ ] Audit `backend/etl_transform_v3.py` and `backend/unpack_json_to_table.py` — every `except: pass` and broad `except Exception:` either gets a narrow exception type, OR writes to a new `etl_run_log` table `{run_id, suburb_id, stage, exception_class, message, severity}`.
- [ ] `enrich_from_unpacked.py` runs its whole upsert in a single transaction; if any row fails, the entire batch rolls back and a run-log row records the failure with the FROZEN incoming state preserved for re-runs.
- [ ] `etl_dq_report_v3.py --detail` surfaces `etl_run_log` rows from the last 7 days grouped by stage.
- [ ] Acceptance: inject a deliberately malformed raw_json row, run unpack+enrich → a row appears in `etl_run_log`, no silent blank-field suburbs get inserted.

### H6 — P0 · Frontend token in httpOnly cookie (closes P8 token-storage half)
- [ ] `/api/login` (`main.py:395`) → set `Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`. Drop the body-return of the token.
- [ ] `get_current_user` already reads cookie (`main.py:316`) — keep it; remove the `Authorization` header branch OR keep it for non-browser API clients only behind a separate `X-Internal-Client` header.
- [ ] Frontend: delete `localStorage.getItem('token')` everywhere (`UserFavoritesTab.tsx:16`, etc.) → rely on cookies. Update `fetch` calls to include `credentials: 'include'`.
- [ ] Acceptance: after login, `document.cookie` in browser dev tools shows NO `access_token` readable by JS; a protected API call still succeeds.

### H7 — P0 · Sanitize rendered external/scraped text (closes P8 XSS half)
- [ ] Audit every place scraped/external text is rendered: `description_raw`, AI `news_sentiment.articles[].summary`, external suburb-profile scrapes from parent-plan T2, `sales_summary` addresses. Render through DOMPurify (already a TS dep? check) before `innerHTML`, or use React's default escaping (most paths likely safe — verify none bypass it via `dangerouslySetInnerHTML`).
- [ ] `backend/main.py` AI endpoints: truncate + clip echoed error strings to ≤200 chars, drop the raw `str(e)` exposure (also closes P14).
- [ ] Acceptance: a suburb `description_raw` containing `<img src=x onerror=alert(1)>` renders as inert text, both in profile and in any AI-surfaced article snippet.

### H8 — P1 · DBlimit/timeout hardening (closes P7)
- [ ] `main.py:117` `create_engine` — add `pool_timeout=10, connect_args={"connect_timeout": 5, "statement_timeout": 30000}` (Postgres statement timeout 30s for API path; longer for ETL scripts with their own engine).
- [ ] Batch `/api/v3/suburbs` (`main.py:1611`) — add `limit` cap (e.g. ≤200) and enforce; today `limit: int = 50` has no upper bound in the route signature.
- [ ] Add a `/health/deep` endpoint that opens a DB session and runs `SELECT 1`; wire it as a secondary docker compose healthcheck for backend.
- [ ] Acceptance: a query taking >30s returns 503 within 30s instead of hanging the worker; `/health/deep` returns 503 when the DB is unreachable.

### H9 — P1 · Rate limiting via Redis (closes P10)
- [ ] Replace `_rate_limit_auth` OrderedDict and `_rate_limit_store` with a Redis-backed token bucket using the already-running Redis (`docker-compose.yml:80`). Keys like `rl:{scope}:{id}:{window}`.
- [ ] Keep existing limits (auth 20/min, AI per-suburb 10/min) and add an API-wide 100/min/IP gateway.
- [ ] Fail-open if Redis is down (log a `redis_rate_limit_unavailable` metric) so a Redis blip doesn't lock out all users.
- [ ] Acceptance: with backend restarted, a banned IP stays banned (rate-limit counter persists in Redis); a Redis outage causes the limiter to log + continue rather than 503.

### H10 — P1 · Config staleness alert (closes P9)
- [ ] At backend startup, log `config_snapshot` with all env-derived values + their source env/file (without printing secret values) and the build's expected ranges (e.g. `DEFAULT_MORTGATE_RATE` should be in 4–8%).
- [ ] If `DEFAULT_MORTGAGE_RATE` unset → startup warning (not fatal) `default_mortgage_rate_unset_using_fallback={value}`.
- [ ] `/api/mortgage-rate` (`main.py:1585`) — stop returning `stale_indicator=True` as a hint and instead compute staleness from the parent-plan `metric_provenance.interest_rate.fetched_at`; return `age_days`, `stale` only when >180 days.
- [ ] Acceptance: tail of backend logs at startup shows the config snapshot; the mortgage-rate endpoint `age_days` increments each day from the fetched_at date.

### H11 — P1 · Freshness surfaced in UI (closes P11)
- [ ] Profile Mortgage card and DOM card — render a relative-time badge ("data as of 23 days ago") reading from `last_updated` (already a column) and the new `metric_provenance` (parent plan T4). When `age_days > 60` → render amber "stale" badge.
- [ ] Acceptance: a suburb not re-scraped in 90 days shows a visible "stale" badge on the Mortgage card.

### H12 — P1 · Structured request logs (closes P14)
- [ ] Add a FastAPI middleware that emits one JSON line per request: `{ts, request_id, method, path, status, latency_ms, user_id, ip, error_class}`. `request_id` propagated via `X-Request-ID` (in/out).
- [ ] In every `except Exception as e: raise HTTPException(500, str(e))` site (`main.py:539, 1302, 1343, 2108, etc. → ~30 sites), log the typed exception with `request_id` and return a generic `"internal_error"` detail + the `request_id` to the client (so users can quote it). Stop echoing `str(e)`.
- [ ] Acceptance: a forced 500 returns body `{"detail":"internal_error","request_id":"…"}`; logs carry the typed stacktrace keyed by request_id.

### H13 — P1 · Concurrency model for AI (closes P15)
- [ ] Move the synchronous langchain AI calls into a thread pool (`asyncio.to_thread` or `run_in_executor` with a bounded `ThreadPoolExecutor(max_workers=2)`) so the single uvicorn event loop isn't blocked.
- [ ] Add a circuit breaker: if a provider returns ≥3 consecutive 5xx/timeout in 60s, short-circuit `/api/insights` to 503 with `reason=provider_degraded` for 90s (and re-try half-open after).
- [ ] Audit memory budget before raising `--workers`: with the 256M cap on the front container (`docker-compose.yml:18`), bumping workers is unsafe; either raise the cap (mirrors the 2G backend cap) or keep 1 worker + the thread pool. Document the decision.
- [ ] Acceptance: while one user triggers an AI insight, another user's basic `/api/suburbs/{id}` call returns in <500ms (today it stalls until AI returns).

### H14 — P2 · Scraper robots/ToS posture (closes P4 follow-up)
- [ ] Each external source's `CONFIG` registry includes a `robots_txt_url` and parsed `Crawl-delay` honoured by default.
- [ ] A single `backend/scrape_policy.py` centralizes `User-Agent`, `Crawl-delay`, per-source allow/disallow flags. Fetchers MUST import from it (no inline `requests.get`).
- [ ] Document explicitly in a new `docs/scraping-policy.md` (not committed per "no new docs unless requested" — instead, pin a `# SCRAPE POLICY` header comment block in `scrape_policy.py`) which sources are licensed public data (ABS, data.gov.au, RBA tables → unrestricted), which are scrape-at-own-risk (Domain, REA, propertyvalue, OTH), and which are strictly prohibited.
- [ ] Acceptance: enabling a new external source requires editing exactly one registry entry; a misconfigured (no robots.txt fetched) source refuses to run with a clear error.

### H15 — P2 · Test scaffolding for the new invariants
- [ ] Add `backend/tests/test_hardening.py` covering: H1 (startup-fail on missing JWT_SECRET), H2 (startup-fail on `*`+credentials), H3 (KeyError on missing DATABASE_URL in non-test), H4 (429 backoff respect), H8 (>30s statement returns 503), H10 (mortgage rate staleness log).
- [ ] Each test uses a temp env (`monkeypatch.setenv`/`unsetenv`) and asserts the failure path; no live network or DB required for the config/startup tests.
- [ ] Acceptance: `pytest backend/tests/test_hardening.py -v` green; CI (if present) gates merges.

## Out of scope (follow-up plans)
- Multi-worker uvicorn / horizontal scale (constrained by mini-PC memory; revisit when host upgrades).
- WAF, bot-mitigation, CDN — assume the mini-PC sits behind whatever router the operator has; not the app's concern.
- Live rate providers (RDA, API banks) — parent plan T1 keeps env-based config + monthly manual refresh; a live feed is a separate piece of work.
- OAuth/SSO — username/password + email-verify flow already exists; enlarging auth surface is not needed for POC.
- Full audit log of admin mutations — no admin surface exists yet.

## Risks & failure modes OF THE HARDENING ITSELF
- **H6 (cookie migration)** could break the existing `UserFavoritesTab` if any fetch path forgets `credentials: 'include'`. Mitigation: a single shared `apiFetch()` wrapper replaces every raw `fetch` call.
- **H2 (CORS fail-closed)** could lock the operator out if the frontend origin changes. Mitigation: `.env.example` documents `CORS_ORIGINS` and the `ALLOW_INSECURE_CORS` escape hatch.
- **H5 (no silent excepts)** could surface a flood of previously-hidden warnings — expect a loud first week. Mitigation: the `etl_run_log` severity lets P0/P1 issues stay alarmable while P2 stays a daily digest.
- **H8 (30s statement timeout)** could abort long-running aggregation queries that are legitimately slow. Mitigation: ETL scripts use a separate engine with a 600s (or no) statement timeout; only the API engine caps at 30s.
- **H13 (thread pool for AI)** could mask the real issue (single-worker memory). Mitigation: the audit step before raising workers, plus the circuit breaker, make sure the thread pool is a stop-gap not a license to pile.

## Validation plan
1. **Restart-survives-auth test:** with H1+H6 in place, log in, `docker compose restart backend`, refresh — session still valid. (Closes P1.)
2. **CORS-misconfig start test:** run with `CORS_ORIGINS=*` and no escape hatch → backend exits non-zero with a logged reason. (Closes P2.)
3. **Secrets-in-source audit:** `git grep -E "realestate_user:realestate_pass" backend` returns 0; `docker compose config` resolves `${DATABASE_URL}` correctly. (Closes P3.)
4. **429 replay test:** unit test in `test_hardening.py` feeds a mock 429 + `Retry-After: 2` and asserts one retry, no hang. (Closes P4.)
5. **Silent-failure capture:** inject malformed raw_json → `etl_run_log` row inserted, profile shows the suburb with a DQ issue, no blank-field silent insert. (Closes P5.)
6. **Statement-timeout test:** a route forcing `pg_sleep(31)` returns 503 within ~30s, worker free. (Closes P7.)
7. **LocalStorage token audit:** `grep -rn "localStorage.getItem('token')" src` returns 0; `document.cookie` shows no readable `access_token` post-login. (Closes P8.)
8. **Stale-rate log:** startup logs contain `default_mortgage_rate_using_env=5.90`, `fetched_at=…`. (Closes P9.)
9. **Redis-persisted rate limit:** restart backend, banned IP counter still blocks further attempts. (Closes P10.)
10. **Structured-log grep:** `docker logs realestate-backend 2>&1 | grep request_id | head -5` returns JSON lines with all required keys; a forced 500 returns the `request_id` to the client. (Closes P12/P14.)
11. **AI concurrency:** trigger `/api/insights` for one suburb; simultaneously trigger `/api/suburbs/{id}` for another → both return within 5s. (Closes P15.)
12. **Re-run full test suite:** `pytest backend/tests/` green including new `test_hardening.py`.

## Open questions for the implementer
- H6: keep the `Authorization: Bearer` header path for non-browser API clients (curl, future mobile app), or fully cookie-only? Recommendation: keep both — header for `X-Internal-Client: 1` marked callers, cookie for browsers.
- H13: raise the front-container memory cap from 256M (`docker-compose.yml:18`) to e.g. 1G to allow the AI thread pool headroom? Recommendation: yes, document the new cap and the reason.
- H14: does the operator want scraping-policy attribution visible in the UI (a "Data sources" page)? Recommendation: yes, but as a P3 follow-up, not this plan.
