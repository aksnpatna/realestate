import asyncio
import json
import os
import sys

# Add backend directory to PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from routers.ask_property import ask_query
from ask.schemas import AskQueryRequest
from models_v3 import SessionLocal
from unittest.mock import MagicMock

async def run_evals():
    dataset_path = os.path.join(os.path.dirname(__file__), "golden_dataset.json")
    with open(dataset_path, 'r') as f:
        queries = json.load(f)

    total = len(queries)
    passed = 0

    print(f"--- Running Enterprise AI NLP Evals ({total} queries) ---")

    for idx, q in enumerate(queries):
        print(f"[{idx+1}/{total}] Testing: '{q['query']}'")
        
        req = AskQueryRequest(question=q['query'])
        mock_request = MagicMock()
        db = SessionLocal()
        
        try:
            res = await ask_query(req, request=mock_request, db=db, current_user="eval_runner")
            
            is_guardrail_triggered = (res.status == "degraded" and "Blocked by Policy" in res.headline)
            
            goal_match = False
            state_match = False
            budget_match = False
            
            if q['is_guardrail']:
                if is_guardrail_triggered:
                    passed += 1
                    print("  ✅ PASS (Guardrail correctly triggered)")
                else:
                    print("  ❌ FAIL (Guardrail missed!)")
            else:
                if is_guardrail_triggered:
                    print("  ❌ FAIL (False positive guardrail block!)")
                    continue
                    
                actual_goal = res.intent.get("goal")
                actual_state = res.intent.get("state")
                actual_budget = res.intent.get("budget")
                
                goal_match = (actual_goal == q['expected_goal'])
                state_match = (q['expected_state'] is None or actual_state == q['expected_state'])
                budget_match = (q['expected_budget'] is None or actual_budget == q['expected_budget'])
                
                if goal_match and state_match and budget_match:
                    passed += 1
                    print(f"  ✅ PASS (Goal: {actual_goal})")
                else:
                    print(f"  ❌ FAIL")
                    if not goal_match: print(f"     Expected Goal: {q['expected_goal']}, Got: {actual_goal}")
                    if not state_match: print(f"     Expected State: {q['expected_state']}, Got: {actual_state}")
                    if not budget_match: print(f"     Expected Budget: {q['expected_budget']}, Got: {actual_budget}")
                    
        except Exception as e:
            print(f"  ❌ CRASH: {e}")
        finally:
            db.close()

    print("\n----------------------------------------------------")
    print(f"EVALUATION COMPLETE: {passed}/{total} ({(passed/total)*100:.1f}%) Passed")
    print("----------------------------------------------------")
    
    if passed < total:
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(run_evals())
