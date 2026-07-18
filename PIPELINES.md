# ETL Pipeline Architecture — Real Estate Suburb Data Platform

Version: `v3-post-merge` (2026-07-18)
Total pipelines: 12 active (down from 22 pre-merge)

---

## Architecture Principles

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐
│   EXTRACT    │ → │    TRANSFORM      │ → │     LOAD     │
│ (raw tables) │    │ (staging tables)  │    │ (final table) │
└──────────────┘    └──────────────────┘    └──────────────┘
```

Only pipeline 1-2-3 follows full EXTRACT→STAGING→FINAL. All other pipelines 
are single-stage writes because they enrich from external sources (OSM, ABS)
that have already undergone their own QA.

---

## Pipeline Inventory

### TIER 1: SCHEDULED (via `v3_scheduler.py` — monthly)

| # | Pipeline | Target | Runtime | Depends On |
|---|----------|--------|---------|------------|
| 1 | `run_v3_extract.py` | `suburbs_raw_v3` | ~30-60 min | `suburbs_all` seed |
| 2 | `run_unpack.py` | `suburbs_unpacked_v3` | ~5-10 min | Pipeline 1 |
| 3 | `enrich_from_unpacked.py` | `suburbs_ui_v3` | 2-5s | Pipeline 2 |
| 4 | `etl_osm_enrich.py` | `suburbs_ui_v3` (OSM cols) | 2-5 min | Pipeline 3 |
| 5 | `etl_abs_social_housing.py` | `suburbs_ui_v3` (G37) | 3-5 min | ABS DataPack |
| 6 | `etl_abs_building.py` | `suburbs_ui_v3` (building_approvals) | 10-30s | ABS API 8731.0 |
| 7 | `etl_cadastre_discovery.py` | `data_sources` | 30-60s | None |

### TIER 2: SCHEDULED (separate cron)

| # | Pipeline | Target | Schedule | Runtime | Depends On |
|---|----------|--------|----------|---------|------------|
| 8 | `nightly_compute.py` | `suburbs_ui_v3` (boundary/block/lot) | Daily, 1 state/night | 3min/state | Pipeline 4 |

### TIER 3: MANUAL / ONE-TIME

| # | Pipeline | Target | Trigger | Runtime | Notes |
|---|----------|--------|---------|---------|-------|
| 9 | `etl_abs_census.py` | `suburbs_ui_v3` (ABS demo) | Manual | 5-10min | Sets `abs_demographics_sourced=True` |
| 10 | `etl_nsw_cadastre.py` | `cadastral_parcels` | Manual | 2-5min/suburb | NSW only |
| 11 | `etl_nsw_planning_rules.py` | `suburbs_ui_v3` (min lot) | Manual | 30-60s/50 | NSW only, LIMIT 50 |

### TIER 4: ON-DEMAND (API endpoints)

| # | Endpoint | Target | Trigger |
|---|----------|--------|---------|
| 12 | `/api/suburbs/{id}/properties` | `property_listings` | First-time suburb visit (lazy) |
| 13 | `/api/analyze-suburb` | `suburbs_ui_v3` (ai_insights) | Authenticated user |
| 14 | `/api/suburbs/{id}/news-sentiment` | `suburbs_ui_v3` (news_sentiment) | Authenticated user |

---

## REMOVED / MERGED PIPELINES

| Old Pipeline | Disposition | Reason |
|---|---|---|
| `etl_transform_v3.py` | Deprecated (no-op) | Superseded by `enrich_from_unpacked.py` |
| `compute_derived_indicators()` | Migrated to `etl_abs_building.py` | Duplicate logic |
| `etl_national_subdivision_proxies.py` | Merged into `nightly_compute.py` | Duplicate OSM lot-size logic |
| `compute_avg_block_sqm()` (in `etl_osm_enrich.py`) | Migrated to `nightly_compute.py` | Duplicate block-size logic |
| `etl_infra_zoning.py` (fetch_zoning_changes) | Removed (returns `[]`) | No live zoning API |
| `predictive_ai_engine.py` | Disabled (`DEMO_MODE=False`) | Demo-only, gated |
| `micro_scraper_v4.py` | No-op stub | No live rate API |
| `ai_sentiment.py` | Stateless module | Called by `main.py`, persists via caller |

---

## DATA LINEAGE MAP

```
                     OnTheHouse (web scraping)
                            │
       ┌────────────────────┼────────────────────┐
       │                    │                    │
  suburbs_raw_v3     suburbs_unpacked_v3   suburbs_ui_v3
  (EXTRACT)           (STAGING)             (FINAL — 200+ columns)
       │                    │                    │
       └────────┬───────────┘                    │
                │                                │
         enrich_from_unpacked.py ────────────────┘
         (bulk SQL UPSERT, 2-5s)

External data sources:
  ┌─ OSM (planet_osm_point/polygon) ─── etl_osm_enrich.py ────────► suburbs_ui_v3
  │     worship, shelter, construction, greenfield, brownfield
  │
  ├─ ABS Census 2021 DataPack ── etl_abs_census.py ───────────────► suburbs_ui_v3
  │     population, median_age, demographics (sets sourced flag)
  │
  ├─ ABS Census G37 ── etl_abs_social_housing.py ─────────────────► suburbs_ui_v3
  │     social_housing_pct, public_housing_dwellings
  │
  ├─ ABS Building Approvals 8731.0 ── etl_abs_building.py ────────► suburbs_ui_v3
  │     building_approvals_12m, infrastructure_investment
  │
  ├─ OSM building footprints ── nightly_compute.py ───────────────► suburbs_ui_v3
  │     avg_block_sqm, min_approved_subdivision_sqm, boundary_geom
  │
  ├─ NSW ePlanning API ── etl_nsw_planning_rules.py ──────────────► suburbs_ui_v3
  │     min_approved_subdivision_sqm (NSW only)
  │
  └─ NSW Spatial Cadastre ── etl_nsw_cadastre.py ─────────────────► cadastral_parcels
        cadastral_source, cadastral_last_synced
```

---

## SCHEDULE TIMELINE (monthly)

```
Day 1, 02:00:
  ├─ Full monthly cycle (all 13,150 suburbs)
  │   ├─ [Step 1/7] Seed pending raw (>25d old)        ~10 sec
  │   ├─ [Step 2/7] Extract (Playwright, 2000/batch)    ~30-60 min
  │   ├─ [Step 3/7] Unpack raw → columnar               ~5-10 min
  │   ├─ [Step 4/7] Enrich columnar → suburbs_ui_v3     ~2-5 sec
  │   ├─ [Step 5/7] OSM social-infra enrichment         ~2-5 min
  │   ├─ [Step 6/7] ABS social housing + building       ~5-10 min
  │   └─ [Step 7/7] Cadastre catalogue survey           ~30-60 sec
  │   Total: ~1-1.5 hours
  │
  └─ 04:00 Nightly compute: that day's state (pipeline 8, ~3 min)

Every night, 03:00:
  └─ Nightly compute: one state (pipeline 8, ~3 min)
     Boundary geom populated automatically on first run

Manual (when needed):
  ├─ etl_abs_census.py         (new Census release)
  ├─ etl_nsw_cadastre.py        (cadastral updates)
  └─ etl_nsw_planning_rules.py  (NSW planning changes)
```

---

## SCHEDULE (v3_scheduler.py)

Single monthly cycle replaces the old monthly-metro + quarterly-national split.
All 13,150 suburbs are processed every 30 days. Change detection ensures only
actually-stale data is re-processed at each layer.

```
Interval: 30 days (configurable via CYCLE_INTERVAL)
Re-extract age: 25 days (REFRSH_AGE_DAYS)
Extract batch: 2000 suburbs per run
CLI: python v3_scheduler.py --run | --daemon
```

---

## COLUMN OWNERSHIP (who writes what)

| Column Group | Owner Pipeline | Protection |
|---|---|---|
| Price, rent, yield, stock | `enrich_from_unpacked.py` | ON CONFLICT UPDATE |
| Demographics (pop, age, income) | `enrich_from_unpacked.py` | Respects `abs_demographics_sourced` flag |
| Demographics (ABS authoritative) | `etl_abs_census.py` | Sets `abs_demographics_sourced=true` |
| Social housing | `etl_abs_social_housing.py` | Sole writer |
| Worship, shelter, construction | `etl_osm_enrich.py` | Sole writer |
| Building approvals, infra tier | `etl_abs_building.py` | Sole writer |
| Block size, min lot, boundary | `nightly_compute.py` | Targets only NULLs |
| NSW min lot (gov) | `etl_nsw_planning_rules.py` | NSW only |
| AI insights, highlights | `main.py` on-demand | Service-specific |
| News sentiment | `main.py` on-demand | Service-specific |

---

## MERGED PIPELINE DETAILS

### Merge: `etl_national_subdivision_proxies.py` → `nightly_compute.py`

Both computed `min_approved_subdivision_sqm` via P10 building footprint / 0.6.
`nightly_compute.py` is more accurate (uses boundary_geom, not point buffer)
and has a daily schedule. The national proxies script was manual-only and
used the same OSM source. **Deleted.**

### Merge: `compute_avg_block_sqm()` → `nightly_compute.py`

Both computed `avg_block_sqm` via P50 / 0.6. `nightly_compute.py` uses
pre-stored `boundary_geom` polygons (0.7ms/suburb) vs the old 1500m point
buffer (23ms/suburb). **Deleted from etl_osm_enrich.py.**

### Merge: `compute_derived_indicators()` → `etl_abs_building.py`

Both wrote `building_approvals_12m` and `infrastructure_investment`.
`etl_abs_building.py` uses real ABS API data (with fallback). The old
function used crude heuristics (`sold * SDR * 0.15`). **Deprecated.**

---

## TIME ESTIMATES

| Operation | Estimated |
|---|---|
| Full monthly cycle | 1-1.5 hours |
| Extract (2000 suburbs) | 30-60 min |
| Unpack + Enrich | 5-10 min |
| OSM enrichment | 2-5 min |
| ABS social housing | 3-5 min |
| ABS building approvals | 10-30 sec |
| Cadastre catalogue | 30-60 sec |
| Nightly compute (one state) | 2-3 min |
| Nightly compute (all states, fresh) | 15-20 min |
| Nightly compute (incremental) | <1 min |
| ABS census (all states) | 10-15 min |

---

## SAFETY GUARDS (nightly_compute)

| Guard | Value |
|---|---|
| Advisory lock | `pg_try_advisory_lock` prevents concurrent runs |
| Statement timeout | 30s per batch |
| Max parallel workers | 2 per query |
| Building LIMIT | 5000 per suburb (LATERAL subquery) |
| Batch size | 25 suburbs |
| Runtime cap | 2.5 hours (auto-stop) |
| Incremental | Only processes `avg_block_sqm IS NULL` rows |
| Boundary pre-pop | One-time, idempotent, fills only NULLs |
