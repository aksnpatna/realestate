"""
entities.py — DB-grounded gazetteer for suburb entity resolution.
Replaces the hardcoded 21-suburb KNOWN_SUBURBS list with a full-DB trigram resolver.
"""
import re
from typing import List, Dict, Optional, Tuple, Any
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from models_v3 import SuburbUIV3

SUBURB_NAME_RX = re.compile(r"[A-Za-z][A-Za-z' -]{2,50}(?:\s+[A-Za-z][A-Za-z' -]{1,50}){0,2}")
POSTCODE_RX = re.compile(r"\b(\d{4})\b")

def extract_tokens(question: str) -> Tuple[List[str], List[str]]:
    postcodes = POSTCODE_RX.findall(question)
    names = [m.group(0).strip() for m in SUBURB_NAME_RX.finditer(question)]
    deduped = list(dict.fromkeys(names))
    return deduped, postcodes

def resolve_with_db(
    db: Session, token: str, state_hint: Optional[str] = None
) -> List[Dict[str, Any]]:
    candidates: List[Dict[str, Any]] = []

    # Step 1 — exact match via SuburbUIV3 model
    q = db.query(SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.state,
                 SuburbUIV3.postcode)
    q = q.filter(func.lower(SuburbUIV3.name) == token.lower())
    if state_hint:
        q = q.filter(SuburbUIV3.state.ilike(state_hint))
    for r in q.all():
        candidates.append({"id": r[0], "name": r[1], "state": r[2],
                           "postcode": r[3], "score": 1.0, "method": "exact"})

    # Step 2 — postcode lookup
    if token.isdigit() and len(token) == 4:
        for r in db.query(SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.state,
                          SuburbUIV3.postcode).filter(
            SuburbUIV3.postcode == token).all():
            if not any(c["id"] == r[0] for c in candidates):
                candidates.append({"id": r[0], "name": r[1], "state": r[2],
                                   "postcode": r[3], "score": 0.95, "method": "postcode"})
        return sorted(candidates, key=lambda x: x["score"], reverse=True)

    # Step 3 — alias table
    try:
        alias_rows = db.execute(text(
            "SELECT a.suburb_id, sa.name, sa.state, sa.postcode "
            "FROM suburb_aliases a JOIN suburbs_ui_v3 sa ON sa.id = a.suburb_id "
            "WHERE LOWER(a.alias) = :token"
        ), {"token": token.lower()}).fetchall()
        for r in alias_rows:
            if not any(c["id"] == r[0] for c in candidates):
                candidates.append({"id": r[0], "name": r[1], "state": r[2],
                                   "postcode": r[3], "score": 0.9, "method": "alias"})
    except Exception:
        pass

    # Step 4 — pg_trgm fuzzy
    try:
        fz = db.query(
            SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.state,
            SuburbUIV3.postcode,
            func.similarity(SuburbUIV3.name, token).label("sim"),
        ).filter(
            SuburbUIV3.is_live == True,
            func.similarity(SuburbUIV3.name, token) >= 0.45,
        ).order_by(
            func.similarity(SuburbUIV3.name, token).desc()
        ).limit(5).all()
        for r in fz:
            if not any(c["id"] == r[0] for c in candidates):
                candidates.append({
                    "id": r[0], "name": r[1], "state": r[2],
                    "postcode": r[3], "score": round(float(r[4]), 3),
                    "method": "trigram",
                })
    except Exception:
        try:
            ilk = db.query(SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.state,
                           SuburbUIV3.postcode).filter(
                SuburbUIV3.is_live == True,
                SuburbUIV3.name.ilike(f"%{token}%"),
            ).limit(5).all()
            for r in ilk:
                if not any(c["id"] == r[0] for c in candidates):
                    candidates.append({
                        "id": r[0], "name": r[1], "state": r[2],
                        "postcode": r[3], "score": 0.5, "method": "ilike_fallback",
                    })
        except Exception:
            pass

    return sorted(candidates, key=lambda x: x["score"], reverse=True)


def resolve_suburbs(
    db: Session, question: str, state_hint: Optional[str] = None
) -> Tuple[List[Dict[str, Any]], bool, Optional[str]]:
    tokens, postcodes = extract_tokens(question)
    resolved = []
    is_ambiguous = False
    clarifying_msg = None

    for token in postcodes:
        results = resolve_with_db(db, token)
        if results:
            if not any(r["id"] == results[0]["id"] for r in resolved):
                resolved.append(results[0])

    stop_tokens = {"house", "unit", "apartment", "suburb", "area", "find", "best",
                   "top", "good", "high", "low", "near", "within", "from", "with",
                   "under", "over", "between", "compare", "moving", "research",
                   "invest", "yield", "growth", "school", "safe", "risk", "where",
                   "what", "which", "should", "will", "would", "greater",
                   "sydney", "melbourne", "brisbane", "perth",
                   "adelaide", "canberra", "hobart", "darwin"}

    for token in tokens:
        token_lower = token.lower()
        if token_lower in stop_tokens:
            continue
        if token in postcodes:
            continue
        if len(token) < 3:
            continue
        results = resolve_with_db(db, token, state_hint)
        if not results:
            continue
        if len(results) >= 2 and results[0]["score"] >= 0.8 and (
            len(results) < 2 or (results[0]["score"] - results[1]["score"]) < 0.2
        ):
            is_ambiguous = True
            opts = [f"{r['name']} {r['state']} {r.get('postcode','')}"
                    for r in results[:3]]
            clarifying_msg = (
                f"Did you mean {', '.join(opts[:-1])} or {opts[-1]}? "
                f"Please specify the state or postcode."
            )
        if results[0]["score"] >= 0.7:
            if not any(r["id"] == results[0]["id"] for r in resolved):
                resolved.append(results[0])

    return resolved, is_ambiguous, clarifying_msg
