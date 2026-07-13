# Graph Report - realestate  (2026-07-13)

## Corpus Check
- 108 files · ~2,223,513 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 768 nodes · 1029 edges · 105 communities (69 shown, 36 thin omitted)
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 157 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9122a43a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_TSConfig App Compiler Options|TSConfig App Compiler Options]]
- [[_COMMUNITY_ETL Transform V3 Pipeline|ETL Transform V3 Pipeline]]
- [[_COMMUNITY_V3 Scheduler Orchestration|V3 Scheduler Orchestration]]
- [[_COMMUNITY_ETL Runbook Documentation|ETL Runbook Documentation]]
- [[_COMMUNITY_TSConfig Node Compiler Options|TSConfig Node Compiler Options]]
- [[_COMMUNITY_Frontend Property Calculators|Frontend Property Calculators]]
- [[_COMMUNITY_Database Models & Scrapers|Database Models & Scrapers]]
- [[_COMMUNITY_JSON Unpack Pipeline|JSON Unpack Pipeline]]
- [[_COMMUNITY_ACARA School Import|ACARA School Import]]
- [[_COMMUNITY_Predictive AI Engine|Predictive AI Engine]]
- [[_COMMUNITY_ETL Extract V3 Pipeline|ETL Extract V3 Pipeline]]
- [[_COMMUNITY_ETL Runbook Script References|ETL Runbook Script References]]
- [[_COMMUNITY_Infra & Zoning Pipeline|Infra & Zoning Pipeline]]
- [[_COMMUNITY_Frontend Core Infrastructure|Frontend Core Infrastructure]]
- [[_COMMUNITY_ABS Building Approvals|ABS Building Approvals]]
- [[_COMMUNITY_Data Quality Report V3|Data Quality Report V3]]
- [[_COMMUNITY_Micro Scraper V4|Micro Scraper V4]]
- [[_COMMUNITY_Oxlint Configuration|Oxlint Configuration]]
- [[_COMMUNITY_Enrich From Unpacked|Enrich From Unpacked]]
- [[_COMMUNITY_Institutional V3 Panel|Institutional V3 Panel]]
- [[_COMMUNITY_Data Downloader|Data Downloader]]
- [[_COMMUNITY_ABS Census Integration|ABS Census Integration]]
- [[_COMMUNITY_README Documentation|README Documentation]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Database Maintenance|Database Maintenance]]
- [[_COMMUNITY_Password Utility|Password Utility]]
- [[_COMMUNITY_School Location Data|School Location Data]]
- [[_COMMUNITY_School Profile Data|School Profile Data]]
- [[_COMMUNITY_Root TSConfig|Root TSConfig]]
- [[_COMMUNITY_V3 Extract Runner|V3 Extract Runner]]
- [[_COMMUNITY_V3 Pilot Runner|V3 Pilot Runner]]
- [[_COMMUNITY_VIC Sales Time Series|VIC Sales Time Series]]
- [[_COMMUNITY_Build Script|Build Script]]
- [[_COMMUNITY_Base Model Pattern|Base Model Pattern]]
- [[_COMMUNITY_LLM Investment Committee Concept|LLM Investment Committee Concept]]
- [[_COMMUNITY_Mortgage Rate API Concept|Mortgage Rate API Concept]]
- [[_COMMUNITY_OSM Amenity Query Concept|OSM Amenity Query Concept]]
- [[_COMMUNITY_Proxy Routing Concept|Proxy Routing Concept]]
- [[_COMMUNITY_Real Estate Tooling Concept|Real Estate Tooling Concept]]
- [[_COMMUNITY_Stamp Duty Concept|Stamp Duty Concept]]
- [[_COMMUNITY_Tag Depth Analysis Concept|Tag Depth Analysis Concept]]
- [[_COMMUNITY_VectorGrid Heatmap Concept|VectorGrid Heatmap Concept]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]

## God Nodes (most connected - your core abstractions)
1. `Session` - 29 edges
2. `SuburbRawV3` - 20 edges
3. `SuburbUIV3` - 20 edges
4. `SuburbPriceHistory` - 20 edges
5. `SuburbUIV2` - 19 edges
6. `SuburbAllModel` - 19 edges
7. `PropertyListing` - 18 edges
8. `SuburbUIModel` - 18 edges
9. `compilerOptions` - 17 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `run_investment_committee()` --calls--> `record_committee_call()`  [INFERRED]
  backend/ai_agent.py → backend/observability.py
- `analyze_sentiment()` --calls--> `record_sentiment_call()`  [INFERRED]
  backend/ai_sentiment.py → backend/observability.py
- `Path` --uses--> `SuburbUIV3`  [INFERRED]
  backend/etl_abs_census.py → backend/models_v3.py
- `warmup()` --calls--> `Session`  [INFERRED]
  backend/warm_cache.py → backend/main.py
- `get_news_sentiment()` --calls--> `analyze_sentiment()`  [INFERRED]
  backend/ai_agent.py → backend/ai_sentiment.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **V3 ETL Pipeline: Scheduler triggers Scrape->Unpack->Enrich->Cache** — backend_scheduler_updatescheduler, models_v3_suburbrawv3, models_v3_suburbuiv3, backend_main_bust_suburbs_cache [EXTRACTED 1.00]
- **AI Committee Flow: Frontend->API->LangGraph Committee->LLM->Cache Results** — app_old_app, backend_main_analyze_suburb, backend_ai_agent_run_investment_committee, backend_ai_agent_ai_committee_app, backend_ai_agent_get_llm [EXTRACTED 1.00]
- **OSM Livability Stack: Local PostGIS->osm_local.py->API endpoint->Frontend Map** — backend_updater_sh_osm_sync, backend_osm_local_get_livability, backend_main_get_osm_livability, app_old_app [EXTRACTED 1.00]
- **Property Investment Analysis Ecosystem** — src_app_tsx, src_components_cashflowgearing_tsx, src_components_quickroicalculator_tsx, concept_stamp_duty, concept_mortgage_rate_api, concept_llm_investment_committee [INFERRED 0.85]
- **Geospatial & OSM Data Pipeline** — src_components_suburbmap_tsx, src_components_vectorgridlayer_tsx, src_services_osmapits, test_overpass_py, vite_config_ts, concept_osm_amenity_query [INFERRED 0.85]
- **JSX Parsing & AST Utilities** — parse_py, parse_ast_mjs, concept_tag_depth_analysis [INFERRED 0.85]
- **Real Estate Engine Microservices Stack** — docker_compose, concept_fastapi_backend, concept_postgis_spatial_db, concept_redis_caching, concept_osm_updater, concept_tileserv, rationale_memory_limits_mini_pc [EXTRACTED 1.00]
- **OnTheHouse Data Scraping Pipeline** — concept_onthehouse_scraping, concept_playwright_scraping, script_data, test_scrape, concept_cotality_data [EXTRACTED 1.00]
- **App.tsx Parse Output Snapshots (Old/New/Baseline)** — new_parse_out, old_parse_out, parse_out, concept_suburb_data_model, concept_bull_bear_price_projection [INFERRED 0.85]

## Communities (105 total, 36 thin omitted)

### Community 0 - "TSConfig App Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 1 - "ETL Transform V3 Pipeline"
Cohesion: 0.20
Nodes (16): batch_loop(), compute_derived_indicators(), extract_demographics(), extract_nearby_suburbs(), extract_property_listings(), extract_sales_summary(), find_metric(), get_metrics_section() (+8 more)

### Community 2 - "V3 Scheduler Orchestration"
Cohesion: 0.15
Nodes (15): _acquire_lock(), mark_changed_for_enrich(), mark_changed_for_unpack(), _python(), v3_scheduler.py — Tiered Update Scheduler with Change Detection ================, Find raw records where data has changed since last unpack.     Sets is_unpacked=, Find unpacked records newer than their enriched counterparts.     Sets is_enrich, Tiered update scheduler for the V3 pipeline. (+7 more)

### Community 3 - "ETL Runbook Documentation"
Cohesion: 0.11
Nodes (17): ACTIVE PIPELINE SCRIPTS, Complete fresh run (all 5 stages):, CRON SCHEDULE (recommended), DATA TABLE STATUS (as of 2026-07-07), FULL PIPELINE RUN ORDER, Generated: 2026-07-07, KNOWN GAPS, Monthly external data refresh: (+9 more)

### Community 4 - "TSConfig Node Compiler Options"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 5 - "Frontend Property Calculators"
Cohesion: 0.29
Nodes (5): TabName, mockSuburbsData, fetchLivabilityData(), LivabilityData, OSMPoi

### Community 6 - "Database Models & Scrapers"
Cohesion: 0.07
Nodes (79): ActivityRequest, analyze_suburb(), AnalyzeRequest, _annualize_cagr(), BoundedRateLimitStore, bust_suburbs_cache(), calculate_roi(), calculate_stamp_duty() (+71 more)

### Community 7 - "JSON Unpack Pipeline"
Cohesion: 0.23
Nodes (13): models_v3_unpacked.py — Layer 1a: UNPACKED COLUMNAR TABLE ======================, SuburbUnpackedV3, extract_census(), extract_metrics(), extract_nearby(), extract_sales(), parse_description(), r0() (+5 more)

### Community 8 - "ACARA School Import"
Cohesion: 0.25
Nodes (10): compute_school_quality_score(), load_location_data(), load_profile_data(), main(), ACARA School ICSEA Import Script Merges School Profile 2025 (ICSEA scores) + Sch, Update suburbs_all DB and suburbs_data.json with ACARA school data., Load school lat/lon keyed by ACARA SML ID., Load school profiles with ICSEA, merging location data. (+2 more)

### Community 9 - "Predictive AI Engine"
Cohesion: 0.27
Nodes (8): ASXPredictor, calculate_predictive_score(), fetch_environmental_risks(), fetch_infrastructure_zoning_data(), Mock function representing an API call to State Government Planning Portals., Mock function representing an API call to GeoScience Australia or State SES APIs, Algorithm combining leading indicators for Capital Growth:     - Falling Days on, run_predictive_engine()

### Community 10 - "ETL Extract V3 Pipeline"
Cohesion: 0.27
Nodes (9): extract_single_suburb(), etl_extract_v3.py — Layer 1: RAW Extraction ====================================, Extract a single suburb's REDUX_DATA payload via Playwright with anti-blocking m, Worker coroutine: consumes jobs from queue, writes results to DB with circuit br, Main extraction runner., Seeds the raw_v3 table from the existing suburbs_all table.     Preserves any al, run_extraction(), seed_raw_v3() (+1 more)

### Community 11 - "ETL Runbook Script References"
Cohesion: 0.22
Nodes (9): compute_derived_indicators(), enrich_from_unpacked.py, etl_extract_v3.py, etl_transform_v3.py, run_unpack.py, run_v3_extract.py, scheduler.py, unpack_json_to_table.py (+1 more)

### Community 12 - "Infra & Zoning Pipeline"
Cohesion: 0.36
Nodes (7): fetch_major_infrastructure_projects(), fetch_zoning_changes(), map_projects_to_suburbs(), Queries data.vic.gov.au CKAN API for major infrastructure projects.     Returns, Mock function representing an integration with State Planning APIs      (e.g., N, Matches the extracted government data to our suburbs_ui_v3 table., run_infra_zoning_pipeline()

### Community 13 - "Frontend Core Infrastructure"
Cohesion: 0.15
Nodes (7): baseSuburb, mockFetch, mockSetActiveSuburb, renderPanel(), ErrorBoundary, Props, State

### Community 14 - "ABS Building Approvals"
Cohesion: 0.38
Nodes (6): estimate_approvals_from_surrounding(), fetch_abs_building_approvals(), ABS Building Approvals Pipeline — Real estate v3. Fetches monthly LGA-level buil, Fetches monthly building approvals from ABS.     Returns dict of LGA → total_12m, When ABS API fails, fall back to statistical estimates from nearby known data., run_abs_building_pipeline()

### Community 15 - "Data Quality Report V3"
Cohesion: 0.33
Nodes (5): detail_report(), dq_summary(), etl_dq_report_v3.py — Data Quality Report ======================================, High-level DQ summary across the entire dataset., Detailed DQ report showing per-suburb issues.

### Community 16 - "Micro Scraper V4"
Cohesion: 0.47
Nodes (5): get_shortlisted_suburbs(), Fetch suburbs that are currently trending or shortlisted for high-frequency upda, Mock function representing a fast, targeted Playwright or API call     that ONLY, run_micro_scraper(), scrape_volatile_metrics()

### Community 17 - "Oxlint Configuration"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 18 - "Enrich From Unpacked"
Cohesion: 0.29
Nodes (6): enrich_all(), enrich_changed(), enrich_from_unpacked.py — SQL-level enrichment from unpacked table -> suburbs_ui, Only enrich records where unpacked data is newer than UI data., Triggers V3 pipeline enrichment from unpacked table (replaces old transform_data, reload_suburbs()

### Community 19 - "Institutional V3 Panel"
Cohesion: 0.20
Nodes (10): Box Hill VIC 3128, Craigieburn VIC 3064, Dandenong VIC 3175, Epping VIC 3076, Frankston VIC 3199, Glen Waverley VIC 3150, Preston VIC 3072, Sunshine VIC 3020 (+2 more)

### Community 20 - "Data Downloader"
Cohesion: 0.83
Nodes (3): download_file_playwright(), fetch_latest_from_ckan(), run_downloader()

### Community 21 - "ABS Census Integration"
Cohesion: 0.23
Nodes (12): build_sal_postcode_map(), _download(), parse_census_tables(), etl_abs_census.py — ABS Census 2021 Demographics Pipeline ======================, Opens the ABS DataPack ZIP in-memory and parses:       - G01: Total persons, age, Main entry point.     Downloads ABS data, matches to suburbs_ui_v3 by postcode+n, Download a file with progress logging. Skips if already cached., Reads ABS SAL→POA concordance.     Returns dict: sal_code (str) → postcode (str) (+4 more)

### Community 22 - "README Documentation"
Cohesion: 0.18
Nodes (10): AI Insights Panel, AI Usage, Architecture, Caching Behaviour, Data Sources, Deployment, Disclaimer, Quick Start (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.60
Nodes (4): check_alerts(), load_last_state(), ai_alerts.py — Detects sentiment and verdict changes for monitored suburbs. Run, save_last_state()

### Community 39 - "Base Model Pattern"
Cohesion: 0.06
Nodes (33): dependencies, @babel/parser, @babel/traverse, driver.js, leaflet, leaflet.vectorgrid, react, react-dom (+25 more)

### Community 65 - "Community 65"
Cohesion: 0.09
Nodes (28): Any, agent_router.py — Rules-based dynamic agent selection for the investment committ, Determine which committee agents to run for a given suburb.      Rules (evaluate, route_agents(), bear_agent_node(), bull_agent_node(), CommitteeState, _evaluate_policy_rules() (+20 more)

### Community 66 - "Community 66"
Cohesion: 0.14
Nodes (17): get_osm_boundary(), get_osm_livability(), Returns local POI data and livability scores from PostGIS OSM tables.     Replac, Returns suburb boundary geojson and center coordinates from local PostGIS., _build_category_query(), compute_scores(), get_boundary(), get_livability() (+9 more)

### Community 67 - "Community 67"
Cohesion: 0.12
Nodes (12): AUSTRALIA_CENTER, boundaryCache, cafeIcon, MapProps, parkIcon, primarySchoolIcon, secondarySchoolIcon, shoppingIcon (+4 more)

### Community 68 - "Community 68"
Cohesion: 0.18
Nodes (10): 1. UI/UX Improvements, 2. Backend Enhancements, 3. Documentation & Developer Guidance, AI Usage Enhancement Plan, Context, Goals, High‑Level Implementation Steps, Open Questions (+2 more)

### Community 69 - "Community 69"
Cohesion: 0.21
Nodes (6): startup_event(), V3 Tiered Update Scheduler.     Monthly metro (~3,953 suburbs), quarterly full (, Invalidate the in-memory suburbs cache so next request gets fresh DB data., start_scheduler(), stop_scheduler(), UpdateScheduler

### Community 70 - "Community 70"
Cohesion: 0.15
Nodes (13): Bankstown NSW 2200, Blacktown NSW 2148, Bondi Junction NSW 2022, Campbelltown NSW 2560, Castle Hill NSW 2154, Chatswood NSW 2067, Hurstville NSW 2220, Liverpool NSW 2170 (+5 more)

### Community 86 - "Community 86"
Cohesion: 0.18
Nodes (13): SortKey, calcMortgageRegFee(), calcTransferFee(), calculateComprehensiveStampDuty(), calculateMaxPurchase(), calculateStampDuty(), FHOG, FIRST_HOME_CONCESSION (+5 more)

### Community 87 - "Community 87"
Cohesion: 0.17
Nodes (9): AIInsightPanelProps, AnalysisStep, AnalysisTab, CashflowGearingProps, GearingResult, BuyerProfile, MyPurchasePlanProps, UserFavoritesTabProps (+1 more)

### Community 88 - "Community 88"
Cohesion: 0.08
Nodes (20): analyze_sentiment(), _call_remote_llm(), _detect_non_english(), _extract_keywords(), _keyword_sentiment(), ai_sentiment.py — Sentiment analysis via remote LLM (Ollama / llama.cpp GGUF). C, Call the remote Qwen model over HTTP for sentiment classification.     Supports, Keyword-based sentiment scoring as fallback. Returns 1-10 score. (+12 more)

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (4): CalcType, CHART_COLORS, PropertyType, STATE_OPTIONS

### Community 91 - "Community 91"
Cohesion: 0.06
Nodes (34): 1. Current Capability Assessment, 2.1 Add a Buy Finder tab, 2.2 Return a shortlist, not one opaque winner, 2.3 Use a trade-off visual, 2.4 Simplify the first suburb-profile viewport, 2.5 Show provenance at metric level, 2. UI and Data Representation Improvements, 3.1 Investment Fit Score (+26 more)

### Community 92 - "Community 92"
Cohesion: 0.25
Nodes (8): Caboolture QLD 4510, Chermside QLD 4032, Coomera QLD 4209, Ipswich QLD 4305, Logan Central QLD 4114, QLD (Queensland), Springfield QLD 4300, Surfers Paradise QLD 4217

### Community 93 - "Community 93"
Cohesion: 0.29
Nodes (7): Armadale WA 6112, Fremantle WA 6160, Joondalup WA 6027, Mandurah WA 6210, Midland WA 6056, Rockingham WA 6168, WA (Western Australia)

### Community 95 - "Community 95"
Cohesion: 0.33
Nodes (5): Australian Suburbs Comprehensive Data (2025-2026), Darwin NT 0800, Data Sources, NT (Northern Territory), Palmerston NT 0830

### Community 96 - "Community 96"
Cohesion: 0.33
Nodes (6): ACT (Australian Capital Territory), Belconnen ACT 2617, Gungahlin ACT 2912, Queanbeyan NSW 2620, Tuggeranong ACT 2900, Woden ACT 2606

### Community 97 - "Community 97"
Cohesion: 0.40
Nodes (5): Elizabeth SA 5112, Noarlunga SA 5168, Prospect SA 5082, SA (South Australia), Salisbury SA 5108

### Community 98 - "Community 98"
Cohesion: 0.13
Nodes (10): OnboardingTour(), QuickRoiCalculatorProps, AffordabilityCalculator, BuyFinder, Calculators, CashflowGearing, InstitutionalV3Panel, MyPurchasePlan (+2 more)

### Community 99 - "Community 99"
Cohesion: 0.08
Nodes (21): get_cached_or_query(), get_news_sentiment(), _get_suburb_or_404(), get_suburbs_v3(), metrics(), _normalize_suburb_id(), Returns V3-enriched suburbs for the institutional dashboard view., Prometheus-compatible metrics endpoint for AI observability. (+13 more)

### Community 102 - "Community 102"
Cohesion: 0.50
Nodes (4): Devonport TAS 7310, Hobart TAS 7000, Launceston TAS 7250, TAS (Tasmania)

## Knowledge Gaps
- **245 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `TabName` (+240 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `run_investment_committee()` connect `Community 65` to `Community 99`, `Database Models & Scrapers`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `Session` connect `Database Models & Scrapers` to `Community 89`, `ETL Extract V3 Pipeline`, `Community 99`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `analyze_suburb()` connect `Database Models & Scrapers` to `Community 65`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 9 inferred relationships involving `Session` (e.g. with `worker()` and `warmup()`) actually correct?**
  _`Session` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `SuburbRawV3` (e.g. with `seed_raw_v3()` and `ActivityRequest`) actually correct?**
  _`SuburbRawV3` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `SuburbUIV3` (e.g. with `ActivityRequest` and `AnalyzeRequest`) actually correct?**
  _`SuburbUIV3` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `SuburbPriceHistory` (e.g. with `ActivityRequest` and `AnalyzeRequest`) actually correct?**
  _`SuburbPriceHistory` has 17 INFERRED edges - model-reasoned connections that need verification._