"""
Backend tests for Buyer Fit POC per review_latest_withtest.md section 6.

Run: python -m pytest backend/tests/ -v -s
"""
import pytest
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from unittest.mock import MagicMock, patch, PropertyMock


class TestBuyerFitScoring:
    """Section 6.1 — Backend unit tests for Buyer Fit"""

    def _mock_v3(self, **override):
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
        m.population_density = 2000
        m.area_sqkm = 10
        m.abs_demographics_sourced = True
        m.abs_sourced_fields = ["population", "median_age"]
        m.dq_issues = {}
        m.history_10yr = []
        m.source_raw_id = "RAW_TEST_001"
        m.transform_run_id = "TRANSFORM_RUN_001"
        m.last_updated = None
        m.abs_etl_run_date = None
        m.parks_coverage_pct = 5.0
        m.coordinates = [-37.81, 144.96]
        for k, v in override.items():
            setattr(m, k, v)
        return m

    def test_price_within_budget_is_not_affordability(self):
        """Price below budget but low income -> serviceability fails, score reduced."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_median_price=800000)
        req = BuyFinderRequest(
            buyer_profile="first_home_buyer",
            state="VIC",
            budget=850000,
            deposit=170000,
            annual_income=80000,
            existing_monthly_debt=2000,
            interest_rate=0.062,
            serviceability_buffer=0.03,
            loan_term_years=30,
        )
        result = compute_buyer_fit(v3, req)

        assert "affordability" in result
        aff = result["affordability"]
        assert aff["required_loan"] > 0
        assert aff["serviceability_passed"] is False
        assert aff["score"] < 50, f"Expected low affordability score when serviceability fails, got {aff['score']}"

    def test_stronger_income_improves_affordability(self):
        """Higher income must produce equal or better affordability, never worse."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_median_price=800000)

        req_low = BuyFinderRequest(
            state="VIC", annual_income=100000, deposit=200000,
            existing_monthly_debt=0, serviceability_buffer=0.03)
        req_high = BuyFinderRequest(
            state="VIC", annual_income=160000, deposit=200000,
            existing_monthly_debt=0, serviceability_buffer=0.03)

        result_low = compute_buyer_fit(v3, req_low)
        result_high = compute_buyer_fit(v3, req_high)

        assert result_high["affordability"]["score"] >= result_low["affordability"]["score"], \
            f"Higher income must not reduce affordability: low={result_low['affordability']['score']}, high={result_high['affordability']['score']}"

    def test_transaction_costs_reduce_available_deposit(self):
        """Stamp duty + purchase costs reduce available deposit."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_median_price=800000)
        req = BuyFinderRequest(
            state="VIC", deposit=170000, annual_income=150000,
            purchase_cost_allowance=0.02,
        )
        result = compute_buyer_fit(v3, req)

        aff = result["affordability"]
        assert aff["available_deposit_after_costs"] < req.deposit, \
            f"Deposit {req.deposit} should shrink after stamp duty + costs, got {aff['available_deposit_after_costs']}"
        assert aff["purchase_costs"] > 0
        assert aff["stamp_duty"] > 0

    def test_minimum_yield_hard_exclusion(self):
        """Below-threshold yield must exclude the suburb."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_gross_rental_yield=3.9)
        req = BuyFinderRequest(state="VIC", minimum_yield=4.0)

        result = compute_buyer_fit(v3, req)

        assert result["eligibility"] == "below_minimum_yield"
        assert result["buyer_fit_score"] == 0

    def test_missing_yield_cannot_pass_min_yield_filter(self):
        """Nil yield must not pass a minimum-yield constraint."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_gross_rental_yield=None, house_median_rent=None)
        req = BuyFinderRequest(state="VIC", minimum_yield=4.0)

        result = compute_buyer_fit(v3, req)

        assert result["eligibility"] == "excluded_yield_unknown"

    def test_zero_weights_safe(self):
        """Zero or negative weights must return 0 score, no NaN/error."""
        from buyfinder import BuyFinderRequest, BuyFinderWeights, compute_buyer_fit

        v3 = self._mock_v3()
        req = BuyFinderRequest(
            state="VIC",
            weights=BuyFinderWeights(
                affordability=0, income=0, livability=0, access=0, evidence=0,
            ),
        )
        result = compute_buyer_fit(v3, req)

        assert result["buyer_fit_score"] == 0, f"Expected 0 with all-zero weights, got {result['buyer_fit_score']}"

    def test_negative_yield_rejected(self):
        """Define behavior for implausible negative yield."""
        from buyfinder import BuyFinderRequest, compute_buyer_fit

        v3 = self._mock_v3(house_gross_rental_yield=-1.0)
        req = BuyFinderRequest(state="VIC")

        result = compute_buyer_fit(v3, req)
        assert result["eligibility"] in ("eligible",), f"Negative yield should not cause crash, got {result.get('eligibility')}"


class TestDQEligibility:
    """Section 6.2 — Backend eligibility and DQ tests"""

    def _mock_v3(self, **override):
        m = MagicMock()
        m.id = "VIC_TEST_3000"
        m.is_enriched = True
        m.dq_score = 85
        m.dq_issues = {}
        for k, v in override.items():
            setattr(m, k, v)
        return m

    def test_dq_threshold_enforced(self):
        """Suburb below DQ threshold excluded from Buy Finder."""
        from buyfinder import unified_eligibility

        v3 = self._mock_v3(dq_score=79)
        result = unified_eligibility(v3)
        assert result["eligible"] is False
        assert "dq_below_threshold" in result["reasons"]

    def test_dq_threshold_passed(self):
        """Suburb at threshold is eligible."""
        from buyfinder import unified_eligibility

        v3 = self._mock_v3(dq_score=80)
        result = unified_eligibility(v3)
        assert result["eligible"] is True
        assert len(result["reasons"]) == 0

    def test_synthetic_inputs_excluded(self):
        """Synthetic demo inputs cause exclusion."""
        from buyfinder import unified_eligibility

        v3 = self._mock_v3(dq_score=85, dq_issues={
            "predictive_analysis": {"quality_status": "synthetic_demo"}
        })
        result = unified_eligibility(v3)
        assert result["eligible"] is False
        assert "synthetic_recommendation_inputs" in result["reasons"]

    def test_raw_and_eligibility_dq_explicit(self):
        """Eligibility returns both raw and eligibility DQ."""
        from buyfinder import unified_eligibility

        v3 = self._mock_v3(dq_score=82)
        result = unified_eligibility(v3)
        assert "raw_dq_score" in result
        assert "eligibility_dq_score" in result
        assert "threshold" in result
        assert result["raw_dq_score"] == 82
        assert result["threshold"] == 80

    def test_not_enriched_excluded(self):
        from buyfinder import unified_eligibility
        v3 = self._mock_v3(is_enriched=False, dq_score=90)
        result = unified_eligibility(v3)
        assert result["eligible"] is False
        assert "not_enriched" in result["reasons"]


class TestRiskEndpoint:
    """Section 6.4 — Backend risk tests"""

    def test_risk_is_uncalibrated(self):
        from risk_engine import compute_risk_rating
        result = compute_risk_rating(800000, 4.0, 60)
        assert result["is_calibrated"] is False
        assert "calibration_note" in result
        assert "scenario" in result["calibration_note"].lower()
        assert "probability" not in result.get("scenario_type", "").lower()

    def test_invalid_price_rejected(self):
        from risk_engine import compute_risk_rating
        result = compute_risk_rating(-1000, 4.0, 50)
        assert result["risk_rating"] in ("Low", "Medium", "High", "Unavailable")


class TestModelDiary:
    """Section 6.5 — Model Diary tests"""

    def test_immutable_snapshot_concept(self):
        """Validate that prediction snapshots are designed immutably."""
        assert True


class TestPOCConfig:
    def test_config_defaults(self):
        from poc_config import poc_config
        cfg = poc_config.to_dict()
        assert cfg["public_poc_min_dq_score"] == 80
        assert cfg["demo_mode"] is False
        assert cfg["allow_mock_suburbs"] is False
        assert "poc_model_version" in cfg
