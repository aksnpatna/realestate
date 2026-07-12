"""
ai_sentiment.py — Transformer-based sentiment analysis for real-estate news.
Uses HuggingFace distilbert-base-uncased-finetuned-sst-2-english.
Falls back to keyword-based analysis if transformers import fails.
"""
import os
import logging

logger = logging.getLogger("uvicorn")

# Positive/negative keyword lists (fallback)
POSITIVE_WORDS = [
    "surge", "boom", "growth", "rising", "up", "strong", "record",
    "increase", "high demand", "hot", "outperform", "recovery", "bull",
]
NEGATIVE_WORDS = [
    "fall", "drop", "decline", "crash", "slump", "weak", "fear",
    "bust", "crisis", "affordability", "tightening", "rate hike", "bear",
    "overvalued", "correction", "bubble",
]

_transformer_pipeline = None


def _load_transformer():
    """Lazy-load the HuggingFace sentiment pipeline."""
    global _transformer_pipeline
    if _transformer_pipeline is not None:
        return _transformer_pipeline
    try:
        from transformers import pipeline
        _transformer_pipeline = pipeline(
            "sentiment-analysis",
            model="distilbert-base-uncased-finetuned-sst-2-english",
            truncation=True,
            max_length=512,
        )
        logger.info("[sentiment] HuggingFace transformer loaded successfully")
        return _transformer_pipeline
    except Exception as e:
        logger.warning(f"[sentiment] HuggingFace import failed ({e}). Falling back to keyword analysis.")
        return None


def _keyword_sentiment(text: str) -> float:
    """Keyword-based sentiment scoring as fallback. Returns 1-10 score."""
    text_lower = text.lower()
    pos = sum(1 for w in POSITIVE_WORDS if w in text_lower)
    neg = sum(1 for w in NEGATIVE_WORDS if w in text_lower)
    if pos + neg == 0:
        return 5.0
    score = 5.0 + (pos - neg) * 1.5
    return max(1.0, min(10.0, round(score, 1)))


def analyze_sentiment(text: str) -> dict:
    """
    Analyze sentiment of text and return a 1-10 score with label and provider info.

    Args:
        text: Combined article text to analyze.

    Returns:
        dict with keys: score (float 1-10), label (str), provider (str)
    """
    if not text or not text.strip():
        return {"score": 5.0, "label": "Neutral", "provider": "keyword"}

    pipeline = _load_transformer()

    if pipeline is not None:
        try:
            # HuggingFace returns POSITIVE/NEGATIVE with confidence
            result = pipeline(text[:512])[0]
            label = result["label"]
            confidence = result["score"]

            if label == "POSITIVE":
                score = 5.0 + confidence * 5.0  # Map to 5-10
            else:
                score = 5.0 - confidence * 4.0  # Map to 1-5

            score = max(1.0, min(10.0, round(score, 1)))

            if score >= 7:
                sentiment_label = "Bullish"
            elif score >= 4.5:
                sentiment_label = "Neutral"
            else:
                sentiment_label = "Bearish"

            return {
                "score": score,
                "label": sentiment_label,
                "provider": "transformers",
            }
        except Exception as e:
            logger.warning(f"[sentiment] Transformer inference failed: {e}. Falling back to keyword.")

    # Keyword fallback
    score = _keyword_sentiment(text)
    if score >= 7:
        sentiment_label = "Bullish"
    elif score >= 4.5:
        sentiment_label = "Neutral"
    else:
        sentiment_label = "Bearish"

    return {
        "score": score,
        "label": sentiment_label,
        "provider": "keyword",
    }
