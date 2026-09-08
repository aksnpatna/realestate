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

#### Frontend Changes
1. Ensure the frontend is built and the Docker image is updated:
   ```bash
   # Stop the existing frontend container
   docker stop realestate-engine
   
   # Remove the old container
   docker rm realestate-engine
   
   # Rebuild the frontend image
   docker build -t realestate-realestate .
   
   # Start a new frontend container
   docker run -d --name realestate-engine --network realestate_default --ip 172.19.0.3 --tmpfs /var/cache/nginx --restart unless-stopped -p 8082:80 --env-file .env realestate-realestate
   ```

#### Backend Changes
1. Push backend changes via Docker Compose:
   ```bash
   docker compose up -d --build backend
   ```

#### Verification
- Check the frontend container logs: `docker logs realestate-engine`
- Test the API: `curl -X POST "http://localhost:8100/api/login" -H "Content-Type: application/json" -d '{"email": "teraamit@gmail.com", "password": "password321"}' -c cookies.txt`
- Test the suburbs API: `curl -s "http://localhost:8100/api/suburbs?state=NSW" -b cookies.txt`

### Delta Changes Log
*(Future changes to be recorded here)*
- **2026-09-06**: Fixed memory exhaustion in `get_suburbs` endpoint by introducing a 500-record-per-state limit. Offloaded news sentiment generation to external LLM to save 2GB RAM. Added `SqmDashboard`, `MarketPulseTab`, and `SoldScatterplot` React components.
- **2026-09-06 (UI Bug Fixes)**: Fixed empty/broken historical charts in the Market Tab (`SqmHistoricalChart.tsx`). Addressed missing `total` fields in SQM stock data by dynamically summing buckets (`r30`, `r60`, etc.), normalized inconsistent date formats between monthly/weekly data, and enabled `connectNulls` on Recharts to prevent disjointed datasets from rendering blank charts. Pushed changes to frontend docker container.
- **2026-09-06 (Unified Search Fixes)**: 
  - **Clarification Questions Visible**: Fixed the issue where clarification questions were only logged to console.log instead of being displayed to the user. Added a visible clarification card with yellow border in `UnifiedSearchView.tsx:276-281`.
  - **Excluded DQ List Rendered**: Added support for displaying the number of excluded suburbs due to data quality issues. The UI now shows: "X suburbs excluded due to data quality issues (below DQ threshold: Y)" in `UnifiedSearchView.tsx:381-385`.
- **2026-09-06 (Test Results)**: Retested the unified search functionality:
  - ✅ NLP path returns discovery results for UI example query "Find investment areas in QLD under $900k"
  - ✅ Clarification questions are properly displayed in the UI
  - ✅ Excluded DQ list is rendered
  - ⚠️ Comparison query still has "AI synthesis unavailable" issue
  - ⚠️ Manual ranking endpoint requires valid session token for testing

- **2026-09-07 (UI Overhaul Phase 1-3)**: 
   - **Phase 1 (Shell, Navigation & Brand)**: Replaced basic navigation with a premium desktop sidebar and mobile bottom nav in `AppShell.tsx`. Overhauled `LandingPage.tsx` with a full-bleed animated hero, social proof strips, and persona cards. Introduced a new design system in `index.css` (PropertyIQ brand, deep navy background, teal accents, DM Sans & Inter typography). Renamed YieldSense/Suburbly references to **PropertyIQ**.
   - **Phase 2 (Unified Search UX)**: Redesigned `UnifiedSearchView.tsx` to feature a conversational hero header, quick-start pill actions, and interactive slider UX for manual filters. Transformed raw NLP output into visually rich 'Story Cards' and rendered suburb discovery results in a clean, animated grid format (`us-suburb-card`).
   - **Phase 3 (Suburb Profile Redesign)**: Created a new premium `SuburbHero.tsx` header for suburb profiles with dynamic SVG `SuburbScoreRing` components. Cleaned up the legacy complex profile header in `App.tsx` by integrating `SuburbHero` for a unified, modern data presentation format.
- **2026-09-07 (World-Class UI Enhancements)**:
   - **Dynamic Background Visuals**: Added animated Australian landscape backgrounds (Sydney Opera House, Melbourne CBD, Brisbane) with auto-rotating images and smooth transitions in `LandingPage.tsx` and `SuburbHero.tsx`.
   - **Enhanced Search Experience**: Added quick start suggestion tags for popular search queries and trust badges showing "13,000+ Suburbs Analyzed" and "AI-Powered Insights" in `LandingPage.tsx`.
   - **Immersive Suburb Profiles**: Enhanced `SuburbHero.tsx` with suburb-specific background imagery and added market sentiment indicator (Strong Buy/Neutral/Sell) with color coding.
   - **Smooth Animations**: Added fadeInUp, fadeInLeft, fadeInRight, pulse, and slideIn animations for better user engagement. Enhanced hover states with transforms and shadows in `index.css`.
   - **Premium Visual Design**: Added elevated shadows (`--shadow-elevated`, `--shadow-hover`), gradient overlays, and improved glass card styling with hover effects. Updated design system for more depth and premium feel.
   - **Social Proof & Trust Indicators**: Enhanced trust badges and official data source displays. Added suburb-specific sentiment indicators to build credibility.
- **2026-09-07 (SuburbHero Component Enhancement)**:
  - **Component Robustness**: Enhanced `SuburbHero` to accept `suburb: SuburbData | null` and handle null case gracefully.
  - **Bug Fixing**: Fixed unused imports in `ChatView.tsx`.
  - **CSS Optimization**: Implemented multiple CSS inclusion strategies to ensure styles are bundled correctly.
  - **Inline Styles**: Added inline styles to SuburbHero component as fallback.
  - **Deployment**: Rebuilt and re-deployed frontend Docker container.
  - **Status Documentation**: Created detailed `SUBURBHERO_STATUS.md` document to track pending issues.
  - **Pending**: CSS styles not being included in compiled bundle due to React tree-shaking; dynamic background image not visible.

- **2026-09-07 (Suburbs from All States & Image Display Fixes)**:
  - **State-Specific Suburbs**: Fixed the issue where only Victorian suburbs were being displayed. Updated `App.tsx` to include `activeState` in the useEffect dependencies, ensuring that when the user changes the state, the app fetches the corresponding suburbs.
  - **Image Display**: Enhanced `SuburbHero.tsx` to handle images from the backend. Now the component checks if the suburb has images (`suburb.images_json`) and displays the first one, or falls back to Unsplash with suburb-specific queries.
  - **API Response**: Updated the backend to include property images in the `/api/suburbs/{suburb_id}` endpoint. Added code to fetch images from the `property_listings` table and include them in the API response as `images_json`.
  - **Interface Update**: Added `images_json` field to the `SuburbData` interface in `src/data/suburbs.ts`.
   - **Docker Deployment**: Rebuilt and re-deployed the frontend Docker container to reflect the changes.

- **2026-09-07 (CSS Tree-Shaking Fix)**:
   - **Build Error**: Fixed "Failed to load transformWithEsbuild" error by adding esbuild as a dev dependency.
   - **CSS Inclusion**: Disabled tree-shaking in vite.config.ts to ensure all CSS styles are included in the bundle.
   - **Sourcemaps**: Added sourcemap generation for debugging purposes.
   - **Minification**: Configured esbuild as the minifier for better build performance.
   - **SuburbHero Styles**: Verified that .sh- class styles are now correctly included in the compiled CSS.
   - **Commit**: Pushed changes to repository with commit message "Add esbuild and fix CSS tree-shaking".

- **2026-09-07 (Suburb Profile Tab)**:
   - **Sidebar Navigation**: Added "Suburb Profile" tab to the "Library" group in the left sidebar.
   - **Mobile Navigation**: Added "Profile" tab to the mobile bottom nav.
   - **Commit**: Pushed changes to repository with commit message "Add Suburb Profile tab to sidebar and mobile nav".

- **2026-09-07 (Persona Switcher Overflow Fix)**:
   - **CSS Fix**: Added overflow control to the persona switcher to prevent it from spilling onto the main screen.
   - **Styles**: Updated .u-72b4a711 class in src/styles/utils.css to include width: 100%, overflow-x: auto, and padding-bottom: 4px.
   - **Commit**: Pushed changes to repository with commit message "Prevent persona switcher from overflowing sidebar".

- **2026-09-07 (Realestate-News-Updater Disabled)**:
   - **Performance Fix**: Disabled the news sentiment updater completely to eliminate CPU and memory consumption.
   - **Changes**:
     - Added `ENABLE_NEWS_UPDATER=false` to .env file
     - Modified `cron_news.py` to check the environment variable and sleep if disabled
     - Removed the news-updater service from docker-compose.yml
   - **Benefits**: Eliminates all CPU and memory usage associated with news sentiment analysis
   - **Deployment**: Stopped and removed the realestate-news-updater container
