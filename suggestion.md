# Real Estate Dashboard and AI Review

**Repository:** [aksnpatna/realestate](https://github.com/aksnpatna/realestate)  
**Review date:** 2026-07-13

## Executive Summary

The application has a strong foundation: a suburb profile, interactive map, affordability and cash-flow tools, historical charts, comparable-suburb clustering, a deterministic growth score, a Monte Carlo risk component, and an AI investment committee.

The main product opportunity is to make the answer to **“Where should I buy?”** decisive, comparable, and inspectable. The current profile is rich but cognitively busy. The score should not be presented as a probability until it has been back-tested and calibrated.

### Immediate priorities

1. Rename **Growth Probability** to **Investment Fit Score** until it is a calibrated probability.
2. Create a first-class **Buy Finder** tab based on buyer constraints and transparent weights.
3. Separate investment score from data quality and model confidence.
4. Replace synthetic infrastructure and environmental signals with authoritative geographic data.
5. Use AI to explain deterministic model outputs and evidence, not to invent the underlying score.
6. Build time-based outcome tracking before attempting model fine-tuning.

> **Important data and legal note:** Transforming OnTheHouse data does not by itself avoid contractual, copyright, database-right, access-control, or anti-collection restrictions. Production use should be assessed against the source terms, collection method, retained fields, redistribution model, and applicable law. Prefer licensed or official feeds, retain provenance, minimize stored data, and obtain legal advice before relying on scraped data commercially.

## 1. Current Capability Assessment

The repository already includes:

- React, TypeScript, Vite, Leaflet, and Recharts frontend.
- FastAPI, SQLAlchemy, PostgreSQL/PostGIS backend.
- Redis and database-backed AI caching.
- Suburb profile and interactive map.
- Affordability, cash-flow, gearing, ROI, and purchase-plan tools.
- Historical price charts and projected scenarios.
- Livability, schools, transit, parks, and amenity data.
- Similar-suburb clustering.
- Deterministic growth scoring.
- Monte Carlo risk analysis.
- LangGraph-style bull, bear, urban-planner, news, and supervisor workflow.
- Persisted committee inputs and outputs through `CommitteeMemory`.
- User favourites, activity tracking, and data-quality indicators.

The product gap is not primarily a lack of features. It is the lack of a single, transparent decision workflow that combines buyer constraints, affordability, risk, evidence quality, and alternatives.

## 2. UI and Data Representation Improvements

### 2.1 Add a Buy Finder tab

Place **Buy Finder** before the detailed Suburb Profile. Start with the user's actual decision constraints:

- Purchase budget.
- Deposit and borrowing limit.
- Property type: house, unit, or either.
- Holding horizon.
- Target state, metro area, or regional area.
- Objective: capital growth, income, first-home affordability, family/livability, or balanced.
- Minimum yield.
- Maximum vacancy.
- Maximum commute.
- School or amenity requirements.
- Flood and bushfire exclusions.
- Minimum data-quality threshold.

Allow users to adjust preferences such as growth, income, affordability, downside risk, and livability. Display the default weights and explain what changing them does.

### 2.2 Return a shortlist, not one opaque winner

The result should be a ranked shortlist of approximately 5-10 suburbs. Each result should display:

| Display | Why it matters |
|---|---|
| Fit score and rank | Shows the deterministic result for the user's chosen settings |
| Confidence band | Shows data completeness, freshness, sample size, and model stability |
| Expected 3- or 5-year range | Shows P10, P50, and P90 scenarios, not a single forecast |
| Downside probability | Probability of a defined price or total-return decline |
| Affordability and cash flow | Deposit, repayments, yield, and cash-flow range |
| Top three drivers | Explains why the suburb ranked well |
| Top two risks | Highlights supply, environmental, affordability, or data concerns |
| Evidence freshness | Shows source date and provenance for consequential metrics |

### 2.3 Use a trade-off visual

Add a scatterplot to the shortlist:

- X-axis: affordability or median price.
- Y-axis: risk-adjusted expected return.
- Bubble size: data confidence.
- Colour: buyer-fit score.
- Click: open a compact suburb comparison drawer.

This helps users understand trade-offs rather than treating rank one as automatically correct.

### 2.4 Simplify the first suburb-profile viewport

The first viewport should contain:

1. Fit for the user's selected objective.
2. Median price, repayments, yield, expected range, and downside risk.
3. Three evidence-backed reasons.
4. Two key risks.
5. A **Compare alternatives** action.

Move dense demographics, listings, amenities, detailed charts, and the full AI debate into expandable sections or secondary tabs.

### 2.5 Show provenance at metric level

Show source and last-updated information beside each important metric, rather than only in the page header. Recommended fields:

- `source_name`
- `source_type`: government, licensed commercial, open data, transformed, estimated
- `source_url`
- `observed_at`
- `loaded_at`
- `coverage_period`
- `transformation_version`
- `quality_status`

Do not make estimated values visually indistinguishable from official observations.

## 3. Deterministic Best-Suburb Model

The current growth score and risk engine are useful starting points. Build a versioned, buyer-weighted model rather than adding another unrelated score.

### 3.1 Investment Fit Score

A useful structure is:

$$
\\text{BuyFit} =
 w_g G + w_y Y + w_a A + w_d D + w_l L - w_r R - w_s S
$$

Where:

- $G$: growth signal from historical price growth, population growth, jobs growth, and demand trend.
- $Y$: income signal from sustainable net yield, vacancy, and rent growth.
- $A$: affordability based on borrowing capacity, deposit, repayment stress, and entry price.
- $D$: demand/supply balance from days on market, clearance rate, stock, approvals, and vacancy.
- $L$: livability based on commute, schools, services, and amenity access.
- $R$: downside risk from volatility, mortgage stress, environmental overlays, and concentration.
- $S$: supply-pipeline risk from approvals, zoning, and future dwelling density.

### 3.2 Model rules

- Score houses and units separately.
- Normalize metrics within comparable cohorts: state, metro or regional area, property type, and price band.
- Keep investment score separate from data quality and confidence.
- Version every model run with model version, source snapshot date, feature values, weights, and result.
- Allow user-adjustable weights while showing the defaults.
- Add sensitivity analysis, for example: “This suburb remains in the top 10 when growth weight changes from 35% to 20%.”
- Use hard exclusions for serious environmental or affordability constraints rather than allowing a high growth score to compensate for them.

### 3.3 Remove synthetic production signals

The predictive engine currently contains postcode-derived mock infrastructure and environmental events. For example, postcode arithmetic is used to generate potential stations, rezoning, flood, and bushfire signals.

These signals should not influence production rankings. Replace them with dated, authoritative geographic overlays from:

- State planning and infrastructure portals.
- Flood and bushfire agencies.
- Local government planning data.
- Confirmed project datasets.
- Property-level or parcel-level overlays where legally and technically available.

Show source, coverage, effective date, and limitations for each overlay.

## 4. Probability and Time-Based Validation

Probabilities should be empirical, not authored by an LLM.

### 4.1 Define prediction targets first

Examples:

- Probability of outperforming the relevant state and property-type median total return over 36 months.
- Probability of avoiding a nominal price decline greater than 5% over 24 months.
- Probability of achieving gross yield above a selected threshold while vacancy remains below a selected threshold.

The target must be defined before training and should be measurable from later data.

### 4.2 Use a calibrated probability model

Start with an explainable model such as logistic regression or gradient boosting with probability calibration:

$$
P(\\text{outperform in 36 months} \\mid X)
$$

Use time-based splits. For example:

- Training: information available from 2013-2019.
- Validation: information available from 2020-2022.
- Test: information available from 2023 onward.

Do not randomly split time-series suburb data because that leaks future market conditions into training.

### 4.3 Display uncertainty and calibration

Show users:

- Estimated probability, for example, “61% estimated chance of three-year outperformance.”
- Calibration quality.
- Reliability range, for example, “61% +/- 9 percentage points.”
- Data-quality and coverage limitations.
- Performance by state, property type, price band, and model version.

### 4.4 Add a Model Diary

For each historical recommendation, persist:

- Original feature snapshot.
- Model version and weights.
- Recommendation and probability.
- Benchmark used.
- Outcome at 6, 12, 24, and 36 months.
- Whether the recommendation was correct.
- Calibration and error metrics.

This creates an auditable view of how the model behaves over time.

## 5. AI Process Evaluation and Improvements

Persisting `raw_metrics_payload` alongside committee outputs is a useful audit step. It is not yet a complete training dataset.

### 5.1 Separate AI explanation from deterministic scoring

The preferred flow is:

```mermaid
flowchart LR
A[Governed source data] --> B[Deterministic feature pipeline]
B --> C[Versioned BuyFit and probability model]
C --> D[Evidence package: drivers, risks, uncertainty]
D --> E[LLM explains only supplied evidence]
E --> F[Structured output validation]
F --> G[Audit log, feedback, outcomes, monitoring]
```

The LLM should explain the model and evidence. It should not silently create the score, change the weights, or invent infrastructure and market catalysts.

### 5.2 Create a training-quality analysis record

Persist the following for every AI analysis:

- Immutable analysis ID.
- Suburb and property type.
- Model version and prompt version.
- Provider and fallback provider.
- Timestamp.
- Input snapshot and content hash.
- Feature values used by the deterministic model.
- Source IDs and source dates.
- Structured agent outputs.
- Final explanation and recommendation language.
- Confidence, assumptions, unknowns, and evidence IDs.
- Cache status.
- User feedback, stored separately from financial outcome labels.
- Human-review status: `unreviewed`, `verified`, `incorrect`, or `superseded`.
- Outcome labels at 6, 12, 24, and 36 months.

### 5.3 Use schema-constrained outputs

Replace regex-dependent parsing with Pydantic or JSON Schema validation. A structured AI response should contain fields similar to:

```json
{
  "verdict": "HOLD",
  "confidence": 0.64,
  "evidence_ids": ["price-growth-2025", "vacancy-2026-q1"],
  "drivers": ["Low vacancy", "Strong population growth"],
  "risks": ["High supply pipeline"],
  "assumptions": ["Gross yield excludes management fees"],
  "unknowns": ["No recent flood-overlay confirmation"],
  "insufficient_evidence": false
}
```

Every claim should reference an input field or source excerpt. If the claim cannot be supported, return `insufficient_evidence` instead of forcing a Buy/Hold/Pass result.

### 5.4 Improve few-shot retrieval

Current retrieval based mainly on growth score and rental yield is too narrow. Include:

- State and market cohort.
- Property type.
- Price band.
- Vacancy.
- Population and jobs trend.
- Data freshness.
- Data-quality score.
- Outcome quality of historical analyses.

Do not retrieve failed or unverified historical analyses as if they were successful examples. Mark them as counterexamples or exclude them from few-shot context.

### 5.5 Do not fine-tune yet

Do not fine-tune on the current small set of generated committee analyses. That risks teaching the model to reproduce previous prompts and errors.

First collect reviewed, outcome-labelled, time-separated data. Then compare:

1. Constrained prompting with evidence citations.
2. Retrieval-augmented explanation.
3. A small supervised model for structured explanations.
4. Fine-tuning only if it improves measured accuracy, calibration, cost, or latency on a held-out period.

## 6. Pre-Mortem

Assume the product failed. The following failure modes are the most important to address.

| Failure mode | Early warning | Fix |
|---|---|---|
| Users interpret scores as financial advice | Users ask which suburb they should definitely buy and rely on rank one | Use “fit” and “estimated probability,” show uncertainty, require comparison, and obtain legal review |
| Scraped source is blocked or challenged | CAPTCHA, rate-limit spikes, inconsistent fields, or legal notice | Use licensed or official feeds, add a source kill switch, define retention rules, and obtain legal advice |
| Rankings look precise but perform poorly | Weak out-of-time performance or poor probability calibration | Back-test by time period, publish internal scorecards, use model promotion gates, and roll back weak versions |
| AI invents catalysts or omits risks | Claims cannot be traced to evidence | Restrict AI to supplied evidence, require source IDs, validate citations, and support `insufficient_evidence` |
| Data staleness causes false signals | Metrics exceed freshness SLA or have mismatched observation dates | Add metric-level freshness, confidence decay, refresh jobs, and ranking thresholds |
| Users are overwhelmed by the dashboard | Low comparison usage and high profile abandonment | Make Buy Finder the default workflow and progressively disclose detail |
| Model favours data-rich suburbs | Top rankings cluster in suburbs with better coverage | Separate confidence from score, normalize by cohort, monitor coverage, and use “not enough evidence” states |
| Fine-tuning amplifies AI mistakes | Repeated wording and unchanged verdict distribution | Train only on curated, reviewed, outcome-labelled data |
| AI cost and latency grow with usage | Cache misses, provider errors, and rising API spend | Cache evidence and analysis separately, use asynchronous jobs, circuit breakers, and deterministic summaries |
| Environmental or planning risk damages trust | Users identify incorrect overlays or mock flags | Remove mock inputs, use authoritative GIS layers, date every signal, and show coverage limits |
| Committee memory becomes biased or poisoned | Similar historical analyses repeatedly influence the same outcome | Add outcome quality, human review, verified-only retrieval, and periodic memory audits |
| Macro proxy is mistaken for local property performance | Local recommendation changes with ETF noise | Treat VAP.AX or similar data as contextual only and measure its incremental predictive value |

## 7. Recommended Delivery Order

### Phase 1: Trust and clarity

- Rename Growth Probability to Investment Fit Score.
- Remove mock predictive signals from production.
- Add metric-level source, freshness, and confidence.
- Clearly distinguish observed, estimated, transformed, and modelled values.

### Phase 2: Decision workflow

- Build Buy Finder.
- Add buyer constraints and hard exclusions.
- Add transparent weights and shortlist ranking.
- Add compare mode and trade-off scatterplot.

### Phase 3: Deterministic model

- Implement versioned BuyFit scoring.
- Separate houses and units.
- Normalize by market cohort.
- Add sensitivity analysis and confidence bands.

### Phase 4: Empirical probability

- Define outcome targets.
- Build time-based backtesting.
- Add calibration and reliability reporting.
- Launch the Model Diary.

### Phase 5: AI hardening

- Add structured outputs and evidence IDs.
- Add confidence, assumptions, unknowns, and insufficient-evidence states.
- Persist immutable audit records.
- Improve few-shot retrieval using cohort and outcome quality.

### Phase 6: Model learning

- Collect reviewed user feedback and realized outcomes.
- Compare prompting, retrieval, and supervised approaches.
- Consider fine-tuning only after sufficient high-quality data exists.

## Conclusion

The strongest near-term improvement is not adding another AI agent. It is making the existing data and models legible:

- What is the user trying to achieve?
- Which suburbs fit those constraints?
- Why did each suburb rank there?
- What could make the recommendation wrong?
- How fresh and trustworthy is each input?
- How did prior recommendations perform?

Once those foundations are in place, AI becomes more useful and safer: it can explain evidence, compare scenarios, surface uncertainty, and communicate model behaviour without pretending to know more than the data supports.
