# Platform Audit and Data Traceability

## 1. Market Data and Chart Issues (SQM Data)
**Issue:** Rent Trends and Price Trends charts were appearing blank for specific suburbs (e.g., Point Cook, Wyndham Vale).
**Root Cause:**
- Point Cook’s rent data points in the database had hundreds of records (weekly data points like `2009-08-01`, `2009-08-08`). 
- When generating `chartData`, these weekly points are appropriately mapped to a single monthly `dateStr` (`"2009-08"`). 
- However, the `LineChart` components had a data filter `data={chartData.filter(d => d.houseRent != null || d.unitRent != null)}`.
- Due to the filtering logic combined with how `Recharts` dynamically builds axis domains, filtering down resulted in empty render paths for specific properties that had missing `null` points in the consolidated `chartData`.
**Fix:**
- Removed the manual `.filter()` layer inside the `<LineChart>` calls in `SqmHistoricalChart.tsx`.
- Relied on Recharts' native `connectNulls={true}` and dynamic auto-domain calculation `domain={['auto', 'auto']}` to accurately map sparse timeline points and correct rendering across all charts.
**Status:** ✅ Resolved.

## 2. Suburb State Searching
**Issue:** Suburb profile dropdown and search were restricted by default only to Victorian suburbs.
**Root Cause:** 
- `App.tsx` state `activeState` was initialized to `"VIC"`.
- The `stateSuburbs` filter excluded any suburbs outside the `activeState`, locking the search box.
- The `backend` endpoint `/api/suburbs` limited default fallback states to `['VIC', 'NSW', 'QLD', 'TAS', 'SA']`, entirely excluding `WA`, `NT`, and `ACT`.
**Fix:**
- Modified `activeState` default to an empty string `""` in `App.tsx`.
- Updated the dropdown select with an explicit `<option value="">All areas</option>`.
- Updated `stateSuburbs` `useMemo` to allow `s.state === activeState || activeState === ''`.
- Added `'WA', 'NT', 'ACT'` to the list of fetched default states in `backend/main.py`.
**Status:** ✅ Resolved.

## 3. WA Heatmap Missing
**Issue:** Heatmap did not show data for Western Australia (WA).
**Root Cause:**
- The PostGIS `public.suburbs_heatmap_view` and `suburbs_ui_v3` tables had WA data loaded (1,906 WA suburbs with geometry, 1,682 with yields).
- `pg_tileserv` (the map vector tile server) caches tiles aggressively. It was serving cached tiles generated before the WA data was fully ingested into `suburbs_ui_v3`.
**Fix:**
- Triggered a container restart via `docker restart realestate-tileserv` to purge the vector tile cache and force dynamic queries on `public.suburbs_heatmap_view`, instantly enabling WA markers.
**Status:** ✅ Resolved.

## Deployment
All changes pushed to `realestate-backend`, `realestate-engine`, and `realestate-tileserv`.
