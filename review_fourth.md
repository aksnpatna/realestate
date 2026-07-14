# Real Estate POC Gap Closure and Test Plan

**Repository:** [aksnpatna/realestate](https://github.com/aksnpatna/realestate)  
**Baseline reviewed:** `master` at `86a450f766f786ef324b79a23baa93f24e79b15a`  
**Date:** 2026-07-14  
**Purpose:** Close the remaining gaps between a technically credible Buyer Fit engine and a coherent, demonstrable buyer decision workflow.

## 1. Outcome Required

The next implementation must make one user promise true:

> A buyer can enter their actual assumptions, receive a deterministic shortlist, open a result, and continue seeing the exact same personalised decision through evidence, AI commentary and cashflow analysis.

This is not a visual clean-up. It is a request-context, decision-snapshot and user-journey implementation.

The target journey is:

```text
Buyer assumptions
  -> Backend Buyer Fit shortlist
  -> Open exact selected result
  -> Same personalised Decision Brief
  -> Evidence details / AI Committee / Cashflow follow-up
```

The score, drivers, risks, affordability result and assumptions shown after opening a result must be the same server-calculated result that appeared in the shortlist. A generic default calculation must never replace a buyer's result.

## 2. Execution Contract For Coding Agents

Use this instruction when handing this document to a coding agent:

> Implement `realestate_poc_gap_closure_and_test_plan.md` against `aksnpatna/realestate` starting from commit `86a450f`. Treat each section as a behaviour contract, not a UI request. Inspect the owning frontend and backend paths before editing. Implement the personalised shortlist-to-decision handoff first, including persistence or a reproducible request contract, then run its focused tests before proceeding. Do not claim a phase is complete because labels or buttons exist. A phase is complete only when its backend semantics, user interaction and automated tests all pass. Preserve the existing deterministic backend Buyer Fit engine as the sole authority for ranking and decision components.

The agent must not:

- replace the personalised result with a default `BuyFinderRequest` when a user opens a shortlist result;
- calculate, rank or reorder Buyer Fit results in the browser;
- introduce browser-only financial calculations as an alternative authority;
- keep a second suburb discovery/ranking flow inside Price Ceiling;
- expose raw DQ as a headline metric when a user-facing Evidence status will do;
- label an uncalibrated scenario as an expected outcome, forecast, probability or return expectation;
- create an untested Model Diary process against a different database model from the one exposed by the API;
- report tests as passing unless they are run after the changes.

## 3. Current Verified State

The following work is already present and should be retained:

- Buy Finder collects annual income, monthly debt, interest rate, serviceability buffer, loan term and purchase-cost allowance.
- The frontend sends those inputs to `POST /api/buy-finder/rank`.
- Buyer Fit ranking, serviceability and hard minimum-yield filtering are backend-owned.
- Result cards show Buyer Fit, serviceability state, Evidence label, support/risk text, and an `Open Suburb` action.
- The standalone calculator is renamed `Price Ceiling Calculator` and describes itself as a planning tool.
- The profile has a visible AI Committee entry point near Decision Brief.
- Cashflow uses an assumptions disclaimer.
- Long-horizon forecasts are unavailable rather than fabricated.

The following gaps remain and define this plan:

1. Opening a shortlist result does not preserve the buyer's personalised decision result.
2. Price Ceiling still locally filters and sorts a second suburb list.
3. Raw DQ remains visible in standard buyer-facing areas.
4. Scenario language still uses predictive-sounding phrases.
5. Model Diary refresh uses `CommitteeMemory` while the exposed APIs use `ModelDiary`.
6. Buyer Fit input validation and zero-capacity affordability behaviour remain unsafe.
7. Tests do not prove the new buyer journey end to end.

## 4. Phase 1: Personalised Shortlist-To-Decision Handoff

### 4.1 Required behaviour

When a buyer selects `Open Suburb` on a Buy Finder result:

1. The application loads the full suburb profile using the existing authoritative suburb endpoint.
2. The application carries the selected backend ranking result and its originating buyer request into the profile state.
3. Decision Brief renders the selected ranking result or a server-side snapshot generated from that exact request.
4. The profile must show the same Buyer Fit score, affordability/serviceability result, drivers, risks, unknowns and evidence label as the selected card.
5. Cashflow may use the selected suburb price/rent as defaults, but must remain a separate indicative calculation.
6. AI remains independent: it may analyse the selected suburb, but it must not change the Buyer Fit score or rank.

### 4.2 Recommended implementation

Use one of these two designs. The first is preferred.

**Preferred: immutable server-side decision snapshot**

- `POST /api/buy-finder/rank` persists a short-lived, immutable ranking snapshot keyed by `request_id`.
- Each result includes `request_id`, `snapshot_id` or a stable `decision_snapshot_ref`.
- Add `GET /api/decision-snapshots/{request_id}/{suburb_id}`.
- The endpoint returns the exact result from the ranking response plus model version, generation timestamp, request assumptions and eligibility information.
- `DecisionBrief` receives the snapshot reference and fetches this endpoint.
- The snapshot must be read-only. Re-running a ranking creates a new request/snapshot rather than mutating an old one.

**Acceptable for this POC: client-held backend response**

- Keep the exact backend ranking response in `App.tsx` state when results load.
- Pass the selected result and request metadata from `BuyFinder` to the profile.
- `DecisionBrief` renders that server-generated selected result directly.
- The profile separately loads full suburb data for maps/history/details.
- Clearly mark the decision as based on the selected shortlist run and preserve it until the user runs a new search.

The acceptable option is faster, but it is not durable across refreshes. Do not claim persistence/reproducibility beyond the current browser session if using it.

### 4.3 Required frontend changes

- Add an explicit application-level type for a Buyer Fit response/result. Do not use `any` for the decision contract.
- Let `BuyFinder` return a selected result plus request metadata through a typed callback.
- In `App.tsx`, load the full suburb record before rendering the profile, then retain the selected Buyer Fit result beside it.
- Rename `Open Suburb` to `Open decision brief` or `View decision` to make the action clear.
- Pass the selected result/snapshot into `DecisionBrief`.
- In Decision Brief, render the selected backend result first. Do not call the generic default decision endpoint when a personalised result is present.
- Show a compact `Based on your latest Buy Finder assumptions` label with an expandable assumptions view.
- Preserve an explicit unavailable state if the suburb profile cannot be loaded. Do not show a partial result as a complete profile.

### 4.4 Required backend changes

If the server-side snapshot design is selected:

- Define a versioned snapshot schema containing: request ID, suburb ID, model version, source snapshot identity/timestamp, Buyer Fit score, components, affordability breakdown, drivers, risks, unknowns, evidence IDs and eligibility detail.
- Store both the buyer request assumptions and result values immutably.
- Add expiry/retention rules suitable for a POC and return a clear expired/unavailable state.
- Ensure the generic `/api/suburbs/{suburb_id}/decision-brief` endpoint is clearly labelled generic or is changed to require a request/snapshot reference for personalised content.

### 4.5 Acceptance criteria

- A buyer changes annual income or monthly debt, runs Buy Finder, opens one result, and sees the same Buyer Fit score in Decision Brief.
- The profile shows the same serviceability pass/fail state and the same main risks as the chosen card.
- Refreshing only the profile data cannot replace the selected decision with a default-profile calculation.
- A generic profile opened outside Buy Finder is labelled `General market snapshot` rather than presented as a personalised decision.

### 4.6 Tests

**Backend**

1. Rank two otherwise-identical requests with materially different annual income.
   - Assert separate request/snapshot IDs.
   - Assert the selected suburb's affordability component differs as expected.
   - Fetch each snapshot and assert it preserves its own score and assumptions.

2. Create a ranking snapshot, mutate current suburb data, then fetch the snapshot.
   - Assert the snapshot score, drivers and affordability values do not mutate.

3. Request a nonexistent or expired snapshot.
   - Assert a clear `404` or documented unavailable response.
   - Assert no generic default score is returned in its place.

**Frontend**

1. Render Buy Finder with a response containing a known result and non-default income/debt assumptions.
   - Select `Open decision brief`.
   - Assert the full-suburb load is requested.
   - Assert Decision Brief displays the exact selected score, drivers, risks and serviceability state.

2. Set raw profile data to values that would generate a different score.
   - Assert the selected result remains unchanged.

3. Render a direct profile visit without a selected result.
   - Assert the UI labels the output as a general snapshot or prompts the user to run Buy Finder.

## 5. Phase 2: Make Price Ceiling A Single-Purpose Planning Tool

### 5.1 Required behaviour

Price Ceiling answers only:

> What purchase price could this deposit and LVR assumption support?

It must not answer:

> Which suburbs should I buy?

### 5.2 Required changes

- Retain deposit, LVR, state and an indicative maximum purchase-price calculation.
- Remove the locally filtered and sorted `Suburbs You Can Afford` table.
- Remove local sorting by Growth Score, yield, schools, transit and CBD distance.
- Add one clear action that takes the user to Buy Finder with a suggested budget/deposit where practical.
- Reuse one backend stamp-duty calculation where possible. If the planning tool remains client-only, label it as an indicative calculation and do not display it beside authoritative Buyer Fit costs as though they are the same model.

### 5.3 Acceptance criteria

- Price Ceiling contains no suburb recommendation or ranking table.
- A buyer can move from an indicative price ceiling to Buy Finder in one clear action.
- Buy Finder remains the only screen that produces a suburb shortlist.

### 5.4 Tests

1. Render Price Ceiling.
   - Assert `Maximum Purchase Price` and disclaimer are visible.
   - Assert no table heading or text matching `Suburbs You Can Afford` exists.
   - Assert no Growth Score / yield / school sorting controls exist.

2. Enter a deposit and select `Use in Buy Finder`.
   - Assert Buy Finder opens with the transferred planning values.
   - Assert no ranked results are created until the backend Buy Finder request completes.

3. Compare a Price Ceiling calculation with a Buy Finder result.
   - Assert the UI labels the former as indicative planning and the latter as the Buyer Fit affordability estimate.

## 6. Phase 3: Evidence First, DQ On Demand

### 6.1 Required behaviour

Users should see an Evidence status, not implementation terminology.

| Internal technical signal | Buyer-facing label |
|---|---|
| High completeness/confidence | `Evidence: High` |
| Moderate completeness/confidence | `Evidence: Medium` |
| Low completeness/confidence | `Evidence: Limited` |
| Missing/unavailable | `Evidence: Unavailable` |

Raw DQ score, configured threshold, synthetic-input status and lineage belong only in `Evidence details`.

### 6.2 Required changes

- Replace buyer-facing `DQ threshold` copy in Buy Finder subtitle, loading state and empty state with plain-language evidence/eligibility wording.
- Remove `DQ: <score>` from the default Decision Brief header.
- Include technical DQ values and threshold only inside an expandable Evidence details area.
- Provide evidence source/update metadata only where it is real; display unavailable rather than invented current dates.

### 6.3 Acceptance criteria

- A buyer can understand why a result is shown without knowing the term DQ.
- A technical reviewer can still expand Evidence details and inspect the score, threshold, eligibility and source references.

### 6.4 Tests

1. Render a normal Buyer Fit result.
   - Assert `Evidence: High`, `Medium`, `Limited` or `Unavailable` is visible.
   - Assert raw DQ number and threshold are absent until Evidence details opens.

2. Open Evidence details.
   - Assert raw score, eligibility score, threshold, data/update status and evidence IDs are shown.

3. Render no eligible results.
   - Assert the message explains that available data and stated constraints produced no matching suburbs.
   - Assert it does not lead with `DQ threshold`.

## 7. Phase 4: Honest Scenario Language

### 7.1 Required changes

Replace predictive language in AI risk/scenario panels:

| Replace | With |
|---|---|
| `estimated downside` | `price-decline scenario` |
| `Est. median` | `illustrative simulated range midpoint` |
| `simulated return` | `illustrative scenario change` |
| `expected return` | never display for an uncalibrated model |

Keep the existing calibration disclaimer, but place it adjacent to the scenario value rather than only in a tooltip.

### 7.2 Acceptance criteria

- A reasonable user cannot mistake the what-if result for a probability, forecast or expected return.
- The UI still communicates the scenario clearly enough to be useful.

### 7.3 Tests

1. Render AI risk output containing a simulated range and decline value.
   - Assert visible text contains `scenario`.
   - Assert visible text does not contain `expected return`, `forecast`, `probability` or `estimated downside`.

2. Trigger the What-If interaction.
   - Assert it calls only `/api/risk/what-if`.
   - Assert rendered output includes the uncalibrated/illustrative disclaimer.

## 8. Phase 5: One Model Diary Persistence Path

### 8.1 Required decision

Choose one canonical persistence model for Model Diary predictions and outcomes. The refresh process, create endpoint, read endpoint and summary endpoint must all use it.

**Preferred:** use the existing `ModelDiary` model because `/api/model-diary/...` already exposes it.

If `CommitteeMemory` must remain for AI audit logs, keep it separate and explicitly named as an AI committee audit record. Do not use it as the hidden source of Model Diary outcomes unless the APIs are changed accordingly.

### 8.2 Required changes

- Align `model_diary_refresh.py` with the canonical Model Diary table/model.
- Make refresh idempotent for every evaluation horizon.
- Store outcome status as `pending`, `pending_partial`, `rated`, or `unavailable` using documented meanings.
- Never substitute `0` for unavailable realised price, yield or vacancy values.
- Ensure the summary reports the model, evaluation horizon, rated sample size and calibration status.
- Add an explicit job invocation/scheduling path suitable for the POC, or document manual operation and its audit output.

### 8.3 Tests

1. Create a Model Diary record through the API, backdate it past a due horizon, and run refresh.
   - Assert the same record receives the realised outcome.

2. Run refresh twice.
   - Assert no duplicate records are created and no original prediction fields change.

3. Remove current source data for a due record.
   - Assert outcome status becomes `unavailable`.
   - Assert realised fields remain null rather than zero.

4. Call Model Diary summary with fewer than ten rated outcomes.
   - Assert status is `incomplete` or `limited` as documented.
   - Assert no calibrated probability claim is returned.

## 9. Phase 6: Affordability Safety And Input Validation

### 9.1 Required backend changes

Add explicit server-side validation for Buyer Fit inputs. The UI constraints are helpful but not sufficient.

At minimum reject with `422` or another documented `4xx` response:

- `budget <= 0`;
- negative deposit, income, debt or purchase-cost allowance;
- non-finite numeric values;
- interest rates outside the documented POC range;
- negative serviceability buffer;
- unreasonable loan terms;
- negative weights or non-finite weight totals;
- invalid minimum yield values.

Correct the zero-capacity bug:

- When borrowing capacity is zero, affordability score must be `0`.
- The result must report serviceability failure.
- It must never receive an affordability score of `100` merely because its price is within the stated budget.

Decide and document whether failed serviceability is a hard exclusion or a ranked-but-failed result. For the POC, recommended behaviour is to keep it visible but clearly marked failed, so the buyer understands why it does not work. Do not call it affordable.

### 9.2 Tests

1. Submit a request with zero income, zero borrowing capacity and a price below budget.
   - Assert affordability score is `0`.
   - Assert serviceability is false.
   - Assert the result contains a capacity/serviceability risk.

2. Submit negative or non-finite values for each constrained input.
   - Assert a `4xx` response.

3. Hold all inputs constant and increase interest rate.
   - Assert repayment increases and affordability does not improve.

4. Hold all inputs constant and increase debt.
   - Assert borrowing capacity and affordability do not improve.

5. Set all weights to zero.
   - Assert documented zero-score behaviour without NaN, infinity or server error.

## 10. Phase 7: Evidence And AI Contract Hardening

This phase is required before representing the AI Committee as evidence-backed rather than merely commentary.

### Required changes

- Resolve each Buyer Fit evidence ID through the evidence endpoint/registry before displaying it as traceable evidence.
- Validate every AI claim's evidence ID against the same registry.
- If any required evidence ID is unknown, downgrade the claim or return `INSUFFICIENT_EVIDENCE`.
- Preserve source URL when it exists; otherwise say source URL is unavailable.
- Make the AI unavailable state explicitly separate from an AI `BUY`, `HOLD` or `PASS` result.

### Tests

1. Return an AI claim with an unknown evidence ID.
   - Assert it is not persisted as a normal verdict.
   - Assert the result is downgraded to `INSUFFICIENT_EVIDENCE` or the invalid claim is removed.

2. Render an AI unavailable response.
   - Assert a clear unavailable message with no verdict styling.

3. Render a valid AI result with source excerpts.
   - Assert source title, source identity and URL when available are visible.
   - Assert missing URL is visibly unavailable rather than fabricated.

## 11. Required Test Files And Build Gates

Add or update focused test files, following existing project conventions:

- `src/components/BuyFinder.test.tsx`
  - finance-input request payload;
  - result card action opens exact selected decision;
  - Evidence details progressive disclosure;
  - no raw DQ in default card.
- `src/components/DecisionBrief.test.tsx`
  - selected backend result renders exactly;
  - generic direct-profile state is labelled correctly;
  - no client-side recalculation.
- `src/components/AffordabilityCalculator.test.tsx`
  - planning-only scope;
  - no local suburb ranking/list;
  - Buy Finder handoff.
- `src/components/AIInsightPanel.test.tsx`
  - scenario wording;
  - unavailable state;
  - no ranking mutation.
- `backend/tests/test_buyfinder.py`
  - input validation;
  - zero-capacity affordability behaviour;
  - rate/debt monotonicity.
- `backend/tests/test_decision_snapshot.py` or equivalent
  - snapshot/request consistency;
  - immutability;
  - unavailable snapshot behaviour.
- `backend/tests/test_model_diary_refresh.py`
  - canonical storage model;
  - idempotency;
  - unavailable outcomes;
  - calibration guard.

Run after every substantive phase:

```powershell
npm run test -- src/components/BuyFinder.test.tsx
npm run test -- src/components/DecisionBrief.test.tsx
python -m pytest backend/tests/test_buyfinder.py -q
```

Before merging or showcasing, run:

```powershell
npm run build
npm run test
npm run lint
python -m compileall backend
python -m pytest backend/tests -q
```

Run focused API contract tests with:

```text
PUBLIC_POC_MODE=true
PUBLIC_POC_MIN_DQ_SCORE=80
DEMO_MODE=false
ALLOW_MOCK_SUBURBS=false
```

Repeat eligibility-related tests with `PUBLIC_POC_MIN_DQ_SCORE=90`.

## 12. Final Showcase Acceptance Script

The product is ready for the next controlled internal showcase only when a presenter can demonstrate the following without manual workarounds:

1. Enter deposit, income, debt and financial assumptions in Buy Finder.
2. Run the deterministic backend shortlist.
3. Open a selected result directly from its card.
4. Show the identical Buyer Fit score, serviceability result, drivers and risks in the Decision Brief.
5. Expand Evidence details to show technical data only when asked.
6. Open AI Committee in one obvious action and state that it challenges but does not determine Buyer Fit.
7. Run a clearly labelled scenario and state that it is uncalibrated.
8. Move to Cashflow/Gearing with the selected suburb's current price/rent defaults.
9. Show Price Ceiling separately as indicative planning, not a second suburb ranking tool.
10. Show an unavailable/error state for a disabled AI or missing decision snapshot without silently substituting defaults.

## 13. Definition Of Done

This gap-closure work is complete only when:

- one selected shortlist result retains its exact personalised decision into the profile;
- the profile loads complete suburb data without overwriting the selected decision;
- Buy Finder is the sole suburb ranking/recommendation path;
- Price Ceiling is a planning calculation only;
- Evidence labels are understandable by non-technical users and DQ remains expandable detail;
- scenario language does not imply prediction or expectation;
- Model Diary refresh and APIs use one canonical model;
- failed serviceability cannot produce a high affordability score;
- all new behaviours have focused automated tests;
- build, lint, frontend tests, backend compilation and backend tests have been run and their results recorded.
