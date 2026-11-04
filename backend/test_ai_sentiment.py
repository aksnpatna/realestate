"""
Unit tests for AI sentiment analysis and caching layer.
Run: cd backend && python -m pytest test_ai_sentiment.py -v
"""
import sys
import os
import json
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["ENABLE_AI_INSIGHTS"] = "true"


class TestSentimentKeywordFallback:
    def test_positive_text(self):
        from ai_sentiment import _keyword_sentiment
        score = _keyword_sentiment("property prices surge with boom growth rising up strong record demand bull")
        assert score > 5.0, f"Expected bullish score, got {score}"

    def test_negative_text(self):
        from ai_sentiment import _keyword_sentiment
        score = _keyword_sentiment("market crash slump decline fall drop crisis bubble correction overvalued bear")
        assert score < 5.0, f"Expected bearish score, got {score}"

    def test_neutral_text(self):
        from ai_sentiment import _keyword_sentiment
        score = _keyword_sentiment("the market remains stable with no significant changes")
        assert score == 5.0, f"Expected neutral score 5.0, got {score}"

    def test_score_bounds(self):
        from ai_sentiment import _keyword_sentiment
        score = _keyword_sentiment("surge boom growth boom boom boom boom boom boom boom")
        assert 1.0 <= score <= 10.0, f"Score {score} out of bounds"

    def test_empty_text(self):
        from ai_sentiment import _keyword_sentiment
        score = _keyword_sentiment("")
        assert score == 5.0


class TestAnalyzeSentiment:
    def test_empty_input(self):
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("")
        assert result["score"] == 5.0
        assert result["label"] == "Neutral"
        assert result["provider"] == "keyword"

    @patch("ai_sentiment._call_remote_llm")
    def test_remote_positive(self, mock_call):
        mock_call.return_value = {"score": 8.5, "label": "Bullish", "provider": "qwen-7b"}
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("the housing market is booming with incredible growth this year")
        assert result["score"] == 8.5
        assert result["label"] == "Bullish"
        assert result["provider"] == "qwen-7b"

    @patch("ai_sentiment._call_remote_llm")
    def test_remote_negative(self, mock_call):
        mock_call.return_value = {"score": 2.5, "label": "Bearish", "provider": "qwen-7b"}
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("market crash prices falling everywhere")
        assert result["score"] == 2.5
        assert result["label"] == "Bearish"
        assert result["provider"] == "qwen-7b"

    @patch("ai_sentiment._call_cloud_llm", return_value=None)
    @patch("ai_sentiment._call_remote_llm")
    def test_remote_fallback_to_keyword(self, mock_call, mock_cloud):
        mock_call.return_value = None  # Simulate remote failure
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("surge boom growth record")
        assert result["provider"] == "keyword"

    @patch("ai_sentiment._call_remote_llm")
    def test_explanation_included(self, mock_call):
        mock_call.return_value = {"score": 8.5, "label": "Bullish", "provider": "qwen-7b"}
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("record growth strong demand booming market surge")
        assert len(result["explanation"]) >= 1, "Should have keyword explanations"
        assert any(e["sentiment"] == "positive" for e in result["explanation"])


class TestIDNormalization:
    def test_frontend_to_db_format(self):
        from suburb_utils import normalize_suburb_id
        assert normalize_suburb_id("parramatta-nsw-2150") == "NSW_PARRAMATTA_2150"
        assert normalize_suburb_id("tarneit-vic-3029") == "VIC_TARNEIT_3029"
        assert normalize_suburb_id("east-melbourne-vic-3002") == "VIC_EAST_MELBOURNE_3002"

    def test_single_word_name(self):
        from suburb_utils import normalize_suburb_id
        assert normalize_suburb_id("ryde-nsw-2112") == "NSW_RYDE_2112"

    def test_unknown_format_fallback(self):
        from suburb_utils import normalize_suburb_id
        result = normalize_suburb_id("SOME_WEIRD_ID")
        assert "_" in result


class TestCachedAI:
    @patch.dict(os.environ, {"AI_CACHE_TTL": "60"})
    def test_decorator_calls_function(self):
        from cache_utils import cached_ai
        call_count = [0]

        @cached_ai("test:{0}")
        def my_func(arg):
            call_count[0] += 1
            return {"result": arg, "count": call_count[0]}

        result = my_func("hello")
        assert result["result"] == "hello"
        assert call_count[0] == 1

    @patch.dict(os.environ, {"AI_CACHE_TTL": "3600"})
    def test_decorator_imports_cache(self):
        from cache_utils import cached_ai

        @cached_ai("import_test:{0}")
        def simple_func(x):
            return {"value": x}

        result = simple_func("test")
        assert result["value"] == "test"

    def test_decorator_preserves_function_metadata(self):
        from cache_utils import cached_ai

        @cached_ai("test_meta:{0}:{1}")
        def documented_func(a, b):
            """Docstring for test."""
            return a + b

        assert documented_func.__name__ == "documented_func"
        assert documented_func.__doc__ == "Docstring for test."


class TestMacroIntelligenceAndValueTrapGuardrails:
    def test_churchill_macro_intelligence(self):
        from ai_agent import _build_macro_intelligence
        metrics = {
            "vacancyRate": 4.48,
            "rentalYield": 3.92,
            "priceChange12mPct": -2.44,
            "priceChange3mPct": -9.86,
            "avgIcsea": 953.0,
            "populationCagr": 0.58,
            "hospitalCount": 0,
            "unemploymentRate": 6.7,
        }
        intel = _build_macro_intelligence("Churchill", "VIC", metrics=metrics, raw_news_score=7.5)
        assert intel["rba_rate_sensitivity"]["level"].upper() == "HIGH"
        assert intel["supply_dilution_risk"]["level"].upper() == "HIGH"
        assert intel["regulatory_tax_risk"]["level"].upper() == "HIGH"
        assert intel["hype_vs_data_divergence"]["level"] == "SEVERE"
        assert intel["amenity_claim_check"]["risk_level"] == "HIGH_PITCH_RISK"
        assert len(intel["amenity_claim_check"]["warnings"]) >= 3

    def test_policy_rules_camelcase_aliases(self):
        from ai_agent import _evaluate_policy_rules
        metrics = {
            "vacancyRate": 4.48,
            "priceChange12mPct": -2.44,
            "rentalYield": 3.92,
            "cbdDistanceMins": 120,
        }
        warnings = _evaluate_policy_rules(metrics, "VIC")
        rule_ids = {w["rule_id"] for w in warnings}
        assert "high_vacancy_risk" in rule_ids
        assert "negative_price_momentum" in rule_ids
        assert "vic_land_tax" in rule_ids

    def test_anti_market_score_and_alternatives(self):
        from types import SimpleNamespace
        from clustering import compute_anti_market_score, find_anti_market_alternatives

        churchill = SimpleNamespace(
            id="VIC_CHURCHILL_3842",
            name="Churchill",
            postcode="3842",
            state="VIC",
            house_median_price=561224.61,
            house_median_price_12m_change_pct=-2.44,
            house_median_price_3m_change_pct=-9.86,
            vacancy_rate=4.48,
            house_gross_rental_yield=3.92,
            avg_icsea=953.0,
            unemployment_rate=6.7,
            social_housing_pct=6.86,
            house_sold_12m=60,
        )
        res = compute_anti_market_score(churchill, state_median_12m=-0.9)
        assert res["is_value_trap"] is True
        assert res["trend_label"] == "Value Trap Warning"
        assert res["anti_market_score"] < 30

        resilient_peer = SimpleNamespace(
            id="VIC_DELACOMBE_3356",
            name="Delacombe",
            postcode="3356",
            state="VIC",
            house_median_price=540000.0,
            house_median_price_12m_change_pct=6.5,
            house_median_price_3m_change_pct=2.1,
            vacancy_rate=1.1,
            house_gross_rental_yield=4.6,
            avg_icsea=995.0,
            unemployment_rate=3.8,
            social_housing_pct=3.2,
            house_sold_12m=85,
        )
        alts = find_anti_market_alternatives(churchill, [churchill, resilient_peer], state_median_12m=-0.9)
        assert len(alts) == 1
        assert alts[0]["id"].upper() == "VIC_DELACOMBE_3356"
        assert alts[0]["anti_market_score"] >= 65

    def test_risk_engine_flags_churchill_high_risk(self):
        from risk_engine import compute_risk_rating
        risk = compute_risk_rating(
            median_price=561225,
            rental_yield=3.92,
            growth_score=42,
            vacancy_rate=4.48,
            price_12m_change_pct=-2.44,
            price_3m_change_pct=-9.86,
        )
        assert risk["risk_rating"] == "High"
        assert risk["expected_return"] < 0

