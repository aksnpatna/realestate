import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from models_v3 import SessionLocal
from routers.decision_brief import get_current_user
from ask.schemas import AskIntent, AskResponse, ScenarioAssumptions, SuburbComparison, SuburbComparisonMetric
from ask.evidence import get_suburb_ui, extract_evidence, calculate_data_quality
from ask.scenarios import compute_affordability, compute_yield
from ask.synthesis import synthesize_research
from ask.policy import validate_policy
from ask.repository import create_conversation, save_ask_brief, _sanitize

router = APIRouter(
    prefix="/api/v3/ask",
    tags=["ask"]
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=AskResponse)
def ask_yieldsense(
    intent: AskIntent, 
    request: Request,
    db: Session = Depends(get_db), 
    current_user: str = Depends(get_current_user)
):
    request_id = f"ask_{uuid.uuid4()}"
    
    # 1. Resolve Suburbs & Evidence
    all_evidence = []
    comparisons = []
    dq_summary = {"coverage": 0, "stale_metric_count": 0, "suburbs": {}}
    
    if not intent.suburbs:
        if intent.goal != "interstate_discovery":
            raise HTTPException(status_code=400, detail="Missing target suburbs for research.")
    
    valid_suburbs = []
    for ref in intent.suburbs:
        v3 = get_suburb_ui(db, ref)
        if not v3:
            continue
        valid_suburbs.append(v3)
        ev = extract_evidence(v3, intent.property_type)
        all_evidence.extend(ev)
        
        dq = calculate_data_quality(v3)
        dq_summary["suburbs"][v3.id] = dq
        
        metrics = []
        for e in ev:
            # Handle non-numeric evidence values like "Bullish" or "Bearish"
            try:
                parsed_val = float(e.value) if e.value is not None else None
            except ValueError:
                parsed_val = e.value
                
            metrics.append(SuburbComparisonMetric(label=e.metric, value=parsed_val, unit=e.unit))
        comparisons.append(SuburbComparison(suburb_id=v3.id, name=v3.name, metrics=metrics))

    # 2. Build Assumptions
    assumptions = []
    if intent.budget: assumptions.append(ScenarioAssumptions(label="Budget", value=f"${intent.budget:,.0f}", source="user"))
    if intent.deposit: assumptions.append(ScenarioAssumptions(label="Deposit", value=f"${intent.deposit:,.0f}", source="user"))
    if intent.annual_income: assumptions.append(ScenarioAssumptions(label="Annual Income", value=f"${intent.annual_income:,.0f}", source="user"))

    # 3. Deterministic Scenarios
    affordability_res = {}
    if valid_suburbs and intent.budget and intent.deposit and intent.annual_income:
        price = valid_suburbs[0].house_median_price if intent.property_type == "house" else valid_suburbs[0].unit_median_price
        if price:
            affordability_res = compute_affordability(
                float(intent.budget), float(intent.deposit), float(intent.annual_income),
                float(intent.monthly_debt) if intent.monthly_debt else None,
                valid_suburbs[0].state, intent.property_type, float(price)
            )

    # 4. Synthesize
    syn = synthesize_research(intent, all_evidence, assumptions, affordability_res)
    
    # 5. Policy Check
    policy_check = validate_policy(syn)
    status = "complete"
    if policy_check["status"] != "valid":
        status = policy_check["status"]
        syn["summary"] = "Evidence-only fallback. " + policy_check["reason"]
        syn["research_priority"] = "insufficient_evidence"

    # 6. Build brief_data — use model_dump(mode='json') for Pydantic v2 which
    #    correctly serializes Decimal -> float/str in one pass. Then _sanitize
    #    as a belt-and-suspenders defence for any non-Pydantic values.
    brief_data = _sanitize({
        "intent": intent.model_dump(mode='json'),
        "assumptions": [a.model_dump(mode='json') for a in assumptions],
        "summary": syn["summary"],
        "research_priority": syn["research_priority"],
        "comparison": [c.model_dump(mode='json') for c in comparisons],
        "supports": syn["supports"],
        "risks": syn["risks"],
        "unknowns": syn["unknowns"],
        "next_steps": syn["next_steps"],
        "evidence": [e.model_dump(mode='json') for e in all_evidence],
        "data_quality": _sanitize(dq_summary),
        "versions": {"evidence": "v1", "scorer": "v1", "prompt": "ask-v1", "model": "gpt-4o"}
    })
    
    conv = create_conversation(db, current_user, title=intent.question[:50])
    save_ask_brief(db, current_user, brief_data, conv.id)

    return AskResponse(
        request_id=request_id,
        status=status,
        **brief_data
    )
