import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime

from models_v3 import SessionLocal, DecisionBriefSnapshot

router = APIRouter(
    prefix="/api/v3/brief",
    tags=["decision_brief"]
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class BriefCreateRequest(BaseModel):
    suburb_id: str
    user_inputs: dict
    buyer_fit_score: float
    market_timing_score: float
    ai_verdict: str
    serviceability_state: dict

class BriefBrokerRequest(BaseModel):
    id: str

@router.post("")
def save_decision_brief(req: BriefCreateRequest, db: Session = Depends(get_db)):
    brief_id = str(uuid.uuid4())
    snapshot = DecisionBriefSnapshot(
        id=brief_id,
        suburb_id=req.suburb_id,
        created_at=datetime.utcnow(),
        user_inputs=req.user_inputs,
        buyer_fit_score=req.buyer_fit_score,
        market_timing_score=req.market_timing_score,
        ai_verdict=req.ai_verdict,
        serviceability_state=req.serviceability_state,
        broker_handoff_status="not_requested"
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return {"id": snapshot.id}

@router.get("/{brief_id}")
def get_decision_brief(brief_id: str, db: Session = Depends(get_db)):
    snapshot = db.query(DecisionBriefSnapshot).filter(DecisionBriefSnapshot.id == brief_id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    return {
        "id": snapshot.id,
        "suburb_id": snapshot.suburb_id,
        "created_at": snapshot.created_at.isoformat(),
        "user_inputs": snapshot.user_inputs,
        "buyer_fit_score": snapshot.buyer_fit_score,
        "market_timing_score": snapshot.market_timing_score,
        "ai_verdict": snapshot.ai_verdict,
        "serviceability_state": snapshot.serviceability_state,
        "broker_handoff_status": snapshot.broker_handoff_status
    }

@router.post("/broker_handoff")
def request_broker_handoff(req: BriefBrokerRequest, db: Session = Depends(get_db)):
    snapshot = db.query(DecisionBriefSnapshot).filter(DecisionBriefSnapshot.id == req.id).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    snapshot.broker_handoff_status = "pending"
    db.commit()
    
    # In a real system, this would trigger an email or API call to the broker platform
    # with the snapshot details.
    
    return {"status": "success", "message": "Broker will contact you shortly."}
