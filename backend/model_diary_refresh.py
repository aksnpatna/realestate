"""
model_diary_refresh.py — Idempotent Model Diary outcome evaluation.

Finds predictions due at 6, 12, and 36 months, captures realized metrics,
and stores outcomes. Never overwrites original prediction snapshots.

Run: python backend/model_diary_refresh.py
"""
import os
import sys
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from models_v3 import SessionLocal, SuburbUIV3, CommitteeMemory
from poc_config import poc_config

logger = logging.getLogger("model_diary_refresh")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


def refresh_outcomes():
    db = SessionLocal()
    try:
        predictions = db.query(CommitteeMemory).filter(
            CommitteeMemory.outcome_status == "pending",
            CommitteeMemory.created_at.isnot(None),
        ).all()

        now = datetime.utcnow()
        updated = 0
        unavailable = 0

        for pred in predictions:
            age_months = (now - pred.created_at).days / 30.44 if pred.created_at else 0

            if age_months < 6:
                continue

            suburb = db.query(SuburbUIV3).filter(
                SuburbUIV3.id == pred.suburb.upper()
            ).first()

            if not suburb:
                pred.outcome_status = "unavailable"
                pred.verified_at = now
                unavailable += 1
                continue

            realized_price = suburb.house_median_price
            realized_yield = suburb.house_gross_rental_yield
            realized_vacancy = suburb.vacancy_rate

            if realized_price and pred.median_price and pred.median_price > 0:
                price_return = (realized_price - pred.median_price) / pred.median_price
            else:
                price_return = None

            if price_return is not None:
                if age_months >= 36:
                    if price_return > 0.10:
                        pred.outcome_status = "outperformed"
                    elif price_return < -0.05:
                        pred.outcome_status = "underperformed"
                    else:
                        pred.outcome_status = "neutral"
                else:
                    pred.outcome_status = "pending_partial"

                pred.outcome_score = round(price_return * 100, 2)
            else:
                pred.outcome_status = "unavailable"

            pred.benchmark_return = realized_yield or 0
            pred.verified_at = now
            updated += 1

        db.commit()

        total = db.query(CommitteeMemory).count()
        rated = db.query(CommitteeMemory).filter(
            CommitteeMemory.outcome_status.in_(["outperformed", "underperformed", "neutral"])
        ).count()

        logger.info(f"Outcome refresh: {updated} updated ({unavailable} unavailable)")
        logger.info(f"Model Diary: {rated}/{total} rated outcomes (sample size for calibration: {rated})")
        if rated < 10:
            logger.info("Insufficient outcome data for statistical calibration. Do not treat as calibrated model.")

    except Exception as e:
        logger.error(f"Outcome refresh failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    refresh_outcomes()
