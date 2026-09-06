# Data Auditability & Provenance Report

## The Need for Traceability

The previous ETL pipeline processed real estate data in **15–20 minutes** for a metro run. The new pipeline completes an equivalent data surface area across the **entire nation in seconds to minutes**. 

This dramatic shift in speed understandably raises questions regarding traceability and auditability. This document serves to explain the structural reasons for the performance increase and map exactly where the data originates.

## Performance: Why is it so fast?

### The Legacy Pipeline (OnTheHouse)
The old pipeline was heavily bottlenecked by **UI-Bound Web Scraping**:
1. It used `Playwright` to spin up a headless Chromium browser.
2. For each suburb, it had to parse and render Megabytes of React JavaScript, CSS, and images just to reveal a hidden JSON object (`window.REDUX_DATA`).
3. It had to perform synthetic `sleep()` delays to wait for elements to attach to the DOM.
4. Python then spent considerable time deserializing and "unpacking" these huge, bloated state payloads across 3 separate database orchestration steps (`raw_v3` -> `unpacked` -> `ui_v3`).

### The New Pipeline (SQM Research)
The new pipeline uses **Direct API Ingestion**:
1. It completely bypasses the browser layer. It uses `aiohttp` to send direct, concurrent HTTP GET requests to the SQM backend endpoints (e.g., `sqmresearch.com.au/graphs/graph_demographics.php`).
2. The server responds instantly with pure, minified JSON payloads (a few Kilobytes instead of Megabytes).
3. We utilize Python's `asyncio` and `ThreadPoolExecutor` to process multiple suburbs in parallel.
4. The pipeline writes the clean JSON and prices directly into the final `suburbs_ui_v3` serving table in a single atomic SQL transaction. 

By removing the browser overhead, the time complexity shifted from **UI Rendering Time** to pure **Network I/O latency**.

## Data Provenance Map

Where is the data coming from?

| Metric | Source Engine | Endpoint / Origin | Frequency | Target Table |
|--------|---------------|-------------------|-----------|--------------|
| **Median Price (House/Unit)** | SQM Research | `/graphs/graph_demographics.php` | Monthly | `suburbs_ui_v3.house_median_price` |
| **Weekly Asking Rent** | SQM Research | `/graphs/graph_demographics.php` | Monthly | `suburbs_ui_v3.house_median_rent` |
| **Vacancy Rate** | SQM Research | `/graphs/graph_vacancy.php` | Monthly | `suburbs_ui_v3.vacancy_rate` |
| **Stock on Market (Total Properties)** | SQM Research | `/total-property-listings.php` | Monthly | `suburbs_ui_v3.total_properties` |
| **Historical Price & Rent JSON** | SQM Research | (Embedded JSON payload) | Monthly | `suburbs_ui_v3.demographics_detail['sqm_data']` |
| **Rental Yield** | Database Native | SQL Math (`Rent * 52 / Price`) | Monthly | `suburbs_ui_v3.house_gross_rental_yield` |
| **Schools & ICSEA** | ACARA | Annual Data Dump | Annual | `suburbs_ui_v3.schools` |
| **Building Approvals** | ABS API | `abs.gov.au/8731.0` | Monthly | `suburbs_ui_v3.building_approvals_12m` |

## Auditing the Output

To verify the integrity of the data at any point, developers can query the raw JSON payload injected directly into the `suburbs_ui_v3` table.

```sql
-- View the raw stock arrays used to build the AI UI trends
SELECT name, demographics_detail->'sqm_data'->'stock' AS stock_history 
FROM suburbs_ui_v3 
WHERE postcode = '2000';
```

Because the SQM script updates the `last_updated` timestamp directly upon extraction, you can mathematically prove the pipeline's execution footprint:

```sql
-- See exactly how many suburbs were touched in the last 24 hours
SELECT COUNT(*) FROM suburbs_ui_v3 WHERE last_updated > NOW() - INTERVAL '1 day';
```
