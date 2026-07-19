# Mortgage Band & Days-on-Market — Data Lineage, Quality & TODOs

**Goal:** Fully account for every suburb profile metric's source → transformation → display, fix the generic `$1800 - $2399` mortgage band and the NULL days-on-market column, identify new authoritative sources to lift, and remediate the data-quality gaps with a concrete TODO list.

**Parent plan:** `/home/aksai/projects/realestate/.kilo/plans/1784423405957-mortgage-dom-data-lineage-quality-plan.md`

## Confirmed decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Mortgage display | Show a **computed P&I monthly repayment** as primary; keep ABS census band as a labelled secondary reference (industry-confirmed: realestate.com.au, propertyvalue.com.au, Domain all show a single computed number, NOT a band; the `$1800 - $2399` string is 2021 ABS census text that every site shows verbatim). |
| 2 | Mortgage formula | 80% LVR (20% deposit), 30-yr term, current AU rate, standard annuity `M = P·r(1+r)ⁿ/((1+r)ⁿ−1)`. Matches realestate.com.au/propertyvalue.com.au methodology. |
| 3 | Days on market (interim) | Derive `DOM ≈ 365 × listings ÷ annual_sales` from existing OnTheHouse `current_sale_listing_count` + `house_sold_12m` (inventory turnover heuristic). |
| 4 | Days on market (target) | Lift true DOM from a second source (Domain suburb profile "Avg days on market" table + realestate.com.au/propertyvalue.com.au "Average Days on Market" panel) and reconcile against the heuristic on a DQ score. |
| 5 | Rate source | Treat `6.20%` as a legacy hardcoded value. Move it to an env var `DEFAULT_MORTGAGE_RATE` (default `5.90%` = current Big 4 SVR avg post-RBA Aug 2025 cut to 3.60%) so it is refreshable without code changes. Full live-rate feed is out of scope for this plan. |
| 6 | Median price freshness | Keep OnTheHouse as primary AVM/sale-price source; add Domain/realestate.com.au suburb-profile median as a cross-validation source stored in a new `external_validation` JSONB column with `source` + `fetched_at` lineage. |
| 7 | Provenance per metric | Add a `metric_provenance` JSONB column on `suburbs_ui_v3` recording `{field: {source, fetched_at, transform, confidence}}` for every externally-sourced metric so lineage is auditable, mirroring the existing `abs_sourced_fields` pattern. |
| 8 | DQ scoring | Add explicit DQ penalties for: stale rate (>180 days), missing `estimated_mortgage_repayment` despite `house_median_price` present, DOM > 365 (heuristic degenerate), median price > 20% deviation from external validation source. Reuse existing `dq_issues`/`dq_score` machinery. |

## Current state (from code inspection)

- **Model:** `backend/models_v3.py` — `SuburbUIV3` has `typical_mortgage_band` (String, line 106) scraped from text, `house_days_on_market` + `unit_days_on_market` (Integer, lines 74, 85) ALWAYS NULL. Added `estimated_mortgage_repayment` (Float) column in this session. DQ columns `dq_issues`, `dq_score`, `transform_version`, `last_updated`, `source_raw_id`, `transform_run_id`, `transform_timestamp` exist for lineage (lines 203-209).
- **ETL pipelines (sources → transforms):**
  - OnTheHouse scrape → `suburbs_raw_v3.raw_json` (`backend/etl_extract_v3.py`, `parallel_scraper.py`, `micro_scraper_v4.py`).
  - JSON → columnar `suburbs_unpacked_v3` (`backend/unpack_json_to_table.py`): 16 market metrics + history, census demographics, **description regex parsing extracts `typical_mortgage_band`** (line 193 regex `likely\s+to\s+be\s+repaying\s+(\$[\d,]+\s*-\s*\$[\d,]+)\s+per\s+month`), property counts.
  - Columnar → UI `suburbs_ui_v3` (`backend/enrich_from_unpacked.py`): pure SQL upsert. **Now computes `estimated_mortgage_repayment` and `house_days_on_market`** (added in this session).
  - ABS Census 2021 (`backend/etl_abs_census.py`): G01/G33/G32 SAL DataPacks — overrides OnTheHouse demographics (population, age, tenure). Sets `abs_demographics_sourced=True`, `abs_sourced_fields` JSON.
  - ABS Social Housing G37 (`backend/etl_abs_social_housing.py`): `public_housing_dwellings`, `community_housing_dwellings`, `social_housing_pct`.
  - OSM planet (`backend/etl_osm_enrich.py`): worship counts, shelter/community/retirement, construction/greenfield/brownfield sqkm.
  - ABS Building Approvals (`backend/etl_abs_building.py`): `building_approvals_12m`.
  - ACARA schools (`backend/import_acara.py`): `schools`, `school_quality`, `avg_icsea`, `top_school_name`.
  - NSW Planning/Cadastre (`backend/etl_nsw_planning_rules.py`, `etl_nsw_cadastre.py`, `etl_cadastre_discovery.py`): cadastral / subdivision precedent (NSW only).
  - VAP ETF benchmark (`backend/main.py` `get_vap_etf()`): macro benchmark for AI committee.
- **API surface returning the metrics:** `/api/suburbs/{id}` (`main.py:940s`), `/api/insights` (`1258`), `/api/v3/suburbs` (`1611`, batch), `/api/v3/suburbs/{id}` (`1744`), `/api/mortgage-rate` (`1585`, returns hardcoded `6.20%`).
- **Frontend display:** `src/App.tsx:942-946` (suburb profile Mortgage card), `src/App.tsx:1107` (explore table), `src/components/InstitutionalV3Panel.tsx:180` (institutional). `src/data/suburbs.ts:61,132` types. All updated in this session to prefer `estimatedMortgageRepayment`.
- **DQ report:** `backend/etl_dq_report_v3.py` already flags `days_on_market` missing (line 74-75). No check for mortgage repayment, no stale-rate check, no external cross-validation.
- **Migration/new column:** `backend/migrate_mortgage_repayment.py` (created in this session) — adds `estimated_mortgage_repayment`, backfills repayment + a heuristic DOM backfill.

## Metric-by-metric data lineage & quality scorecard

Legend: 🟢 good · 🟡 derivable/gap · 🔴 missing/wrong

### A. Mortgage repayment

| Metric | Display | Source (current) | Transform | Quality | Issue |
|---|---|---|---|---|---|
| `typical_mortgage_band` (String, `"$1800 - $2399/mo"`) | Secondary | ABS Census 2021 (via OnTheHouse description text) | Regex scrape `unpack_json_to_table.py:193-194` | 🔴 misleading | Generic ABS band reflects 2021 mortgages on old balances — not a today-buyer's repayment. **Also literally the same text shown on competitor sites** (propertyvalue.com.au, Domain, OTH all show census text verbatim — so it is not wrong, just not a "mortgage estimate"). |
| `estimated_mortgage_repayment` (Float, monthly $) | Primary (NEW) | Derived from `house_median_price` | SQL annuity in `enrich_from_unpacked.py`, rate 6.20% hardcoded | 🟡 disclaimable | Formula mathematically verified vs external calculators (within $5). Median price within 1-2% of CoreLogic/OpenAgent. **But rate is ~50bp above current Big 4 SVR (~5.50-5.90% post Aug 2025 RBA cut to 3.60%).** |
| `/api/mortgage-rate` (`main.py:1585`) | Frontend slider default | Hardcoded `4.35` cash rate + `1.85` margin = `6.20%`, `source="static_default"`, `stale_indicator=True` | None | 🔴 stale | Hardcoded payload; `stale_indicator` admits it but no refresh mechanism. |

### B. Days on market

| Metric | Display | Source (current) | Transform | Quality | Issue |
|---|---|---|---|---|---|
| `house_days_on_market` | Suburb profile + V3 panel | NONE populating it | Now derived: `365 × current_sale_listing_count / house_sold_12m` in `enrich_from_unpacked.py` | 🟡 heuristic | Verified vs real data: Point Cook 28d, Wyndham Vale 31d, Cranbourne 19-21d (propertyvalue.com.au, YIP/CoreLogic, OpenAgent). Heuristic directionally correct but: (a) on-market-only inventory excludes withdrawn/expired listings, (b) sharper/colder markets produce degenerate DOM, (c) no unit DOM computed. |
| `unit_days_on_market` | V3 panel | NONE | None — not in enrich SQL | 🔴 missing | Column exists but never written. Need `unit_sold_12m` pulled through enrich (currently only `house_sold_12m` is selected). |

### C. Median prices / rents (reference for mortgage + DOM denominators)

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `house_median_price` | OnTheHouse `house_sale_price` (fallback `house_median_value` AVM) | `COALESCE` in `enrich_from_unpacked.py:46` | 🟢 good — verified within 1-2% of CoreLogic/PropTrack (Point Cook $836.5K vs property.com.au $825.5K; Wyndham Vale $610K = YIP exact) |
| `house_median_rent` | OnTheHouse `rent_h` (12-mo asking rent) | Direct passthrough | 🟢 good — verified (Wyndham Vale $450/wk = YIP exact) |
| `price_to_rent_ratio` | Derived | `median_price / (weekly_rent × 52)` in enrich SQL line 79 | 🟢 good |
| `unit_median_price` / `unit_median_rent` / `unit_sale_price` | OnTheHouse | Direct | 🟢 good |

### D. Market velocity (DOM denominators)

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `house_stock_on_market` (= `current_sale_listing_count`) | OnTheHouse `suburbProperty.detail.currentSaleListingCount` | Direct int cast (`unpack_json_to_table.py:325`) | 🟡 undercount | Code comment at `enrich_from_unpacked.py:89-90` admits OnTheHouse "significantly undercounts compared to Domain/REA" and applies a `×3` heuristic for vacancy rate but NOT for DOM. |
| `house_sold_12m` | OnTheHouse `sold_12m_h` metric series | Latest of 10-slot history | 🟢 good — verified (Point Cook 1157 houses sold/12mo matches propertyvalue.com.au) |

### E. Demographics (already authoritative — for context)

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `population_2021`, `median_age`, `owner_occupier_rate`, `investor_rate` | ABS Census 2021 SAL DataPacks (`etl_abs_census.py`) | Override OnTheHouse; `abs_demographics_sourced=True` | 🟢 authoritative |
| `social_housing_pct`, renter dwellings | ABS Census 2021 G37 (`etl_abs_social_housing.py`) | Override | 🟢 authoritative |
| `predominant_age_group`, `predominant_occupation`, `predominant_household`, `income_band` | OnTheHouse (extracted from ABS-quoting description text) or ABS direct | Regex/title-case | 🟡 mixed — should be reconciled to ABS G01/G33 directly |

### F. Social infrastructure / future-growth (OSM)

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `worship_*`, `shelter_count`, `community_centre_count`, `retirement_home_count` | OSM `planet_osm_point/polygon` via `realestate-osm-updater` | 2500m radius buffer around suburb centroid, `ST_DWithin` counts (`etl_osm_enrich.py`) | 🟡 spatial — radius approximation documented |
| `construction_sqkm`, `greenfield_sqkm`, `brownfield_sqkm`, `building_construction_count` | OSM landuse tags | Polygon area clip to buffer | 🟡 same radius approximation |

### G. Schools

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `schools`, `school_quality`, `avg_icsea`, `top_school_name` | ACARA (`import_acara.py`) | Spatial join | 🟢 authoritative |

### H. Cadastral / subdivision (NSW only)

| Metric | Source | Transform | Quality |
|---|---|---|---|
| `approved_subdivisions_12m`, `min_approved_subdivision_sqm`, `cadastral_*` | NSW Planning Portal / data.gov.au (`etl_nsw_planning_rules.py`, `etl_nsw_cadastre.py`) | Direct | 🟡 NSW-only — VIC/QLD etc. unsourced |

## New sources to lift (recommended)

| # | Source | Licence / Access | Metrics to lift | Why |
|---|---|---|---|---|
| N1 | **realestate.com.au / propertyvalue.com.au suburb profile** (PropTrack / Cotality AVM) | Public, scrape (rate-limited, 429 seen) | `medianPrice`, `12mGrowthPct`, `medianRent`, `medianRentGrowth`, `avgDaysOnMarket`, `auctionClearanceRate`, `avgVendorDiscount`, `compoundingGrowthRate` | **True DOM** (verified: Point Cook 28d, units 41d), discounted-from-listing %, clearance rate — none of which we have |
| N2 | **Domain.com.au suburb profile** | Public, scrape | Per-bedroom `medianPrice`, `avgDaysOnMarket`, `clearanceRate`, `soldThisYear` (table on the page) | Independent DOM cross-validation; Channel-side data via Domain Group / Cotality |
| N3 | **CoreLogic / Cotality free suburb reports** (yourinvestmentpropertymag.com.au syndicates CoreLogic) | Free public via YIP | `medianHousePrice`, `annualCapitalGrowth`, `avgDaysOnMarket`, `rentalYield`, `salesCount` | Authoritative for median price cross-check (Wyndham Vale $610K exact match) |
| N4 | **RBA statistical tables F1.1 / F2** (cash rate, indicator lending rates) | CC BY (free, CSV download) | `cash_rate`, `avg_variable_owner_occupier_rate`, `avg_big4_svr` | Closes the `6.20%` staleness gap; refreshes monthly |
| N5 | **ABS Census 2021 G33 (income) & G01 (population/age)** currently partially used | CC BY 4.0 | `predominant_income_band`, `median_age`, `predominant_age_group` directly (currently regex-parsed from description text that quotes ABS) | Removes fragile regex dependency; makes these `abs_demographics_sourced=True` |
| N6 | **ABS Building Approvals 8731.0** | CC BY 4.0 | `building_approvals_12m` state/LGA roll-up | Replaces/augments per-suburb inferred counts |
| N7 | **data.gov.au state land registries** (NSW already done; add VIC land.vic.gov.au, QLD) | Open data | Subdivision precedent, cadastral for VIC/QLD | Closes H gap |
| N8 | **APRA / Big 4 bank SVR pages** (CBA/Westpac/NAB/ANZ) | Public sites | Average of Big 4 SVR | Matches realestate.com.au methodology exactly (their disclaimer states: "interest rate applied is the average of the big 4 bank's Standard Variable Rates") |

**Priority for THIS plan's TODOs:** N1 (DOM), N4 (rate), N2/N3 (median price cross-validation). N5-N8 are valuable but can be follow-ups.

## Scope (in / out)

**In scope:**
- Documented lineage table above (this file).
- Make mortgage rate configurable via `DEFAULT_MORTGAGE_RATE` env var (default `5.90%`).
- Add `metric_provenance` JSONB lineage column.
- Implement true-DOM ETL from one external source (N1 or N2) with scraped + fallback heuristic.
- Add `external_validation` JSONB for median price cross-checks (N3).
- Extend DQ report: stale rate, missing repayment, degenerate DOM, median price deviation > 20%.
- Compute `unit_days_on_market` from `unit_sold_12m`.
- Wire frontend to show DOM, mortgage estimate, and a "data source + freshness" footnote on the cards.

**Out of scope (follow-up plans):**
- Live RDA feed scheduler for SVR/rate refresh (N4 batch monthly is enough for now — one-shot import).
- VIC/QLD cadastral (N7).
- Direct ABS income/age replacement (N5) — current ABS override path works.

## TODOs (ordered)

### T1 — Mortgage rate: env-config + refresh from RBA/big-4 (N4 + N8)
- [ ] Add `DEFAULT_MORTGAGE_RATE` env var read in `models_v3.py`, `enrich_from_unpacked.py` (replace hardcoded `0.062`), `main.py` `/api/mortgage-rate` endpoint, `migrate_mortgage_repayment.py`, `backend/buyfinder.py` (`compute_repayment`), `backend/main.py` ROI calc (`1523`).
- [ ] Default value `5.90` (= current Big 4 SVR avg, post Aug 2025 cut). Keep `4.35 + 1.85` breakdown in `/api/mortgage-rate` payload but read base from env (`DEFAULT_CASH_RATE=3.60`, `RETAIL_MARGIN=2.30` → `5.90`).
- [ ] One-shot backfill of `estimated_mortgage_repayment` via `migrate_mortgage_repayment.py` after the env change (re-compute at new rate).
- [ ] Acceptance: `GET /api/mortgage-rate` returns `effective_mortgage_rate=5.90`, `source="env_default"`, `stale_indicator=False`; existing buyfinder repayment test still passes (rates are inputs, not asserted).

### T2 — True days-on-market ETL from external source (N1 / N2)
- [ ] Decide N1 vs N2 for primary DOM source. Recommended: **N2 (Domain)** — less aggressive 429 than REA (REA returned 429 in this session), Domain suburb-profile has a per-bedroom DOM table. Fall back to N1 (realestate.com.au via `propertyvalue.com.au` path) if Domain blocks.
- [ ] Create `backend/etl_external_market.py` mirroring `etl_abs_census.py` structure: fetch per-suburb HTML, parse `medianHousePrice`, `avgDaysOnMarketHouse`, `avgDaysOnMarketUnit`, `clearanceRate`, `vendorDiscount`, `soldThisYear`.
- [ ] Store in NEW columns: `external_dom_house` (Integer), `external_dom_unit` (Integer), `external_median_price` (Float), `external_source` (String: `"domain"` | `"propertyvalue"`), `external_fetched_at` (DateTime).
- [ ] Reconciliation: `house_days_on_market = COALESCE(external_dom_house, heuristic_dom)` where `heuristic_dom = 365 × listings / sold_12m`. Same for units.
- [ ] Flag in `dq_issues` when `|heuristic_dom - external_dom| > 30` days [severity `warning`, issue `dom_mismatch`].
- [ ] Acceptance: Wyndham Vale `house_days_on_market` populated to ~31 (matches YIP/CoreLogic exact); Point Cook ~28; Cranbourne ~19. Empty for suburbs not yet scraped.

### T3 — Median price cross-validation (N3)
- [ ] Add column `external_validation` JSONB `{"corelogic": {"house_median": ..., "fetched_at": ...}, "domain": {...}}`.
- [ ] Schedule (or one-shot) fetcher that pulls CoreLogic-syndicated data from yourinvestmentpropertymag.com.au or Domain and stores into `external_validation`.
- [ ] DQ rule: if `|house_median_price - external_validation.corelogic.house_median| / house_median_price > 0.20`, append `dq_issues` `{field: house_median_price, issue: external_deviation, severity: error, value: deviation%}`.
- [ ] Acceptance: a few suburbs where our median > 20% off CoreLogic surface in `etl_dq_report_v3.py --detail`.

### T4 — Provenance / lineage per metric (decision 7)
- [ ] Add `metric_provenance` JSONB column on `suburbs_ui_v3`.
- [ ] Populate on the final enrich pass: keys = field names (`house_median_price`, `estimated_mortgage_repayment`, `house_days_on_market`, ...), values = `{source, fetched_at, transform, confidence}`.
- [ ] Examples: `house_median_price: {source: "onthehouse:house_sale_price", transform: "COALESCE(sale_price, avm_value)", confidence: "high"}`; `house_days_on_market: {source: "domain:avgDaysOnMarket", transform: "direct", confidence: "high"} | {source: "heuristic_365×stock/sold", confidence: "medium"}`; `typical_mortgage_band: {source: "abs_census_2021_via_description_regex", confidence: "low_for_today_buyer"}.
- [ ] Acceptance: `SELECT metric_provenance FROM suburbs_ui_v3 WHERE id = 'VIC_WYNDHAM_VALE_3024'` returns full lineage for every externally-quoted metric.

### T5 — `unit_days_on_market` derivation
- [ ] Pull `unit_sold_12m` through the enrich SQL SELECT (currently absent — line `u.house_sold_12m` only).
- [ ] Compute `unit_days_on_market = ROUND(365.0 × current_sale_listing_count_unit / unit_sold_12m)` — but `current_sale_listing_count` is not property-type split in OnTheHouse. Use `current_sale_listing_count × (unit_total_properties / (house + unit))` as a split proxy OR fall back to N1/N2 per-unit DOM directly.
- [ ] Add to enrich INSERT column list + ON CONFLICT UPDATE clause.
- [ ] Update `migrate_mortgage_repayment.py` backfill to also handle unit DOM.
- [ ] Acceptance: `unit_days_on_market` populated for ≥80% of enriched suburbs.

### T6 — DQ report expansion
- [ ] `backend/etl_dq_report_v3.py`: add checks →
  - `estimated_mortgage_repayment IS NULL AND house_median_price > 0` → severity `error`, issue `missing_mortgage_estimate`.
  - `days_on_market > 365` → severity `warning`, issue `dom_degenerate`.
  - `|heuristic_dom - external_dom| > 30` → `dom_mismatch`.
  - `|house_median_price - external_median_price| / house_median_price > 0.20` → `external_deviation`.
  - `mortgage_rate_age > 180 days` (read `transform_timestamp` or `metric_provenance.interest_rate.fetched_at`) → `stale_rate`.
- [ ] Print these in `--detail` and `--all` modes.
- [ ] Acceptance: `python etl_dq_report_v3.py --detail` shows the new check types.

### T7 — Frontend: source + freshness footnote
- [ ] On the Mortgage card and DOM card in `src/App.tsx` and `src/components/InstitutionalV3Panel.tsx`, render a small "Source: {source} · {relative time}" line under each value, reading from `metric_provenance` returned via a new API field.
- [ ] Also expose `historicalMortgageBand` labelled as "ABS 2021 census" (existing `typicalMortgageBand`) below the computed repayment so the legacy figure stays visible + correctly attributed.
- [ ] Acceptance: user can see, at a glance, that the computed `$2,989/mo` is "Estimated P&I @ 5.90%, 20% deposit, 30y" and the `$1800 – $2399` is "ABS 2021 census of existing mortgages".

### T8 — API: return new lineage & DOM fields
- [ ] In all 4 endpoints returning `typicalMortgageBand` (`main.py:954, 1258, 1661, 1794`) and `*_daysOnMarket` (`937, 947, 1633, 1644, 1766, 1777`), add `estimatedMortgageRepayment` (done), `mortgageRate` (from env), `mortgageRateSource` ("env_default" | "rba_big4_avg"), `metricProvenance` (for the visible subset).
- [ ] Acceptance: `GET /api/suburbs/{id}` JSON now includes `estimatedMortgageRepayment`, `mortgageRate`, `houseDaysOnMarket` (non-null), `metricProvenance`.

## Risks & failure modes
- **Scrape 429s (seen for REA this session):** prefer Domain / propertyvalue / YIP for any external fetch; respect robots.txt and add jittered delays + cache. Treat external fetch failure as a non-fatal DQ warning, fall back to the heuristic DOM.
- **Heuristic DOM degenerate cases:** cold markets with `current_sale_listing_count >> house_sold_12m` produce DOM > 365 → already planned as a DQ warning, not a hard failure.
- **Rate drift:** if `DEFAULT_MORTGAGE_RATE` stale, repayment estimates drift silently — mitigate via the `stale_rate` DQ check + visible "rate @ X% as of {date}" footnote.
- **Median price mismatch > 20%:** could mean our source is stale or the external source is at a different sale-date cutoff → surfaced as `external_deviation` DQ issue, not auto-overridden. Manual review path only.

## Validation plan
1. Run the existing buyfinder tests (`backend/tests/test_buyfinder.py`) after env-rate change → ensure rate is an input and tests still green.
2. Run `python migrate_mortgage_repayment.py` on a dev DB → confirm column add + backfill row count.
3. Run `python enrich_from_unpacked.py --changed` → confirm `estimated_mortgage_repayment` and `house_days_on_market` columns populate for sample suburbs.
4. Spot-check 3 suburbs against verified external data above: Wyndham Vale repayment ≈ $2,989/mo @ 5.90% (recalc loan $488K → $2,890/mo, ~3% lower than 6.20%); DOM ≈ 31; Point Cook DOM ≈ 28; Cranbourne DOM ≈ 19.
5. Run `python etl_dq_report_v3.py --detail` → confirm new check categories present.
6. Load the profile UI → confirm the Mortgage card shows `${val}/mo` + "Source · as of" footnote, and ABS band is labelled.

## Open questions for the implementer
- T2: Confirm whether Domain suburb-profile scraping is permitted under their ToS for this internal POC; if not, switch primary to realestate.com.au via propertyvalue.com.au with retry/backoff for 429.
- T5: Is `current_rental_listing_count` split by house/unit available in OnTheHouse raw payload (it is not split in the unpacked model)? If not, accept the proxy split or rely on the external source for unit DOM entirely.
