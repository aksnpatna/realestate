# Real Estate Engine — ETL Pipeline Runbook
# Generated: 2026-07-07

## Pipeline Architecture

The ETL pipeline has 5 stages. Stages 1-3 are orchestrated by the scheduler.
Stages 4-5 are independent and must be run manually or via cron.

```
STAGE 0: SEEDING (v3_scheduler)
STAGE 1: EXTRACT (scrape onthehouse.com.au → suburbs_raw_v3)
STAGE 2: UNPACK (raw JSON → suburbs_unpacked_v3)
STAGE 3: ENRICH (unpacked → suburbs_ui_v3 + derived indicators)
STAGE 4: EXTERNAL DATA (ACARA schools, ABS building approvals)
STAGE 5: MAINTENANCE (VACUUM ANALYZE)
```


## ACTIVE PIPELINE SCRIPTS

### STAGE 0 — SEEDING (runs continuously)

| Script | Purpose | Dependencies | When |
|--------|---------|-------------|------|
| `scheduler.py` | Daemon wrapper | v3_scheduler.py subprocess | Auto-starts with API container |
| `v3_scheduler.py` | Tiered scheduler | run_v3_extract, run_unpack, enrich_from_unpacked | Daemon mode — checks every 30 days metro, 90 days country |


### STAGE 1 — EXTRACT (monthly metro / quarterly full)

| Script | Purpose | Produces | Command |
|--------|---------|----------|---------|
| `etl_extract_v3.py` | Playwright scraper | suburbs_raw_v3.raw_json | Called by v3_scheduler |
| `run_v3_extract.py` | CLI wrapper | Delegates to etl_extract_v3 | `--live-only` for metro, `--limit 500` |

**Data freshness:** Metro ≤30 days. Regional ≤90 days.
**Current status:** 13,150 records in suburbs_ui_v3. 3,850 live (metro). 
**Last run:** Check with SQL: `SELECT MAX(last_updated) FROM suburbs_ui_v3;`


### STAGE 2 — UNPACK (after each extraction batch)

| Script | Purpose | Produces | Command |
|--------|---------|----------|---------|
| `unpack_json_to_table.py` | JSON→columnar extractor | suburbs_unpacked_v3 (32+ columns) | `python unpack_json_to_table.py` |
| `run_unpack.py` | CLI wrapper | Delegates | Called by v3_scheduler |

**Runs after:** Any extraction batch completes.
**Batch size:** 200 suburbs per batch.


### STAGE 3 — ENRICH (after unpack, before DQ report)

| Script | Purpose | Produces | Command |
|--------|---------|----------|---------|
| `enrich_from_unpacked.py` | SQL bulk upsert | suburbs_ui_v3 (full enrichment) | Called by v3_scheduler with `--changed` |
| `etl_transform_v3.py` | Python transform (alternative) | suburbs_ui_v3 + property_listings | `python etl_transform_v3.py --loop` |
| `compute_derived_indicators()` | Post-transform refresh | unemployment_rate, building_approvals_12m, infrastructure_investment | Auto-called after batch |
| `etl_dq_report_v3.py` | DQ summary report | Console output | `python etl_dq_report_v3.py` |

**⚠ IMPORTANT:** Always run `compute_derived_indicators()` after enrich_from_unpacked to refresh estimates.
`etl_transform_v3.py` has property_listings extraction that the SQL path doesn't. Use it if listings need refresh.

**Current status:** 13,150 enriched suburbs with derived indicators populated.


### STAGE 4 — EXTERNAL DATA (independent, run separately)

| # | Script | Purpose | Frequency | Command | Status |
|---|--------|---------|-----------|---------|--------|
| 4.1 | `import_acara.py` | School ICSEA scores | Annual (when ACARA releases) | `python import_acara.py` | ✅ Run 2026-07-07 (3745 suburbs) |
| 4.2 | `etl_abs_building.py` | ABS building approvals (8731.0) | Monthly | `python etl_abs_building.py` | ✅ Run 2026-07-07 (10855 suburbs) |
| 4.3 | `etl_abs_census.py` | ABS census demographics | Every 5 years (Census) | `python etl_abs_census.py` | ⚠ MOCK — uses deterministic fake data |
| 4.4 | `etl_infra_zoning.py` | Gov infrastructure projects | Monthly | `python etl_infra_zoning.py` | ⚠ Partial — Vic CKAN API + mock zoning |

**⚠ GAP:** `etl_abs_census.py` produces fake data. Real ABS Census integration needed.
**⚠ GAP:** `import_acara.py` writes to `suburbs_all` table. Sync to V3 with:
```sql
UPDATE suburbs_ui_v3 u SET schools = s.data->'acara_schools' FROM suburbs_all s WHERE UPPER(u.id) = UPPER(s.id) AND s.data ? 'acara_schools';
```

**⚠ GAP:** `etl_infra_zoning.py` uses mock zoning data for states outside Victoria. Needs real NSW/QLD/WA planning portal APIs.


### STAGE 5 — MAINTENANCE

| Script | Purpose | Frequency | Command |
|--------|---------|-----------|---------|
| `maintenance.py` | VACUUM ANALYZE on 3 tables | Weekly | `python maintenance.py` |


## FULL PIPELINE RUN ORDER

### Complete fresh run (all 5 stages):
```bash
# 1. Start scheduler (auto-starts with API container)
docker compose up -d backend

# 2. Wait for first extraction cycle, OR trigger manually:
docker exec realestate-backend python run_v3_extract.py --live-only --limit 500

# 3. Unpack (auto-scheduled, OR manual):
docker exec realestate-backend python run_unpack.py

# 4. Enrich (auto-scheduled, OR manual):
docker exec realestate-backend python enrich_from_unpacked.py --changed

# 5. Derived indicators:
docker exec realestate-backend python -c "from etl_transform_v3 import compute_derived_indicators; compute_derived_indicators()"

# 6. External data:
docker exec realestate-backend python import_acara.py
docker exec realestate-backend python etl_abs_building.py
docker exec realestate-backend python etl_abs_census.py
docker exec realestate-backend python etl_infra_zoning.py

# 7. DQ report:
docker exec realestate-backend python etl_dq_report_v3.py

# 8. Maintenance (weekly):
docker exec realestate-backend python maintenance.py
```

### Quick refresh (metro only, after new scrapes):
```bash
docker exec realestate-backend python run_v3_extract.py --live-only --limit 500
docker exec realestate-backend python run_unpack.py
docker exec realestate-backend python enrich_from_unpacked.py --changed
docker exec realestate-backend python -c "from etl_transform_v3 import compute_derived_indicators; compute_derived_indicators()"
```

### Monthly external data refresh:
```bash
docker exec realestate-backend python etl_abs_building.py
docker exec realestate-backend python etl_infra_zoning.py
```


## DATA TABLE STATUS (as of 2026-07-07)

| Table | Records | Last Updated | Notes |
|-------|---------|-------------|-------|
| suburbs_raw_v3 | 4,327 | varies per suburb | Raw JSON from onthehouse |
| suburbs_unpacked_v3 | 0 | — | Columnar table (empty — enrich bypasses it) |
| suburbs_ui_v3 | 13,150 | 2026-07-07 | Main enriched table (frontend source) |
| property_listings | varies | varies | Sale/rent listing rows |
| suburbs_all (legacy) | 3,745 | 2026-07-07 | V2 table — being deprecated |


## KNOWN GAPS

1. **Days on Market:** DB column exists (suburbs_ui_v3.house_days_on_market) but scraper doesn't extract this field from onthehouse. OnTheHouse shows this data in the UI but not in REDUX_DATA JSON.

2. **Auction Clearance Rate:** Same issue — DB column exists, scraper doesn't extract.

3. **ABS Census:** Uses mock/stub data. Needs real ABS Census DataPack CSV integration for unemployment rate, household income, and occupation data.

4. **Infrastructure Zoning:** Only Victoria has real CKAN API. NSW/QLD/WA use mock data.

5. **ACARA Schools:** Writes to legacy suburbs_all table. Manual sync to suburbs_ui_v3 needed after each import.


## CRON SCHEDULE (recommended)

```
# Monthly — metro extraction + external data
0 2 1 * * cd /home/aksai/projects/realestate && docker exec realestate-backend python run_v3_extract.py --live-only --limit 500
0 4 1 * * cd /home/aksai/projects/realestate && docker exec realestate-backend python run_unpack.py
0 6 1 * * cd /home/aksai/projects/realestate && docker exec realestate-backend python enrich_from_unpacked.py --changed
0 7 1 * * cd /home/aksai/projects/realestate && docker exec realestate-backend python -c "from etl_transform_v3 import compute_derived_indicators; compute_derived_indicators()"
0 8 1 * * cd /home/aksai/projects/realestate && docker exec realestate-backend python etl_abs_building.py

# Quarterly — full extraction
0 2 1 */3 * cd /home/aksai/projects/realestate && docker exec realestate-backend python run_v3_extract.py --limit 2000

# Weekly — maintenance
0 3 * * 0 cd /home/aksai/projects/realestate && docker exec realestate-backend python maintenance.py

# Annual — ACARA schools (when new data released, typically March)
# 0 2 1 3 * cd /home/aksai/projects/realestate && docker exec realestate-backend python import_acara.py

# Every 5 years — ABS Census (next Census: 2026)
# After Census data released, run etl_abs_census.py with real DataPack
```
