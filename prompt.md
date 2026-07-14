Your authoritative implementation specification is:
realestate_poc_gap_closure_and_test_plan.md

Implement the plan end to end. This is behaviour and contract work, not a visual-only task.

Operating rules:
1. Read the plan and inspect the owning frontend/backend paths before each change.
2. Complete Phase 1 first: preserve the exact personalised Buyer Fit result when a user opens a shortlist result and enters the Decision Brief/profile flow.
3. Immediately run focused tests after the first substantive Phase 1 edit. Do not continue into later phases until that validation passes.
4. Keep Buyer Fit ranking, affordability and eligibility deterministic and backend-owned. Do not calculate/re-rank results in the browser.
5. Do not replace a buyer’s selected result with a default BuyFinderRequest or generic suburb decision.
6. Do not leave Price Ceiling as a second suburb finder/ranking flow.
7. Do not present raw DQ as a primary buyer-facing metric. Use Evidence labels with technical detail behind progressive disclosure.
8. Do not use forecast, expected return, probability, or estimated-downside language for uncalibrated scenarios.
9. Choose one canonical Model Diary persistence model; ensure refresh scripts and API endpoints use that same model.
10. Do not mark a phase complete based on UI appearance. Implement backend semantics, API contracts, UI behaviour, and automated tests.

For every phase in the plan:
- make the smallest coherent implementation;
- add or update the specified backend, frontend, integration and regression tests;
- run the phase’s focused validation command;
- fix failures before expanding scope;
- preserve existing public API compatibility unless the plan explicitly requires an API contract change.

Required final validation:
- npm run build
- npm run test
- npm run lint
- python -m compileall backend
- python -m pytest backend/tests -q

Run relevant eligibility checks using:
PUBLIC_POC_MODE=true
PUBLIC_POC_MIN_DQ_SCORE=80
DEMO_MODE=false
ALLOW_MOCK_SUBURBS=false

Then repeat eligibility-related tests with:
PUBLIC_POC_MIN_DQ_SCORE=90

At completion, provide:
1. Files changed and why.
2. The decision-snapshot/request contract selected and its limitations.
3. Tests run, with pass/fail results.
4. Any remaining known limitations, clearly separated from completed work.
5. A concise walkthrough proving the final showcase acceptance script in the plan can be demonstrated.

Do not claim completion if any required validation fails or is not run.
