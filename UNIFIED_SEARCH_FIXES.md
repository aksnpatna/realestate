# Fix Summary: Unified Search Tests

## Issues Found and Fixed

### 1. Clarification Questions Not Visible in UI
- **Issue**: When the NLP model returns a `needs_clarification` response, questions were only logged to console.log, leaving the user without feedback
- **Fix**: Added a yellow-bordered clarification card in `src/components/UnifiedSearchView.tsx:276-281`
- **Verification**: Tested with query "test"

### 2. Excluded Suburbs List Not Rendered
- **Issue**: The UI didn't display the number of suburbs excluded due to data quality issues
- **Fix**: Added support for showing excluded count and DQ threshold in `src/components/UnifiedSearchView.tsx:381-385`
- **Verification**: Tested with TAS rank call

### 3. Budget Filter Not Enforced
- **Issue**: Suburbs with median prices above budget were still included in results
- **Fix**: Added explicit budget check in `backend/buyfinder.py:173-187`
- **Verification**: Tested with $500k budget in TAS

### 4. Weight Sum Validation Missing
- **Issue**: The backend didn't validate weight inputs
- **Fix**: Added weight sum validation in `backend/main.py:2680-2683`
- **Verification**: Tested with zero-sum and 200% sum weights

### 5. Investment Search Intent Routing Issue
- **Issue**: Investment search queries without specific suburbs were being treated as single_suburb_research and asking for clarification instead of showing discovery results
- **Fix**: Updated intent pipeline in `backend/ask/intent.py` and ask router in `backend/routers/ask_property.py`
- **Verification**: Tested with "Find investment areas in QLD under $900k with rental resilience"

## Changes Made

### Frontend
```diff
src/components/UnifiedSearchView.tsx:
+ Added clarificationQuestion state
+ Updated callQuery to set clarificationQuestion instead of console.log
+ Added clarification card UI component
+ Added excluded count display in ranking results
```

### Backend
```diff
backend/buyfinder.py:
+ Added explicit budget check before property type filtering

backend/main.py:
+ Added weight sum validation

backend/ask/intent.py:
+ Updated parse_intent_deterministic to treat investment search without suburbs as geo discovery
+ Updated run_intent_pipeline to preserve is_geo_discovery value after LLM parsing

backend/routers/ask_property.py:
+ Added investment_search to discovery route
```

### Git
```
fix: unified search - clarification UI, budget filter, investment discovery
ignore test files
```

## Verification

All changes are tested and passed:
- ✅ Clarification UI shown for "test" query
- ✅ Investment query returns discovery results
- ✅ Budget filter correctly excludes high-priced suburbs
- ✅ Weight sum validation returns 422 error
- ✅ Excluded count displayed in UI
- ✅ Linting and type checking passed
- ✅ Build completed successfully
- ✅ Docker container running with all fixes

## Final Test Results

| Test Scenario | Result | Notes |
|---------------|--------|-------|
| NLP query: "Find investment areas in QLD under $900k with rental resilience" | ✅ Complete discovery returned | 5 QLD suburbs with high yield |
| NLP query: "Compare Kenmore and Indooroopilly" | ✅ Comparison returned | 2 rows of comparison |
| Rank: TAS $500k FHB | ✅ Results returned | 50 eligible suburbs, 765 excluded |
| Rank: TAS $500k with 200% sum weights | ✅ Results returned | Scores normalized internally |
| Rank: TAS $500k with zero sum weights | ✅ Error returned | 422: "weights sum must be >0 and ≤1000" |
