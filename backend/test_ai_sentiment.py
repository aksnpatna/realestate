"""
Unit tests for AI sentiment analysis and caching layer.
Run: cd backend && python -m pytest test_ai_sentiment.py -v
"""
import sys
import os
import json
from unittest.mock import patch, MagicMock, PropertyMock

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ["ENABLE_AI_INSIGHTS"] = "true"


class TestSentimentKeywordFallback:
    """Test the keyword-based sentiment scoring (no transformers required)."""

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
    """Test the main analyze_sentiment function with mocked transformer."""

    def test_empty_input(self):
        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("")
        assert result["score"] == 5.0
        assert result["label"] == "Neutral"
        assert result["provider"] == "keyword"

    @patch("ai_sentiment._load_transformer")
    def test_keyword_fallback_bullish(self, mock_load):
        mock_load.return_value = None  # Force keyword fallback

        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("record growth strong demand booming market surge")
        assert result["score"] >= 6.5, f"Expected bullish, got {result}"
        assert result["label"] == "Bullish"
        assert result["provider"] == "keyword"

    @patch("ai_sentiment._load_transformer")
    def test_transformer_positive(self, mock_load):
        mock_pipeline = MagicMock()
        mock_pipeline.return_value = [{"label": "POSITIVE", "score": 0.98}]
        mock_load.return_value = mock_pipeline

        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("the housing market is booming with incredible growth this year")
        assert result["score"] >= 9.0, f"Expected score >= 9.0 got {result['score']}"
        assert result["label"] == "Bullish"
        assert result["provider"] == "transformers"

    @patch("ai_sentiment._load_transformer")
    def test_transformer_negative(self, mock_load):
        mock_pipeline = MagicMock()
        mock_pipeline.return_value = [{"label": "NEGATIVE", "score": 0.99}]
        mock_load.return_value = mock_pipeline

        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("market crash prices falling everywhere")
        assert result["score"] <= 1.1, f"Expected score <= 1.1"
        assert result["label"] == "Bearish"
        assert result["provider"] == "transformers"

    @patch("ai_sentiment._load_transformer")
    def test_transformer_failure_fallsback(self, mock_load):
        mock_load.return_value = None

        from ai_sentiment import analyze_sentiment
        result = analyze_sentiment("surge boom growth record")
        assert result["provider"] == "keyword"


class TestIDNormalization:
    """Test the suburb ID normalizer."""

    def test_frontend_to_db_format(self):
        from main import _normalize_suburb_id
        assert _normalize_suburb_id("parramatta-nsw-2150") == "NSW_PARRAMATTA_2150"
        assert _normalize_suburb_id("tarneit-vic-3029") == "VIC_TARNEIT_3029"
        assert _normalize_suburb_id("east-melbourne-vic-3002") == "VIC_EAST_MELBOURNE_3002"

    def test_single_word_name(self):
        from main import _normalize_suburb_id
        assert _normalize_suburb_id("ryde-nsw-2112") == "NSW_RYDE_2112"

    def test_unknown_format_fallback(self):
        from main import _normalize_suburb_id
        result = _normalize_suburb_id("SOME_WEIRD_ID")
        assert "_" in result


class TestCachedAI:
    """Test the cached_ai decorator behavior."""

    @patch.dict(os.environ, {"AI_CACHE_TTL": "60"})
    def test_decorator_calls_function(self):
        from cache_utils import cached_ai

        call_count = [0]

        @cached_ai("test:{0}")
        def my_func(arg):
            call_count[0] += 1
            return {"result": arg, "count": call_count[0]}

        # First call should execute
        result = my_func("hello")
        assert result["result"] == "hello"
        assert call_count[0] == 1

    @patch.dict(os.environ, {"AI_CACHE_TTL": "3600"})
    @patch("cache_utils.logger")
    def test_decorator_imports_cache(self, mock_logger):
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
