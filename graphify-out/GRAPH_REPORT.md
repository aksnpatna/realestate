# Graph Report - realestate  (2026-07-09)

## Corpus Check
- 87 files · ~2,206,607 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 572 nodes · 792 edges · 79 communities (53 shown, 26 thin omitted)
- Extraction: 84% EXTRACTED · 16% INFERRED · 0% AMBIGUOUS · INFERRED: 129 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `80a288bb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 76|Community 76]]

## God Nodes (most connected - your core abstractions)
1. `Session` - 26 edges
2. `SuburbRawV3` - 18 edges
3. `SuburbPriceHistory` - 18 edges
4. `SuburbUIV2` - 17 edges
5. `SuburbUIV3` - 17 edges
6. `SuburbAllModel` - 17 edges
7. `compilerOptions` - 17 edges
8. `PropertyListing` - 16 edges
9. `SuburbUIModel` - 16 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `analyze_suburb()` --calls--> `run_investment_committee()`  [INFERRED]
  backend/main.py → backend/ai_agent.py
- `get_similar_suburbs()` --calls--> `find_similar_suburbs()`  [INFERRED]
  backend/main.py → backend/clustering.py
- `seed_raw_v3()` --calls--> `SuburbRawV3`  [INFERRED]
  backend/etl_extract_v3.py → backend/models_v3.py
- `worker()` --calls--> `Session`  [INFERRED]
  backend/etl_extract_v3.py → backend/main.py
- `update_password()` --calls--> `UserModel`  [INFERRED]
  backend/update_pwd.py → backend/main.py

## Import Cycles
- None detected.

## Communities (79 total, 26 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (79): ActivityRequest, analyze_suburb(), AnalyzeRequest, _annualize_cagr(), BoundedRateLimitStore, _build_v2_only_response(), _build_v3_fallback_response(), bust_suburbs_cache() (+71 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (21): TabName, SortKey, CashflowGearingProps, GearingResult, V3SuburbData, BuyerProfile, MyPurchasePlanProps, OnboardingTour() (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.27
Nodes (9): extract_single_suburb(), etl_extract_v3.py — Layer 1: RAW Extraction ====================================, Worker coroutine: consumes jobs from queue, writes results to DB., Main extraction runner., Seeds the raw_v3 table from the existing suburbs_all table.     Preserves any al, Extract a single suburb's REDUX_DATA payload via Playwright., run_extraction(), seed_raw_v3() (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (28): dependencies, @babel/parser, @babel/traverse, driver.js, leaflet, leaflet.vectorgrid, react, react-dom (+20 more)

### Community 4 - "Community 4"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.17
Nodes (18): batch_loop(), compute_derived_indicators(), extract_demographics(), extract_nearby_suburbs(), extract_property_listings(), extract_sales_summary(), find_metric(), get_metrics_section() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (11): mark_changed_for_enrich(), mark_changed_for_unpack(), _python(), v3_scheduler.py — Tiered Update Scheduler with Change Detection ================, Find unpacked records newer than their enriched counterparts.     Sets is_enrich, Tiered update scheduler for the V3 pipeline., Run a Python helper script as a subprocess., Set suburbs_raw_v3.status = 'pending' for suburbs older than threshold.     This (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (13): models_v3_unpacked.py — Layer 1a: UNPACKED COLUMNAR TABLE ======================, SuburbUnpackedV3, extract_census(), extract_metrics(), extract_nearby(), extract_sales(), parse_description(), r0() (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (17): get_osm_boundary(), get_osm_livability(), Returns local POI data and livability scores from PostGIS OSM tables.     Replac, Returns suburb boundary geojson and center coordinates from local PostGIS., _build_category_query(), compute_scores(), get_boundary(), get_livability() (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.24
Nodes (14): Any, bear_agent_node(), bull_agent_node(), CommitteeState, fetch_news_node(), get_llm(), get_news_sentiment(), On-demand Tavily news search for a single suburb.     Cached in DB — only fetche (+6 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (10): compute_school_quality_score(), load_location_data(), load_profile_data(), main(), ACARA School ICSEA Import Script Merges School Profile 2025 (ICSEA scores) + Sch, Update suburbs_all DB and suburbs_data.json with ACARA school data., Load school lat/lon keyed by ACARA SML ID., Load school profiles with ICSEA, merging location data. (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (8): ASXPredictor, calculate_predictive_score(), fetch_environmental_risks(), fetch_infrastructure_zoning_data(), Mock function representing an API call to State Government Planning Portals., Mock function representing an API call to GeoScience Australia or State SES APIs, Algorithm combining leading indicators for Capital Growth:     - Falling Days on, run_predictive_engine()

### Community 14 - "Community 14"
Cohesion: 0.21
Nodes (6): startup_event(), V3 Tiered Update Scheduler.     Monthly metro (~3,953 suburbs), quarterly full (, Invalidate the in-memory suburbs cache so next request gets fresh DB data., start_scheduler(), stop_scheduler(), UpdateScheduler

### Community 15 - "Community 15"
Cohesion: 0.22
Nodes (9): compute_derived_indicators(), enrich_from_unpacked.py, etl_extract_v3.py, etl_transform_v3.py, run_unpack.py, run_v3_extract.py, scheduler.py, unpack_json_to_table.py (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.36
Nodes (7): fetch_major_infrastructure_projects(), fetch_zoning_changes(), map_projects_to_suburbs(), Queries data.vic.gov.au CKAN API for major infrastructure projects.     Returns, Mock function representing an integration with State Planning APIs      (e.g., N, Matches the extracted government data to our suburbs_ui_v3 table., run_infra_zoning_pipeline()

### Community 17 - "Community 17"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 18 - "Community 18"
Cohesion: 0.28
Nodes (13): Bankstown NSW 2200, Blacktown NSW 2148, Bondi Junction NSW 2022, Campbelltown NSW 2560, Castle Hill NSW 2154, Chatswood NSW 2067, Hurstville NSW 2220, Liverpool NSW 2170 (+5 more)

### Community 19 - "Community 19"
Cohesion: 0.38
Nodes (6): estimate_approvals_from_surrounding(), fetch_abs_building_approvals(), ABS Building Approvals Pipeline — Real estate v3. Fetches monthly LGA-level buil, Fetches monthly building approvals from ABS.     Returns dict of LGA → total_12m, When ABS API fails, fall back to statistical estimates from nearby known data., run_abs_building_pipeline()

### Community 20 - "Community 20"
Cohesion: 0.33
Nodes (5): detail_report(), dq_summary(), etl_dq_report_v3.py — Data Quality Report ======================================, High-level DQ summary across the entire dataset., Detailed DQ report showing per-suburb issues.

### Community 21 - "Community 21"
Cohesion: 0.47
Nodes (5): get_shortlisted_suburbs(), Fetch suburbs that are currently trending or shortlisted for high-frequency upda, Mock function representing a fast, targeted Playwright or API call     that ONLY, run_micro_scraper(), scrape_volatile_metrics()

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (35): ACT (Australian Capital Territory), Armadale WA 6112, Australian Suburbs Comprehensive Data (2025-2026), Belconnen ACT 2617, Caboolture QLD 4510, Chermside QLD 4032, Coomera QLD 4209, Darwin NT 0800 (+27 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (17): ACTIVE PIPELINE SCRIPTS, Complete fresh run (all 5 stages):, CRON SCHEDULE (recommended), DATA TABLE STATUS (as of 2026-07-07), FULL PIPELINE RUN ORDER, Generated: 2026-07-07, KNOWN GAPS, Monthly external data refresh: (+9 more)

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (6): enrich_all(), enrich_changed(), enrich_from_unpacked.py — SQL-level enrichment from unpacked table -> suburbs_ui, Only enrich records where unpacked data is newer than UI data., Triggers V3 pipeline enrichment from unpacked table (replaces old transform_data, reload_suburbs()

### Community 27 - "Community 27"
Cohesion: 0.83
Nodes (3): download_file_playwright(), fetch_latest_from_ckan(), run_downloader()

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): fetch_abs_demographics(), Mock function representing an API call or flat-file lookup to ABS Datasets (e.g., run_abs_integration()

### Community 29 - "Community 29"
Cohesion: 0.24
Nodes (10): Box Hill VIC 3128, Craigieburn VIC 3064, Dandenong VIC 3175, Epping VIC 3076, Frankston VIC 3199, Glen Waverley VIC 3150, Preston VIC 3072, Sunshine VIC 3020 (+2 more)

### Community 56 - "Community 56"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 73 - "Community 73"
Cohesion: 0.12
Nodes (11): AUSTRALIA_CENTER, boundaryCache, cafeIcon, MapProps, parkIcon, primarySchoolIcon, secondarySchoolIcon, shoppingIcon (+3 more)

## Knowledge Gaps
- **161 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `TabName` (+156 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Session` connect `Community 0` to `Community 2`, `Community 5`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `get_suburb_properties()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `V3Scheduler` connect `Community 6` to `Community 0`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Session` (e.g. with `worker()` and `SuburbUIV2`) actually correct?**
  _`Session` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `SuburbRawV3` (e.g. with `seed_raw_v3()` and `ActivityRequest`) actually correct?**
  _`SuburbRawV3` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 15 inferred relationships involving `SuburbPriceHistory` (e.g. with `ActivityRequest` and `AnalyzeRequest`) actually correct?**
  _`SuburbPriceHistory` has 15 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `SuburbUIV2` (e.g. with `ActivityRequest` and `AnalyzeRequest`) actually correct?**
  _`SuburbUIV2` has 14 INFERRED edges - model-reasoned connections that need verification._