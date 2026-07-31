"""
eval_harness.py — Golden-query evaluation harness for Ask YieldSense v2.
Run: python -m pytest backend/tests/eval/ -v
Each JSONL line: {"query":"…", "expect_goal":"…", "expect_suburb_names":["…"], "max_status":"complete|needs_clarification", "forbidden_in_summary":["…". "…"]}
"""
import json
import os
import sys
import pytest
from typing import Dict, Any, List

GOLDEN_FILE = os.path.join(os.path.dirname(__file__), "golden_queries.jsonl")

def load_golden() -> List[Dict[str, Any]]:
    if not os.path.exists(GOLDEN_FILE):
        return []
    cases = []
    with open(GOLDEN_FILE) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                cases.append(json.loads(line))
    return cases

def evaluate_query(client, case: Dict[str, Any]) -> Dict[str, Any]:
    resp = client.post("/api/v3/ask/query", json={"question": case["query"]})
    data = resp.json()
    result = {"query": case["query"], "status_code": resp.status_code, "actual_status": data.get("status"), "check_failures": []}

    if case.get("expect_status_200", True) and resp.status_code != 200:
        result["check_failures"].append(f"Expected 200, got {resp.status_code}")
    intent = data.get("intent", {})
    actual_goal = intent.get("goal")
    if case.get("expect_goal") and actual_goal != case["expect_goal"]:
        result["check_failures"].append(f"Expected goal '{case['expect_goal']}', got '{actual_goal}'")

    suburbs = data.get("query_understood", {}).get("suburbs", [])
    actual_names = [s.get("name") for s in suburbs]
    if case.get("expect_suburb_names"):
        for expected_name in case["expect_suburb_names"]:
            resolved = any(expected_name.lower() in n.lower() for n in actual_names)
            if not resolved:
                result["check_failures"].append(f"Expected suburb '{expected_name}' in resolved list {actual_names}")

    max_status = case.get("max_status", "complete")
    status_priority = {"complete": 0, "needs_clarification": 1, "insufficient_evidence": 2, "degraded": 3, "degraded_intent": 4}
    if status_priority.get(data.get("status"), 5) > status_priority.get(max_status, 0):
        result["check_failures"].append(f"Status '{data.get('status')}' worse than max '{max_status}'")

    summary = data.get("summary", "").lower()
    for forbidden in case.get("forbidden_in_summary", []):
        if forbidden.lower() in summary:
            result["check_failures"].append(f"Forbidden phrase '{forbidden}' found in summary")

    evidence_count = len(data.get("evidence", []))
    if case.get("expect_min_evidence", 0) and evidence_count < case["expect_min_evidence"]:
        result["check_failures"].append(f"Evidence count {evidence_count} below minimum {case['expect_min_evidence']}")

    result["passed"] = len(result["check_failures"]) == 0
    return result

GOLDEN_CASES = load_golden()

@pytest.mark.parametrize("case", GOLDEN_CASES, ids=lambda c: c.get("id", c["query"][:60]))
def test_golden_query(authenticated_client, case):
    result = evaluate_query(authenticated_client, case)
    assert result["passed"], "\n".join(result["check_failures"])

@pytest.fixture
def authenticated_client():
    from fastapi.testclient import TestClient
    from main import app
    from models_v3 import SessionLocal
    client = TestClient(app)
    def get_db_override():
        db = SessionLocal()
        try: yield db
        finally: db.close()
    app.dependency_overrides[get_db] = get_db_override
    from routers import decision_brief
    original = decision_brief.get_current_user
    decision_brief.get_current_user = lambda: "eval_user"
    yield client
    decision_brief.get_current_user = original

@pytest.mark.skipif(not GOLDEN_CASES, reason="No golden queries file")
class TestGoldenEvaluations:
    def test_all_golden_found(self):
        assert len(GOLDEN_CASES) >= 20, f"Expected ≥20 golden cases, found {len(GOLDEN_CASES)}"
    def test_adversarial_safe(self):
        adv = [c for c in GOLDEN_CASES if c.get("category") == "adversarial"]
        for c in adv:
            result = evaluate_query(fixture_client(), c)
            assert result["passed"], f"Adversarial '{c['query'][:60]}' failed: {'; '.join(result['check_failures'])}"
