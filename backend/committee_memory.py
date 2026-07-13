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
    """
    try:
        db = SessionLocal()
        vendor = _detect_llm_provider()
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
            raw_metrics_payload=metrics,
            created_at=datetime.utcnow(),
            prompt_version="ciov2-json-schema-1.0",
            provider=vendor,
            review_status="unreviewed",
            outcome_status="pending",
        )
        db.add(entry)
        db.commit()

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


def _detect_llm_provider() -> str:
    import os
    if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "none":
        return "nvidia/llama-3.1-70b"
    elif os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "none":
        return "groq/llama-3.3-70b"
    elif os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "none":
        return "deepseek-chat"
    elif os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "none":
        return "openai/gpt-4o-mini"
    return "ollama/qwen2.5:7b"


def retrieve_similar(suburb: str, state: str, metrics: Dict, limit: int = 3) -> str:
    """
    Find the most similar past committee analyses in the same state.
    
    Quality gates: only retrieves entries with review_status='verified' or 'unreviewed'.
    Explicitly excludes entries marked 'incorrect' or 'superseded'.
    
    Similarity = weighted Manhattan distance:
        |growth_score_diff| + |rental_yield_diff * 10|
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
                CommitteeMemory.review_status.in_(["verified", "unreviewed"]),
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
            verified_note = ""
            if row.outcome_status == "underperformed":
                verified_note = " [CAUTION: underperformed benchmark, treat as counterexample]"
            elif row.outcome_status == "outperformed":
                verified_note = " [VERIFIED: outperformed benchmark]"
                
            context_parts.append(
                f"{i+1}. {row.suburb}, {row.state}: "
                f"Verdict={row.verdict}, "
                f"Growth={row.growth_score}, Yield={row.rental_yield}%"
                f"{verified_note}"
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
