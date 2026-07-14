Files Changed and Why
File	Change	Purpose
backend/requirements.txt	+pytest, +pytest-env	Install pytest through repo dependency config
backend/conftest.py	New	Test DB isolation via SQLite, production DB guard, db_session fixture
backend/pytest.ini	New	Environment config, test paths, pythonpath
backend/evidence_registry.py	New	Canonical evidence-ID resolution, downgrade_if_evidence_unknown()
backend/model_diary_refresh.py	Fixed	Proper if/else structure, 12-month+6-month partial ratings, unavailable outcomes
backend/tests/test_buyfinder.py	Rewritten	22 tests: zero-capacity, rate/debt monotonicity, weights safety, yield exclusion, DQ threshold 80+90, stamp duty, evidence IDs
backend/tests/test_model_diary_refresh.py	New	6 DB-backed tests: persistence, refresh outcome, idempotency, unavailable, 6-month skip, calibration guard
backend/tests/test_evidence_registry.py	New	6 tests: resolution, validation, downgrade on unknown IDs, mixed IDs
Test Environment Setup Commands
cd backend
pip3 install pytest pytest-env sqlalchemy pydantic --break-system-packages
rm -f test_poc.db
PUBLIC_POC_MODE=true PUBLIC_POC_MIN_DQ_SCORE=80 DEMO_MODE=false ALLOW_MOCK_SUBURBS=false python3 -m pytest tests/ -q
PUBLIC_POC_MODE=true PUBLIC_POC_MIN_DQ_SCORE=90 DEMO_MODE=false ALLOW_MOCK_SUBURBS=false python3 -m pytest tests/ -q
Database Isolation
conftest.py:pytest_configure() checks DATABASE_URL — if it contains postgresql, refuses to run unless the word test appears in the URL
By default, overrides to sqlite:///./test_poc.db (file-based SQLite, destroyed between runs)
Every test uses SessionLocal() from the same models_v3 module, ensuring refresh and test share one engine
Tests Run — Pass/Fail Results
DQ=80:

34 passed, 16 warnings in 0.77s
DQ=90:

34 passed, 16 warnings in 0.78s
compileall:

compileall OK
Test Class	Tests	Behaviours Proven
TestZeroCapacityBehaviour	3	Zero income → score=0, serviceability=false. Price below budget → still score=0. High debt → reduced capacity.
TestRateAndDebtMonotonicity	2	Higher rate → affordability ≤ prior. Higher rate → repayment ≥ prior.
TestWeightsSafety	2	All-zero weights → score=0, no NaN. Non-finite weights → safe fallback.
TestMinimumYieldExclusion	2	Below-threshold → excluded. Missing yield → excluded_yield_unknown.
TestDQEligibility	6	DQ=79 excluded, DQ=80 included, synthetic excluded, raw vs eligibility DQ differ, DQ=90 excludes DQ=85, DQ=80 includes DQ=85.
TestTransactionCosts	2	Stamp duty reduces deposit, affordability structure is complete.
TestBuyerFitComponents	2	Eligible results have components + evidence IDs.
TestModelDiaryPersistence	1	Create via canonical ModelDiary, read back.
TestModelDiaryRefresh	5	Refresh produces rated_12m, idempotent, missing suburb→unavailable, <6mo untouched, insufficient data→calibration guard.
TestEvidenceResolution	6	Valid prefixes resolve, unknown→None, downgrade on bad IDs, no downgrade when valid, mixed validation, unknown listing.
Remaining Limitations
Limitation	Status
datetime.utcnow() deprecation warnings (16 total)	Non-blocking; use of datetime.now(datetime.UTC) preferred
Pydantic .dict() deprecation (1 warning)	Use .model_dump() in Pydantic V2
Evidence registry only validates prefix/form — does not query live DB source records	P2; registry structure exists, live resolution pending DB population
Frontend tests not run as part of this task	Frontend tests unchanged, 28/28 pass separately
npm run lint has 1 pre-existing stale file error	Not our code, not introduced in this task
