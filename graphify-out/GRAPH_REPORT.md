# Graph Report - realestate  (2026-07-06)

## Corpus Check
- 60 files · ~2,158,475 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 428 nodes · 549 edges · 44 communities (34 shown, 10 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d650c6cf`
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
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `compilerOptions` - 15 edges
3. `NSW (New South Wales) — Greater Sydney` - 13 edges
4. `transform_all()` - 11 edges
5. `Session` - 11 edges
6. `BoundedRateLimitStore` - 10 edges
7. `SuburbUIV2` - 10 edges
8. `SuburbAllModel` - 10 edges
9. `V3Scheduler` - 10 edges
10. `Australian Suburbs Comprehensive Data (2025-2026)` - 10 edges

## Surprising Connections (you probably didn't know these)
- `analyze_suburb()` --calls--> `run_investment_committee()`  [INFERRED]
  backend/main.py → backend/ai_agent.py
- `get_similar_suburbs()` --calls--> `find_similar_suburbs()`  [INFERRED]
  backend/main.py → backend/clustering.py
- `seed_raw_v3()` --calls--> `SuburbRawV3`  [INFERRED]
  backend/etl_extract_v3.py → backend/models_v3.py
- `worker()` --calls--> `Session`  [INFERRED]
  backend/etl_extract_v3.py → backend/main.py
- `V3Scheduler` --uses--> `SuburbRawV3`  [INFERRED]
  backend/v3_scheduler.py → backend/models_v3.py

## Import Cycles
- None detected.

## Communities (44 total, 10 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (35): ACT (Australian Capital Territory), Armadale WA 6112, Australian Suburbs Comprehensive Data (2025-2026), Belconnen ACT 2617, Caboolture QLD 4510, Chermside QLD 4032, Coomera QLD 4209, Darwin NT 0800 (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (24): SortKey, GearingResult, V3SuburbData, BuyerProfile, MyPurchasePlanProps, AUSTRALIA_CENTER, MapProps, parkIcon (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (24): dependencies, leaflet, react, react-dom, react-leaflet, recharts, devDependencies, oxlint (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (40): analyze_suburb(), AnalyzeRequest, BoundedRateLimitStore, _build_v3_fallback_response(), _check_rate_limit(), _compute_growth_score(), get_news_sentiment(), get_similar_suburbs() (+32 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (11): mark_changed_for_enrich(), mark_changed_for_unpack(), _python(), v3_scheduler.py — Tiered Update Scheduler with Change Detection ================, Find unpacked records newer than their enriched counterparts.     Sets is_enrich, Tiered update scheduler for the V3 pipeline., Run a Python helper script as a subprocess., Set suburbs_raw_v3.status = 'pending' for suburbs older than threshold.     This (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.23
Nodes (5): startup_event(), V3 Tiered Update Scheduler.     Monthly metro (~3,953 suburbs), quarterly full (, start_scheduler(), stop_scheduler(), UpdateScheduler

### Community 8 - "Community 8"
Cohesion: 0.23
Nodes (14): batch_loop(), extract_demographics(), extract_nearby_suburbs(), extract_property_listings(), extract_sales_summary(), find_metric(), get_metrics_section(), parse_description() (+6 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (13): Bankstown NSW 2200, Blacktown NSW 2148, Bondi Junction NSW 2022, Campbelltown NSW 2560, Castle Hill NSW 2154, Chatswood NSW 2067, Hurstville NSW 2220, Liverpool NSW 2170 (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (10): Box Hill VIC 3128, Craigieburn VIC 3064, Dandenong VIC 3175, Epping VIC 3076, Frankston VIC 3199, Glen Waverley VIC 3150, Preston VIC 3072, Sunshine VIC 3020 (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.19
Nodes (13): get_osm_livability(), Returns local POI data and livability scores from PostGIS OSM tables.     Replac, _build_category_query(), compute_scores(), get_livability(), get_pois(), osm_local.py — Local PostGIS OSM queries (replaces Overpass API) ===============, Return POIs within radius_m of (lat, lng).      Args:         lat, lng: Center p (+5 more)

### Community 12 - "Community 12"
Cohesion: 0.25
Nodes (10): compute_school_quality_score(), load_location_data(), load_profile_data(), main(), ACARA School ICSEA Import Script Merges School Profile 2025 (ICSEA scores) + Sch, Update suburbs_all DB and suburbs_data.json with ACARA school data., Load school lat/lon keyed by ACARA SML ID., Load school profiles with ICSEA, merging location data. (+2 more)

### Community 13 - "Community 13"
Cohesion: 0.27
Nodes (12): Any, bear_agent_node(), bull_agent_node(), CommitteeState, fetch_news_node(), get_llm(), get_news_sentiment(), On-demand Tavily news search for a single suburb.     Cached in DB — only fetche (+4 more)

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (6): enrich_all(), enrich_changed(), enrich_from_unpacked.py — SQL-level enrichment from unpacked table -> suburbs_ui, Only enrich records where unpacked data is newer than UI data., Triggers V3 pipeline enrichment from unpacked table (replaces old transform_data, reload_suburbs()

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): download_file_playwright(), fetch_latest_from_ckan(), run_downloader()

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

### Community 27 - "Community 27"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 28 - "Community 28"
Cohesion: 0.50
Nodes (3): cosine_similarity(), find_similar_suburbs(), Finds cheaper suburbs that share similar mathematical characteristics     to the

### Community 29 - "Community 29"
Cohesion: 0.23
Nodes (13): models_v3_unpacked.py — Layer 1a: UNPACKED COLUMNAR TABLE ======================, SuburbUnpackedV3, extract_census(), extract_metrics(), extract_nearby(), extract_sales(), parse_description(), r0() (+5 more)

### Community 32 - "Community 32"
Cohesion: 0.27
Nodes (9): extract_single_suburb(), etl_extract_v3.py — Layer 1: RAW Extraction ====================================, Worker coroutine: consumes jobs from queue, writes results to DB., Main extraction runner., Seeds the raw_v3 table from the existing suburbs_all table.     Preserves any al, Extract a single suburb's REDUX_DATA payload via Playwright., run_extraction(), seed_raw_v3() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.36
Nodes (7): fetch_major_infrastructure_projects(), fetch_zoning_changes(), map_projects_to_suburbs(), Queries data.vic.gov.au CKAN API for major infrastructure projects.     Returns, Mock function representing an integration with State Planning APIs      (e.g., N, Matches the extracted government data to our suburbs_ui_v3 table., run_infra_zoning_pipeline()

### Community 34 - "Community 34"
Cohesion: 0.36
Nodes (7): calculate_predictive_score(), fetch_environmental_risks(), fetch_infrastructure_zoning_data(), Mock function representing an API call to State Government Planning Portals., Mock function representing an API call to GeoScience Australia or State SES APIs, Algorithm combining leading indicators for Capital Growth:     - Falling Days on, run_predictive_engine()

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (5): detail_report(), dq_summary(), etl_dq_report_v3.py — Data Quality Report ======================================, High-level DQ summary across the entire dataset., Detailed DQ report showing per-suburb issues.

### Community 38 - "Community 38"
Cohesion: 0.47
Nodes (5): get_shortlisted_suburbs(), Fetch suburbs that are currently trending or shortlisted for high-frequency upda, Mock function representing a fast, targeted Playwright or API call     that ONLY, run_micro_scraper(), scrape_volatile_metrics()

### Community 39 - "Community 39"
Cohesion: 0.67
Nodes (3): fetch_abs_demographics(), Mock function representing an API call or flat-file lookup to ABS Datasets (e.g., run_abs_integration()

## Knowledge Gaps
- **136 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `Any` (+131 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `V3Scheduler` connect `Community 6` to `Community 5`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `SuburbAllModel` connect `Community 5` to `Community 6`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `SuburbUnpackedV3` connect `Community 29` to `Community 5`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _194 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.06475485661424607 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._