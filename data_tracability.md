# SQM Research Data Tracability

## Overview
This document tracks all SQM Research data points that are scrapped, processed, and displayed in the UI. It ensures data consistency and completeness between the extraction, transformation, and presentation layers.

## SQM Data Points - Extraction Layer

### 1. Rents Data (`/weekly-rents.php`)
- Fields captured: `houses_all`, `houses_3`, `units_all`, `units_2`, `combined`, `date`
- Data type: Weekly rental prices
- Source format: JSON array

### 2. Vacancy Data (`/graph_vacancy.php`)
- Fields captured: `vr` (vacancy rate, decimal), `listings`, `properties`, `year`, `month`
- Data type: Monthly vacancy statistics
- Source format: JavaScript variable (var_data)

### 3. Stock Data (`/total-property-listings.php`)
- Fields captured: `total`, `r30`, `r60`, `r90`, `r180`, `r180p` (age buckets), `year`, `month`
- Data type: Monthly property listings by age
- Source format: JavaScript variable (var_data)

### 4. Prices Data (`/weekly-asking-prices.php`)
- Fields captured: `houses_all`, `houses_3`, `units_all`, `units_2`, `combined`, `date`
- Data type: Weekly asking prices
- Source format: JSON array

## SQM Data Points - Transformation Layer

### Processed Metrics (Stored in `suburbs_ui_v3`)
| Metric | Formula | Source | UI Displayed |
|--------|---------|--------|--------------|
| `house_median_price` | SQM `houses_all` (×1000 if <10000) | Prices endpoint | ✅ Yes - Market Indicators, Property Overview |
| `unit_median_price` | SQM `units_all` (×1000 if <10000) | Prices endpoint | ✅ Yes - Market Indicators, Property Overview |
| `house_median_rent` | SQM `houses_all` | Rents endpoint | ✅ Yes - Property Overview |
| `unit_median_rent` | SQM `units_all` | Rents endpoint | ✅ Yes - Property Overview |
| `house_gross_rental_yield` | (rent × 52 / price) × 100 | Rents + Prices | ✅ Yes - Market Indicators, Property Overview |
| `unit_gross_rental_yield` | (rent × 52 / price) × 100 | Rents + Prices | ✅ Yes - Property Overview |
| `house_median_price_1m_change_pct` | ((latest - 30d_ago) / 30d_ago) × 100 | Prices history | ❌ No |
| `house_median_price_3m_change_pct` | ((latest - 90d_ago) / 90d_ago) × 100 | Prices history | ❌ No |
| `house_median_price_12m_change_pct` | ((latest - 365d_ago) / 365d_ago) × 100 | Prices history | ✅ Yes - Market Indicators |
| `house_median_rent_12m_change` | ((latest - 365d_ago) / 365d_ago) × 100 | Rents history | ✅ Yes - Property Overview |
| `vacancy_rate` | SQM `vr` × 100 (decimal → percentage) | Vacancy endpoint | ✅ Yes - Market Indicators, SqmHistoricalChart |
| `total_properties` | Sum of `r30 + r60 + r90 + r180 + r180p` | Stock endpoint | ✅ Yes - Market Indicators |
| `house_days_on_market` | Weighted avg: (r30×15 + r60×45 + r90×75 + r180×135 + r180p×200) / total | Stock endpoint | ✅ Yes - Market Indicators |
| `house_stock_on_market` | Sum of `r30 + r60 + r90 + r180 + r180p` | Stock endpoint | ✅ Yes - Market Indicators |
| `house_gross_rental_yield_trend` | Current yield - yield_12m_ago | Rents + Prices history | ✅ Yes - Market Indicators |
| `dq_score` | 100 base, minus penalties for missing fields | All metrics | ✅ Yes - Property Overview |

### Raw History Data (Stored in `demographics_detail->'sqm_data'`)
| Data Category | Fields | UI Displayed |
|---------------|--------|--------------|
| `sold` | Yearly sold properties with sqm, address, ppsqm | ✅ Yes - SoldScatterplot |
| `vacancy` | Monthly vacancy rate history | ✅ Yes - SqmHistoricalChart |
| `stock` | Monthly stock on market history | ✅ Yes - SqmHistoricalChart |
| `rents` | Weekly rent history | ❌ No |
| `prices` | Weekly price history | ❌ No |

## UI Components Displaying SQM Data

### 1. **MarketIndicatorsSection.tsx**
Displays processed SQM metrics:
- Demand / Supply Ratio (from supplyDemandRatio)
- Absorption Rate (from houseSold12m / houseStockOnMarket)
- Days on Market (from houseDaysOnMarket)
- Vacancy Rate (from vacancyRate)
- Price 12M Change (from houseMedianPrice12mChangePct)
- Price / Rent Ratio (from priceToRentRatio)
- Price / Income Ratio (from priceToIncomeRatio)
- Vendor Discounting (from houseMedianPrice12mChangePct)
- Investor % (from investorRate)
- Yield Trend (House) (from houseGrossRentalYieldTrend)

### 2. **SqmDashboard.tsx**
Manages SQM data fetching and displays:
- Recent Sold Properties (SoldScatterplot)
- Vacancy Rate Trends (SqmHistoricalChart)

### 3. **SqmHistoricalChart.tsx**
Displays historical trends:
- Vacancy rate over time (line chart)
- Stock on market over time (line chart)
- AI insights on market trends

### 4. **SoldScatterplot.tsx**
Displays sold properties:
- Price per sqm vs land size scatterplot
- Data from `sqm_data->'sold'`

### 5. **Property Overview (App.tsx)**
Displays key metrics:
- House Median Price
- Unit Median Price
- House Median Rent
- Unit Median Rent
- House Gross Rental Yield
- Unit Gross Rental Yield
- Vacancy Rate
- Days on Market

## Data Tracability Matrix

### Extraction → Transformation → Display
```
Rents Data (API) → house_median_rent, unit_median_rent → Property Overview
Rents Data (API) → house_gross_rental_yield, unit_gross_rental_yield → Property Overview, Market Indicators
Rents Data (API) → house_gross_rental_yield_trend → Market Indicators
Rents History → ❌ Not displayed in UI

Prices Data (API) → house_median_price, unit_median_price → Property Overview
Prices Data (API) → house_median_price_12m_change_pct → Market Indicators
Prices History → ❌ Not displayed in UI

Vacancy Data (API) → vacancy_rate → Property Overview, Market Indicators, SqmHistoricalChart
Vacancy History → SqmHistoricalChart (vacancy rate trend)

Stock Data (API) → total_properties, house_days_on_market, house_stock_on_market → Market Indicators
Stock History → SqmHistoricalChart (stock on market trend)

Sold Data (JSON) → SoldScatterplot (price per sqm vs land size)
```

## Missing UI Representations

### 1. Weekly Rent History
- **Issue**: Rents history is scraped but not displayed in the UI
- **Recommendation**: Add a line chart to SqmHistoricalChart to show rent trends over time
- **Impact**: Helps investors understand rental growth patterns

### 2. Weekly Price History
- **Issue**: Prices history is scraped but not displayed in the UI  
- **Recommendation**: Add a line chart to SqmHistoricalChart to show price trends over time
- **Impact**: Provides complete picture of market appreciation

### 3. 1-Month and 3-Month Price Changes
- **Issue**: Short-term price change metrics are calculated but not displayed
- **Recommendation**: Add these metrics to MarketIndicatorsSection or Property Overview
- **Impact**: Shows recent price momentum

## Action Items

1. **Enhance SqmHistoricalChart.tsx**:
   - Add weekly rent history chart
   - Add weekly price history chart
   - Add tooltips and legends for new charts
   - Ensure charts are responsive and mobile-friendly

2. **Update MarketIndicatorsSection.tsx**:
   - Add 1-month price change metric
   - Add 3-month price change metric
   - Update impact descriptions for new metrics

3. **Add Data Quality Indicators**:
   - Display data freshness (last updated date)
   - Show DQ score in SqmDashboard
   - Add tooltips explaining data sources and calculations

## Verification Steps

### To validate SQM data display:
1. Navigate to `/api/suburbs/{suburb_id}` and check the response
2. Compare metrics with `/api/suburbs/{suburb_id}/sqm` raw data
3. Verify metrics in MarketIndicatorsSection
4. Check SoldScatterplot data points
5. Validate historical trends in SqmHistoricalChart

### Test Suburbs for Validation:
- Point Cook, VIC (VIC_POINT_COOK_3030)
- Tarneit, VIC (VIC_TARNEIT_3029)
- Melbourne, VIC (VIC_MELBOURNE_3000)
- Sydney, NSW (NSW_SYDNEY_2000)

## Conclusion

The UI currently displays a comprehensive set of SQM Research data points, but there are opportunities to enhance it with additional historical trend charts and short-term price change metrics. These improvements would provide investors with a more complete view of market dynamics.