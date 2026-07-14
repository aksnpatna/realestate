Your authoritative specification is:
`realestate_backend_integration_test_closure_plan.md`

Complete the backend verification work that remained unproven after the Buyer Fit POC changes. This task is focused on creating a reproducible test environment and proving existing behaviour; do not make unrelated product or UI changes.

First inspect the repository’s dependency configuration, database settings, migrations, Docker setup, pytest conventions, ModelDiary model, `model_diary_refresh.py`, evidence registry, and backend test suite.

Implement the smallest coherent solution that satisfies the plan.

Rules:
1. Install and configure `pytest` through the repository’s dependency configuration. Do not rely on a machine-global installation.
2. Create or document an isolated test database path using `TEST_DATABASE_URL` or an equivalent explicit test-only configuration.
3. Add a guard that fails fast if integration tests target a database not clearly identified as a test database.
4. Never execute automated tests against a shared, production, development, or POC database.
5. Keep pure Buyer Fit calculations database-free where the existing design allows it.
6. Add real database-backed Model Diary tests. Do not mock persistence for tests intended to prove persistence, refresh lifecycle, or idempotency.
7. Seed only deterministic minimal fixtures. Tests must not scrape, call external APIs, or depend on live data.
8. Complete runtime evidence-ID validation against the canonical registry. Unknown required evidence must become `INSUFFICIENT_EVIDENCE` or be removed under a documented rule.
9. Test eligibility behaviour using both `PUBLIC_POC_MIN_DQ_SCORE=80` and `PUBLIC_POC_MIN_DQ_SCORE=90`.
10. Do not report completion if `pytest`, the test database, or any required test remains unavailable.

Required backend behaviours to prove:
- zero borrowing capacity returns affordability score `0`, failed serviceability, and a capacity/serviceability risk;
- invalid/non-finite/negative Buyer Fit inputs return documented `4xx` responses;
- higher interest rate cannot improve affordability;
- higher debt cannot improve capacity or affordability;
- all-zero weights return finite, documented behaviour;
- Model Diary records created by API are updated by refresh in the same canonical `ModelDiary` storage;
- refresh is idempotent;
- missing realised data remains null and becomes `unavailable`, never zero;
- insufficient Model Diary outcomes do not produce a calibration/probability claim;
- valid evidence resolves to real sources; invalid evidence is downgraded safely.

Run and report exact results for:

```powershell
python -m pytest backend/tests/test_buyfinder.py -q
python -m pytest backend/tests/test_model_diary_refresh.py -q
python -m pytest backend/tests -q
python -m compileall backend

Run applicable tests twice, with:
PUBLIC_POC_MODE=true
PUBLIC_POC_MIN_DQ_SCORE=80
DEMO_MODE=false
ALLOW_MOCK_SUBURBS=false
and then:
PUBLIC_POC_MIN_DQ_SCORE=90
At completion provide:

Files changed and why.
Exact test-environment setup commands.
The isolation mechanism proving tests cannot point to a shared database.
Test files added/updated and the behaviour each proves.
Full command results, including failures or skips.
Remaining limitations stated as incomplete work, not as passed work
