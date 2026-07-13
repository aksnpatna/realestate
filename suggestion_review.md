# Real Estate Dashboard: Latest Implementation Review

**Repository:** [aksnpatna/realestate](https://github.com/aksnpatna/realestate)  
**Review date:** 2026-07-13

## Review Verdict

The latest repository is moving in the right direction, but the implementation is currently stronger at *displaying AI conclusions* than at proving them.

The AI has not disappeared. The current panel still exposes:

- News sentiment.
- Bull agent analysis.
- Bear agent analysis.
- Urban Planner analysis.
- CIO playbook.
- Monte Carlo risk.
- Policy warnings.
- Source excerpts.
- What-if controls.

The concern is valid, though: the UI currently exposes conclusions more strongly than the chain of evidence. Several audit structures exist in the schema without a complete user-facing or operational feedback loop.

A user can see a verdict such as `BUY` or `HOLD`, but cannot reliably answer:

- Which exact metrics caused it?
- Which sources support those metrics?
- How fresh are those sources?
- How confident should I be?
- Has this model been correct historically?
- What would change the verdict?

That is the central credibility gap.

## Findings

### 1. Critical: Buy Finder is not yet a complete buyer decision model

The new [BuyFinder.tsx](https://github.com/aksnpatna/realestate/blob/master/src/components/BuyFinder.tsx) is a useful UI start, but its scoring is currently a client-side heuristic:

```text
Fit Score =
growth * weight
+ yield * weight
+ affordability * weight
+ livability * weight
```

Current weaknesses:

- No deposit or borrowing-capacity input.
- No property-type selection between house and unit.
- No holding horizon.
- No minimum yield filter.
- No maximum vacancy filter.
- No flood or bushfire exclusion.
- No risk component in the Fit Score.
- No confidence band.
- No P10/P50/P90 projection.
- No downside probability.
- No shortlist comparison.
- No scatterplot.
- No persisted request or model version.
- No backend ranking endpoint.

The affordability calculation is particularly weak:

```text
affordability = 100 - medianPrice / 30000
```

This does not represent a buyer's affordability. A $750,000 suburb receives a score of 75 regardless of the buyer's income, deposit, debt, interest rate, stamp duty, or borrowing capacity.

#### Fix

Move ranking to a backend endpoint:

```text
POST /api/buy-finder/rank
```

Example request:

```json
{
  "budget": 850000,
  "deposit": 170000,
  "annual_income": 150000,
  "property_type": "house",
  "holding_period_years": 7,
  "objective": "balanced",
  "minimum_yield": 3.5,
  "maximum_vacancy": 4.0,
  "maximum_cbd_minutes": 60,
  "exclude_flood_risk": true,
  "exclude_bushfire_risk": true,
  "weights": {
    "growth": 30,
    "income": 25,
    "affordability": 20,
    "risk": 15,
    "livability": 10
  }
}
```

Example response:

```json
{
  "model_version": "buyfit-1.0.0",
  "request_id": "uuid",
  "results": [
    {
      "suburb_id": "NSW_PARRAMATTA_2150",
      "rank": 1,
      "fit_score": 78,
      "confidence": 0.71,
      "confidence_band": [68, 84],
      "expected_return": {
        "p10": -4.2,
        "p50": 5.8,
        "p90": 13.4
      },
      "downside_probability": 0.18,
      "hard_constraints_passed": true,
      "drivers": [],
      "risks": [],
      "evidence_ids": []
    }
  ]
}
```

The frontend should display the explanation of the score, not independently recalculate the score.

### 2. Critical: Fit Score is not yet fully transparent

The original generic score remains `growthScore`, generated in `main.py` by `_compute_growth_score()`. Buy Finder creates a separate `fitScore`, but users are not shown a complete, consistent score contract.

There are now effectively two scores:

- Backend `growthScore`.
- Frontend Buy Finder `fitScore`.

This creates a risk that users see one score on the profile and a different score in Buy Finder without understanding why.

#### Fix

Define one formal score vocabulary:

```text
Growth Score       = market growth signal only
Income Score       = rental/income signal
Risk Score         = downside and uncertainty signal
Livability Score   = lifestyle signal
Investment Fit     = buyer-weighted composite
```

Return an explicit breakdown:

```json
{
  "fit_score": 78,
  "components": {
    "growth": {
      "score": 82,
      "weight": 30,
      "contribution": 24.6
    },
    "income": {
      "score": 71,
      "weight": 25,
      "contribution": 17.75
    },
    "affordability": {
      "score": 76,
      "weight": 20,
      "contribution": 15.2
    },
    "risk": {
      "score": 61,
      "weight": 15,
      "contribution": 9.15
    },
    "livability": {
      "score": 72,
      "weight": 10,
      "contribution": 7.2
    }
  }
}
```

The UI should show:

> Fit Score: 78/100  
> 24.6 points from growth, 17.8 from income, 15.2 from affordability, 9.2 from risk, and 7.2 from livability.

This creates credibility without forcing users to read the entire AI debate.

### 3. High: AI evidence is not linked tightly enough to the verdict

The AI panel exposes Bull, Bear, Urban Planner, and the CIO playbook. That is useful, but the agent prompts still produce free text and the supervisor still parses its output with regular expressions in [ai_agent.py](https://github.com/aksnpatna/realestate/blob/master/backend/ai_agent.py).

The current flow is approximately:

1. Send metrics to multiple agents.
2. Ask the supervisor to produce formatted text.
3. Extract `VERDICT`, `STRATEGY`, `REALITY CHECK`, and `CATALYSTS` using regex.
4. Save the result.

This remains fragile. The prompts say “do not hallucinate,” but that instruction alone does not create evidence grounding.

The source excerpts shown in the UI are mostly news snippets. They do not establish which exact metrics support claims such as:

- Strong demand.
- Good growth potential.
- Affordable.
- Infrastructure catalyst.
- Low risk.

#### Fix

Every AI assertion should be structured:

```json
{
  "claim": "Rental demand appears resilient",
  "claim_type": "driver",
  "evidence_ids": [
    "vacancy_rate:2026-06-30",
    "days_on_market:2026-06-30",
    "rent_growth:2026-06-30"
  ],
  "confidence": 0.68,
  "status": "supported"
}
```

Add an evidence drawer with:

- Claim.
- Supporting metric values.
- Source.
- Observation date.
- Transformation date.
- Why the evidence supports the claim.
- Contradictory evidence, if present.

The AI tab should have two levels.

#### Decision summary

- Verdict.
- Confidence.
- Three supported drivers.
- Three risks.
- What would change the verdict.

#### Evidence and method

- Agent contributions.
- Exact metrics.
- News sources.
- Model version.
- LLM provider.
- Cache age.
- Missing data.
- Conflicting evidence.
- What-if analysis.

This solves the “too simple” problem without making the default screen noisy.

### 4. High: Structured AI output is incomplete

The repository now persists `raw_metrics_payload` in `CommitteeMemory`, which is good. However, [committee_memory.py](https://github.com/aksnpatna/realestate/blob/master/backend/committee_memory.py) still stores only a limited record:

- Suburb.
- State.
- Growth score.
- Yield.
- Vacancy.
- Median price.
- Arguments.
- Verdict.
- Playbook.
- Risk rating.
- Raw metrics.

It does not yet reliably store:

- Prompt version.
- Model version.
- Provider fallback path.
- Input hash.
- Source IDs.
- Source dates.
- Agent confidence.
- Evidence IDs.
- Assumptions.
- Unknowns.
- Parse status.
- Human review status.
- User feedback.
- Outcome labels.

The supervisor output remains regex parsed rather than schema validated.

#### Fix

Add a Pydantic contract:

```python
class EvidenceClaim(BaseModel):
    claim: str
    evidence_ids: list[str]
    confidence: float
    status: Literal["supported", "contradicted", "unknown"]


class CommitteeVerdict(BaseModel):
    verdict: Literal["BUY", "HOLD", "PASS"]
    confidence: float
    drivers: list[EvidenceClaim]
    risks: list[EvidenceClaim]
    assumptions: list[str]
    unknowns: list[str]
    insufficient_evidence: bool
    model_version: str
    prompt_version: str
    provider: str
```

If validation fails, return:

```json
{
  "verdict": "INSUFFICIENT_EVIDENCE",
  "confidence": 0.0,
  "unknowns": ["The AI response did not satisfy the evidence schema."]
}
```

Do not silently fall back to a partially parsed verdict.

### 5. High: Model Diary exists in schema, but not as a working feedback loop

The latest [models_v3.py](https://github.com/aksnpatna/realestate/blob/master/backend/models_v3.py) includes a `ModelDiary` table. That is progress, but a complete operational loop is still needed:

- Endpoint for viewing diary records.
- Scheduled job populating 6-, 12-, and 36-month outcomes.
- Benchmark comparison.
- Calibration metrics.
- Model performance dashboard.
- Evidence that recommendations are scored after the fact.

A table definition alone does not create model accountability.

#### Fix

Add:

```text
POST /api/model-diary/predictions
GET  /api/model-diary/{suburb_id}
GET  /api/model-diary/summary
POST /api/model-diary/refresh-outcomes
```

Persist each prediction with:

```text
prediction_id
suburb_id
property_type
prediction_date
model_version
feature_snapshot
weights
fit_score
predicted_probability
benchmark
baseline_price
baseline_yield
outcome_6m
outcome_12m
outcome_36m
outperformance_result
created_at
```

The summary endpoint should report:

- Brier score.
- Calibration error.
- Hit rate.
- Outperformance versus benchmark.
- Results by state.
- Results by property type.
- Results by price band.
- Results by confidence band.
- Results by model version.

Until this exists, do not use “probability” in the UI.

### 6. High: Metric-level provenance is not exposed

The database has useful lineage fields in `SuburbUIV3`, including:

- `abs_sourced_fields`
- `abs_etl_run_date`
- `dq_issues`
- `dq_score`
- `transform_version`
- `source_raw_id`
- `transform_run_id`
- `transform_timestamp`
- `last_updated`

That is a good internal foundation. The API still mainly returns plain values such as:

```json
{
  "houseMedianPrice": 750000,
  "houseGrossRentalYield": 4.2,
  "populationCagr": 1.4
}
```

The user cannot see whether each value is:

- Government sourced.
- Licensed commercial data.
- Transformed scraped data.
- Estimated.
- Derived.
- Stale.
- Missing or defaulted.

#### Fix

Return metric metadata:

```json
{
  "houseMedianPrice": {
    "value": 750000,
    "source_type": "licensed_commercial",
    "source_name": "Property market dataset",
    "observed_at": "2026-06-30",
    "loaded_at": "2026-07-02",
    "quality_status": "verified"
  }
}
```

The UI can keep this compact:

> Median price: $750k  
> Source: commercial dataset  
> Observed: Jun 2026  
> Confidence: High

For derived values:

> Population CAGR: 1.4%  
> Derived from ABS 2016 and 2021 census counts  
> Approximation: five-year CAGR

### 7. High: Mock or simulated data remains in production paths

The latest public [predictive_ai_engine.py](https://github.com/aksnpatna/realestate/blob/master/backend/predictive_ai_engine.py) still contains postcode arithmetic for:

- Infrastructure events.
- Rezoning events.
- Flood risk.
- Bushfire risk.

It also describes these as mock functions. If `run_predictive_engine()` is ever executed, results are written into `dq_issues["predictive_analysis"]`.

There is also a simulated mortgage-rate endpoint in [main.py](https://github.com/aksnpatna/realestate/blob/master/backend/main.py):

```text
source: "Simulated Live RBA + Margin API"
```

This is acceptable for a clearly labelled prototype, but not for a production recommendation engine.

#### Fix

Choose one of these paths:

1. Remove those fields entirely from production scoring.
2. Keep them only behind `DEMO_MODE=true`.
3. Replace them with authoritative dated datasets.
4. Return `status: unavailable` rather than a synthetic result.

The UI should never show a synthetic value beside government or licensed values without a prominent “simulated” label.

### 8. Medium: Monte Carlo results look more authoritative than their assumptions

The AI panel displays:

- Low/Medium/High risk.
- Decline probability.
- Projected median.
- Expected return.

The underlying [risk_engine.py](https://github.com/aksnpatna/realestate/blob/master/backend/risk_engine.py) uses a simple normal-return simulation whose mean is derived from the heuristic growth score and a few macro adjustments.

That can be useful as a scenario tool, but it is not yet a validated probability model. The what-if simulator in `AIInsightPanel.tsx` is even simpler and uses a separate client-side formula from the backend simulation. Therefore:

- The displayed decline probability may look statistically precise.
- The what-if result may not match the official risk engine.
- The model is not calibrated against historical outcomes.
- The simulation does not appear to model regime changes, serial correlation, transaction costs, or property-type differences.

#### Fix

Rename the display:

> Model scenario: estimated downside probability

Add:

- Simulation assumptions.
- Horizon.
- Number of iterations.
- Input snapshot date.
- Model version.
- Historical calibration status.
- Difference between scenario output and empirical probability.

Use the same backend endpoint for standard and what-if scenarios. Do not maintain a second risk formula in the frontend.

### 9. Medium: Few-shot memory can reinforce unverified AI opinions

The repository stores up to 500 analyses and retrieves similar analyses using mainly:

```text
 growth_score difference + rental_yield difference
```

This can create a feedback loop:

1. An earlier model makes an unsupported `BUY` call.
2. The call is saved.
3. A similar suburb retrieves it.
4. The supervisor sees it as prior context.
5. The next verdict becomes more likely to repeat the same conclusion.

The memory has no outcome-quality gate.

#### Fix

Add:

```text
review_status
outcome_status
outcome_score
benchmark_return
model_version
verified_at
```

Only use `verified` or explicitly labelled counterexamples in few-shot retrieval. Better still, use historical analyses as contrasting cases:

```text
This previous similar suburb was rated BUY but underperformed its benchmark.
Treat it as a cautionary example.
```

### 10. Medium: The UI hides useful AI detail in the wrong place

The current AI panel does show the committee debate, but it appears after the user has already scanned a large profile. Important evidence is also hidden behind “Show Source Excerpts.”

That is not necessarily bad, but the current hierarchy makes the AI feel like a decorative opinion panel rather than a transparent decision aid.

#### Better structure

Place a compact Decision Brief near the top:

```text
Investment Fit: 78/100
Evidence confidence: Medium
AI synthesis: HOLD
Estimated downside scenario: 18%

Why:
+ Low vacancy
+ Positive population trend
+ Strong rental demand

Watch:
- High entry price
- Missing flood-overlay confirmation

What changes the result:
- Vacancy above 5%
- Yield below 3%
- Interest rate above 7.5%
```

Then let the user expand:

```text
[View evidence]
[View model calculation]
[View committee debate]
[View source excerpts]
[Run what-if scenario]
```

This is stronger than either showing every internal AI step by default or hiding everything.

## Strengthened Product Questions

The earlier review questions should become explicit questions the product answers before displaying a recommendation.

### Buyer objective

- Is the user buying to live in the property, rent it, or do both?
- Is the priority growth, income, affordability, lifestyle, or a balanced objective?
- What property type is eligible?
- What is the maximum acceptable negative cash flow?
- What is the minimum holding period?

### Affordability

- What is the buyer's deposit?
- What are the acquisition costs, including stamp duty and legal fees?
- What is the borrowing capacity at the selected interest rate?
- What happens if interest rates increase by 1% or 2%?
- Does the recommendation remain affordable after vacancy and maintenance costs?

### Risk

- Is flood or bushfire exposure an automatic exclusion?
- What level of vacancy is unacceptable?
- What price decline can the buyer tolerate?
- Is the property dependent on one employer, one infrastructure project, or one demographic trend?
- What data is missing that could reverse the recommendation?

### Evidence

- What exact source supports each material claim?
- What was the observation date?
- Is the value observed, derived, estimated, transformed, or simulated?
- How much of the result depends on the non-government dataset?
- Is the source legally usable for the intended display and retention?
- Are source dates aligned, or are old census figures being compared with current property data?

### AI

- Did the AI generate the verdict, or only explain a deterministic score?
- Which evidence IDs support each driver and risk?
- Which agents were skipped by dynamic routing?
- Did agents disagree?
- What was the fallback provider?
- Was the result served from cache?
- What does the AI explicitly not know?
- Does the response meet the structured schema?
- Is the result suitable for training, or merely an unverified generated opinion?

### Validation

- What was the prediction target?
- What benchmark is used?
- Was the model trained only on information available at prediction time?
- How did previous recommendations perform after 6, 12, and 36 months?
- Is a stated 60% probability actually observed as approximately 60% in backtesting?
- Does performance hold across states, price bands, property types, and metro/regional cohorts?

## Recommended Fix Order

### P0: Do before presenting AI recommendations as authoritative

1. Remove or isolate postcode-based mock infrastructure and environmental signals.
2. Stop describing heuristic scores or Monte Carlo outputs as probabilities.
3. Replace frontend-only Buy Finder ranking with a versioned backend ranking endpoint.
4. Add evidence IDs and metric-level provenance.
5. Replace regex AI parsing with schema validation.
6. Use one backend risk calculation for standard and what-if scenarios.

### P1: Do next for credibility

1. Add the Decision Brief.
2. Add visible score contribution breakdown.
3. Add confidence band and missing-data explanation.
4. Add hard constraint exclusions.
5. Add Model Diary outcome refresh.
6. Add model performance and calibration summary.
7. Add AI model, prompt, provider, and cache metadata.

### P2: Do after outcome data accumulates

1. Improve few-shot retrieval with verified outcomes.
2. Add cohort-specific calibration.
3. Compare prompting, retrieval, and supervised models.
4. Consider fine-tuning only after sufficient reviewed and outcome-labelled data exists.

## Final Assessment

The latest implementation is not too simple because it hides internal AI agents. It is too simple where it presents strong conclusions without enough visible support.

The best balance is:

- Keep the default UI concise.
- Make the score calculation expandable.
- Show source and freshness inline.
- Show AI evidence links.
- Show disagreement and uncertainty.
- Show what would change the result.
- Show historical model performance.
- Keep the full committee debate available for users who want it.

The current repository has the right architectural ingredients, particularly `CommitteeMemory`, `ModelDiary`, data lineage fields, source excerpts, policy warnings, and the committee panel. The remaining work is to connect those ingredients into a verifiable product workflow rather than treating each as an isolated feature.
