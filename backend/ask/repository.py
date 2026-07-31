import uuid
import json
from decimal import Decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from sqlalchemy.orm import Session
import hashlib
import secrets

from models_v3 import AskConversation, AskMessage, AskBrief


def _sanitize(obj: Any) -> Any:
    """Recursively convert non-JSON-serializable types to safe primitives."""
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(v) for v in obj]
    return obj

def generate_share_token() -> (str, str):
    """Generates a raw token and its hash."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
    return raw_token, token_hash

def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

def create_conversation(db: Session, user_id: str, title: Optional[str] = None) -> AskConversation:
    conv_id = str(uuid.uuid4())
    conv = AskConversation(id=conv_id, user_id=user_id, title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv

def get_conversation(db: Session, conversation_id: str, user_id: str) -> Optional[AskConversation]:
    return db.query(AskConversation).filter(
        AskConversation.id == conversation_id,
        AskConversation.user_id == user_id
    ).first()

def add_message(db: Session, conversation_id: str, role: str, content: str) -> AskMessage:
    msg = AskMessage(
        id=str(uuid.uuid4()),
        conversation_id=conversation_id,
        role=role,
        content=content
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

def save_ask_brief(db: Session, user_id: str, brief_data: Dict[str, Any], conversation_id: Optional[str] = None) -> AskBrief:
    brief = AskBrief(
        id=str(uuid.uuid4()),
        user_id=user_id,
        conversation_id=conversation_id,
        intent=_sanitize(brief_data.get('intent', {})),
        assumptions=_sanitize(brief_data.get('assumptions', [])),
        summary=brief_data.get('summary', ''),
        research_priority=brief_data.get('research_priority', 'medium'),
        comparison=_sanitize(brief_data.get('comparison', [])),
        supports=_sanitize(brief_data.get('supports', [])),
        risks=_sanitize(brief_data.get('risks', [])),
        unknowns=_sanitize(brief_data.get('unknowns', [])),
        next_steps=_sanitize(brief_data.get('next_steps', [])),
        evidence=_sanitize(brief_data.get('evidence', [])),
        data_quality=_sanitize(brief_data.get('data_quality', {})),
        versions=_sanitize(brief_data.get('versions', {}))
    )
    db.add(brief)
    db.commit()
    db.refresh(brief)
    return brief

def get_brief(db: Session, brief_id: str, user_id: str) -> Optional[AskBrief]:
    return db.query(AskBrief).filter(
        AskBrief.id == brief_id,
        AskBrief.user_id == user_id
    ).first()

def share_brief(db: Session, brief_id: str, user_id: str) -> Optional[str]:
    """Generates a share token for a brief and sets visibility to public."""
    brief = get_brief(db, brief_id, user_id)
    if not brief:
        return None
    raw_token, token_hash = generate_share_token()
    brief.visibility = "public"
    brief.share_token_hash = token_hash
    db.commit()
    return raw_token

def get_shared_brief(db: Session, brief_id: str, token: str) -> Optional[AskBrief]:
    token_hash = hash_token(token)
    return db.query(AskBrief).filter(
        AskBrief.id == brief_id,
        AskBrief.visibility == "public",
        AskBrief.share_token_hash == token_hash
    ).first()

def redact_brief_for_public(brief: AskBrief) -> Dict[str, Any]:
    """Redacts sensitive financial data for public viewing."""
    assumptions = brief.assumptions or []
    redacted_assumptions = [a for a in assumptions if a.get('label') not in ('Annual income', 'Monthly debt', 'Deposit')]
    
    return {
        "id": brief.id,
        "summary": brief.summary,
        "assumptions": redacted_assumptions,
        "research_priority": brief.research_priority,
        "comparison": brief.comparison,
        "supports": brief.supports,
        "risks": brief.risks,
        "unknowns": brief.unknowns,
        "next_steps": brief.next_steps,
        "evidence": brief.evidence,
        "data_quality": brief.data_quality,
        "created_at": brief.created_at.isoformat()
    }
