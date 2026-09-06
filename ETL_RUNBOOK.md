# Real Estate Engine — ETL Pipeline Runbook
# Updated: 2026-09-02 (SQM Research 3-Stage ETL)

## Pipeline Architecture

The ETL pipeline has been fundamentally re-architected with proper **Extract → Transform → Load layers** for full auditability and separation of concerns. The legacy `sqm_scraper_async.py` has been replaced by a 3-stage pipeline.

### The New Data Flow
```
┌─────────────────────────────────────────────────┐
│ STAGE 1: EXTRACT (sqm_extract.py)               │
│   HTTP to SQM Research → sqm_raw_extractions    │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│ STAGE 2: TRANSFORM (sqm_transform.py)           │
│   Raw JSON → Derived metrics → Staging JSON     │
└────────────────────────┬────────────────────────┘
                         │
┌────────────────────────▼────────────────────────┐
│ STAGE 3: LOAD (sqm_load.py)                     │
│   Staging JSON → suburbs_ui_v3 + time-series    │
└─────────────────────────────────────────────────┘

[ EXTERNAL DATA ] → import_acara.py, etl_abs_*.py
[ MAINTENANCE ] → maintenance.py (VACUUM ANALYZE)
```

## ACTIVE PIPELINE SCRIPTS

### STAGE 1 & 2 & 3 — COMPLETE ETL (Systemd Managed)

| Script | Purpose | Produces | How it Runs |
|--------|---------|----------|---------|
| `sqm_pipeline.py` | Orchestrator: runs all 3 stages | `suburbs_ui_v3` (prices, yields, history) | Automated via `systemd` |
| `sqm_extract.py` | Stage 1: Fetch raw SQM data per postcode | `sqm_raw_extractions` (immutable) | Called by pipeline |
| `sqm_transform.py` | Stage 2: Compute derived metrics | `/tmp/sqm_transform_*.json` | Called by pipeline |
| `sqm_load.py` | Stage 3: Load into UI tables | `suburbs_ui_v3` + `suburb_price_history` | Called by pipeline |

**Data freshness:** Monthly. 
**Current status:** 15,475 postcodes processed. 98.6% completion rate.
**Automation:** A systemd timer (`sqm-scraper.timer`) triggers `sqm-scraper.service` on the 1st of every month at 3:00 AM, with a randomized delay of up to 7 days to prevent anti-bot detection.

**Auditability:** Every stage logs to `etl_run_log`. `sqm_raw_extractions` is append-only (immutable per-postcode history).

### STAGE 3 — EXTERNAL DATA (independent, run separately)

| # | Script | Purpose | Frequency | Command | Status |
|---|--------|---------|-----------|---------|--------|
| 3.1 | `import_acara.py` | School ICSEA scores | Annual | `python import_acara.py` | ✅ Active |
| 3.2 | `etl_abs_building.py` | ABS building approvals | Monthly | `python etl_abs_building.py` | ✅ Active |
| 3.3 | `etl_abs_census.py` | ABS census demographics | 5 years | `python etl_abs_census.py` | ⚠ Stub |
| 3.4 | `etl_infra_zoning.py` | Infrastructure projects | Monthly | `python etl_infra_zoning.py` | ⚠ Partial |

### STAGE 4 — MAINTENANCE

| Script | Purpose | Frequency | Command |
|--------|---------|-----------|---------|
| `maintenance.py` | VACUUM ANALYZE on 3 tables | Weekly | `python maintenance.py` |


## FULL PIPELINE RUN ORDER

If you need to manually trigger a full fresh run from scratch:

```bash
# 1. Run the complete 3-stage ETL pipeline
docker exec realestate-backend python sqm_pipeline.py

# 2. External data:
docker exec realestate-backend python import_acara.py
docker exec realestate-backend python etl_abs_building.py
docker exec realestate-backend python etl_abs_census.py
docker exec realestate-backend python etl_infra_zoning.py

# 3. DQ report:
docker exec realestate-backend python etl_dq_report_v3.py
```

### Staged Manual Run (for debugging)

```bash
# Stage 1: Extract raw data (limit to 5 postcodes)
docker exec realestate-backend python sqm_extract.py --limit 5

# Stage 2: Transform (returns staging file path)
STAGING=$(docker exec realestate-backend python sqm_transform.py)

# Stage 3: Load
docker exec realestate-backend python sqm_load.py "$STAGING"
```

## DEPRECATED ARCHIVES

The following components have been removed or replaced:
- `etl_extract_v3.py` (Playwright overhead)
- `unpack_json_to_table.py` (No longer needed, SQM writes direct to UI table)
- `enrich_from_unpacked.py`
- `v3_scheduler.py` (Replaced by OS-level `systemd`)
- `etl_transform_v2/v3`
- `sqm_scraper_async.py` (Replaced by `sqm_pipeline.py` with proper ETL layers)
