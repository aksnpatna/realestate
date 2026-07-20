# PropertyIQ Data Architecture V3

## Overview
As of V3, the PropertyIQ pipeline has officially shifted away from fragile web scraping (onthehouse.com.au) to an institutional-grade, proxy-based data extraction model using **SQM Research**.

This document serves as the single source of truth for where our data comes from, how it is transformed, and where it lives in the Postgres database, preventing future extraction overlaps or schema corruption.

---

## 1. Core Data Sources & Delegation

| Metric Category | Primary Source | Fallback Source | Reason for Delegation |
| :--- | :--- | :--- | :--- |
| **Asking Prices (Houses/Units)** | **SQM Research** | OnTheHouse (Legacy) | SQM provides clean JSON array data with 15-year histories, bypassing severe WAF bot protection. |
| **Asking Rents (Houses/Units)** | **SQM Research** | ABS / Census (Legacy) | SQM provides weekly live rents. ABS data is 5 years out of date. |
| **Vacancy Rates** | **SQM Research** | *None* | Essential macro-indicator for investment risk; exclusively provided by SQM. |
| **Stock on Market (Inventory)** | **SQM Research** | OnTheHouse (Legacy) | SQM categorizes stock by age (0-30 days, 180+ days) revealing market stagnation. |
| **Demographics & Population** | **ABS (Census)** | *None* | Government ground-truth data for population, age, and occupation. |
| **Geo-Spatial & POIs** | **OpenStreetMap** | *None* | Powers 15-minute city metrics, transit scores, and school mapping via PostGIS. |

---

## 2. Extraction & ETL Pipeline

### Stage 1: Local VPN Extraction (SQM)
* **Script:** `backend/sqm_scraper_async.py`
* **Execution:** Manual execution over a local VPN (e.g., PureVPN set to Australia) to bypass IP blocking.
* **Mechanism:** Multithreaded (3 workers max). Fetches data by Postcode (2,188 postcodes covering 13,000+ suburbs).
* **Storage:** Injects JSON data directly into `suburbs_ui_v3.demographics_detail -> 'sqm_data'`. Also updates top-level snapshot columns (`vacancy_rate`, `house_median_rent`, `house_median_price`).

### Stage 2: Database Normalization & DQ Scoring
* **Script:** `backend/enrich_from_unpacked.py`
* **Mechanism:** Merges ABS demographics, OpenStreetMap POIs, and legacy `suburbs_all` data into the `suburbs_ui_v3` master table.
* **Conflict Resolution:** The `ON CONFLICT DO UPDATE` clause explicitly preserves SQM data over legacy data using `COALESCE(suburbs_ui_v3.house_median_price, EXCLUDED.house_median_price)`.
* **Data Quality (DQ) Score:** SQM acts as the primary health check. If SQM Asking Price exists, the suburb instantly achieves a **100/100 DQ Score**, overriding legacy missing-data penalties.

---

## 3. The Database Schema (`suburbs_ui_v3`)

### Top-Level SQM Snapshot Columns
These columns are used for ultra-fast UI rendering and filtering in the Buy Finder:
* `vacancy_rate` (Float): Percentage of empty rentals (e.g., 1.22).
* `total_properties` (Integer): Total listings on market right now.
* `house_median_price` / `unit_median_price` (Float): Asking prices.
* `house_median_rent` / `unit_median_rent` (Float): Weekly asking rents.

### The Historical Payload (`demographics_detail->'sqm_data'`)
This JSONB column holds the heavy 15-year arrays used for rendering Highcharts in the Suburb Profile.
```json
{
  "sqm_data": {
    "prices": [{"date": "2010-01-01", "houses_all": 500000, "units_all": 350000}],
    "rents": [{"date": "2010-01-01", "houses_all": 450, "units_all": 350}],
    "vacancy": [{"year": 2010, "month": 1, "vr": "0.012", "listings": 120}],
    "stock": [{"year": 2010, "month": 1, "total": 45, "r30": 10, "r180p": 5}]
  }
}
```

---

## 4. Decommissioning Legacy Systems
* **OnTheHouse Scraper:** The `backend/micro_scraper_v4.py` and `parallel_scraper.py` are now considered legacy. We will stop maintaining them. They serve only as a fallback for niche fields (like `days_on_market`) until we derive DOM from SQM Stock arrays.
* **UI Dependency:** The React frontend now expects `vacancy_rate` and `house_median_rent` at the top level of the API response, completely replacing the static `abs_rent` or mocked UI fallbacks.
