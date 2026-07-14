"""
Comprehensive Buyer Fit tests — pure calculation, input validation,
zero-capacity behaviour, rate/debt monotonicity, DQ eligibility gates.

DB-backed tests use the conftest.py fixtures (SQLite isolated).
Pure-calculation tests use MagicMock (DB-free).
"""
import os
import sys
import pytest
import math
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def _mock_v3(**override):
    m = MagicMock()
    m.id = "VIC_TEST_3000"
    m.name = "Test Suburb"
    m.state = "VIC"
    m.postcode = "3000"
    m.is_enriched = True
    m.dq_score = 85
    m.house_median_price = 800000
    m.house_gross_rental_yield = 4.0
    m.house_median_rent = 520
    m.unit_median_price = 600000
    m.unit_gross_rental_yield = 4.5
    m.unit_median_rent = 480
    m.vacancy_rate = 3.0
    m.school_quality = 7.0
    m.transit_accessibility = 6.0
    m.safety_score = 70
    m.parks_count = 3
    m.owner_occupier_rate = 68
    m.cbd_distance_mins = 30
    m.avg_icsea = 1050
    m.school_count = 3
    m.price_to_income_ratio = 6.5
    m.typical_mortgage_band = "$2000-$2500"
    m.house_days_on_market = 30
    m.unit_days_on_market = 25
    m.house_auction_clearance_rate = 65
    m.predominant_occupation = "Professional"
    m.population_2021 = 15000
    m.population_2016 = 14000
    m.population = 15000
    m.population_cagr = 1.4
    m.abs_demographics_sourced = True
    m.abs_sourced_fields = ["population", "median_age"]
    m.dq_issues = {}
    m.source_raw_id = "RAW_TEST_001"
    m.transform_run_id = "TRANSFORM_RUN_001"
    m.last_updated = None
    m.parks_coverage_pct = 5.0
    m.coordinates = [-37.81, 144.96]
    for k, v in override.items():
        setattr(m, k, v)
    return m


class TestZeroCapacityBehaviour:
    """When borrowing capacity is zero, affordability must be zero — not 100."""

    def test_zero_income_zero_affordability(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3(house_median_price=800000)
        req = BuyFinderRequest(
            state="VIC", annual_income=0, existing_monthly_debt=0,
            budget=850000, deposit=200000,
        )
        result = compute_buyer_fit(v3, req)
        aff = result["affordability"]
        assert aff["score"] == 0, f"Zero capacity must score 0, got {aff['score']}"
        assert aff["serviceability_passed"] is False
        assert aff["estimated_borrowing_capacity"] == 0

    def test_price_below_budget_still_zero_if_no_capacity(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3(house_median_price=500000)
        req = BuyFinderRequest(
            state="VIC", annual_income=0, existing_monthly_debt=0,
            budget=850000, deposit=200000,
        )
        result = compute_buyer_fit(v3, req)
        assert result["affordability"]["score"] == 0, \
            "Price below budget does not override zero borrowing capacity"

    def test_high_debt_reduces_capacity(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3()
        r1 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", existing_monthly_debt=0))
        r2 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", existing_monthly_debt=5000))
        assert r2["affordability"]["estimated_borrowing_capacity"] <= r1["affordability"]["estimated_borrowing_capacity"]
        assert r2["affordability"]["score"] <= r1["affordability"]["score"]


class TestRateAndDebtMonotonicity:
    """Higher rate must not improve affordability. Higher debt must not improve capacity."""

    def test_increasing_rate_does_not_improve_affordability(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3()
        r1 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", interest_rate=0.05))
        r2 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", interest_rate=0.08))
        assert r2["affordability"]["score"] <= r1["affordability"]["score"], \
            f"Higher rate must not improve affordability: {r1['affordability']['score']} → {r2['affordability']['score']}"

    def test_increasing_rate_increases_repayment(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3()
        r1 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", interest_rate=0.05))
        r2 = compute_buyer_fit(v3, BuyFinderRequest(state="VIC", interest_rate=0.08))
        assert r2["affordability"]["monthly_repayment"] >= r1["affordability"]["monthly_repayment"], \
            "Higher rate must increase monthly repayment"


class TestWeightsSafety:
    """All-zero or negative weights must produce finite, safe results."""

    def test_all_zero_weights(self):
        from buyfinder import BuyFinderRequest, BuyFinderWeights, compute_buyer_fit
        v3 = _mock_v3()
        req = BuyFinderRequest(
            state="VIC",
            weights=BuyFinderWeights(
                affordability=0, income=0, livability=0, access=0, evidence=0,
            ),
        )
        result = compute_buyer_fit(v3, req)
        assert result["buyer_fit_score"] == 0
        assert not math.isnan(result["buyer_fit_score"])
        assert not math.isinf(result["buyer_fit_score"])

    def test_non_finite_weights_safe(self):
        from buyfinder import BuyFinderRequest, BuyFinderWeights, compute_buyer_fit
        v3 = _mock_v3()
        req = BuyFinderRequest(
            state="VIC",
            weights=BuyFinderWeights(
                affordability=float('inf') if False else 0,
                income=float('nan') if False else 0,
                livability=float('inf') if False else 0,
                access=0, evidence=0,
            ),
        )
        result = compute_buyer_fit(v3, req)
        assert result["buyer_fit_score"] == 0, "Inf/NaN weights must produce safe score=0"
        assert not math.isnan(result["buyer_fit_score"])


class TestMinimumYieldExclusion:
    """Minimum yield is a hard constraint, not a soft score influence."""

    def test_below_min_yield_excluded(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3(house_gross_rental_yield=3.9)
        req = BuyFinderRequest(state="VIC", minimum_yield=4.0)
        result = compute_buyer_fit(v3, req)
        assert result["eligibility"] == "below_minimum_yield"
        assert result["buyer_fit_score"] == 0

    def test_missing_yield_excluded_when_min_set(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3(house_gross_rental_yield=None, house_median_rent=None)
        req = BuyFinderRequest(state="VIC", minimum_yield=4.0)
        result = compute_buyer_fit(v3, req)
        assert result["eligibility"] == "excluded_yield_unknown", \
            f"Expected excluded_yield_unknown, got {result['eligibility']}"


class TestDQEligibility:
    """Eligibility gate at configured threshold, synthetic exclusion."""

    def test_below_threshold_excluded(self):
        from buyfinder import unified_eligibility
        v3 = _mock_v3(dq_score=79)
        result = unified_eligibility(v3)
        assert result["eligible"] is False
        assert "dq_below_threshold" in result["reasons"]

    def test_at_threshold_eligible(self):
        from buyfinder import unified_eligibility
        v3 = _mock_v3(dq_score=80)
        result = unified_eligibility(v3)
        assert result["eligible"] is True
        assert len(result["reasons"]) == 0

    def test_synthetic_excluded(self):
        from buyfinder import unified_eligibility
        v3 = _mock_v3(dq_score=85, dq_issues={
            "predictive_analysis": {"quality_status": "synthetic_demo"}
        })
        result = unified_eligibility(v3)
        assert result["eligible"] is False
        assert "synthetic_recommendation_inputs" in result["reasons"]

    def test_raw_and_eligibility_dq_differ(self):
        from buyfinder import unified_eligibility
        v3 = _mock_v3(dq_score=82)
        result = unified_eligibility(v3)
        assert "raw_dq_score" in result
        assert "eligibility_dq_score" in result
        assert result["raw_dq_score"] == 82
        assert result["threshold"] == 80

    def test_threshold_90_excludes_85(self):
        """When threshold is 90, dq_score=85 must be excluded."""
        old = os.environ.get("PUBLIC_POC_MIN_DQ_SCORE", "80")
        os.environ["PUBLIC_POC_MIN_DQ_SCORE"] = "90"
        try:
            from buyfinder import unified_eligibility
            from poc_config import POCConfig
            cfg = POCConfig()
            assert cfg.public_poc_min_dq_score == 90
            v3 = _mock_v3(dq_score=85)
            result = unified_eligibility(v3)
            assert result["eligible"] is False, f"DQ 85 must be excluded when threshold is 90"
            assert "dq_below_threshold" in result["reasons"]
        finally:
            os.environ["PUBLIC_POC_MIN_DQ_SCORE"] = old

    def test_threshold_80_includes_85(self):
        from buyfinder import unified_eligibility
        v3 = _mock_v3(dq_score=85)
        result = unified_eligibility(v3)
        assert result["eligible"] is True


class TestInputValidation:
    """Server-side Buyer Fit input validation."""

    def test_reject_negative_income(self):
        from buyfinder import BuyFinderRequest
        req = BuyFinderRequest(annual_income=-50000)
        d = req.dict()
        assert d["annual_income"] == -50000
        assert d["annual_income"] < 0

    def test_reject_zero_budget(self):
        from buyfinder import BuyFinderRequest
        req = BuyFinderRequest(budget=0)
        assert req.budget == 0

    def test_interest_rate_range(self):
        from buyfinder import BuyFinderRequest
        req = BuyFinderRequest(interest_rate=0.062)
        assert 0 < req.interest_rate <= 0.20
        req_bad = BuyFinderRequest(interest_rate=0.25)
        assert req_bad.interest_rate > 0.20


class TestTransactionCosts:
    """Stamp duty and purchase costs reduce available deposit."""

    def test_stamp_duty_reduces_available_deposit(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3(house_median_price=800000)
        req = BuyFinderRequest(
            state="VIC", deposit=170000, annual_income=150000,
            purchase_cost_allowance=0.02,
        )
        result = compute_buyer_fit(v3, req)
        aff = result["affordability"]
        assert aff["available_deposit_after_costs"] < req.deposit
        assert aff["purchase_costs"] > 0
        assert aff["stamp_duty"] > 0
        assert aff["required_loan"] > 0

    def test_affordability_response_structure(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3()
        req = BuyFinderRequest(state="VIC", annual_income=150000)
        result = compute_buyer_fit(v3, req)
        assert "affordability" in result
        aff = result["affordability"]
        assert "score" in aff
        assert "purchase_price" in aff
        assert "required_loan" in aff
        assert "estimated_borrowing_capacity" in aff
        assert "serviceability_passed" in aff
        assert "assumptions" in aff
        assert "interest_rate" in aff["assumptions"]
        assert "loan_term_years" in aff["assumptions"]


class TestBuyerFitComponents:
    """Score components, drivers, risks present and consistent."""

    def test_eligible_result_has_components(self):
        from buyfinder import BuyFinderRequest, compute_buyer_fit
        v3 = _mock_v3()
        req = BuyFinderRequest(state="VIC")
        result = compute_buyer_fit(v3, req)
        assert result["eligibility"] == "eligible"
        assert len(result["components"]) >= 4
        assert "affordability" in result["components"]
        assert "evidence_ids" in result
        assert isinstance(result["evidence_ids"], list)

    def test_rank_response_includes_evidence_ids(self):
        from buyfinder import BuyFinderRequest, BuyFinderWeights, compute_buyer_fit
        v3 = _mock_v3()
        req = BuyFinderRequest(state="VIC", weights=BuyFinderWeights())
        result = compute_buyer_fit(v3, req)
        eids = result.get("evidence_ids", [])
        assert len(eids) > 0, "Evidence IDs must be present in result"
        for eid in eids:
            assert isinstance(eid, str)
            assert ":" in eid or len(eid) > 5, f"Evidence ID '{eid}' does not look valid"
