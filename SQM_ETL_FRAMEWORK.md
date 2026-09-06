# SQM Research ETL Framework
**Version:** 3.0 | **Updated:** 2026-09-02 | **Status:** Active

## Overview

A 3-stage ETL pipeline that extracts property market data from SQM Research, transforms it into derived metrics, and loads it into the final UI tables. This replaces the old `sqm_scraper_async.py` which wrote directly to the UI table, bypassing the transform layer.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SQM RESEARCH (source)                        │
│  weekly-rents | vacancy-rates | total-property-listings |        │
│  asking-property-prices                                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTP (anti-bot hardened)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 1: EXTRACT (sqm_extract.py)                              │
│  ─ 3-worker ThreadPoolExecutor + browser UA + proxy + backoff   │
│  ─ 4 SQM endpoints per postcode (rents, vacancy, stock, prices)   │
│  ─ No transformation — raw JSON arrays stored as-is             │
│  ─ Every error logged to etl_run_log (no silent failures)        │
│  ─ Output: sqm_raw_extractions table (immutable, append-only)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Read from raw layer
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 2: TRANSFORM (sqm_transform.py)                          │
│  ─ No HTTP calls — pure data transformation                     │
│  ─ Price normalization ($'000 → $) with DQ bounds              │
│  ─ Gross rental yield: (rent × 52 / price) × 100               │
│  ─ Growth %: 1m (30d), 3m (90d), 12m (365d) — houses & units    │
│  ─ Rent 12m change                                              │
│  ─ Vacancy rate: decimal → percentage                          │
│  ─ Days-on-market proxy: weighted avg of stock age buckets     │
│  ─ Yield trend: 12-month yield delta                            │
│  ─ DQ score (0-100) with issue list                            │
│  ─ Output: staging JSON file (/tmp/sqm_transform_*.json)        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Read staging JSON
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  STAGE 3: LOAD (sqm_load.py)                                    │
│  ─ COALESCE: never overwrites existing data with NULL           │
│  ─ Writes snapshot columns to suburbs_ui_v3                     │
│  ─ Populates history_10yr + history_rent_10yr (for CAGR scoring) │
│  ─ Upserts suburb_price_history time-series table               │
│  ─ Stores full SQM history in demographics_detail->'sqm_data'   │
│  ─ Updates last_updated, transform_run_id, transform_timestamp │
│  ─ Busts API in-memory cache after load                         │
│  ─ Output: suburbs_ui_v3 (final UI table)                       │
└─────────────────────────────────────────────────────────────────┘
```

## SQM Endpoints

All endpoints use the current `/property/` slug format (the legacy `.php` URLs are kept as fallbacks):

| Metric | URL | Extraction Pattern | Fields Captured |
|--------|-----|-------------------|-----------------|
| Rents | `/property/weekly-rents?postcode={pc}&t=1` | `json_array` | `houses_all`, `houses_3`, `units_all`, `units_2`, `combined`, `date` |
| Vacancy | `/property/vacancy-rates?postcode={pc}&t=1` | `var_data` | `vr`, `listings`, `properties`, `year`, `month` |
| Stock | `/property/total-property-listings?postcode={pc}&t=1` | `var_data` | `total`, `r30`, `r60`, `r90`, `r180`, `r180p`, `year`, `month` |
| Prices | `/property/asking-property-prices?postcode={pc}&t=1` | `json_array` | `houses_all`, `houses_3`, `units_all`, `units_2`, `combined`, `date` |

> **Note:** SQM provides **asking prices** (vendor asking-price index), not settled sale prices. The UI explicitly labels this as "SQM Asking Price" with a source provenance caveat.

## Data Flow per Postcode

SQM data is fetched **per postcode**, then expanded to all suburbs sharing that postcode during the LOAD stage.

```
Postcode 3000 → 1 raw extraction row → 1 transform record → N suburb_ui_v3 rows updated
```

## Anti-Bot Measures

| Measure | Implementation |
|---------|---------------|
| Concurrency | 3-worker ThreadPoolExecutor (configurable via `SQM_MAX_WORKERS`) |
| Intra-postcode delay | 1s + 0-0.3s jitter between the 4 endpoint requests |
| Inter-postcode delay | 2s + 0-1s jitter between postcodes |
| User-Agent | Browser Chrome UA (via `http_client.py` SourceConfig) |
| Proxy | `PROXY_URL` env var (e.g. local VPN) |
| Retry | Exponential backoff with jitter (via `http_client.get_with_backoff`) |
| 429 handling | Respects `Retry-After` header |
| Monthly schedule | systemd timer on 1st of month + up to 7 days random delay |

## DQ Bounds (Transform Stage)

Values outside these bounds are rejected (not stored) and flagged in DQ issues:

| Metric | Min | Max | Action if out of bounds |
|--------|-----|-----|------------------------|
| Asking price | $50,000 | $20,000,000 | Not stored, DQ issue logged |
| Weekly rent | $50 | $5,000 | Not stored, DQ issue logged |
| Gross rental yield | 0.1% | 25% | Not stored, DQ issue logged |
| Vacancy rate | 0% | 15% | Not stored, DQ issue logged |

## Computed Metrics

| Metric | Formula | Source Data |
|--------|---------|-------------|
| `house_median_price` | SQM `houses_all` × 1000 (if < 10000) | `prices[-1].houses_all` |
| `unit_median_price` | SQM `units_all` × 1000 (if < 10000) | `prices[-1].units_all` |
| `house_median_rent` | SQM `houses_all` (direct) | `rents[-1].houses_all` |
| `unit_median_rent` | SQM `units_all` (direct) | `rents[-1].units_all` |
| `house_gross_rental_yield` | `(rent × 52 / price) × 100` | Derived from price + rent |
| `unit_gross_rental_yield` | `(rent × 52 / price) × 100` | Derived from price + rent |
| `house_median_price_1m_change_pct` | `((latest - 30d_ago) / 30d_ago) × 100` | `prices` array |
| `house_median_price_3m_change_pct` | `((latest - 90d_ago) / 90d_ago) × 100` | `prices` array |
| `house_median_price_12m_change_pct` | `((latest - 365d_ago) / 365d_ago) × 100` | `prices` array |
| `house_median_rent_12m_change` | `((latest - 365d_ago) / 365d_ago) × 100` | `rents` array |
| `vacancy_rate` | SQM `vr` × 100 (decimal → percentage) | `vacancy[-1].vr` |
| `total_properties` | SQM `total` (direct) | `stock[-1].total` |
| `house_days_on_market` | Weighted avg: `(r30×15 + r60×45 + r90×75 + r180×135 + r180p×200) / total` | `stock[-1]` age buckets |
| `house_stock_on_market` | `r30 + r60 + r90 + r180 + r180p` | `stock[-1]` age buckets |
| `house_gross_rental_yield_trend` | `current_yield - yield_12m_ago` | `prices` + `rents` arrays |
| `dq_score` | 100 base, minus penalties for missing fields | All metrics |

## Audit Trail

Every run is logged to the `etl_run_log` table:

| Column | Description |
|--------|-------------|
| `run_id` | Unique pipeline run identifier (e.g. `sqm_pipeline_20260902_120000_abc12345`) |
| `stage` | `EXTRACT`, `TRANSFORM`, `LOAD`, or `PIPELINE` |
| `suburb_id` | Suburb affected (nullable for summary entries) |
| `exception_class` | Exception type if errored |
| `message` | Human-readable log message |
| `severity` | `info`, `warning`, or `error` |
| `created_at` | Timestamp |

The `sqm_raw_extractions` table provides an immutable per-postcode audit trail — each extraction run creates new rows, never overwriting previous ones. You can diff any two runs to see exactly what changed.

## Scripts

| Script | Stage | Purpose |
|--------|-------|---------|
| `sqm_extract.py` | 1 | Fetch raw SQM data per postcode → `sqm_raw_extractions` |
| `sqm_transform.py` | 2 | Compute derived metrics from raw data → staging JSON |
| `sqm_load.py` | 3 | Load transformed data → `suburbs_ui_v3` + `suburb_price_history` |
| `sqm_pipeline.py` | All | Orchestrator: runs all 3 stages in sequence |
| `etl_dq_report_v3.py` | Report | Data quality summary and detail reports |

## Running the Pipeline

### Automated (systemd)

```bash
# The systemd timer triggers the pipeline on the 1st of each month at 3 AM
# with up to 7 days random delay for anti-bot purposes
sudo systemctl start sqm-scraper.timer
```

### Manual (full run)

```bash
# Inside the backend container
docker exec realestate-backend python sqm_pipeline.py

# From host (uses systemd-style invocation)
cd backend && python3 sqm_pipeline.py
```

### Manual (staged)

```bash
# Stage 1: Extract
python sqm_extract.py --state VIC

# Stage 2: Transform (outputs staging JSON path)
STAGING=$(python sqm_transform.py)

# Stage 3: Load
python sqm_load.py "$STAGING"
```

### Testing / Dry Run

```bash
# Extract just 5 postcodes
python sqm_extract.py --limit 5

# Transform specific postcodes
python sqm_transform.py --postcodes 3000,3142

# Load in dry-run mode (no DB writes)
python sqm_load.py /tmp/sqm_transform_xxx.json --dry-run
```

## Database Tables

| Table | Layer | Description |
|-------|-------|-------------|
| `sqm_raw_extractions` | RAW (Layer 0) | Immutable per-postcode raw SQM JSON. Append-only. |
| `suburbs_raw_v3` | RAW (Layer 1) | Legacy OnTheHouse raw data (deprecated, retained for audit) |
| `suburbs_ui_v3` | UI (Layer 2) | Final normalized table consumed by the API and frontend |
| `suburb_price_history` | Analytics (Layer 3) | Time-series price/rent history for charts and CAGR computation |
| `etl_run_log` | Audit | Pipeline run logs for all stages |
