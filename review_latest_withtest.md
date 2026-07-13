# Real Estate GitHub Remediation and Test Plan

**Repository:** [aksnpatna/realestate](https://github.com/aksnpatna/realestate)  
**Reviewed revision:** `master` at `5c09fa7c9ed4a865068c5e799ef1ba99a8b93aff`  
**Review date:** 2026-07-14  
**Purpose:** Strict implementation requirements for the internal Buyer Fit POC.

## 1. Decision

The reviewed commit contains the intended POC direction, but it is **not a clean pass**. It is suitable for continued internal development and a controlled showcase only after the blocking items in this document are fixed and the required tests pass.

The POC must present a deterministic, current-data Buyer Fit workflow. It must not present unsupported personal affordability, calibrated investment probabilities, or long-horizon forecasts as established facts.

## 2. Non-Negotiable Rules

These rules are acceptance gates, not suggestions.

### Must not happen

1. A suburb below the configured POC DQ threshold may not appear in a ranked recommendation response.
2. A suburb with synthetic recommendation inputs may not be ranked or used as a recommendation driver.
3. A minimum-yield control may not be displayed unless it is enforced by the backend.
4. A budget input may not be described as personal affordability unless income, deposit, debt assumptions, transaction costs, and borrowing assumptions are used.
5. The frontend may not calculate a second Buyer Fit score.
6. A frontend heuristic may not be presented as the authoritative Decision Brief.
7. A historical CAGR calculation may not be labelled or displayed as a 10-year forecast.
8. An uncalibrated Monte Carlo scenario may not be labelled as a probability, prediction, expected outcome, or forecast.
9. An AI claim may not cite an evidence ID that the backend cannot resolve to a real evidence record.
10. A generic source label or current-date placeholder may not be used as a substitute for the actual source timestamp and lineage.
11. Unavailable data may not silently become mock data, default data, or an empty successful result.
12. AI output that fails schema validation may not be persisted as a normal verdict.
13. Incorrect or superseded committee memory may not be retrieved for future prompts.
14. Model Diary records may not be described as calibrated performance until enough verified outcomes exist.
15. A release may not be declared ready without frontend and backend validation against the reviewed code.

## 3. Current Status Summary

| Area | Current status | Release decision |
|---|---|---|
| Central POC configuration | Implemented in `backend/poc_config.py` | Keep and test |
| DQ gate for Buy Finder | Implemented using raw `dq_score >= 80` | Fix consistency and test |
| DQ gate for all display paths | Incomplete because synthetic input status is not consistently passed | Blocker |
| Backend Buyer Fit endpoint | Implemented at `POST /api/buy-finder/rank` | Keep and test |
| Client-side ranking | Removed from Buy Finder | Regression-test |
| Affordability | Incorrectly reduces to full budget | Blocker |
| Minimum yield | Accepted by request but not enforced | Blocker |
| Evidence endpoint | Present but partly generic and not fully source-linked | Blocker |
| Structured AI output | Implemented with validation fallback | Keep and test |
| AI evidence grounding | Schema exists, registry validation is incomplete | Blocker |
| Synthetic predictive engine | Demo-labelled and disabled by default | Keep and test isolation |
| Risk what-if | Backend endpoint exists and is uncalibrated-labelled | Keep and test wording |
| 10-year projection UI | Still present in `src/App.tsx` | Blocker |
| Decision Brief | Client-side heuristic | Blocker or explicitly downgrade |
| Model Diary schema | Present | Verify operational refresh |
| Model Diary outcome job | Not demonstrated | Blocker for training-readiness claims |
| Mock fallback | Removed from `src/App.tsx` | Regression-test |
| Automated validation | Not yet executed for this review | Blocker before sign-off |

## 4. Blocking Remediation Items

## 4.1 Fix Buyer Fit affordability

### What is not right

`backend/buyfinder.py` currently uses an expression equivalent to:

```python
available_budget = req.deposit + (req.budget - req.deposit)
```

This always equals `req.budget`. It does not model:

- Borrowing capacity.
- Annual income.
- Existing debt.
- Interest rate or serviceability buffer.
- Stamp duty.
- Conveyancing and purchase costs.
- Deposit consumed by transaction costs.
- Loan-to-value ratio.
- Whether the requested deposit is sufficient for the property price.

The resulting score is a price-within-budget score, not a buyer affordability score.

### Required fix

Choose one of the following and document the choice in the API contract.

**Preferred POC implementation:** add explicit buyer inputs:

```json
{
  "budget": 850000,
  "deposit": 170000,
  "annual_income": 150000,
  "existing_monthly_debt": 0,
  "interest_rate": 0.062,
  "serviceability_buffer": 0.03,
  "loan_term_years": 30,
  "purchase_cost_allowance": 0.02
}
```

Calculate:

1. Purchase costs from state and price.
2. Funds remaining after purchase costs.
3. Required loan.
4. A documented borrowing-capacity estimate using income and debt assumptions.
5. A repayment or serviceability check.
6. An affordability score that is monotonic: more required borrowing must not improve the score.

The API must return the calculation assumptions and component values. Do not return only a score.

Example response shape:

```json
{
  "affordability": {
    "score": 72.4,
    "purchase_price": 800000,
    "purchase_costs": 32000,
    "available_deposit_after_costs": 138000,
    "required_loan": 662000,
    "estimated_borrowing_capacity": 700000,
    "serviceability_passed": true,
    "assumptions": {
      "interest_rate": 0.062,
      "serviceability_buffer": 0.03,
      "loan_term_years": 30
    }
  }
}
```

**Acceptable fallback:** if the POC cannot collect income and debt, rename the control and output to `price_within_declared_budget`. Do not call it affordability.

### Do not fix it by

- Increasing or decreasing the arbitrary score constant.
- Adding a disclaimer while retaining the word `affordable`.
- Using deposit plus budget without transaction costs.
- Hiding missing income behind a default income value.
- Letting the frontend calculate the affordability result.

## 4.2 Enforce minimum yield and other declared constraints

### What is not right

`minimum_yield` is accepted by the request and sent by the frontend, but the ranking path does not visibly enforce it as a hard constraint. It is not acceptable for a control labelled `Min Yield` to influence only a soft score or have no effect.

The old request contract also included maximum vacancy and environmental exclusions. The current POC deliberately simplified the request, but every remaining control must have a clear semantic contract.

### Required fix

Before calculating a rank, apply hard constraints:

```python
if request.minimum_yield is not None and gross_yield < request.minimum_yield:
    exclude("below_minimum_yield")
```

Return exclusions separately from ranked results:

```json
{
  "excluded": [
    {
      "suburb_id": "...",
      "reason": "below_minimum_yield",
      "actual_value": 2.8,
      "requested_value": 4.0
    }
  ]
}
```

Missing yield must not pass a minimum-yield constraint. It must be excluded as `yield_unknown` unless the user explicitly chooses an `include_unknowns` mode.

Either remove unsupported controls or implement them. Do not leave controls that look authoritative but do nothing.

## 4.3 Make DQ eligibility consistent

### What is not right

Buy Finder filters using the raw `SuburbUIV3.dq_score`, while the UI displays a recalibrated DQ value from `_calibrate_dq()`. Eligibility and displayed quality can therefore disagree.

The general `/api/suburbs` path also calls the eligibility helper with the synthetic-input argument hard-coded to false. This means Buy Finder has stronger synthetic-data isolation than general suburb display paths.

### Required fix

Create one server-side eligibility function that receives the full suburb record and returns both the decision and reasons:

```python
{
  "eligible": false,
  "reasons": ["dq_below_threshold", "synthetic_recommendation_inputs"],
  "raw_dq_score": 82,
  "eligibility_dq_score": 76,
  "threshold": 80
}
```

Use the same function in:

- `/api/suburbs`
- `/api/suburbs/{suburb_id}` where recommendations are shown
- `/api/similar-suburbs`
- `/api/buy-finder/rank`
- Any future recommendation or comparison endpoint

Choose one canonical DQ score for gating. Preferred approach:

- `raw_dq_score`: pipeline quality score.
- `eligibility_dq_score`: the score used for publication gating.
- Display both when they differ.

The UI must not imply that a displayed score of 80 means the raw pipeline score was 80 unless that is actually true.

## 4.4 Replace placeholder provenance with real evidence lineage

### What is not right

The evidence endpoint exists, but entries such as `Property market dataset` and current-month observation dates do not prove where a value came from. A loaded date is not an observed date.

The current evidence contract is therefore not yet sufficient to support the statement “trace every material metric to its source.”

### Required fix

Every evidence entry must contain:

```json
{
  "evidence_id": "raw:abc123:house_median_price:2026-06-30",
  "metric_name": "Median House Price",
  "value": 800000,
  "unit": "AUD",
  "source_type": "scraped_source",
  "source_name": "actual source system name",
  "source_url": "actual URL or null for controlled internal source",
  "source_record_id": "abc123",
  "observed_at": "2026-06-30T00:00:00Z",
  "loaded_at": "2026-07-01T02:15:00Z",
  "transform_run_id": "run-uuid",
  "direct_or_derived": "direct",
  "quality_status": "verified",
  "raw_snapshot_ref": "raw:abc123",
  "dq_issue": null
}
```

For derived metrics, include the input evidence IDs:

```json
{
  "evidence_id": "derived:house_gross_yield:2026-06-30",
  "direct_or_derived": "derived",
  "derived_from": [
    "raw:abc123:house_median_price:2026-06-30",
    "raw:abc123:house_median_rent:2026-06-30"
  ]
}
```

Do not fabricate source type, source name, or observation date. If the source timestamp is unavailable, return `observed_at: null` and `quality_status: "observation_date_unknown"`.

## 4.5 Validate AI evidence IDs against the evidence registry

### What is not right

Pydantic validation ensures that the AI response has the expected shape. It does not prove that the evidence IDs in the response exist or support the claim.

A model can still return a syntactically valid claim with an invented ID such as `vacancy_rate:2026`.

### Required fix

The backend must provide an evidence registry for each analysis request. Before persistence:

1. Parse the structured committee response.
2. Resolve every `evidence_id`.
3. Mark each claim as `supported`, `unsupported`, or `partially_supported`.
4. Reject or downgrade claims with unknown evidence IDs.
5. Persist the evidence snapshot used for the verdict.
6. Include the request ID and model version.

A committee response with no resolvable evidence must become `INSUFFICIENT_EVIDENCE`, not a normal `BUY`, `HOLD`, or `SELL` verdict.

## 4.6 Remove the unsupported 10-year projection

### What is not right

`src/App.tsx` still generates a “Next 10-Year Projection” from historical CAGR and bull/base/bear multipliers. This is forecast-style product behaviour without calibration, validated uncertainty, or a documented forecasting model.

Renaming “Growth Probability” to “Growth Score” does not fix the projection.

### Required fix

For the POC, remove the projection or replace it with:

- Historical price and rent series.
- A clearly labelled current snapshot.
- An uncalibrated scenario tool labelled `scenario only`.
- An explicit unavailable state for long-horizon forecasting.

Required wording if a scenario remains:

> Scenario illustration only. This is not an empirical probability, calibrated forecast, or financial prediction.

Do not use `forecast`, `prediction`, `expected price`, `probability`, or `confidence interval` for the current heuristic output.

## 4.7 Make Decision Brief server-consistent

### What is not right

`src/components/DecisionBrief.tsx` derives drivers, risks, and “what changes the result” in the browser from raw fields. Buy Finder separately receives backend-generated components and drivers.

This creates two possible explanations for the same suburb.

### Required fix

The Decision Brief must consume one of:

1. The backend Buyer Fit response already returned for the current request; or
2. A backend endpoint that returns a versioned decision snapshot with score components, drivers, risks, unknowns, and evidence IDs.

The response must include:

```json
{
  "decision_snapshot_id": "uuid",
  "model_version": "buyer-fit-poc-1.0.0",
  "request_id": "uuid",
  "suburb_id": "...",
  "score": 74.2,
  "components": {},
  "drivers": [],
  "risks": [],
  "unknowns": [],
  "evidence_ids": [],
  "generated_at": "..."
}
```

The frontend may format the result, but it must not recalculate it.

## 4.8 Complete Model Diary outcome evaluation

### What is not right

The schema supports prediction dates and realized outcomes, but the inspected scheduler primarily handles scraping, unpacking, and enrichment. A reliable outcome-refresh process was not demonstrated.

Stored fields alone do not create future training data.

### Required fix

Add an idempotent scheduled job that:

1. Finds due Model Diary predictions at 6, 12, and 36 months.
2. Loads the same metric definitions used at prediction time.
3. Captures realized price, rent, vacancy, and other agreed outcomes.
4. Calculates outcome status and error metrics.
5. Stores the observation timestamp and source evidence IDs.
6. Never overwrites the original prediction snapshot.
7. Marks missing outcomes as `unavailable`, not zero.
8. Produces aggregate summaries only when the sample size is reported.

Do not call the model calibrated until the diary has a documented sample size, target definition, evaluation window, and measured performance.

## 5. Already-Fixed Areas That Must Stay Fixed

The following changes in the reviewed commit are correct and require regression coverage:

- `PUBLIC_POC_MIN_DQ_SCORE` is centrally configured and defaults to 80.
- `DEMO_MODE` defaults to false.
- Silent mock fallback was removed from `src/App.tsx`.
- Buy Finder calls `POST /api/buy-finder/rank`.
- Client-side Buy Finder scoring was removed.
- The UI displays model version and DQ threshold.
- Structured AI output is validated.
- Invalid AI output becomes `INSUFFICIENT_EVIDENCE`.
- Predictive demo output is labelled `synthetic_demo`.
- Buy Finder excludes synthetic recommendation inputs.
- Risk what-if output is labelled uncalibrated scenario output.
- Model Diary and CommitteeMemory contain model and outcome metadata.

A future change must not restore any mock fallback, browser-side ranking, probability wording, or synthetic-data use in a recommendation path.

## 6. Required Test Plan

## 6.1 Backend unit tests for Buyer Fit

Add tests under the backend test suite, for example `backend/tests/test_buyfinder.py`.

### Test: price within budget is not the same as affordability

Arrange a buyer with:

- Budget: 850,000.
- Deposit: 170,000.
- Annual income: 80,000.
- Existing debt: 2,000 per month.

Use a property priced at 800,000. The result must not claim high personal affordability merely because the price is below budget. It must either fail serviceability or return a materially reduced affordability score.

Expected assertions:

```python
assert result["affordability"]["required_loan"] > 0
assert result["affordability"]["serviceability_passed"] is False
assert result["affordability"]["score"] < 50
```

### Test: stronger income improves affordability monotonically

Use the same suburb and deposit. Compare annual income of 100,000 and 160,000.

```python
assert high_income_result.score >= low_income_result.score
```

The reverse must never occur.

### Test: transaction costs reduce available deposit

Use a property where the deposit is exactly enough for the nominal deposit but not enough after stamp duty and purchase costs.

```python
assert result["affordability"]["available_deposit_after_costs"] < request.deposit
assert result["affordability"]["required_loan"] > nominal_required_loan
```

### Test: minimum yield is a hard exclusion

```python
request.minimum_yield = 4.0
property.house_gross_rental_yield = 3.9

result = compute_buyer_fit(property, request)

assert result["eligibility"] == "excluded_minimum_yield"
assert result["hard_constraints_passed"] is False
assert "below_minimum_yield" in result["hard_failures"]
```

### Test: missing yield cannot pass a minimum-yield filter

```python
request.minimum_yield = 4.0
property.house_gross_rental_yield = None

assert result["eligibility"] == "excluded_yield_unknown"
```

### Test: zero or negative weights are handled safely

```python
request.weights = BuyFinderWeights(
    affordability=0,
    income=0,
    livability=0,
    access=0,
    evidence=0,
)

assert result["buyer_fit_score"] == 0
```

The endpoint must not return NaN, infinity, or a server error.

## 6.2 Backend eligibility and DQ tests

### Test: DQ threshold is enforced

```python
settings.PUBLIC_POC_MIN_DQ_SCORE = 80
suburb.dq_score = 79

response = rank_suburbs(request, db)

assert suburb.id not in result_ids(response)
assert excluded_reason(response, suburb.id) == "excluded_dq"
```

### Test: threshold is configurable

Run the same fixture with thresholds 80 and 90. The result set must change predictably and the response must return the active threshold.

```python
assert response["dq_threshold"] == 90
```

### Test: synthetic recommendation inputs are excluded in every path

Set:

```python
suburb.dq_issues = {
    "predictive_analysis": {
        "quality_status": "synthetic_demo"
    }
}
```

Assert exclusion from:

- `/api/buy-finder/rank`
- `/api/suburbs`
- `/api/similar-suburbs`
- Any comparison or recommendation endpoint

### Test: raw and eligibility DQ are explicit

If calibrated DQ differs from raw DQ, the API must return both values and the gate must use the documented canonical value.

## 6.3 Evidence and provenance tests

### Test: every evidence ID resolves

For every ranked result and every AI claim:

```python
for evidence_id in result["evidence_ids"]:
    assert evidence_registry.resolve(evidence_id) is not None
```

### Test: derived metrics list their inputs

For rental yield, assert that the evidence record references the actual price and rent evidence IDs.

### Test: source dates are not fabricated

When source observation time is unavailable:

```python
assert evidence["observed_at"] is None
assert evidence["quality_status"] == "observation_date_unknown"
```

The endpoint must not manufacture the current month as the observation date.

### Test: AI claims with unknown IDs are downgraded

```python
verdict = CommitteeVerdict(
    verdict="BUY",
    claims=[
        EvidenceClaim(
            claim="Strong demand",
            evidence_ids=["does-not-exist"],
        )
    ],
)

validated = validate_claim_evidence(verdict, registry)

assert validated.verdict == "INSUFFICIENT_EVIDENCE"
```

## 6.4 Backend risk tests

### Test: risk endpoint uses one canonical path

Mock the backend risk engine and call `/api/risk/what-if`. Assert that the frontend-facing route invokes the backend engine and does not calculate risk independently.

### Test: risk wording is uncalibrated

The response must contain:

```json
{
  "is_calibrated": false,
  "calibration_note": "...",
  "scenario_type": "price_decline_scenario"
}
```

It must not contain user-facing `probability` wording for this result.

### Test: invalid numeric inputs are rejected

Reject negative prices, invalid rates, impossible yields, and NaN-like values with a 4xx response. Do not silently coerce invalid inputs into plausible numbers.

## 6.5 Model Diary tests

### Test: prediction snapshot is immutable

Create a diary record, update current suburb metrics, and verify that the original baseline and evidence IDs remain unchanged.

### Test: outcome refresh is idempotent

Run the outcome job twice. It must not duplicate outcome records or change the original prediction snapshot.

### Test: unavailable outcomes remain unavailable

If a future source is missing, assert that the outcome is `unavailable` rather than zero or a fabricated value.

### Test: calibration summary reports sample size

A summary must include sample count and evaluation window. It must not report calibrated performance for zero or insufficient observations.

## 6.6 Frontend tests

Add or extend Vitest and Testing Library tests.

### Test: Buy Finder uses the backend result

Mock `POST /api/buy-finder/rank` and assert that the rendered Buyer Fit value equals the backend value.

Change the raw suburb fixture after the response is returned. The rendered score must not change unless another backend request is made.

### Test: Buy Finder does not rank locally

Search the component test or use a fixture where the old browser formula would rank suburb A above suburb B while the backend ranks B above A. Assert the displayed order follows the backend response.

### Test: backend failure shows unavailable state

```typescript
mockFetch.mockRejectedValueOnce(new Error('Network error'))

expect(await screen.findByText('Data Unavailable')).toBeInTheDocument()
expect(screen.queryByText(/showing client-side results/i)).not.toBeInTheDocument()
```

### Test: minimum-yield control is sent to the backend

Set the UI control to 4%. Assert the request body contains:

```typescript
expect(body.minimum_yield).toBe(4)
```

The test must also verify that the response excludes a below-threshold suburb.

### Test: Decision Brief renders backend data

Mock a decision snapshot with known drivers and risks. Assert those exact values render. Change the raw suburb fields without changing the snapshot and assert that the drivers and risks do not change.

### Test: unsupported projection is absent or explicitly unavailable

Assert that the UI does not render `Next 10-Year Projection` as a forecast. If a historical scenario remains, assert that it includes the required scenario disclaimer.

### Test: risk labels remain correct

Assert that the UI uses `scenario`, `scenario range`, or `price decline scenario`, and does not render `probability` or `forecast` for the uncalibrated output.

### Test: AI invalid output produces insufficient evidence

Mock an invalid backend committee response or backend fallback and assert that the UI displays `INSUFFICIENT_EVIDENCE` rather than `BUY` or `HOLD`.

## 7. API Contract Tests

Add contract tests for these endpoints:

| Endpoint | Required contract |
|---|---|
| `GET /api/poc/config` | Returns active DQ threshold, demo mode, mock mode, model version |
| `GET /api/suburbs` | Returns only eligible records in public POC mode; no silent fallback |
| `GET /api/suburbs/{id}/evidence` | Returns resolvable source-linked evidence records |
| `GET /api/similar-suburbs` | Applies the same DQ and synthetic gates |
| `POST /api/buy-finder/rank` | Applies hard constraints server-side and returns model/request metadata |
| `GET /api/risk/what-if` | Returns uncalibrated scenario metadata |
| `POST /api/model-diary/predictions` | Persists an immutable prediction snapshot |
| `GET /api/model-diary/summary` | Reports sample size and outcome status |

Every response containing a recommendation must include enough metadata to reproduce or audit the result:

- `model_version`
- `request_id` or `decision_snapshot_id`
- DQ threshold and applied gate
- component scores and weights
- drivers and risks
- unknown fields
- evidence IDs
- generation timestamp

## 8. Release Test Commands

Run these from the repository root after checking out the reviewed implementation and fixes:

```powershell
npm ci
npm run build
npm run test
npm run lint
```

Backend syntax and import checks:

```powershell
python -m compileall backend
python -m pytest backend/tests -q
```

If the repository does not yet have a complete backend test suite, add the focused tests in this document before treating the result as validated.

Run the API contract tests against a test database with:

- `PUBLIC_POC_MODE=true`
- `PUBLIC_POC_MIN_DQ_SCORE=80`
- `DEMO_MODE=false`
- `ALLOW_MOCK_SUBURBS=false`

Then repeat the eligibility tests with `PUBLIC_POC_MIN_DQ_SCORE=90` to prove the threshold is configuration-driven.

## 9. Minimum Showcase Acceptance Criteria

The showcase may proceed only when all of the following are true:

- Buyer Fit is calculated only by the backend.
- Affordability is either correctly modelled or explicitly renamed to price-within-budget.
- Minimum yield behaves as a real hard constraint.
- DQ and synthetic-input gates are consistent across recommendation paths.
- Evidence IDs resolve to actual source or transform records.
- The Decision Brief uses the backend decision snapshot.
- The unsupported 10-year forecast is removed or clearly downgraded to a scenario illustration.
- Risk output is labelled uncalibrated scenario output.
- AI claims with unknown evidence IDs cannot become normal verdicts.
- Model Diary captures immutable prediction snapshots and has an idempotent outcome refresh path.
- Frontend build, tests, lint, backend compilation, and backend tests pass.
- The UI shows an explicit unavailable state when the API or database is unavailable.

## 10. Final POC Position

The repository has a credible foundation for a friend-circle or internal NPD demonstration. The strongest story is:

> A backend-owned, deterministic Buyer Fit shortlist over an explicitly quality-gated snapshot dataset, with transparent component scores, evidence lineage, and AI used for explanation rather than unsupported prediction.

Do not claim that the POC provides:

- Personal financial advice.
- Calibrated investment probabilities.
- Reliable 10-year forecasts.
- Fully trained or calibrated machine learning.
- Complete source provenance until the evidence registry is implemented.
- Personal affordability until the affordability calculation uses the buyer's financial inputs.

The implementation should be presented as a controlled decision-support prototype with explicit unknowns and evidence gaps. That is credible. The current defects become dangerous only when the UI makes stronger claims than the data and calculations can support.
