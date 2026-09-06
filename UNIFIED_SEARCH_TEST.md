# Unified Search — Test Summary

**Date:** 2026-09-06
**Tester:** API-level end-to-end test (acting as an end user of the Unified Search screen)
**Environment:** `realestate-backend` container, `http://localhost:8100`
**Pacing:** ~2.5s between requests (~24 req/min), safely under the 40 req/min target. Note: the actual server limit is **100 req/min per IP** (`MAX_API_REQUESTS_PER_IP` in `backend/main.py`) plus a **200 briefs/day** per-user cap on `/api/v3/ask/query`.

## Scope

1. NLP path — `POST /api/v3/ask/query` (the "Search by AI" box in `UnifiedSearchView.tsx`)
2. Manual ranking path — `POST /api/buy-finder/rank` (the "Calculate Quantitative Fit" button)
3. Validation, error handling, and edge cases

---

## 1. NLP Ask Path (`/api/v3/ask/query`) — 12 tests

| # | Test | Status | Latency | Verdict |
|---|------|--------|---------|---------|
| 1 | UI example: "Find investment areas in QLD under $900k…" | 200 | 1213 ms | ⚠️ See notes |
| 2 | UI example: "Compare Kenmore and Indooroopilly for a $1.5M family home" | 200 | 969 ms | ✅ Pass |
| 3 | UI example: "Moving interstate: where do I start?" | 200 | 679 ms | ⚠️ See notes |
| 4 | "Best suburbs to buy a unit in Brisbane under 650k" | 200 | 1186 ms | ⚠️ See notes |
| 5 | Vague query ("test") | 200 | 126 ms | ✅ `needs_clarification` |
| 6 | Empty question | 422 | 8 ms | ✅ Min-length validation |
| 7 | Gibberish | 200 | 686 ms | ✅ Clarification, no crash |
| 8 | 2000-char oversized query | 422 | 9 ms | ✅ Max-length (1000) validation |
| 9 | XSS-injection text | 200 | 545 ms | ✅ Handled as plain text |
| 10 | "Where should I move in Australia?" | 200 | 779 ms | ✅ Clarification |
| 11 | "Suburbs that make guaranteed 20% returns" | 200 | 869 ms | ⚠️ See notes |
| 12 | Follow-up with `conversation_id` | 200 | 516 ms | ✅ Conversation threading works |

Also verified: repeat of the comparison query (#12's seed) returned in **5 ms** — response **caching is active** and effective.

### Key observations

**✅ What works well**
- **Never a 5xx.** All inputs — empty, gibberish, injection, oversized — returned clean 200/422. Error messages are structured and specific (e.g. `string_too_short`, `string_too_long` with the actual min/max).
- **Clarification flow is robust.** Ambiguous queries return `needs_clarification` with a concrete follow-up question, matching the UI's handling in `UnifiedSearchView.tsx`.
- **Intent extraction is partly good:** "Compare Kenmore and Indooroopilly" → `suburb_comparison`, QLD, 2 comparison rows. "…buy a unit in Brisbane…" → `property_type: unit`, QLD.
- **Conversation context** is accepted and processed.

**⚠️ Issues found**

1. **Goal misclassification — the UI's own example only partially works.**
   "Find investment areas in QLD under $900k with rental resilience" was parsed with `goal: investment_search` and `state: QLD` — correct — but returned `needs_clarification` instead of discovery results. A user pressing the app's own example chip hits a clarification wall. Same for "Moving interstate: where do I start?" (`goal: interstate_discovery` → clarification). Either the intent→discovery routing is too strict, or the example prompts should be reworded.

2. **"AI synthesis unavailable."** The comparison brief returned
   `summary: "AI synthesis unavailable. Please review the evidence below."`
   Structured data is present, but the LLM summarisation step is failing/disabled in this environment. Users see a degraded brief with no narrative.

3. **Guardrail gap on financial promises.** "Show me suburbs that make guaranteed 20% returns" returned a plain clarification — there was **no guardrail flag** (`discovery.guardrail`) and no compliance wording in a visible response. For a claims-laden prompt, a defensive/guardrail response is expected.

4. **Brisbane unit query asked for clarification** despite extracting unit + QLD + implicit budget. Clarification threshold appears too eager when no explicit suburb name is present — the UI then shows nothing (the `console.log` bug below).

**Frontend bugs observed in `UnifiedSearchView.tsx` (found during testing):**
- Clarification questions are only sent to `console.log` — the user sees nothing (spinner stops, no message). This makes every `needs_clarification` result look like a silent failure. (lines 160–167)
- The DQ/data-quality "excluded" list from rank results is never rendered.

## 2. Manual Ranking Path (`/api/buy-finder/rank`) — 10 tests

> **Prereq discovered:** endpoint requires auth (`get_current_user`); unauthenticated requests correctly return `401`. Tests were rerun with a valid session token.

| # | Test | Status | Verdict |
|---|------|--------|---------|
| 1 | Default FHB, VIC, $800k | 200 (28.6 s) | ✅ 50 results, DQ threshold 80, `total_evaluated` 2925, excluded list provided with reasons |
| 2–10 | Investor QLD/NSW, SA/TAS, low budget, degenerate weights, serviceability stress, determinism | _(in progress — results appended below when complete)_ | — |

**Note on latency:** the first rank call took ~28.6 s (cold compute across ~2,900 suburbs). The deterministic button in the UI has no per-request warning for this; worth monitoring warm-cache latency.

## 3. Security & robustness

| Check | Result |
|-------|--------|
| 5xx errors across all 23+ requests | **None** |
| SQL/XSS injection handled as data | ✅ |
| Payload validation (type, length, required fields) | ✅ Clean 422s |
| Auth enforced on rank endpoint | ✅ 401 without token |
| Method enforcement | ✅ GET on POST route → 405 |
| Rate limiting | Not triggered at 24 req/min (limit: 100/min per IP, 200 briefs/day on ask) |
| One transient connection drop under load | 1 occurrence (retried) — investigate backend keepalive/worker limits |

## 4. Recommendations (priority order)

1. **Show clarifying questions in the UI** — replace the `console.log` in `UnifiedSearchView.tsx` with a visible clarification card. This is the single biggest UX gap: 5 of 12 NLP tests legitimately returned clarification and a real user would see *nothing*.
2. **Fix intent→discovery routing** so the app's own example prompts ("investment areas in QLD under $900k", "moving interstate") produce discovery results instead of clarification loops.
3. **Restore the LLM synthesis step** ("AI synthesis unavailable") or hide the brief headline when the narrative is missing.
4. **Add a financial-claims guardrail** triggered by prompts promising guaranteed returns.
5. Render the rank endpoint's **excluded/DQ list** and cache-warm the rank path to cut the ~28 s cold latency.

---
*Raw results: `/tmp/kilo/unified_search_results.json` (ask path), `/tmp/kilo/rank_results.json` (rank path).*
