# Real Estate POC: Affordable Data Ingestion and Cleansing Playbook

**Prepared:** 2026-07-13  
**Purpose:** Turn the dashboard into a credible proof of concept without committing to a $75K commercial data contract.

## Executive Decision

Do not buy the $75K dataset before proving that users value the decision workflow.

Build a narrow, transparent POC using:

1. A small geography, such as one state or 20-50 suburbs.
2. Open government and openly licensed datasets.
3. A small number of derived metrics that can be reproduced.
4. Explicit provenance, freshness, and missing-data states.
5. No synthetic flood, bushfire, infrastructure, or property values.
6. A deterministic score that is labelled as a score, not a probability.
7. Human review of the first recommendations.

The first product does not need to answer “Which suburb is best in Australia?” It needs to answer a narrower question convincingly:

> “For this buyer profile and this selected area, which suburbs satisfy the constraints, and what evidence supports the ranking?”

That is enough to validate the product before purchasing expensive coverage.

## Rebalanced Principle: Ship the Useful Thing

The POC must not become a 36-month exercise in reconstructing proprietary sales history. Data democratisation does not require matching every field held by a large provider. It requires making a useful set of public, current, and user-supplied signals understandable and comparable.

The product can ship a decent score now if the score answers a narrower question:

> “How well does this area fit the buyer’s current brief, based on the evidence currently available?”

That is different from predicting capital growth. It is still valuable because many buyers first need help narrowing choices, understanding trade-offs, and identifying what to check next.

### The score should be a decision-fit score

Use a 0-100 **Buyer Fit Score**, not a growth probability:

```text
Buyer Fit Score
= 30% affordability fit
+ 25% current income fit
+ 20% livability fit
+ 15% access and amenity fit
+ 10% evidence completeness
```

The weights can change by buyer profile, but the inputs must be visible. This score can be calculated from:

- User budget, deposit, property type, and commute limit.
- Current asking or median price where available.
- Current rent and gross yield where available.
- Vacancy or rental-demand proxy where available.
- Population and demographic context.
- Schools, parks, transport, and amenities.
- Current hazard or planning indicators when available.
- Data completeness and freshness.

Do not include a missing field as zero unless zero is a real observation. For an unavailable metric, reduce the **evidence completeness** component and show the gap. The score remains useful because it measures fit to the brief, not confidence about the future.

### Three score modes

The product should make the mode explicit:

| Mode | Question answered | Suitable now |
|---|---|---|
| **Buyer Fit** | Does this area fit my current brief? | Yes |
| **Market Context** | What current signals describe this area? | Yes |
| **Growth Forecast** | What is likely to happen over time? | Later, after outcomes |

The first release should make Buyer Fit the primary score and show Market Context as supporting evidence. Growth Forecast can be disabled or marked `not available yet`.

## Proportional Source Handling

Source governance should be a lightweight engineering control, not a reason to stop building.

For each source, record only the minimum useful metadata:

- Source name.
- URL or dataset identifier.
- Retrieval date.
- Attribution requirement.
- Whether the value is direct or derived.
- A short note if the source cannot be used for redistribution.

Then keep moving with the usable sources. Do not wait for perfect historical coverage or a legal opinion on every possible future feature.

Use three practical labels in the product:

- `Open/current`.
- `Derived/current`.
- `Unavailable in this version`.

Reserve detailed legal review for a source that you are about to commercialise, redistribute, or make central to the business. For the POC, do not copy restricted raw data into the new pipeline if its terms clearly prohibit it, but do not let uncertainty about a future commercial model block a current-data comparison tool.

## A Decent Score Without Sales History

The score does not need historical sale prices to be useful. It needs a clear target, reasonable normalisation, and visible limitations.

### Affordability fit

Calculate affordability from the buyer’s own situation:

```text
available_budget = deposit + verified_borrowing_capacity
affordability_fit = clamp(100 -
  (price - available_budget) / available_budget * 100, 0, 100)
```

If borrowing capacity is not supplied, use the user’s stated maximum budget and label the result `budget fit`, not lending advice.

### Income fit

Use current rent and price where available:

```text
gross_yield = weekly_rent * 52 / price * 100
income_fit = normalise(gross_yield, buyer_profile.minimum_yield, target_yield)
```

If either price or rent is missing, return `unknown` and lower evidence completeness rather than inventing yield.

### Livability and access fit

Use countable present-day signals such as:

- Distance to the selected CBD or employment centre.
- Number of mapped schools, parks, transport stops, and essential services.
- A user-selected school or transport preference.
- Local amenity density, with the search radius displayed.

This is not claiming that more amenities guarantee price growth. It is measuring fit to a stated lifestyle brief.

### Evidence completeness

Score whether the result can be inspected:

```text
evidence_completeness =
  available material metrics / required material metrics * 100
```

This is a quality signal, not a confidence probability. A suburb can rank well for a buyer and still show `Evidence completeness: 62/100`.

### Example

```text
Buyer Fit Score: 78/100

Affordability fit:       92 x 30% = 27.6
Current income fit:      70 x 25% = 17.5
Livability fit:          80 x 20% = 16.0
Access and amenities:    75 x 15% = 11.25
Evidence completeness:  58 x 10% = 5.8

Total: 78.15 -> 78/100
```

The user gets a useful shortlist and can see exactly why the score is not higher. No historical forecast is required.

## Working POC Mode: Use the Existing Dataset, Narrow It Aggressively

For the current stage, the goal is a working internal demonstration for your friend circle and the NPD discussion. Do not rebuild the entire ingestion system before demonstrating the product. Use the existing dataset, but put a strict publication gate in front of it.

This is the practical compromise:

- Keep the existing raw and transformed data untouched as the baseline.
- Do not expose every suburb.
- Publish only suburbs that pass a configurable data-quality threshold.
- Clearly label the result as an internal evaluation POC.
- Use the existing data to demonstrate the decision workflow, not to claim national completeness.
- Capture the exact gaps that an NPD data/API proposal would need to solve.

### Recommended initial threshold

Start with:

```text
PUBLIC_POC_MIN_DQ_SCORE = 80
```

Use `DQ >= 80` as the initial publication threshold, then inspect the resulting coverage. If too many suburbs remain, test `85` and `90` as analysis thresholds. Do not choose the threshold only to make the result set look impressive.

The application should support three explicit data views:

| View | Rule | Purpose |
|---|---|---|
| **POC Recommended** | `dq_score >= 80` and required Buyer Fit fields available | User-facing shortlist |
| **POC Review Queue** | `60 <= dq_score < 80` or material fields missing | Data-cleansing worklist |
| **Excluded** | `dq_score < 60`, synthetic inputs, or identity failure | Never ranked or recommended |

The DQ score is a publication gate, not a guarantee that the data is correct. The UI must still show which fields are missing, stale, estimated, or derived.

### Do not use DQ as a cosmetic badge

The current code recalculates or displays DQ in places, but the ranking path must enforce it. A suburb with `DQ 55` must not enter the ranked POC response merely because it has an attractive price or yield.

The backend must apply:

```python
eligible = (
  suburb.dq_score is not None
  and suburb.dq_score >= settings.public_poc_min_dq_score
  and not suburb.has_synthetic_recommendation_inputs
  and suburb.identity_status == "verified"
)
```

If the current schema does not have `has_synthetic_recommendation_inputs` or `identity_status`, add equivalent derived fields in the POC publication query. Do not rely on a frontend filter.

## Existing Data POC: Required Product Boundary

The first demonstration should show a complete user journey using the filtered existing data:

1. User selects a buyer profile.
2. User supplies budget, deposit, property type, and key preferences.
3. System shows only eligible suburbs from the DQ-filtered set.
4. Backend calculates Buyer Fit Score.
5. UI shows score components and contribution points.
6. UI shows current evidence and DQ/source freshness.
7. AI explains the deterministic result using the supplied evidence.
8. User can inspect why a suburb ranked, why another failed, and what data is missing.
9. User can save the request and shortlist for the NPD demonstration.

Do not make the first demonstration depend on ten-year history, property listings, growth probabilities, or a national feed. The product should feel complete because the decision workflow is complete, not because every dataset is present.

## NPD Showcase Contract

The POC should produce a short, concrete request for the NPD group rather than a general request for “more data.” Capture the gaps from actual use:

| POC observation | NPD request |
|---|---|
| Too few suburbs pass DQ 80 | Coverage for the selected geography |
| Price or rent unavailable | Current aggregate price/rent API |
| No consistent historical observations | Dated monthly or quarterly snapshots |
| Environmental risk unknown | Authoritative flood/bushfire layer |
| Planning signals inconsistent | Dated planning/project status API |
| User cannot compare outcomes | Stable suburb and property-type identifiers |
| Source freshness unclear | Observation and update timestamps |

The showcase should demonstrate:

- What works with the current dataset.
- How many suburbs pass the DQ gate.
- Which metrics are most useful.
- Which missing fields limit the score.
- Exactly what API or data contract would unlock the next product stage.

This is a much stronger NPD conversation than presenting a large list of hypothetical requirements.

## Mandatory Implementation Specification for the Showcase Build

The following items are required for the next implementation iteration. They are not suggestions, placeholders, or items to defer while polishing the UI.

### 1. Add a POC configuration profile

Create one configuration source for the internal POC:

```text
PUBLIC_POC_MODE=true
PUBLIC_POC_MIN_DQ_SCORE=80
DEMO_MODE=false
ALLOW_MOCK_SUBURBS=false
POC_MODEL_VERSION=buyer-fit-poc-1.0.0
```

Requirements:

- The backend owns these settings.
- The frontend must not define a separate DQ threshold.
- The default must not enable mock data.
- The active threshold and mode must be returned by a health/config response so the showcase can be verified.

Acceptance test: changing `PUBLIC_POC_MIN_DQ_SCORE` from `80` to `90` changes the backend result count without changing source data.

### 2. Enforce the DQ gate in every recommendation path

Update the suburb list, Buy Finder ranking, similar-suburb results, and any recommendation endpoint so that excluded suburbs cannot appear as ranked recommendations.

Requirements:

- `dq_score >= PUBLIC_POC_MIN_DQ_SCORE`.
- `is_enriched == true`.
- Identity is verified.
- No synthetic recommendation inputs.
- Required fields for the selected buyer profile are present.
- Excluded records may appear only in a separate data-quality review response.

Acceptance test: insert or select a suburb below DQ 80 and prove it cannot appear in `/api/buy-finder/rank`, even if its price, yield, or current score is attractive.

### 3. Implement the backend Buyer Fit endpoint

Add:

```text
POST /api/buy-finder/rank
```

Minimum request:

```json
{
  "buyer_profile": "first_home_buyer",
  "state": "VIC",
  "budget": 850000,
  "deposit": 170000,
  "property_type": "house",
  "maximum_cbd_minutes": 60,
  "minimum_yield": null,
  "weights": {
    "affordability": 30,
    "income": 25,
    "livability": 20,
    "access": 15,
    "evidence": 10
  }
}
```

Minimum response:

```json
{
  "model_version": "buyer-fit-poc-1.0.0",
  "dq_threshold": 80,
  "results": [
    {
      "rank": 1,
      "suburb_id": "VIC_EXAMPLE_3000",
      "buyer_fit_score": 78,
      "confidence_label": "medium",
      "eligibility": "eligible",
      "components": {},
      "drivers": [],
      "unknowns": [],
      "evidence_ids": []
    }
  ],
  "excluded_count": 0
}
```

Requirements:

- Calculate the score only in the backend.
- Normalize weights server-side and reject invalid weights.
- Return deterministic ordering with a stable tie-breaker.
- Return `insufficient_data` or `cannot_verify` instead of silently imputing missing values.
- Persist the request and feature snapshot.

Acceptance test: two identical requests against the same data snapshot return byte-equivalent scores and the same ordering.

### 4. Replace the current Buy Finder implementation

Update `src/components/BuyFinder.tsx`:

- Remove the local `useMemo` score calculation.
- Remove `100 - medianPrice / 30000` affordability logic.
- Send the buyer request to `/api/buy-finder/rank`.
- Render backend components, drivers, unknowns, DQ threshold, and excluded count.
- Display an explicit loading, error, and no-eligible-suburbs state.
- Do not render mock results when the endpoint fails.

Acceptance test: changing a weight or budget causes a network request and the displayed score exactly matches the backend response.

### 5. Make Buy Finder a real application tab

Update `src/App.tsx`:

- Add `buy-finder` to `TabName`.
- Add a visible `Buy Finder` navigation tab.
- Render `BuyFinder` from the tab route.
- Pass no hidden client-side scoring data into the component.
- Preserve the profile dashboard as the baseline experience.

Acceptance test: a user can open Buy Finder from the main navigation, submit a request, see ranked eligible suburbs, and return to the profile without losing the baseline flow.

### 6. Remove production synthetic inputs

Update `backend/predictive_ai_engine.py`:

- Remove postcode modulo infrastructure, rezoning, flood, and bushfire calculations from the production path.
- Keep demo-only fixtures only when `DEMO_MODE=true`.
- Mark all demo fixtures `synthetic_demo`.
- Ensure the Buyer Fit endpoint rejects synthetic fields.

Acceptance test: with `DEMO_MODE=false`, no recommendation response contains a synthetic infrastructure, flood, bushfire, or rezoning value.

### 7. Stop silent mock fallback

Update `src/App.tsx`:

- Do not use `mockSuburbsData` when the API returns an empty response or fails.
- Only enable mock data when `DEMO_MODE=true` is explicitly supplied by the build configuration.
- Show `Data unavailable` and the failed service state instead.

Acceptance test: stop the API and prove the UI does not display a ranked suburb or a production-looking recommendation.

### 8. Correct score language and expose the calculation

Update the profile and Buy Finder UI:

- Replace `Growth Probability` with `Growth Score`.
- Add `Buyer Fit Score` for the new composite score.
- Show component scores, weights, and contribution points.
- Show `Evidence completeness` separately from score and confidence.
- Remove any tooltip that describes a formula different from the backend code.

Acceptance test: a user can manually add the displayed component contributions and reproduce the displayed Buyer Fit Score within the documented rounding rule.

### 9. Add the evidence contract

Add a backend evidence response, preferably:

```text
GET /api/suburbs/{suburb_id}/evidence
```

Each material metric must return:

- `evidence_id`.
- Value and unit.
- Source name or `existing_dataset`.
- Retrieval/load date.
- Observation date if known.
- Direct or derived status.
- Quality status.
- DQ issue, if any.

Acceptance test: price, rent, yield, population, vacancy, and DQ score can each be traced from the UI to an evidence record.

### 10. Make AI explanatory and schema-validated

Update `backend/ai_agent.py`:

- Replace regex parsing of `VERDICT`, `STRATEGY`, `REALITY CHECK`, and `CATALYSTS`.
- Validate a structured response with Pydantic.
- Include claims, evidence IDs, confidence label, assumptions, unknowns, model version, prompt version, and provider.
- Return `INSUFFICIENT_EVIDENCE` when the provider response is malformed or unsupported.
- Never silently default to `Hold`.
- Do not allow AI output to change the deterministic Buyer Fit Score.

Acceptance test: a deliberately malformed provider response produces a visible insufficient-evidence result while the deterministic ranking still renders.

### 11. Remove the second risk formula

Update `src/components/AIInsightPanel.tsx`:

- Remove the inline client-side what-if risk formula.
- Call one backend risk endpoint for standard and scenario analysis, or disable what-if in the snapshot POC.
- Label any scenario as an estimate, not a calibrated probability.

Acceptance test: frontend source contains no independent decline-probability formula and the displayed scenario includes the backend model version and inputs.

### 12. Persist the POC decision record

Persist:

- Request ID.
- Buyer inputs.
- DQ threshold.
- Feature snapshot ID.
- Model version.
- Ranked results.
- Excluded suburbs and reasons.
- AI explanation status.
- Timestamp.

This is enough to demonstrate reproducibility and prepare for future Model Diary outcomes. Do not claim calibration yet.

Acceptance test: a saved showcase request can be reopened and produces the same result against the same feature snapshot.

## Showcase Release Gate

The POC is ready for the friend-circle and NPD demonstration only when all of these are true:

- The Buy Finder tab is visible and works end-to-end.
- At least one result set passes the DQ threshold.
- The DQ threshold is enforced by the backend.
- No mock data is shown with `DEMO_MODE=false`.
- No synthetic environmental or infrastructure signal affects a score.
- Buyer Fit is calculated by one backend implementation.
- Score contributions are visible.
- Evidence and DQ status are visible.
- Unknown data is shown as unknown, not low risk or zero.
- AI failure does not break or alter the deterministic ranking.
- Every showcase result has a model version and timestamp.
- The output identifies the exact missing data/API capability requested from NPD.

If one of these conditions fails, the build is not ready for showcase. Fix the condition rather than explaining it away in the demo.

## Challenge to the Previous Recommendation

The previous recommendation was too conservative in one important way: it treated the absence of historical sales data as if it blocked a meaningful product. It does not. It blocks a particular class of claim: validated growth prediction.

The revised boundary is:

- Build the buyer-fit experience now.
- Use current and observable signals.
- Let users bring their own budget and priorities.
- Accumulate history from the date the tool launches.
- Add forecasting only when it earns its place through observed outcomes.

That gives the startup something demonstrable within weeks rather than waiting for a national historical dataset.

## Important Reality Check: Historical Data Is Not a POC Prerequisite

The purpose of the first POC is not to recreate the historical database held by large property-data providers. If historical suburb-level price, rent, vacancy, or hazard data is unavailable under acceptable terms, do not pretend that it can be reconstructed reliably from scattered web pages.

The POC should be split into three honest capability levels:

| Capability | What can be shown now | What must wait |
|---|---|---|
| **Current evidence** | Current permitted metrics, source dates, buyer constraints, comparisons, and unknowns | Nothing, if the source is lawful and reliable |
| **Historical context** | Only official or permitted dated observations that can be reproduced | Complete suburb time series and property-level history |
| **Validated prediction** | Not claimed in the first POC | Outcomes, calibration, probabilities, and backtesting |

This means the first product can be useful without claiming to forecast growth. It can answer:

> “Given the evidence available today, which areas fit this buyer’s constraints, what supports that result, and what cannot currently be verified?”

That is a credible product. A transparent `history unavailable` message is stronger than a fabricated chart or an extrapolated probability.

### Features to remove from the first POC when data is unavailable

Do not build or display these until there is a lawful, dated source:

- Ten-year price charts.
- Historical rent charts.
- P10/P50/P90 forecasts.
- Downside probabilities.
- Calibrated growth probabilities.
- “Outperformed the market” claims.
- Historical model accuracy dashboards.
- Flood or bushfire hard exclusions based on incomplete coverage.

Replace them with:

- Current snapshot comparison.
- Source age and quality status.
- A list of unavailable fields.
- Deterministic fit to the buyer’s stated constraints.
- A watchlist for future observations.
- Human-reviewed evidence notes.

## The Buildable Product Definition

The first release should be an **evidence-led buyer comparison tool**, not a national property forecasting engine.

### Inputs available from the user

The user can provide information the product cannot lawfully or affordably source:

- Budget or maximum purchase price.
- Deposit.
- Property type.
- Target state or city.
- Commute limit.
- Minimum rental yield, if relevant.
- Maximum vacancy, if a permitted current source exists.
- Risk exclusions, subject to available authoritative overlays.
- Holding intention and buyer profile.

### Outputs the product can support without a large historical feed

- Eligible or ineligible against stated constraints.
- Current evidence score by category.
- Affordability relative to the user’s own budget and deposit.
- Current rent-to-price calculation where both values are available.
- Amenity, school-location, or transport indicators from permitted sources.
- Current source freshness and data quality.
- Missing evidence and reasons for exclusion.
- A shortlist that the user can save and revisit.

### Outputs the product must not claim yet

- “This suburb has a 70% chance of growth.”
- “This is the best suburb in Australia.”
- “This property will return 8%.”
- “Low flood risk” when the authoritative overlay is unavailable.
- “Historical performance” from a single current snapshot.
- “AI discovered a catalyst” when no dated source supports it.

## Three-Stage Data Plan When History Is Unavailable

### Stage A: Snapshot POC

Use one current or latest permitted observation per metric. Every result shows the observation date and whether the field is verified, derived, estimated, or unavailable.

The ranking is a **Current Buyer Fit**, not a growth forecast. It should favour constraints and evidence quality:

```text
Current Buyer Fit
= affordability fit
+ current income fit
+ current livability fit
+ current evidence quality
- current constraint violations
```

Do not include historical growth as a component if it is not available consistently across the selected suburbs.

### Stage B: Accumulated history

Once the POC is running, take a dated snapshot on a fixed schedule from permitted sources. The product gradually builds its own first-party observation history from the date it starts operating.

This does not recreate the past. It creates a clean, auditable panel dataset for future comparison:

```text
suburb_id + metric_name + observed_at + value + source_snapshot_id
```

After enough observations exist, show change over time with a clear label such as `Observed since July 2026`. Do not call it a ten-year trend.

### Stage C: Outcome validation

Only after the product has accumulated dated observations and outcomes should it consider:

- Backtesting.
- Benchmark comparison.
- Calibration.
- Probability language.
- Model training or fine-tuning.

The Model Diary can begin recording predictions now, but it must report `not enough outcomes` until there is enough evidence. A table full of empty outcome columns is not calibration.

## What to Do With the Existing Historical Fields

The current repository contains history-shaped fields and projections. Do not delete the existing baseline data before backing it up, but do not automatically carry those fields into the new POC.

Classify every existing historical field:

1. **Permitted and traceable:** retain with source, observation date, and licence metadata.
2. **Permitted but incomplete:** retain only as context and label the coverage gap.
3. **Derived from permitted data:** retain with formula and input evidence.
4. **Commercial or scraped with unclear rights:** quarantine from the POC until permission is confirmed.
5. **Synthetic or extrapolated:** remove from recommendation logic and label as development-only if retained.

The POC should never use a legacy field simply because it is already in `SuburbUIV3`. Existing storage is not proof of legal permission, historical accuracy, or current freshness.

## Transition Sequence: Preserve the Existing System First

Treat the current dashboard as the baseline and the new POC as a parallel experiment. Do not clean, overwrite, or migrate in place.

### Step 0: Freeze the baseline

Before changing ingestion or scoring:

1. Stop scheduled ETL, scraping, enrichment, and predictive jobs.
2. Record the current Git commit, environment variables names, database schema version, and running service versions.
3. Export the current API and UI build status.
4. Write down which data was collected under which source terms or licence.
5. Mark the baseline as read-only.

The freeze should have a timestamp, operator, commit ID, and database backup ID. Do not copy secrets into the repository or the Markdown record.

### Step 1: Back up the repository and database

Create two independent backup types:

- **Code backup:** a Git tag and an archive of the current working tree.
- **Data backup:** a PostgreSQL custom-format dump plus a separate copy of raw source files and ETL logs.

Example PowerShell sequence from the repository root:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
git status --short
git rev-parse HEAD
git tag "baseline-$stamp"
git archive --format=zip --output "../realestate-baseline-$stamp.zip" HEAD
```

Example database backup from the environment that can reach PostgreSQL:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
pg_dump --format=custom --file "../realestate-db-$stamp.dump" $env:DATABASE_URL
```

If PostgreSQL runs in Docker, run `pg_dump` inside the database container or use the project’s documented database service. The important part is that the dump is taken from the same database used by the current application.

Also preserve:

- `suburbs_raw_v3` and all raw extraction payloads.
- `suburbs_ui_v3` and history tables.
- `committee_memory` and `model_diary`.
- ETL logs, scheduler logs, and data-quality outputs.
- Source registry and licence notes.
- Current `docker-compose` and environment configuration, excluding secrets.

Verify the backup before proceeding:

```powershell
Get-FileHash "../realestate-baseline-$stamp.zip" -Algorithm SHA256
Get-FileHash "../realestate-db-$stamp.dump" -Algorithm SHA256
pg_restore --list "../realestate-db-$stamp.dump" | Select-Object -First 20
```

For a serious handover, restore the dump into a temporary database and run a row-count check. A backup that has never been restored is only an assumption.

### Step 2: Create an isolated POC line

Use a separate branch and, preferably, a separate database and environment:

```powershell
git switch -c poc/open-data-ingestion
```

Recommended separation:

```text
Current baseline                 New POC
-------------------------------  -------------------------------
realestate database              realestate_poc database
existing ETL jobs                poc ETL jobs only
current production-like API      poc API profile
existing AI cache                poc cache namespace
existing raw data                new permitted snapshots
```

Never point a new destructive migration at the baseline database. Use a database name, schema, or container that cannot be confused with the current one. Use a POC cache prefix such as `poc:` so old AI results cannot leak into new rankings.

### Step 3: Make the first POC data decision explicit

Select one geography and a fixed suburb list. For example:

```text
POC geography: one city
POC suburbs: 20-30 named suburbs
POC property types: house and unit only
POC buyer profiles: first-home buyer and investor
POC refresh: manual or weekly
```

Create the source registry before downloading data. Every planned metric must have one of these outcomes:

- permitted source selected;
- derived from permitted fields;
- unavailable and excluded from ranking;
- development-only demo field, excluded from production logic.

### Step 4: Ingest new data without touching the baseline

Run the new pipeline into POC-only raw, bronze, silver, and gold tables. Keep the original source payload and the transformation version for every record.

The first successful run should produce:

- source snapshot IDs;
- content hashes;
- retrieval and observation dates;
- canonical suburb IDs;
- quality flags;
- rejected-record report;
- per-metric provenance;
- row counts by layer.

Do not copy the existing commercial or scraped raw payloads into the new POC merely because they are already present. First classify whether the intended POC use is permitted. If the answer is unclear, leave those fields unavailable.

### Step 5: Compare, do not overwrite

Run a comparison report between baseline and POC data:

| Check | Required output |
|---|---|
| Suburb coverage | Baseline count versus POC count |
| Metric coverage | Which fields are present in each system |
| Value differences | Absolute and percentage differences |
| Missingness | New missing fields and reason |
| Provenance | Source and observation date for each POC metric |
| Synthetic usage | Confirm zero synthetic fields in POC scores |
| Ranking impact | Which suburbs move and why |

The report is for investigation only. Do not silently choose whichever value makes a ranking look better.

### Step 6: Rebuild only the decision slice

Implement the POC in this order:

1. Canonical suburb identity.
2. Source registry and metric metadata.
3. Cleansing and quality gates.
4. Backend Buy Finder request and ranking contract.
5. Component scores and evidence IDs.
6. Decision Brief UI.
7. AI explanation of the deterministic output.
8. Model Diary prediction record.

Leave listings, national coverage, fine-tuning, and advanced forecasting out of the first slice. They can be evaluated after users demonstrate that the evidence-led ranking is useful.

### Step 7: Validate and release the POC separately

Before showing the POC to users:

- Restore the backup into a temporary database and confirm it is usable.
- Run parser, cleansing, score, and API contract tests.
- Confirm `DEMO_MODE` data cannot enter the production score path.
- Confirm unknown flood or bushfire data is not treated as low risk.
- Confirm the same feature snapshot produces the same ranking.
- Confirm AI output failure leaves the deterministic result visible.
- Confirm the old baseline still starts from its own database and cache.

The POC is a release candidate only after these checks pass. The baseline remains available for comparison and rollback.

### Step 8: Keep rollback simple

Rollback means:

1. Stop the POC services.
2. Point the application back to the baseline image, branch, database, and cache namespace.
3. Do not restore a database dump over the live database unless the baseline database itself was damaged.
4. Preserve the POC outputs and failure report for learning.

The normal rollback should be configuration-based, not a destructive restore operation.

## Critical Feedback Carried Forward as Release Gates

The last review identified issues that are still material. They are not optional polish for the new POC.

### Gate 1: No synthetic recommendation inputs

The postcode-based infrastructure, rezoning, flood, and bushfire logic must be removed from recommendation paths or isolated behind `DEMO_MODE=true`. A production POC score must fail closed when an authoritative environmental field is unavailable.

**Pass condition:** a test proves that synthetic fields contribute zero points to every production score.

### Gate 2: Growth Score is not a probability

Rename `Growth Probability` to `Growth Score` or `Growth Potential Score`. Do not publish probability language until the Model Diary contains enough dated outcomes to test calibration.

**Pass condition:** the UI and API use consistent score terminology and expose confidence separately.

### Gate 3: One ranking implementation

The browser must not calculate an alternative Buy Finder score. Ranking, hard constraints, affordability, and risk inputs belong in the backend and must be versioned.

**Pass condition:** the same request and feature snapshot return the same ranking from the API, and the UI only renders the response.

### Gate 4: Provenance is part of the data contract

A general `last_updated` field or suburb DQ badge is insufficient. Each material metric needs source, observation date, load date, transformation version, and quality status.

**Pass condition:** a user can open the evidence for price, rent, population, vacancy, and risk fields without inspecting the database.

### Gate 5: AI must be schema-validated and evidence-linked

Replace regex parsing and silent default verdicts. AI output must validate against a structured contract containing verdict, confidence, claims, evidence IDs, assumptions, unknowns, model version, and prompt version.

**Pass condition:** malformed AI output produces `INSUFFICIENT_EVIDENCE` while preserving the deterministic ranking.

### Gate 6: Standard and what-if risk must share one engine

Remove the separate client-side what-if formula. Both standard and scenario results must use the same backend risk implementation, with scenario inputs recorded.

**Pass condition:** a scenario response includes the risk model version, inputs, horizon, assumptions, and whether it is calibrated.

### Gate 7: Model Diary must be operational before probability claims

Persist the feature snapshot, request, model version, score, confidence, baseline values, benchmark, and eventual outcome. Add outcome refresh and summary calculations before calling results probabilities.

**Pass condition:** a recommendation created today can be found later and evaluated against a dated outcome without reconstructing the original data from memory.

### Gate 8: Few-shot memory must not recycle unverified opinions

Historical AI analyses should be excluded from few-shot context until they have an outcome or human-review status. Unverified analyses may be retained for audit, but not treated as examples to imitate.

**Pass condition:** retrieval tests prove that unverified or failed analyses are not supplied as positive few-shot context.

### Gate 9: Mock fallback data must be visible and disabled by default

The current UI fallback to mock suburb data is acceptable for development but dangerous if it looks like live data. Production configuration should fail visibly or show an explicit demo mode.

**Pass condition:** an unavailable API cannot silently populate production-looking recommendations from mock data.

## Recommended Execution Order

For the actual work, use this order:

1. Freeze current jobs and record the baseline commit.
2. Take and verify code, database, raw-data, and configuration backups.
3. Create a separate branch, database, cache namespace, and environment profile.
4. Add the source registry and decide what existing data is legally reusable.
5. Remove or gate synthetic fields before copying any scoring logic.
6. Ingest one small permitted geography into new raw and bronze tables.
7. Clean into canonical silver metrics with quality flags and provenance.
8. Add backend ranking and hard-filter tests.
9. Add score breakdown, confidence, and evidence APIs.
10. Add the Decision Brief UI and wire the real Buy Finder tab.
11. Add schema-validated AI explanations after deterministic ranking works.
12. Persist ranking requests and Model Diary records.
13. Run baseline-versus-POC comparison and user interviews.
14. Decide whether any missing metric justifies a small commercial trial.

Do not start with a large scrape, a national ranking, or AI fine-tuning. Start with a reversible data slice that can prove whether the product is useful.

## What Not To Do

Do not:

- Scrape a commercial website and assume transformation makes the data legally safe.
- Copy raw payloads, images, addresses, or historical records unless the licence and terms permit it.
- Mix synthetic values with government values.
- Fill missing values with plausible-looking defaults.
- Present a score as a forecast probability without calibration.
- Build a national ranking before the data contract and source rights are understood.
- Spend on an LLM or commercial data feed before the core evidence workflow works.

A transformed dataset may still be restricted by contract terms, copyright, database rights, access controls, or usage limits. Obtain written permission or use a source with a licence that permits the intended use. This document is a product and engineering plan, not legal advice.

## POC Scope

### Recommended first slice

Choose one of these scopes:

| Option | Geography | Best for | Cost control |
|---|---|---|---|
| A | One city and 20-30 suburbs | Fastest demo and user interviews | Excellent |
| B | One state and 50-100 suburbs | More useful ranking comparison | Good |
| C | Three buyer journeys and 30 suburbs | Testing product-market fit | Good |

Start with Option A unless an identified customer requires another area.

### Buyer journeys

Support only three profiles initially:

- First-home buyer: maximum purchase price, deposit, commute, minimum livability.
- Owner-occupier upgrader: property type, schools, commute, price ceiling.
- Investor: yield, vacancy, price, risk, and holding period.

Do not add every possible filter. Every input should either affect a deterministic calculation or be clearly marked as informational.

## Affordable Source Strategy

Use a source registry before ingesting any data. A source is not production-ready merely because a URL is publicly reachable.

| Data domain | POC source direction | Use | Governance requirement |
|---|---|---|---|
| Population and demographics | ABS Census and other ABS open datasets | Population, age, household structure, income bands | Record dataset, release, geography, and observation year |
| Interest rates and macro context | RBA published data | Macro context and scenario inputs | Record series identifier and retrieval date |
| Schools | State or federal open education datasets where permitted | School location and selected public attributes | Do not infer school catchment eligibility from suburb name |
| Transport and amenities | OpenStreetMap and local open data | Counts and proximity indicators | Follow ODbL attribution and avoid overstating completeness |
| Planning and infrastructure | State/local government open data portals | Dated projects, approvals, planning layers | Store project status and source date; do not call an announcement a delivered project |
| Environmental hazards | Authoritative state or local open hazard layers | Flood and bushfire screening | Use only datasets with clear licence and geometry/date metadata |
| Prices and rents | Official open datasets, permitted aggregate data, or user-provided files | Market context | Do not scrape a commercial provider without permission |
| Listings | Optional later phase | Property-level discovery | Defer until rights, retention, and display terms are confirmed |

### Source selection rule

For every field, select one of these statuses:

- `verified_open`: source licence permits the intended use.
- `licensed`: written commercial or government permission exists.
- `derived`: calculated only from permitted source fields.
- `estimated`: modelled or approximate; not suitable for hard constraints.
- `unavailable`: no lawful or reliable source in the current POC.
- `synthetic_demo`: development-only and excluded from recommendation logic.

The production recommendation path may use `verified_open`, `licensed`, and carefully documented `derived` fields. It must not use `synthetic_demo` values.

## Data Architecture

Use a simple four-layer pipeline. The goal is traceability, not infrastructure theatre.

```text
Source files / APIs
        |
        v
Raw snapshots (immutable)
        |
        v
Bronze records (parsed, typed, source-aware)
        |
        v
Silver canonical metrics (deduplicated, validated)
        |
        v
Gold product views (scores, rankings, explanations)
```

### Raw layer

Keep an immutable record for each retrieval:

```json
{
  "snapshot_id": "abs-census-2021-2026-07-13-001",
  "source_id": "abs.census.2021",
  "retrieved_at": "2026-07-13T00:00:00Z",
  "observed_at": "2021-08-10",
  "licence_url": "https://...",
  "content_sha256": "...",
  "request_url": "https://...",
  "parser_version": "abs-parser-1.0.0",
  "payload_path": "raw/abs/...",
  "status": "success"
}
```

Never overwrite a raw snapshot. If a source changes, ingest a new snapshot and retain the previous one.

### Bronze layer

Parse the source into typed records while retaining the original source fields:

- `source_id`
- `snapshot_id`
- `source_record_id`
- `suburb_name_raw`
- `postcode_raw`
- `state_raw`
- `field_name_raw`
- `value_raw`
- `unit_raw`
- `observed_at`
- `loaded_at`
- `parse_status`
- `parse_error`

Bronze is allowed to contain dirty values. It is not the user-facing layer.

### Silver canonical layer

Map records to a canonical suburb key and typed metrics:

```json
{
  "suburb_id": "VIC_RICHMOND_3121",
  "metric_name": "population",
  "value": 28600,
  "unit": "people",
  "property_type": null,
  "source_id": "abs.census.2021",
  "snapshot_id": "abs-census-2021-2026-07-13-001",
  "observed_at": "2021-08-10",
  "loaded_at": "2026-07-13T00:00:00Z",
  "transformation_version": "metric-map-1.0.0",
  "quality_status": "verified",
  "quality_flags": []
}
```

Store metric values and metric metadata together. Do not rely on one general suburb-level `last_updated` timestamp.

### Gold layer

The product layer may contain:

- Growth Score.
- Income Score.
- Affordability Score.
- Risk Score.
- Livability Score.
- Investment Fit.
- Driver and risk explanations.
- Data quality and confidence.
- Evidence IDs.

Every gold output must be reproducible from a feature snapshot and a model version.

## Canonical Data Model

Create a small canonical dictionary before building more UI.

| Canonical metric | Type | Valid range | Missing behaviour |
|---|---:|---:|---|
| `median_price` | decimal | `> 0` | Exclude from affordability ranking |
| `median_rent_weekly` | decimal | `>= 0` | Do not calculate yield |
| `gross_yield_pct` | decimal | `0-30` warning above 15 | Mark outlier; never silently cap |
| `vacancy_rate_pct` | decimal | `0-100` | Do not pass vacancy filter |
| `population` | integer | `>= 0` | Leave unknown |
| `population_growth_cagr_pct` | decimal | `-100 to 100` | Calculate only with valid dated observations |
| `days_on_market` | integer | `>= 0` | Leave unknown |
| `school_count` | integer | `>= 0` | Do not infer school quality |
| `transit_access_score` | decimal | `0-100` | Mark unavailable if no source |
| `flood_risk` | enum | `low/medium/high/unknown` | `unknown` is not `low` |
| `bushfire_risk` | enum | `low/medium/high/unknown` | `unknown` is not `low` |
| `cbd_distance_minutes` | integer | `>= 0` | Do not pass commute filter |

Use `null` or an explicit `unknown` enum for missing values. Avoid values such as `0`, `5`, or `100` as defaults unless zero is actually observed.

## Cleansing Rules

### 1. Identity resolution

Create a canonical key from an authoritative suburb boundary or geography reference where possible.

Rules:

- Normalize Unicode and whitespace.
- Uppercase state codes.
- Preserve the raw name separately.
- Treat postcode as a string, not an integer, because leading zeros matter.
- Resolve aliases through a maintained mapping table.
- Reject a record when suburb, state, and postcode cannot be disambiguated.

Example:

```text
"St Kilda East", "VIC", "3183"
-> VIC_ST_KILDA_EAST_3183
```

Do not match suburbs by name alone. “Richmond” exists in multiple states and a name-only join can corrupt the product silently.

### 2. Type and unit normalization

Convert values at ingestion time and record the conversion:

- `$750,000` -> `750000`, unit `AUD`.
- `4.2%` -> `4.2`, unit `percent`.
- Weekly rent remains weekly; annual rent is a separate derived metric.
- Dates are stored in ISO format with a timezone for load timestamps.
- Do not mix monthly, quarterly, and annual observations without retaining the original period.

### 3. Range checks

Range checks should create quality flags, not silently repair values.

Examples:

- Negative price: reject.
- Yield below `0%`: reject.
- Yield above `15%`: warning and review; above `30%`: quarantine.
- Vacancy below `0%` or above `100%`: reject.
- Population change above an agreed threshold: review for unit or join error.
- Future observation date: quarantine unless the source explicitly identifies a forecast.

### 4. Duplicate handling

Define a natural key for every source. For a suburb metric it may be:

```text
source_id + geography_id + metric_name + property_type + observation_period
```

When duplicates occur:

1. Keep all raw records.
2. Select the winning record by documented priority.
3. Record the rejected record IDs and reason.
4. Never deduplicate on “last row wins” without a source rule.

### 5. Derived metric rules

Derived metrics must carry their formula and input evidence.

Example gross yield:

```text
gross_yield_pct = (median_rent_weekly * 52 / median_price) * 100
```

Store:

- Formula version.
- Input metric IDs.
- Input observation dates.
- Output calculation date.
- Rounding rule.

Population CAGR should only be calculated from two valid dated population observations:

$$
CAGR = \left(\frac{P_{end}}{P_{start}}\right)^{1 / years} - 1
$$

If the dates or units are uncertain, return `unknown` rather than an approximate number.

### 6. Missing data policy

Use three separate concepts:

- `missing`: source did not provide the field.
- `not_applicable`: field does not apply.
- `unavailable`: source or licence is not available in the POC.

A missing environmental risk layer must not become “low risk.” A missing price must not become “affordable.”

## Data Quality Gates

Do not publish a source batch until it passes these checks:

| Gate | Example threshold | Action on failure |
|---|---:|---|
| Identity match rate | `>= 98%` | Quarantine unmatched records |
| Required metric completeness | `>= 90%` for ranking fields | Exclude incomplete suburbs from ranking |
| Duplicate rate | `< 1%` | Investigate source key |
| Invalid numeric rate | `< 0.5%` | Quarantine invalid records |
| Freshness | Defined per metric | Show stale badge or exclude |
| Licence metadata | 100% of sources | Block publication |
| Transformation test pass | 100% | Block release |
| Synthetic field usage | 0 in production scores | Block release |

A suburb can still appear in search with incomplete data, but it must not receive a misleading rank. Display `Insufficient data` and explain why.

## Ranking Model for the POC

The first version should be deterministic and modest.

### Hard filters first

Apply hard constraints before scoring:

- Maximum purchase price.
- Property type availability.
- Minimum yield, if investor profile.
- Maximum vacancy, if investor profile.
- Maximum commute, if supplied.
- Flood and bushfire exclusions only when authoritative risk data is available.
- Minimum data completeness for a ranked result.

If an exclusion cannot be evaluated because the field is unknown, the result should be `cannot_verify`, not a pass.

### Score second

Use a transparent weighted score:

```text
Investment Fit
= Growth Score       * buyer_weight_growth
+ Income Score       * buyer_weight_income
+ Affordability      * buyer_weight_affordability
+ Risk Score         * buyer_weight_risk
+ Livability Score   * buyer_weight_livability
```

Return the component scores, weights, contributions, and evidence IDs. Do not call the result a probability.

### Confidence separately

Confidence should reflect evidence quality, not optimism:

- High: all material inputs present, recent, licensed/open, and internally consistent.
- Medium: one or more material inputs are older or derived.
- Low: material fields are missing, estimated, or not independently verified.

The score can be high while confidence is low. That distinction is useful and should be visible.

## AI Role in the POC

Keep AI out of the numerical decision logic.

The deterministic service should produce:

- Scores.
- Filters.
- Ranking.
- Drivers.
- Risks.
- Evidence IDs.
- Unknowns.

The AI may then turn those supplied facts into readable language. It must not invent missing evidence or change the score.

A safe POC response shape is:

```json
{
  "summary": "This suburb ranks well for the selected investor profile.",
  "drivers": [
    {
      "claim": "Yield is above the buyer minimum.",
      "evidence_ids": ["metric.gross_yield_pct:2026-06-30"],
      "status": "supported"
    }
  ],
  "risks": [
    {
      "claim": "Flood risk could not be verified in the current POC.",
      "evidence_ids": [],
      "status": "unknown"
    }
  ],
  "unknowns": ["Authoritative flood overlay unavailable"],
  "model_version": "buyfit-poc-1.0.0",
  "prompt_version": "decision-brief-1.0.0"
}
```

If the AI response does not validate, show the deterministic result and mark the explanation as unavailable. Never silently substitute a generic `HOLD`.

## POC Budget

Indicative budget, excluding the founder's time:

| Item | Lean POC approach | Indicative cost |
|---|---|---:|
| Storage and database | Local Docker or low-cost hosted PostgreSQL | $0-$50/month |
| Scheduled ingestion | GitHub Actions or a small worker | $0-$30/month |
| Open-source processing | Python, pandas, DuckDB, PostGIS, dbt Core | $0 licence cost |
| Open data downloads | Government/open portals | Usually $0, subject to terms |
| Map tiles/geocoding | Use cached/open-licence sources and limit requests | $0-$100/month |
| LLM explanation | Local model or usage-capped API | $0-$100/month |
| Domain and basic deployment | Optional | $20-$100/month |
| Legal/licence review | Targeted review of intended sources | Budget separately |

A sensible first target is **$0-$500 per month** for a serious POC, not $75K upfront. The exact amount depends on hosting, geocoding, and whether a lawyer reviews commercial source terms.

Do not treat the $75K quote as the cost of “getting started.” Treat it as a later option for a specific coverage or accuracy gap that the POC has already demonstrated.

## Build Plan

### Week 1: Source and contract inventory

Deliverables:

- Source registry.
- Licence and attribution notes.
- Canonical suburb key strategy.
- Three buyer profiles.
- Metric dictionary.
- Decision on one geography.

Success condition: every planned metric has a named source or is explicitly marked unavailable.

### Week 2: Raw and bronze ingestion

Deliverables:

- Immutable raw snapshots.
- Content hashes.
- Retrieval logs.
- Typed bronze tables.
- Parser tests for each source.

Success condition: a source batch can be rerun and produces the same bronze output from the same snapshot.

### Week 3: Silver cleansing and quality report

Deliverables:

- Canonical suburb mapping.
- Unit normalization.
- Duplicate rules.
- Range checks.
- Quality flags.
- Per-metric provenance.

Success condition: every published metric can be traced to a source record and observation date.

### Week 4: Deterministic ranking

Deliverables:

- Backend ranking endpoint.
- Hard constraints.
- Component scores.
- Evidence IDs.
- Confidence calculation.
- Request persistence with model version.

Success condition: two runs with the same snapshot, request, and model version produce the same ranking.

### Week 5: Decision Brief and interviews

Deliverables:

- Top-fold Decision Brief.
- Evidence drawer.
- Unknowns and limitations.
- Three buyer workflows.
- Five to ten user interviews or observed sessions.

Success condition: users can explain why the first-ranked suburb ranked first without reading source code.

### Week 6: Outcome tracking setup

Deliverables:

- Model Diary prediction records.
- Baseline feature snapshot.
- Benchmark selection.
- Scheduled outcome refresh design.
- No probability language unless calibration is available.

Success condition: every recommendation can be evaluated later against a dated baseline.

## Commercial Data Decision Gate

Only reconsider the $75K dataset after the POC answers all of these questions:

1. Do users return to the product?
2. Which missing metric causes the most trust loss?
3. Does that metric materially change rankings?
4. Is the commercial provider allowed to support the intended display, storage, and derived use?
5. Can a smaller geography, API tier, trial, or per-query plan solve the gap?
6. Can the provider supply historical snapshots needed for validation?
7. What is the cost per active user or decision supported?
8. Is the data better than an open-source alternative by enough to justify the price?

If the answer is unknown, negotiate a smaller experiment:

- Paid sample for one state.
- One-month trial.
- Limited API calls.
- Evaluation licence.
- Non-production research licence.
- Co-design or startup programme.
- Data partnership with an agency, broker, council, or research group.

Get the permitted use in writing. In particular, clarify storage duration, derived metrics, user display, caching, redistribution, model training, and deletion obligations.

## Practical Product Positioning Without Commercial Coverage

The POC can still be valuable if it is honest about its boundary:

> “An evidence-led suburb comparison tool for selected Australian areas, using open government, local open-data, and transparent derived metrics.”

That is a narrower product, but it is defensible. It can help users compare:

- Demographic change.
- Rental demand proxies.
- Openly available planning activity.
- Amenity and transport access.
- Affordability relative to the chosen buyer profile.
- Evidence freshness and data quality.

Avoid claiming:

- Complete market coverage.
- Accurate property valuations.
- Guaranteed growth.
- Comprehensive environmental screening.
- Licensed listing access.
- Personalised financial advice.

## Immediate Changes for the Current Repository

The latest reviewed repository should be adjusted in this order. These are direct fixes to the current implementation, not optional future ideas:

### P0: Make the current code trustworthy

1. **Disable synthetic predictors.** In `backend/predictive_ai_engine.py`, remove the postcode modulo logic from all production paths. If the development demo needs it, isolate it behind `DEMO_MODE=false` by default and write `quality_status: synthetic_demo` into the output.
2. **Stop silent mock fallback.** In `src/App.tsx`, do not fall back to `mockSuburbsData` when the API is empty or unavailable unless the application is explicitly in demo mode. Show a data-unavailable state instead.
3. **Rename misleading scores.** In `src/App.tsx` and related API responses, replace `Growth Probability` with `Growth Score`. Remove the tooltip formula that does not match the backend implementation.
4. **Remove the browser ranking formula.** In `src/components/BuyFinder.tsx`, stop calculating affordability and fit in `useMemo`. The component should send a request to the backend and render the returned ranking.
5. **Add the backend decision endpoint.** Add `POST /api/buy-finder/rank` with a versioned request and response contract. For the snapshot POC, support budget, deposit, property type, state/geography, commute, and only filters whose data is actually available.
6. **Fail closed on unknown hard constraints.** Unknown flood, bushfire, price, or vacancy data must return `cannot_verify` or `insufficient_data`, never a pass.

### P1: Make the evidence inspectable

7. **Add metric provenance.** Add a parallel evidence response such as `GET /api/suburbs/{suburb_id}/evidence` rather than breaking all existing scalar fields immediately. Include source, licence status, observation date, load date, transformation version, quality status, and evidence ID.
8. **Expose score components.** Return Growth, Income, Affordability, Risk, Livability, and Current Buyer Fit components with weights and contributions. Do not merge confidence into the score.
9. **Build the Decision Brief.** Place the deterministic result above the detailed AI panel. Show eligibility, Current Buyer Fit, confidence, top evidence, unknowns, and reasons a suburb was excluded.
10. **Replace regex AI parsing.** In `backend/ai_agent.py`, validate a structured Pydantic response. On malformed output, return `INSUFFICIENT_EVIDENCE`; do not default to `Hold`.
11. **Link claims to evidence.** Store claim type, evidence IDs, confidence, assumptions, unknowns, model version, prompt version, and provider metadata with every AI explanation.
12. **Unify risk calculations.** Remove the client-side what-if formula from `src/components/AIInsightPanel.tsx`. Use one backend risk endpoint only if the POC has enough data to support a scenario; otherwise show `scenario unavailable`.

### P2: Make the system learnable later

13. **Persist decision snapshots.** Store the user inputs, selected features, missing fields, ranking output, model version, and timestamp. This is useful even without historical data.
14. **Activate Model Diary carefully.** Record predictions and baselines now, but show `not enough outcomes` rather than calibration metrics until observations exist.
15. **Gate memory retrieval.** In `backend/committee_memory.py`, do not use unverified AI analyses as positive few-shot examples. Keep them for audit only.
16. **Label simulated rates.** Change `/api/mortgage-rate` from `Simulated Live RBA + Margin API` to an explicit non-live status, or remove it from recommendation logic.
17. **Quarantine legacy history.** Do not expose ten-year projections or old history fields in the POC until their source rights, dates, and transformations are verified.

### POC acceptance test

Before calling the new POC usable, test this exact failure path:

```text
API unavailable
-> no mock suburbs shown
-> no ranking generated
-> user sees data unavailable
-> baseline dashboard remains unaffected
```

Then test the evidence path:

```text
Current suburb metric
-> source snapshot
-> observation date
-> transformation version
-> quality status
-> deterministic score contribution
-> optional AI explanation with evidence ID
```

If either path cannot be demonstrated, the POC is not yet ready for external users.

## Definition of Done for the POC

The POC is ready for user validation when:

- At least 20-50 suburbs are ingested from permitted sources.
- Every published metric has source, observation date, load date, and quality status.
- No synthetic data affects rankings.
- Missing data is visible and never silently replaced with a default.
- The ranking is backend-generated and deterministic.
- Hard constraints are enforced by the backend.
- The user can see score contributions and evidence.
- AI explanations cite evidence IDs and can return `INSUFFICIENT_EVIDENCE`.
- Inputs and outputs are persisted with model versions.
- Recommendations can be evaluated later through the Model Diary.
- At least five target users can use the product and explain its ranking logic.

## Final Recommendation

Build the smallest trustworthy dataset you can govern, not the largest dataset you can purchase.

The commercial dataset may eventually be worthwhile, but it should be bought to solve a measured POC bottleneck, not to compensate for an unvalidated product. A transparent product with fewer suburbs and clear limitations is a stronger startup asset than a national dashboard whose data rights, provenance, and recommendations cannot be defended.
