"""
model_diary_refresh.py — Idempotent Model Diary outcome evaluation.

Uses the canonical ModelDiary model (same as /api/model-diary/* endpoints).
Finds due predictions at 6, 12, and 36 months, captures realized metrics,
and stores outcomes. Never overwrites original prediction snapshots.

Run: python backend/model_diary_refresh.py
"""
import os
import sys
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))

from models_v3 import SessionLocal, SuburbUIV3, ModelDiary
from poc_config import poc_config

logger = logging.getLogger("model_diary_refresh")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")


def refresh_outcomes():
    db = SessionLocal()
    try:
        predictions = db.query(ModelDiary).filter(
            ModelDiary.outcome_rating.is_(None),
            ModelDiary.prediction_date.isnot(None),
        ).all()

        now = datetime.utcnow()
        updated = 0
        unavailable = 0

        for pred in predictions:
            age_months = (now - pred.prediction_date).days / 30.44 if pred.prediction_date else 0

            if age_months < 6:
                continue

            suburb = db.query(SuburbUIV3).filter(
                SuburbUIV3.id == pred.suburb_id.upper()
            ).first()

            if not suburb:
                pred.outcome_rating = "unavailable"
                unavailable += 1
                continue

            realized_price = suburb.house_median_price
            baseline_price = pred.baseline_median_price or 0

            if realized_price and baseline_price and baseline_price > 0:
                price_return = (realized_price - baseline_price) / baseline_price
                if age_months >= 36:
                    pred.realized_price_36m = realized_price
                if age_months >= 12:
                    pred.realized_price_12m = realized_price
                if age_months >= 6:
                    pred.realized_price_6m = realized_price

                if age_months >= 36:
                    if price_return > 0.10:
                        pred.outcome_rating = "outperformed"
                    elif price_return < -0.05:
                        pred.outcome_rating = "underperformed"
                    else:
                        pred.outcome_rating = "neutral"
                elif age_months >= 12:
                    pred.outcome_rating = "rated_12m"
                elif age_months >= 6:
                    pred.outcome_rating = "rated_6m"
                else:
                    pred.outcome_rating = None
            else:
                pred.outcome_rating = "unavailable"

            updated += 1

        db.commit()

        total = db.query(ModelDiary).count()
        rated = db.query(ModelDiary).filter(
            ModelDiary.outcome_rating.isnot(None),
            ModelDiary.outcome_rating != "unavailable",
        ).count()

        logger.info(f"Outcome refresh: {updated} evaluated ({unavailable} unavailable)")
        logger.info(f"Model Diary: {rated}/{total} rated outcomes")
        if rated < 10:
            logger.info("Insufficient outcome data for calibration. Status: incomplete.")

    except Exception as e:
        logger.error(f"Outcome refresh failed: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    refresh_outcomes()
