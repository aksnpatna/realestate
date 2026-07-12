"""
committee_memory.py — PostgreSQL-backed committee analysis memory.
Stores past analyses in the existing DB and retrieves similar suburb
analyses for few-shot prompting. Zero additional RAM — reuses existing PG.
"""
import json
import logging
from datetime import datetime
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from typing import Dict, Optional

from models_v3 import CommitteeMemory, DATABASE_URL, SessionLocal

logger = logging.getLogger("uvicorn")
MAX_MEMORIES = 500


def store_analysis(suburb: str, state: str, metrics: Dict, result: Dict) -> None:
    """
    Persist a committee analysis to the DB for future retrieval.

    Args:
        suburb: Suburb name.
        state: State code.
        metrics: Dict of V3 metrics.
        result: Dict of committee outputs.
    """
    try:
        db = SessionLocal()
        entry = CommitteeMemory(
            suburb=suburb,
            state=state.upper(),
            growth_score=metrics.get("growthScore") or 50,
            rental_yield=metrics.get("rentalYield") or 4.0,
            vacancy_rate=metrics.get("vacancyRate") or 3.0,
            median_price=metrics.get("houseMedianPrice") or 0,
            verdict=result.get("verdict", ""),
            bull_argument=result.get("bull", ""),
            bear_argument=result.get("bear", ""),
            urban_argument=result.get("urban", ""),
            playbook=result.get("playbook", ""),
            risk_rating=result.get("risk_assessment", {}).get("risk_rating", ""),
            created_at=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()

        # Prune old entries beyond MAX_MEMORIES
        total = db.query(CommitteeMemory).count()
        if total > MAX_MEMORIES:
            oldest = db.query(CommitteeMemory)\
                .order_by(CommitteeMemory.created_at.asc())\
                .limit(total - MAX_MEMORIES)\
                .all()
            for old in oldest:
                db.delete(old)
            db.commit()

        db.close()
    except Exception as e:
        logger.warning(f"[memory] Failed to store analysis: {e}")


def retrieve_similar(suburb: str, state: str, metrics: Dict, limit: int = 3) -> str:
    """
    Find the most similar past committee analyses in the same state.

    Similarity = weighted Manhattan distance:
        |growth_score_diff| + |rental_yield_diff * 10|

    Skip entries for the same suburb to avoid circular reasoning.

    Returns:
        Formatted few-shot context string, or empty string if no matches.
    """
    try:
        db = SessionLocal()
        current_gs = metrics.get("growthScore") or 50
        current_ry = metrics.get("rentalYield") or 4.0

        rows = db.query(CommitteeMemory)\
            .filter(
                CommitteeMemory.state == state.upper(),
                func.lower(CommitteeMemory.suburb) != suburb.lower(),
                CommitteeMemory.verdict != "",
            )\
            .order_by(
                func.abs(CommitteeMemory.growth_score - current_gs)
                + func.abs(CommitteeMemory.rental_yield - current_ry) * 10
            )\
            .limit(limit)\
            .all()
        db.close()

        if not rows:
            return ""

        context_parts = ["[Past Committee Analyses — Similar Suburbs]"]
        for i, row in enumerate(rows):
            context_parts.append(
                f"{i+1}. {row.suburb}, {row.state}: "
                f"Verdict={row.verdict}, "
                f"Growth={row.growth_score}, Yield={row.rental_yield}%"
            )
            if row.bull_argument:
                context_parts.append(f"   Bull: {row.bull_argument[:200]}")
            if row.bear_argument:
                context_parts.append(f"   Bear: {row.bear_argument[:200]}")

        logger.info(f"[memory] Retrieved {len(rows)} similar past analyses for {suburb}, {state}")
        return "\n".join(context_parts)

    except Exception as e:
        logger.warning(f"[memory] Failed to retrieve similar: {e}")
        return ""
