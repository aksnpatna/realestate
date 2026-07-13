Implement realestate_poc_product_flow_and_validation_plan.md against the current repository.

Treat it as a product and engineering contract, not only a UI brief. Start with Phase 1 and proceed in order. Inspect the owning code path before each edit. After every substantive edit, run the narrowest relevant test or build check.

The implementation must include:
- frontend workflow changes;
- backend contract changes;
- real buyer financial-input wiring;
- one authoritative Buyer Fit calculation;
- no duplicate affordability or ranking logic;
- DQ presented as Evidence status, with technical detail behind an expandable view;
- AI Committee visible from Buy Finder or the selected suburb;
- AI kept as an explanation and challenge layer, not the numeric ranking authority;
- provenance and evidence validation;
- focused frontend and backend tests.

Do not implement only CSS or navigation. Do not claim a phase is complete unless its backend behaviour and tests are complete. Report completed, blocked and unverified validation gates separately.
