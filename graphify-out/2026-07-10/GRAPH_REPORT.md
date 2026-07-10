# Graph Report - .  (2026-07-10)

## Corpus Check
- 49 files · ~2,209,842 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 300 nodes · 301 edges · 66 communities (34 shown, 32 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Suburb Clustering|Suburb Clustering]]
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `compilerOptions` - 15 edges
3. `transform_all()` - 11 edges
4. `V3Scheduler` - 9 edges
5. `unpack_all()` - 8 edges
6. `Generated: 2026-07-07` - 7 edges
7. `ACTIVE PIPELINE SCRIPTS` - 7 edges
8. `run_predictive_engine()` - 6 edges
9. `r2()` - 5 edges
10. `extract_metrics()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `unpack_all()` --calls--> `SuburbUnpackedV3`  [INFERRED]
  backend/unpack_json_to_table.py → backend/models_v3_unpacked.py
- `V3Scheduler` --uses--> `SuburbAllModel`  [INFERRED]
  backend/v3_scheduler.py → backend/parallel_scraper.py
- `MyPurchasePlanProps` --references--> `SuburbData`  [EXTRACTED]
  src/components/MyPurchasePlan.tsx → src/data/suburbs.ts

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

## Communities (66 total, 32 thin omitted)

### Community 0 - "TSConfig App Compiler Options"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 1 - "ETL Transform V3 Pipeline"
Cohesion: 0.20
Nodes (16): batch_loop(), compute_derived_indicators(), extract_demographics(), extract_nearby_suburbs(), extract_property_listings(), extract_sales_summary(), find_metric(), get_metrics_section() (+8 more)

### Community 2 - "V3 Scheduler Orchestration"
Cohesion: 0.18
Nodes (11): mark_changed_for_enrich(), mark_changed_for_unpack(), _python(), v3_scheduler.py — Tiered Update Scheduler with Change Detection ================, Find unpacked records newer than their enriched counterparts.     Sets is_enrich, Tiered update scheduler for the V3 pipeline., Run a Python helper script as a subprocess., Set suburbs_raw_v3.status = 'pending' for suburbs older than threshold.     This (+3 more)

### Community 3 - "ETL Runbook Documentation"
Cohesion: 0.11
Nodes (17): ACTIVE PIPELINE SCRIPTS, Complete fresh run (all 5 stages):, CRON SCHEDULE (recommended), DATA TABLE STATUS (as of 2026-07-07), FULL PIPELINE RUN ORDER, Generated: 2026-07-07, KNOWN GAPS, Monthly external data refresh: (+9 more)

### Community 4 - "TSConfig Node Compiler Options"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 5 - "Frontend Property Calculators"
Cohesion: 0.17
Nodes (11): SortKey, BuyerProfile, MyPurchasePlanProps, calculateMaxPurchase(), calculateStampDuty(), mockSuburbsData, POI, School (+3 more)

### Community 6 - "Database Models & Scrapers"
Cohesion: 0.19
Nodes (11): Ingestion Target Layer. Stores the pure, unprocessed JSON payload extracted from, Normalized and Transformed Layer.      Ready for immediate frontend consumption., SuburbRawV2, SuburbUIV2, models_v3_unpacked.py — Layer 1a: UNPACKED COLUMNAR TABLE ======================, SuburbUnpackedV3, CrimeStatModel, SuburbAllModel (+3 more)

### Community 7 - "JSON Unpack Pipeline"
Cohesion: 0.32
Nodes (11): extract_census(), extract_metrics(), extract_nearby(), extract_sales(), parse_description(), r0(), r2(), unpack_json_to_table.py — One-time JSON → Columnar Extraction ================== (+3 more)

### Community 8 - "ACARA School Import"
Cohesion: 0.25
Nodes (10): compute_school_quality_score(), load_location_data(), load_profile_data(), main(), ACARA School ICSEA Import Script Merges School Profile 2025 (ICSEA scores) + Sch, Update suburbs_all DB and suburbs_data.json with ACARA school data., Load school lat/lon keyed by ACARA SML ID., Load school profiles with ICSEA, merging location data. (+2 more)

### Community 9 - "Predictive AI Engine"
Cohesion: 0.27
Nodes (8): ASXPredictor, calculate_predictive_score(), fetch_environmental_risks(), fetch_infrastructure_zoning_data(), Mock function representing an API call to State Government Planning Portals., Mock function representing an API call to GeoScience Australia or State SES APIs, Algorithm combining leading indicators for Capital Growth:     - Falling Days on, run_predictive_engine()

### Community 10 - "ETL Extract V3 Pipeline"
Cohesion: 0.27
Nodes (9): extract_single_suburb(), etl_extract_v3.py — Layer 1: RAW Extraction ====================================, Worker coroutine: consumes jobs from queue, writes results to DB., Main extraction runner., Seeds the raw_v3 table from the existing suburbs_all table.     Preserves any al, Extract a single suburb's REDUX_DATA payload via Playwright., run_extraction(), seed_raw_v3() (+1 more)

### Community 11 - "ETL Runbook Script References"
Cohesion: 0.22
Nodes (9): compute_derived_indicators(), enrich_from_unpacked.py, etl_extract_v3.py, etl_transform_v3.py, run_unpack.py, run_v3_extract.py, scheduler.py, unpack_json_to_table.py (+1 more)

### Community 12 - "Infra & Zoning Pipeline"
Cohesion: 0.36
Nodes (7): fetch_major_infrastructure_projects(), fetch_zoning_changes(), map_projects_to_suburbs(), Queries data.vic.gov.au CKAN API for major infrastructure projects.     Returns, Mock function representing an integration with State Planning APIs      (e.g., N, Matches the extracted government data to our suburbs_ui_v3 table., run_infra_zoning_pipeline()

### Community 13 - "Frontend Core Infrastructure"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

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
Cohesion: 0.40
Nodes (3): enrich_changed(), enrich_from_unpacked.py — SQL-level enrichment from unpacked table -> suburbs_ui, Only enrich records where unpacked data is newer than UI data.

### Community 20 - "Data Downloader"
Cohesion: 0.83
Nodes (3): download_file_playwright(), fetch_latest_from_ckan(), run_downloader()

### Community 21 - "ABS Census Integration"
Cohesion: 0.67
Nodes (3): fetch_abs_demographics(), Mock function representing an API call or flat-file lookup to ABS Datasets (e.g., run_abs_integration()

### Community 22 - "README Documentation"
Cohesion: 0.50
Nodes (3): Expanding the Oxlint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **85 isolated node(s):** `$schema`, `plugins`, `react/rules-of-hooks`, `react/only-export-components`, `SortKey` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `V3Scheduler` connect `V3 Scheduler Orchestration` to `Database Models & Scrapers`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `SuburbAllModel` connect `Database Models & Scrapers` to `V3 Scheduler Orchestration`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `SuburbUnpackedV3` connect `Database Models & Scrapers` to `JSON Unpack Pipeline`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `plugins`, `react/rules-of-hooks` to the rest of the system?**
  _131 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TSConfig App Compiler Options` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `ETL Runbook Documentation` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `TSConfig Node Compiler Options` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._