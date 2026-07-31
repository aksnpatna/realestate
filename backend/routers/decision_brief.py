import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
import hashlib
import secrets

from models_v3 import SessionLocal, DecisionBriefSnapshot

router = APIRouter(
    prefix="/api/v3/brief",
    tags=["decision_brief"]
)

# Mock Auth Dependency (replace with actual JWT later)
def get_current_user():
    return "test-user-id-1234"

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

class ShareRequest(BaseModel):
    id: str

@router.post("")
def save_decision_brief(req: BriefCreateRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    brief_id = str(uuid.uuid4())
    snapshot = DecisionBriefSnapshot(
        id=brief_id,
        user_id=current_user,
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
def get_decision_brief(brief_id: str, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    snapshot = db.query(DecisionBriefSnapshot).filter(
        DecisionBriefSnapshot.id == brief_id,
        DecisionBriefSnapshot.user_id == current_user
    ).first()
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
def request_broker_handoff(req: BriefBrokerRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    snapshot = db.query(DecisionBriefSnapshot).filter(
        DecisionBriefSnapshot.id == req.id,
        DecisionBriefSnapshot.user_id == current_user
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    snapshot.broker_handoff_status = "pending"
    db.commit()
    
    # In a real system, this would trigger an email or API call to the broker platform
    # with the snapshot details.
    
    return {"status": "success", "message": "Broker will contact you shortly."}

@router.post("/share")
def share_brief(req: ShareRequest, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    snapshot = db.query(DecisionBriefSnapshot).filter(
        DecisionBriefSnapshot.id == req.id,
        DecisionBriefSnapshot.user_id == current_user
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    snapshot.visibility = "public"
    snapshot.share_token_hash = token_hash
    db.commit()
    return {"share_token": raw_token}

@router.get("/shared/{brief_id}")
def get_shared_brief(brief_id: str, token: str, db: Session = Depends(get_db)):
    token_hash = hashlib.sha256(token.encode('utf-8')).hexdigest()
    snapshot = db.query(DecisionBriefSnapshot).filter(
        DecisionBriefSnapshot.id == brief_id,
        DecisionBriefSnapshot.visibility == "public",
        DecisionBriefSnapshot.share_token_hash == token_hash
    ).first()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Brief not found")
    
    # Redact sensitive info
    safe_inputs = {k: v for k, v in snapshot.user_inputs.items() if k not in ["income", "deposit", "debt", "budget"]}
    return {
        "id": snapshot.id,
        "suburb_id": snapshot.suburb_id,
        "created_at": snapshot.created_at.isoformat(),
        "user_inputs": safe_inputs,
        "buyer_fit_score": snapshot.buyer_fit_score,
        "market_timing_score": snapshot.market_timing_score,
        "ai_verdict": snapshot.ai_verdict
    }
