# Suburbly (Real Estate App) Platform Documentation
**Date**: September 6, 2026
**Status**: Stable - SQM ETL Pipeline + V3 Enriched Data

This document provides a comprehensive overview of the application's data traceability, UI architecture, and deployment mechanisms. It will be used going forward to capture all delta changes.

---

## 1. System Architecture

The application is structured into three main layers:
1. **ETL & Data Ingestion (Python/Asyncio)**: Directly ingests data from SQM Research APIs and ABS endpoints, replacing the old browser-based scraping method.
2. **Backend API (FastAPI + PostgreSQL/PostGIS)**: Serves the aggregated and enriched data. AI endpoints leverage a local LLM via Ollama (Qwen-2.5 3B) hosted on an external Mac Mini.
3. **Frontend UI (React/TypeScript)**: The consumer-facing platform (branded as **Suburbly**) featuring a persona-aware design that adapts to First Home Buyers, Investors, and Buyers Agents.

---

## 2. Data Traceability Matrix: SQM Research

Data flows from the SQM backend endpoints into the `suburbs_ui_v3` table, and is then served to the React UI.

### Origin to Database
- **Median Price**: `/graphs/graph_demographics.php` → `suburbs_ui_v3.house_median_price`
- **Weekly Asking Rent**: `/graphs/graph_demographics.php` → `suburbs_ui_v3.house_median_rent`
- **Vacancy Rate**: `/graphs/graph_vacancy.php` → `suburbs_ui_v3.vacancy_rate`
- **Total Properties (Stock)**: `/total-property-listings.php` → `suburbs_ui_v3.total_properties`
- **Historical Data**: Embedded JSON payloads → `suburbs_ui_v3.demographics_detail['sqm_data']`
- **Calculated Yield**: `Rent * 52 / Price` → `suburbs_ui_v3.house_gross_rental_yield`

### Database to UI Components
1. **Property Overview (`App.tsx`)**: Displays top-level metrics (Median Price, Rent, Vacancy Rate).
2. **Market Indicators (`MarketIndicatorsSection.tsx`)**: Displays Demand/Supply Ratio, Absorption Rate, Days on Market, Price/Rent Ratio.
3. **SQM Dashboard (`SqmDashboard.tsx`)**: Fetches historical SQM data to display:
   - **Vacancy Rate Trends**: Rendered via `SqmHistoricalChart.tsx`.
   - **Recent Sold Properties**: Rendered via `SoldScatterplot.tsx` (using `sqm_data->'sold'`).
4. **Market Pulse Tab (`MarketPulseTab.tsx`)**: New dedicated tab for macro news and benchmarks (Interest Rates, Auctions, RBA trends) powered by AI sentiment.

---

## 3. UI Uplifts & UX Architecture

Based on the recent platform audit, the UI has been uplifted from an analyst-heavy tool to a consumer-friendly platform:

- **Branding**: Rebranded to **Suburbly**, removing generic data-heavy titles. The UI now utilizes gradients and a modern, welcoming color palette.
- **Persona-Aware Language**: The data model uses the `personas.ts` configuration to adapt the language and visibility of sections based on whether the user is a First Home Buyer or an Investor.
- **Profile Sections**:
  - The "Technical" tab is restricted to Buyers Agents.
  - A new **Market Pulse** tab replaces buried news data.
  - **AI Insights** are framed as "What this suburb means for you" rather than "Investment Committee".
- **Performance**: 
  - Suburbs are lazy-loaded effectively.
  - The API list endpoint (`/api/suburbs`) restricts memory overhead to 500 records per state to prevent OOM kills on the backend.

---

## 4. Infrastructure & Deployment (`realestate.akstest.win`)

The application is fully containerized using `docker-compose.yml`.

### Services
- **`realestate-backend`**: FastAPI server running on port 8100. Memory limited to **4GB**. Connects to PostGIS database.
- **`realestate-news-updater`**: Background cron job fetching news sentiment. It is constrained to **2GB** RAM and relies on an external Mac Mini (192.168.1.150) for LLM inference (avoiding 28GB memory hogs).
- **`realestate-db`**: PostGIS 15. Memory limited to 2GB, tuned for a mini-PC (shared_buffers=512MB, effective_cache_size=2GB).
- **`realestate-redis`**: Caching layer, limited to 300MB.

### Deployment Flow
To reflect changes to `realestate.akstest.win`:
1. Ensure the frontend is built: `npm run build` (if the Nginx container serves a static build).
2. Push backend changes via docker: `docker compose up -d --build backend`
3. Nginx handles routing port 80/443 to `8082` (Frontend) and `/api` to `8100` (Backend).

### Delta Changes Log
*(Future changes to be recorded here)*
- **2026-09-06**: Fixed memory exhaustion in `get_suburbs` endpoint by introducing a 500-record-per-state limit. Offloaded news sentiment generation to external LLM to save 2GB RAM. Added `SqmDashboard`, `MarketPulseTab`, and `SoldScatterplot` React components.
- **2026-09-06 (UI Bug Fixes)**: Fixed empty/broken historical charts in the Market Tab (`SqmHistoricalChart.tsx`). Addressed missing `total` fields in SQM stock data by dynamically summing buckets (`r30`, `r60`, etc.), normalized inconsistent date formats between monthly/weekly data, and enabled `connectNulls` on Recharts to prevent disjointed datasets from rendering blank charts. Pushed changes to frontend docker container.
- **2026-09-06 (Unified Search Fixes)**: 
  - **Clarification Questions Visible**: Fixed the issue where clarification questions were only logged to console.log instead of being displayed to the user. Added a visible clarification card with yellow border in `UnifiedSearchView.tsx:276-281`.
  - **Excluded DQ List Rendered**: Added support for displaying the number of excluded suburbs due to data quality issues. The UI now shows: "X suburbs excluded due to data quality issues (below DQ threshold: Y)" in `UnifiedSearchView.tsx:381-385`.

