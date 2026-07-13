# Real Estate POC Product Flow and Validation Plan

**Repository:** [aksnpatna/realestate](https://github.com/aksnpatna/realestate)  
**Baseline reviewed:** `master` at `2b395444b88a3ee9f26b2c70a11a3ba91a4509d0`  
**Date:** 2026-07-14  
**Purpose:** Turn the backend, data-quality, affordability and AI work into one understandable, demonstrable product flow.

## 1. Product Decision

The POC should present one coherent buyer journey:

1. A buyer describes their financial position and objectives.
2. Buy Finder returns a short list of suitable, eligible suburbs.
3. The buyer opens a suburb and sees the deterministic decision summary.
4. Affordability and cashflow details explain the financial mechanics.
5. AI Committee provides a visible challenge and explanation layer.
6. Evidence details show why the result can or cannot be trusted.
7. The buyer can change assumptions and compare the result again.

The product headline is not DQ, infrastructure or AI-generated prediction. The product headline is:

> A transparent decision-support workflow that narrows a large property universe into a small, explainable shortlist using current data and explicit buyer assumptions.

DQ, backend ranking, provenance and tests exist to make that experience credible and repeatable.

## 1.1 How To Use This Plan With A Coding Agent

This document is an implementation specification, not a layout-only design brief. The agent must inspect and modify the frontend, backend, AI integration, evidence/provenance paths and automated tests as required by the phases below.

Use this instruction when handing the plan to an implementation agent:

> Implement `realestate_poc_product_flow_and_validation_plan.md` against the current repository. Treat the plan as a product and engineering contract, not only a UI brief. Start with Phase 1, then proceed in order. Before each edit, inspect the owning code path and state the local hypothesis. After each substantive edit, run the narrowest relevant test or build check before continuing. Preserve existing working behaviour unless the plan explicitly changes it. Do not stop at a visual mock-up: wire the frontend to the backend contracts, remove duplicate calculations, make AI discoverable, keep DQ behind user-level Evidence status, and add or update the tests required by the current phase. Report completed, blocked and unverified gates separately.

The agent must not:

- implement only CSS, navigation or visual layout;
- claim that a control is implemented unless its backend semantics and test are present;
- leave hidden default affordability inputs in place;
- retain two authoritative Buyer Fit or affordability calculations;
- expose DQ prominently without an evidence explanation;
- remove AI merely to simplify the first screen;
- mark later phases complete because the frontend compiles;
- claim runtime, provenance or calibration validation without running the relevant checks.

The expected implementation order is:

1. Establish the Buy Finder, Affordability/Price Ceiling, Cashflow/Gearing and AI boundaries.
2. Wire the buyer financial inputs through the Buy Finder request and response.
3. Make the backend the sole authority for ranking, affordability components and Decision Brief content.
4. Apply one eligibility and evidence path across recommendation endpoints.
5. Surface AI Committee from the result or selected suburb without making AI authoritative for ranking.
6. Validate scenarios, cashflow assumptions, persistence and outcome readiness.

An agent may split these phases into separate changes, but each phase must finish with its own focused validation gate before the next phase begins.

## 2. What The Investment Must Deliver

### User-visible benefits

The completed POC must let a user:

- understand which suburbs match their stated profile;
- see whether the result is based on price fit or a fuller affordability calculation;
- see why a suburb ranked where it did;
- see the main risks and unknowns;
- challenge the result with AI Bull, Bear and Urban Planner views;
- run a clearly labelled scenario when assumptions change;
- distinguish current facts, derived metrics, scenarios and AI commentary;
- understand when data is unavailable instead of receiving a fabricated result.

### Platform benefits

The backend and DQ work must provide:

- one authoritative Buyer Fit calculation;
- repeatable results for the same request and data snapshot;
- hard constraints that actually exclude unsuitable records;
- a consistent publication gate for recommendation paths;
- source and transformation metadata for material metrics;
- structured AI responses with an explicit insufficient-evidence outcome;
- a record of the model and assumptions used for later evaluation;
- a clean failure state when the database, API or AI provider is unavailable.

### What the work must not become

The POC must not become:

- a DQ monitoring dashboard presented as a consumer product;
- a collection of duplicate calculators;
- an opaque score with no explanation;
- an AI verdict that secretly determines the numerical ranking;
- a financial advice tool;
- a calibrated prediction or forecasting product before outcome evidence exists.

## 3. Product Language Rules

Use language that matches what the implementation actually calculates.

| Use | Avoid unless separately validated |
|---|---|
| Buyer Fit Score | Investment probability |
| Price Fit | Personal affordability when income/debt are absent |
| Affordability estimate | Guaranteed borrowing capacity |
| Current snapshot | Forecast |
| Historical price trend | Expected future price |
| Scenario range | Probability or prediction |
| Evidence quality | Truth score |
| AI commentary | AI-approved recommendation |
| Unavailable | Estimated value when the value is missing |

The footer must continue to state that the tool is for general information and is not financial, investment or real estate advice.

## 4. Target User Flow

### Step 1: Buyer setup

The primary Buy Finder flow should collect the inputs required to make the output meaningful:

- buyer profile;
- state or search region;
- property type;
- deposit;
- annual income;
- existing monthly debt;
- interest-rate assumption;
- serviceability buffer;
- loan term;
- purchase-cost allowance;
- optional maximum CBD travel time;
- optional minimum rental yield;
- objective weights.

The UI must explain that the rate, buffer, term and purchase-cost allowance are assumptions, not lender approval criteria.

If the POC does not want to collect income and debt, the product must use `Price Fit` and `price_within_declared_budget` instead of `Affordability`.

### Step 2: Backend shortlist

The frontend sends one request to `POST /api/buy-finder/rank`.

The backend must:

1. validate numeric inputs;
2. calculate purchase costs;
3. calculate available deposit after costs;
4. calculate required loan;
5. calculate an estimated borrowing capacity;
6. calculate serviceability under the stated assumptions;
7. apply hard constraints;
8. apply the canonical eligibility gate;
9. calculate Buyer Fit components;
10. return ranked results, exclusions, assumptions and metadata.

The frontend must not calculate or reorder Buyer Fit results.

### Step 3: Results screen

Each result card should show only the information needed for scanning:

- rank and suburb;
- Buyer Fit Score;
- affordability or price-fit status;
- rental yield where available;
- evidence quality in user language;
- one or two supporting factors;
- one or two risks;
- an action to open the suburb decision view.

Technical DQ values should be available through an `Evidence details` control, not dominate the card.

Recommended result-card structure:

```text
#1 Suburb name, VIC
Buyer Fit 78
Affordability: Serviceability passes under stated assumptions
Evidence: High | Updated: 30 Jun 2026

Supports: Available deposit supports purchase price
Watch: Elevated vacancy (4.8%)

[Open decision brief] [Evidence details] [AI Committee]
```

### Step 4: Decision view

The selected suburb view should begin with:

- current market snapshot;
- Buyer Fit Score;
- affordability breakdown;
- top drivers;
- top risks;
- unknown fields;
- visible AI entry point;
- visible scenario entry point;
- historical data, not unsupported future projections.

The Decision Brief must consume a backend decision snapshot. It may format the response but must not calculate a second score or invent a second set of drivers.

### Step 5: AI explanation layer

AI must be visible in the selected suburb workflow. It should not be buried behind two unrelated expandable sections.

Provide a prominent control or tab labelled `AI Committee` next to `Decision Brief` and `Evidence`.

The AI panel may show:

- Bull argument;
- Bear argument;
- Urban Planner argument;
- CIO playbook;
- news sentiment and source excerpts;
- policy notices;
- explicit unknowns;
- risk scenario controls.

The AI must explain and challenge the deterministic result. It must not silently change the numerical Buyer Fit ranking.

When no valid AI result exists, show:

```text
AI Committee: Insufficient evidence
No reliable committee verdict was produced from the available evidence.
```

Do not show a normal `BUY`, `HOLD` or `PASS` verdict when schema validation or evidence resolution fails.

### Step 6: Cashflow and detailed affordability

Cashflow/Gearing is a follow-on analysis for a selected suburb or property. It should not compete with Buy Finder for the initial shortlist.

It may calculate:

- gross rent;
- expenses;
- interest;
- vacancy;
- pre-tax cashflow;
- post-tax illustrative cashflow;
- gross and net yield.

Every tax, rate and expense value must be labelled as an assumption or indicative calculation.

## 5. Affordability And Buy Finder Boundary

The tools have different jobs and must be implemented accordingly.

| Tool | Question answered | Output |
|---|---|---|
| Affordability | What purchase price could this financial profile potentially support? | Price ceiling and affordability breakdown |
| Buy Finder | Which eligible suburbs best match this profile and objective? | Ranked shortlist and reasons |
| Cashflow/Gearing | What might the cashflow look like for a selected property? | Income, expenses and scenario cashflow |
| AI Committee | What arguments, risks and contextual signals should be considered? | Structured commentary and challenge |

### Required design choice

Choose one of these approaches and document it in the product:

**Preferred:** Move the affordability inputs into Buy Finder and show the affordability breakdown inside each result. Retain the standalone calculator only as a quick planning tool.

**Acceptable:** Keep both screens, but rename the standalone tool to `Price Ceiling Calculator` and make it clear that it does not rank suburbs or perform the Buyer Fit calculation.

### Must not happen

- Two screens must not rank the same suburbs using different formulas.
- A standalone affordability result must not be treated as the Buy Finder ranking.
- Buy Finder must not use hidden default income or debt values without showing them.
- The user must not see `Affordability` if the calculation is only price comparison.
- A frontend result must not override the backend affordability calculation.

## 6. DQ And Evidence Presentation

DQ is a control that protects the result. It is not the result itself.

### Default presentation

Use a compact user-facing status:

- `Evidence: High`
- `Evidence: Medium`
- `Evidence: Limited`
- `Evidence: Unavailable`

Show technical detail only when requested:

- raw DQ score;
- eligibility DQ score;
- active threshold;
- excluded fields;
- synthetic-input status;
- source and transform references;
- observation and load timestamps.

### DQ behaviour

The same backend eligibility function must be used for:

- `/api/suburbs`;
- `/api/suburbs/{suburb_id}` where recommendations are shown;
- `/api/similar-suburbs`;
- `POST /api/buy-finder/rank`;
- future comparison and recommendation endpoints.

A record below the canonical threshold must not appear as an eligible recommendation. A record with synthetic recommendation inputs must not be used as a recommendation driver.

### Evidence behaviour

Every material result and AI claim must point to resolvable evidence or be marked unsupported. Missing source dates must remain null with an explicit quality status. The system must never manufacture the current date as the observation date.

### UI test of healthy DQ presentation

The product review should be able to answer both questions:

1. Can a user understand the recommendation without knowing what DQ means?
2. Can a technical reviewer expand the result and prove why the record was eligible?

If the answer to either question is no, the presentation needs revision.

## 7. AI Product Contract

AI is a visible explanation and challenge layer with strict boundaries.

### AI may

- summarise supplied metrics;
- compare Bull, Bear and Urban Planner perspectives;
- identify risks and assumptions;
- summarise relevant news;
- explain disagreement between signals;
- provide a strategy/playbook as commentary;
- return `INSUFFICIENT_EVIDENCE`.

### AI may not

- create the authoritative Buyer Fit score;
- override hard eligibility constraints;
- use synthetic predictive data as if it were observed evidence;
- claim a calibrated probability without measured calibration;
- cite an evidence ID that cannot be resolved;
- persist invalid structured output as a normal verdict;
- present a scenario as a prediction or expected return.

### AI visibility acceptance criteria

A new user must be able to find the AI Committee from the Buy Finder result or selected suburb without scrolling through the full profile and opening multiple unrelated sections.

A showcase presenter must be able to demonstrate:

1. the deterministic shortlist;
2. the score drivers and risks;
3. the AI Committee challenge;
4. the source excerpts or evidence status;
5. a scenario change;
6. the fact that the AI does not change the numeric ranking.

## 8. Backend Contracts

### Buyer Fit request

The request must validate:

- budget greater than zero;
- deposit non-negative;
- annual income non-negative;
- monthly debt non-negative;
- interest rate within an explicitly documented range;
- serviceability buffer non-negative;
- loan term within a documented range;
- purchase-cost allowance non-negative;
- weights finite and non-negative;
- minimum yield within a documented range when supplied.

### Buyer Fit response

Every ranked result must include:

- `model_version` at response level;
- `request_id`;
- applied DQ threshold;
- rank;
- Buyer Fit Score;
- score components and weights;
- affordability breakdown or explicit price-fit label;
- drivers;
- risks;
- unknowns;
- evidence IDs;
- confidence/evidence label;
- generation timestamp or request metadata.

### Hard constraints

Minimum yield must be a true exclusion. Missing yield must not pass a minimum-yield filter.

Exclusions must show:

- suburb ID;
- suburb name;
- exclusion reason;
- actual value where known;
- requested value where relevant;
- eligibility detail where relevant.

### Decision Brief

`GET /api/suburbs/{suburb_id}/decision-brief` must return a versioned snapshot containing:

- snapshot ID;
- model version;
- request ID or equivalent reproducibility metadata;
- suburb ID;
- score;
- components;
- drivers;
- risks;
- unknowns;
- evidence IDs;
- eligibility detail;
- generated timestamp.

The snapshot should be tied to the buyer request when the Decision Brief is opened from Buy Finder. A generic default request must not be presented as the user's personalised decision.

## 9. Required Build Sequence

Implement and validate in this order.

### Phase 1: Naming and journey

- Decide whether standalone Affordability remains or becomes Price Ceiling.
- Make Buy Finder the primary entry point.
- Expose the AI Committee from results or the selected suburb header.
- Reduce DQ prominence to Evidence status with expandable technical detail.

**Gate:** A new user can explain what each screen does without reading technical documentation.

### Phase 2: Buyer inputs

- Add annual income, monthly debt and rate assumptions to the Buy Finder form.
- Send them in the ranking request.
- Display active assumptions near the results.
- Remove or visibly label backend defaults.

**Gate:** Changing income or debt changes the affordability component in a predictable direction.

### Phase 3: One authoritative decision path

- Use the backend result for ranking, Decision Brief, drivers and risks.
- Remove remaining frontend score or explanation calculations.
- Pass the original request or decision snapshot into the selected suburb view.

**Gate:** Changing raw frontend suburb data after a response does not change the displayed score, drivers or risks.

### Phase 4: Evidence and DQ

- Use one eligibility function everywhere.
- Expose user-level evidence status.
- Keep technical DQ and lineage behind details.
- Resolve all evidence IDs before normal AI persistence.

**Gate:** An excluded, synthetic or below-threshold record cannot enter a recommendation path, and every displayed evidence ID resolves.

### Phase 5: AI visibility

- Surface AI Committee beside Decision Brief.
- Preserve News Sentiment and source excerpts.
- Show insufficient evidence clearly.
- Keep AI numeric independence from Buyer Fit.

**Gate:** The showcase presenter can reach AI in one obvious action from a ranked result.

### Phase 6: Scenario and cashflow

- Keep risk what-if under scenario language.
- Link Cashflow/Gearing from a selected suburb or result.
- Label rates, tax, rent and expenses as assumptions.
- Remove forecast-style wording.

**Gate:** No UI labels an uncalibrated scenario as a forecast, probability or expected outcome.

### Phase 7: Outcome readiness

- Persist immutable prediction snapshots.
- Add an idempotent outcome refresh process.
- Record unavailable outcomes as unavailable.
- Report sample size and evaluation window.

**Gate:** No calibration claim is shown without sufficient verified outcomes.

## 10. Test Plan

### 10.1 Backend affordability tests

1. **Low-income serviceability failure**
   - Use a price below the declared budget with low income and high existing debt.
   - Assert required loan is positive.
   - Assert serviceability fails or affordability is materially reduced.
   - Assert the response does not say the property is personally affordable.

2. **Income monotonicity**
   - Hold property, deposit, debt and rate constant.
   - Compare low and high income requests.
   - Assert higher income does not reduce the affordability score.

3. **Debt monotonicity**
   - Hold all other inputs constant.
   - Compare zero debt with high monthly debt.
   - Assert higher debt does not improve affordability or serviceability.

4. **Purchase-cost effect**
   - Assert stamp duty and purchase costs reduce available deposit.
   - Assert required loan is higher than the nominal price-minus-deposit amount.

5. **Rate sensitivity**
   - Hold all other inputs constant.
   - Increase the interest-rate assumption.
   - Assert repayment increases and affordability does not improve.

6. **Invalid input rejection**
   - Reject negative price, negative income, negative debt, invalid rate, invalid term and NaN-like values with a 4xx response.

### 10.2 Backend Buyer Fit tests

1. **Backend is authoritative**
   - Call the ranking service with fixtures.
   - Assert result order follows the backend score.
   - Assert no browser-side score is required to produce the response.

2. **Minimum yield exclusion**
   - Set minimum yield above the suburb yield.
   - Assert the suburb is absent from ranked results.
   - Assert the exclusion contains the actual and requested values.

3. **Missing yield exclusion**
   - Set minimum yield and remove yield data.
   - Assert the suburb is excluded as yield unknown.

4. **Zero weights**
   - Set all weights to zero.
   - Assert no NaN, infinity or server error.
   - Assert the documented zero-score behaviour.

5. **Result reproducibility**
   - Repeat the same request against the same snapshot.
   - Assert scores, order, exclusions and components are equal apart from request identifiers and timestamps.

### 10.3 Eligibility and DQ tests

1. **Threshold gate**
   - A record below the configured threshold must not be ranked.
   - A record at the threshold must follow the documented inclusive/exclusive rule.

2. **Configuration change**
   - Run with threshold 80 and threshold 90.
   - Assert the response reports the active threshold.
   - Assert the eligible set changes predictably.

3. **Synthetic exclusion**
   - Mark predictive recommendation inputs as `synthetic_demo`.
   - Assert exclusion from Buy Finder, suburb recommendations, similar suburbs and comparison paths.

4. **Raw versus eligibility DQ**
   - Use a fixture where raw and eligibility DQ differ.
   - Assert both are returned.
   - Assert the documented canonical score controls the gate.

5. **Unavailable data**
   - Remove the database or force the API to fail.
   - Assert the UI shows `Data Unavailable`.
   - Assert no mock, default or stale successful result is shown as current.

### 10.4 Provenance and evidence tests

1. **Evidence ID resolution**
   - Resolve every evidence ID returned for a ranked result.
   - Resolve every evidence ID attached to an AI claim.
   - Fail the test if any ID is unknown.

2. **Derived metric lineage**
   - For rental yield, assert the evidence record references the actual price and rent evidence IDs.

3. **No fabricated dates**
   - When the source observation date is unavailable, assert `observed_at` is null and quality status explains why.
   - Assert the current month is not inserted as an observation date.

4. **Source metadata**
   - Assert source name, source type, source record ID, loaded timestamp and transform run ID are either real or explicitly null.
   - Reject generic placeholder metadata where a real value is required.

### 10.5 Decision Brief tests

1. **Backend snapshot rendering**
   - Mock a known backend snapshot.
   - Assert exact score, drivers, risks and unknowns render.

2. **No frontend recalculation**
   - Change raw suburb fields after the snapshot is loaded.
   - Assert the score, drivers and risks remain unchanged.

3. **Request consistency**
   - Open a result from Buy Finder with non-default inputs.
   - Assert the Decision Brief uses that request or snapshot, not an unrelated default request.

4. **Unavailable state**
   - Make the Decision Brief endpoint fail.
   - Assert a clear unavailable message and no stale authoritative summary.

### 10.6 AI tests

1. **AI is discoverable**
   - Render a ranked result or selected suburb.
   - Assert an AI Committee action is visible without opening multiple unrelated sections.

2. **Structured invalid output**
   - Return malformed or schema-invalid committee output.
   - Assert the result becomes `INSUFFICIENT_EVIDENCE`.
   - Assert it is not persisted as BUY, HOLD or PASS.

3. **Evidence validation**
   - Return a syntactically valid claim with an unknown evidence ID.
   - Assert the claim is downgraded or the verdict becomes `INSUFFICIENT_EVIDENCE`.

4. **AI does not alter ranking**
   - Run Buyer Fit before and after AI analysis.
   - Assert the numeric score and rank do not change unless the user changes the Buyer Fit request or data snapshot.

5. **AI failure**
   - Disable the AI provider or return a 503.
   - Assert a clear unavailable state.
   - Assert cached results are labelled with their age if displayed.

6. **News source visibility**
   - Assert news entries show available title, source and URL metadata.
   - Do not imply that a snippet is verified evidence when it has no resolvable source.

### 10.7 Scenario and cashflow tests

1. **Scenario wording**
   - Assert the UI uses `scenario`, `scenario range` or `price decline scenario`.
   - Assert it does not use probability, forecast or expected return for uncalibrated output.

2. **Backend risk path**
   - Mock the backend risk endpoint.
   - Assert the UI renders its response and does not calculate a second risk result locally.

3. **Cashflow assumptions**
   - Assert rate, rent, vacancy, expenses, tax and depreciation assumptions are visible.
   - Assert missing inputs are unavailable, not silently zeroed.

### 10.8 Model Diary tests

1. **Immutable prediction snapshot**
   - Create a prediction.
   - Change current suburb data.
   - Assert original baseline fields and evidence references remain unchanged.

2. **Idempotent outcome refresh**
   - Run the refresh job twice.
   - Assert no duplicate outcome records and no mutation of the original prediction.

3. **Unavailable outcomes**
   - Remove future source data.
   - Assert outcome status is `unavailable`, not zero.

4. **Calibration guard**
   - With zero or insufficient rated outcomes, assert the summary says incomplete or limited.
   - Assert no calibrated-performance or probability claim is shown.

### 10.9 Frontend build and integration tests

Run from the repository root:

```powershell
npm ci
npm run build
npm run test
npm run lint
```

Run backend checks:

```powershell
python -m compileall backend
python -m pytest backend/tests -q
```

Run API contract tests with:

```text
PUBLIC_POC_MODE=true
PUBLIC_POC_MIN_DQ_SCORE=80
DEMO_MODE=false
ALLOW_MOCK_SUBURBS=false
```

Repeat threshold tests with `PUBLIC_POC_MIN_DQ_SCORE=90`.

Where a live database is unavailable, use isolated unit tests and explicitly mark runtime validation as pending. Do not claim the POC is fully validated from compilation alone.

## 11. Definition Of Done

The product flow is ready for a controlled internal showcase when:

- Buy Finder is the clear primary discovery path.
- Buyer financial inputs are collected or the output is explicitly named Price Fit.
- Affordability and Buy Finder have distinct responsibilities.
- The frontend sends the inputs used by the backend affordability calculation.
- The backend is the only authority for ranking and decision components.
- Minimum yield and other visible hard constraints are enforced server-side.
- DQ is visible as understandable Evidence status, with technical detail available on demand.
- The same eligibility function protects all recommendation paths.
- Evidence IDs resolve or claims are downgraded.
- AI Committee is reachable in one obvious action from the result or selected suburb.
- AI explanations do not change deterministic ranking.
- Historical data is clearly separated from scenarios and unavailable forecasts.
- Risk output is labelled as an uncalibrated scenario.
- Cashflow and tax outputs show assumptions and disclaimers.
- API failure, AI failure and missing data produce explicit unavailable states.
- Frontend build, test and lint pass.
- Backend compilation and focused tests pass.
- Runtime/API validation is completed or clearly recorded as pending.
- Model Diary is not described as calibrated without verified outcomes and sample size.

## 12. Showcase Script

Use this sequence for the friend-circle or NPD demonstration:

1. Enter a buyer profile with deposit, income and debt.
2. Show that Buy Finder returns a small ranked shortlist.
3. Open one result and show Buyer Fit, affordability assumptions and the two main risks.
4. Expand Evidence details only briefly to show the result is traceable.
5. Open AI Committee and show Bull, Bear and Urban Planner views.
6. Point out that AI explains and challenges the result but does not determine the rank.
7. Change the interest rate or debt and rerun the shortlist.
8. Show the affordability and ranking response changing consistently.
9. Run a risk scenario and state that it is an uncalibrated scenario, not a prediction.
10. Open Cashflow/Gearing for deeper analysis.
11. End by showing the limitations and the future Model Diary outcome path.

The audience should leave understanding the product benefit, not the internal mechanics:

> It helps a buyer move from a broad market to a small, explainable shortlist while making the assumptions, evidence gaps and competing viewpoints visible.

## 13. Explicit Non-Goals

The current POC does not claim to provide:

- lender approval;
- personal financial advice;
- a guaranteed affordable purchase price;
- a calibrated investment probability;
- a reliable ten-year forecast;
- fully validated source provenance until the evidence registry is complete;
- trained machine-learning performance until Model Diary outcomes are collected and evaluated.
