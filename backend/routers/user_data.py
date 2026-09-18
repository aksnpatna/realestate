"""
user_data.py — GDPR/APP-compliant data export and deletion endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
import json

from models_v3 import SessionLocal, AskConversation, AskBrief, AskMessage, UserFeedback
from routers.decision_brief import get_current_user

router = APIRouter(prefix="/api/user", tags=["user-data"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_models():
    """Lazy import to avoid circular dependency with main.py"""
    from main import (
        UserModel, UserFavorite, UserPortfolioProperty, UserActivity,
        UserConsent, UserDecisionSnapshot, BuyersAgentClient
    )
    return UserModel, UserFavorite, UserPortfolioProperty, UserActivity, UserConsent, UserDecisionSnapshot, BuyersAgentClient


@router.get("/data-export")
def export_user_data(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Export all data associated with the current user (APP 12 — right to access)."""
    data = {
        "user_id": current_user,
        "exported_at": datetime.utcnow().isoformat() + "Z",
        "account": {},
        "conversations": [],
        "briefs": [],
        "messages": [],
        "feedback": [],
        "favorites": [],
        "portfolio": [],
        "activities": [],
        "consents": [],
        "decision_snapshots": [],
        "agent_clients": [],
    }

    UserModel, UserFavorite, UserPortfolioProperty, UserActivity, \
        UserConsent, UserDecisionSnapshot, BuyersAgentClient = _get_user_models()

    user = db.query(UserModel).filter(UserModel.id == current_user).first()
    if user:
        data["account"] = {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "user_type": user.user_type,
            "is_verified": user.is_verified,
            "marketing_consent": user.marketing_consent,
            "created_at": user.created_at,
        }

    conversations = db.query(AskConversation).filter(
        AskConversation.user_id == current_user
    ).all()
    data["conversations"] = [
        {"id": c.id, "title": c.title, "created_at": str(c.created_at)}
        for c in conversations
    ]

    briefs = db.query(AskBrief).filter(AskBrief.user_id == current_user).all()
    data["briefs"] = [
        {"id": b.id, "conversation_id": b.conversation_id,
         "summary": (b.summary or "")[:200], "created_at": str(b.created_at)}
        for b in briefs
    ]

    if conversations:
        conv_ids = [c.id for c in conversations]
        messages = db.query(AskMessage).filter(
            AskMessage.conversation_id.in_(conv_ids)
        ).all()
        data["messages"] = [
            {"id": m.id, "role": m.role, "content": m.content[:500],
             "created_at": str(m.created_at)}
            for m in messages
        ]

    feedback = db.query(UserFeedback).filter(UserFeedback.user_id == current_user).all()
    data["feedback"] = [
        {"request_id": f.request_id, "query": f.query[:200],
         "feedback_type": f.feedback_type, "expected_behavior": f.expected_behavior,
         "created_at": str(f.created_at)}
        for f in feedback
    ]

    favorites = db.query(UserFavorite).filter(UserFavorite.user_id == current_user).all()
    data["favorites"] = [
        {"id": f.id, "suburb_id": f.suburb_id, "created_at": f.created_at}
        for f in favorites
    ]

    portfolio = db.query(UserPortfolioProperty).filter(
        UserPortfolioProperty.user_id == current_user
    ).all()
    data["portfolio"] = [
        {"id": p.id, "suburb_id": p.suburb_id, "address": p.address,
         "purchase_price": p.purchase_price, "purchase_date": p.purchase_date}
        for p in portfolio
    ]

    activities = db.query(UserActivity).filter(UserActivity.user_id == current_user).all()
    data["activities"] = [
        {"id": a.id, "action_type": a.action_type, "target_id": a.target_id,
         "timestamp": a.timestamp}
        for a in activities
    ]

    consents = db.query(UserConsent).filter(UserConsent.user_id == current_user).all()
    data["consents"] = [
        {"id": c.id, "consent_type": c.consent_type,
         "ip_address": c.ip_address, "timestamp": c.timestamp}
        for c in consents
    ]

    snapshots = db.query(UserDecisionSnapshot).filter(
        UserDecisionSnapshot.user_id == current_user
    ).all()
    data["decision_snapshots"] = [
        {"id": s.id, "suburb_id": s.suburb_id, "label": s.label,
         "created_at": s.created_at}
        for s in snapshots
    ]

    agent_clients = db.query(BuyersAgentClient).filter(
        BuyersAgentClient.user_id == current_user
    ).all()
    data["agent_clients"] = [
        {"id": a.id, "name": a.name, "created_at": a.created_at}
        for a in agent_clients
    ]

    return data


@router.delete("/data")
def delete_user_data(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Delete all data associated with the current user (APP 13 — right to deletion).

    This permanently removes: conversations, briefs, messages, feedback,
    favorites, portfolio, activities, consents, decision snapshots, and agent clients.
    The user account record is anonymised (email hashed, names removed) but kept
    for audit trail purposes.
    """
    deleted_counts = {}

    UserModel, UserFavorite, UserPortfolioProperty, UserActivity, \
        UserConsent, UserDecisionSnapshot, BuyersAgentClient = _get_user_models()

    conversations = db.query(AskConversation).filter(
        AskConversation.user_id == current_user
    ).all()
    conv_ids = [c.id for c in conversations]
    if conv_ids:
        db.query(AskMessage).filter(
            AskMessage.conversation_id.in_(conv_ids)
        ).delete()
        deleted_counts["messages"] = len(conv_ids)

    db.query(AskBrief).filter(AskBrief.user_id == current_user).delete()
    db.query(AskConversation).filter(AskConversation.user_id == current_user).delete()

    db.query(UserFeedback).filter(UserFeedback.user_id == current_user).delete()
    db.query(UserFavorite).filter(UserFavorite.user_id == current_user).delete()
    db.query(UserPortfolioProperty).filter(UserPortfolioProperty.user_id == current_user).delete()
    db.query(UserActivity).filter(UserActivity.user_id == current_user).delete()
    db.query(UserConsent).filter(UserConsent.user_id == current_user).delete()
    db.query(UserDecisionSnapshot).filter(UserDecisionSnapshot.user_id == current_user).delete()
    db.query(BuyersAgentClient).filter(BuyersAgentClient.user_id == current_user).delete()

    user = db.query(UserModel).filter(UserModel.id == current_user).first()
    if user:
        user.email = f"deleted_{current_user[:8]}@erased.local"
        user.first_name = None
        user.last_name = None
        user.user_type = None
        user.marketing_consent = False
        deleted_counts["account_anonymised"] = True

    db.commit()

    return {
        "status": "success",
        "message": "All user data has been permanently deleted. Your account has been anonymised.",
        "user_id": current_user,
        "deleted_at": datetime.utcnow().isoformat() + "Z",
        "details": deleted_counts,
    }
