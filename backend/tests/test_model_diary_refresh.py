"""
Model Diary persistence, refresh lifecycle, and idempotency tests.

Uses the canonical ModelDiary model (same as /api/model-diary/*).
Tests are DB-backed via SQLite/TEST_DATABASE_URL — not mocked.
"""
import os
import sys
import pytest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models_v3 import ModelDiary, SuburbUIV3, SessionLocal


def _make_diary_predictions(db, count=3):
    """Seed minimal diary fixtures with 400-day-old predictions."""
    entries = []
    for i in range(count):
        entry = ModelDiary(
            suburb_id=f"VIC_TEST_300{i}",
            prediction_date=datetime.utcnow() - timedelta(days=400),
            predicted_fit_score=75.0 + i,
            ai_verdict="HOLD",
            baseline_median_price=800000.0 + i * 10000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=3.0,
            data_quality_score=85.0,
        )
        db.add(entry)
        entries.append(entry)
    db.commit()
    return entries


def _make_suburb(db, suburb_id="VIC_TEST_3000", price=820000.0, rent=550.0, yield_val=4.2):
    existing = db.query(SuburbUIV3).filter(SuburbUIV3.id == suburb_id).first()
    if existing:
        return existing
    s = SuburbUIV3(
        id=suburb_id,
        name="Test Suburb",
        state="VIC",
        postcode="3000",
        is_enriched=True,
        dq_score=85,
        house_median_price=price,
        house_median_rent=rent,
        house_gross_rental_yield=yield_val,
        vacancy_rate=3.0,
        school_quality=7.0,
        transit_accessibility=6.0,
        safety_score=70,
        parks_count=3,
        owner_occupier_rate=68,
        cbd_distance_mins=30,
        avg_icsea=1050,
        school_count=3,
        population_2021=15000,
    )
    db.add(s)
    db.commit()
    return s


class TestModelDiaryPersistence:
    """Proves canonical ModelDiary model works end-to-end."""

    def test_create_via_model_direct(self, db_session):
        entry = ModelDiary(
            suburb_id="VIC_TEST_3000",
            prediction_date=datetime.utcnow(),
            predicted_fit_score=78.2,
            ai_verdict="BUY",
            baseline_median_price=800000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=2.8,
            data_quality_score=85,
        )
        db_session.add(entry)
        db_session.commit()

        fetched = db_session.query(ModelDiary).filter(
            ModelDiary.suburb_id == "VIC_TEST_3000"
        ).first()
        assert fetched is not None
        assert fetched.predicted_fit_score == 78.2
        assert fetched.ai_verdict == "BUY"
        assert fetched.baseline_median_price == 800000
        assert fetched.outcome_rating is None


class TestModelDiaryRefresh:
    """Proves refresh lifecycle, idempotency, and outcome rules."""

    def test_refresh_updates_outcome_when_suburb_exists(self, db_session):
        from model_diary_refresh import refresh_outcomes
        _make_suburb(db_session, "VIC_TEST_3000", price=820000)
        now = datetime.utcnow()
        entry = ModelDiary(
            suburb_id="VIC_TEST_3000",
            prediction_date=now - timedelta(days=400),
            predicted_fit_score=75,
            baseline_median_price=800000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=3.0,
            data_quality_score=85,
        )
        db_session.add(entry)
        db_session.commit()

        refresh_outcomes()

        db_session.refresh(entry)
        assert entry.outcome_rating is not None
        assert entry.outcome_rating in ("outperformed", "underperformed", "neutral", "rated_12m", "rated_6m"), \
            f"Expected rated outcome, got {entry.outcome_rating}"
        assert entry.realized_price_12m == 820000.0

    def test_refresh_idempotent(self, db_session):
        from model_diary_refresh import refresh_outcomes
        _make_suburb(db_session, "VIC_TEST_3001", price=820000)
        now = datetime.utcnow()
        entry = ModelDiary(
            suburb_id="VIC_TEST_3001",
            prediction_date=now - timedelta(days=400),
            predicted_fit_score=75,
            baseline_median_price=800000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=3.0,
            data_quality_score=85,
        )
        db_session.add(entry)
        db_session.commit()

        refresh_outcomes()
        db_session.refresh(entry)
        rating1 = entry.outcome_rating

        refresh_outcomes()
        db_session.refresh(entry)
        rating2 = entry.outcome_rating

        count = db_session.query(ModelDiary).filter(
            ModelDiary.suburb_id == "VIC_TEST_3001"
        ).count()
        assert count == 1, "Refresh must not create duplicate records"
        assert rating1 == rating2, "Idempotent refresh must not change rating"

    def test_missing_suburb_becomes_unavailable(self, db_session):
        from model_diary_refresh import refresh_outcomes
        now = datetime.utcnow()
        entry = ModelDiary(
            suburb_id="VIC_MISSING_9999",
            prediction_date=now - timedelta(days=400),
            predicted_fit_score=75,
            baseline_median_price=800000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=3.0,
            data_quality_score=85,
        )
        db_session.add(entry)
        db_session.commit()

        refresh_outcomes()

        db_session.refresh(entry)
        assert entry.outcome_rating == "unavailable", \
            f"Missing suburb must be unavailable, got {entry.outcome_rating}"
        assert entry.realized_price_12m is None, "Missing data must remain None, not zero"

    def test_predictions_within_6_months_not_updated(self, db_session):
        from model_diary_refresh import refresh_outcomes
        _make_suburb(db_session, "VIC_TEST_3002", price=820000)
        now = datetime.utcnow()
        entry = ModelDiary(
            suburb_id="VIC_TEST_3002",
            prediction_date=now - timedelta(days=30),
            predicted_fit_score=75,
            baseline_median_price=800000,
            baseline_rental_yield=4.0,
            baseline_vacancy_rate=3.0,
            data_quality_score=85,
        )
        db_session.add(entry)
        db_session.commit()

        refresh_outcomes()

        db_session.refresh(entry)
        assert entry.outcome_rating is None, "Prediction under 6 months must not be rated"

    def test_summary_reports_insufficient_data(self, db_session):
        from model_diary_refresh import refresh_outcomes
        entries = _make_diary_predictions(db_session, count=2)
        # Fix entries to days=400 for refresh eligibility
        for entry in entries:
            entry.prediction_date = datetime.utcnow() - timedelta(days=400)
        db_session.commit()
        _make_suburb(db_session, "VIC_TEST_3003", price=820000)
        _make_suburb(db_session, "VIC_TEST_3004", price=830000)

        refresh_outcomes()

        rated = db_session.query(ModelDiary).filter(
            ModelDiary.outcome_rating.isnot(None),
            ModelDiary.outcome_rating != "unavailable",
        ).count()
        assert rated < 10, f"Insufficient rated outcomes must report incomplete: {rated} rated"
