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

    @patch("ai_sentiment._call_remote_llm")
    def test_remote_fallback_to_keyword(self, mock_call):
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
