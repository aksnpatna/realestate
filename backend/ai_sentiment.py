"""
ai_sentiment.py — Sentiment analysis via remote LLM (Ollama / llama.cpp GGUF).
Calls Qwen-2.5 7B at REMOTE_LLM_URL over HTTP. Falls back to keyword analysis.
No local GPU/transformers required.
"""
import os
import re
import json
import logging
import threading
import httpx

logger = logging.getLogger("uvicorn")

REMOTE_LLM_URL = os.getenv(
    "REMOTE_LLM_URL",
    "http://192.168.1.150:11434/api/generate"
)

# Concurrency guard — max 3 parallel calls to the Mac Air
_sentiment_sem = threading.BoundedSemaphore(3)

# Character ranges for non-English detection
NON_LATIN_RANGES = [
    (0x4E00, 0x9FFF),   # CJK Unified
    (0xAC00, 0xD7AF),    # Hangul
    (0x3040, 0x309F),    # Hiragana
    (0x30A0, 0x30FF),    # Katakana
    (0x0400, 0x04FF),    # Cyrillic
    (0x0600, 0x06FF),    # Arabic
    (0x0590, 0x05FF),    # Hebrew
]


def _detect_non_english(text: str) -> float:
    """Return ratio of non-Latin characters. > 0.15 means likely non-English."""
    if not text:
        return 0.0
    non_latin = 0
    for ch in text:
        code = ord(ch)
        if code > 127:
            non_latin += 1
    return non_latin / len(text)


def _translate_text(text: str) -> str:
    """
    Translate non-English text to English using Qwen on Mac Air.
    Returns original text if translation fails.
    """
    if not REMOTE_LLM_URL:
        return text

    truncated = text[:800]
    prompt = f"Translate the following text to English. Output ONLY the translation:\n\n{truncated}"

    try:
        if "/api/generate" in REMOTE_LLM_URL:
            payload = {
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 500},
            }
        else:
            payload = {
                "prompt": prompt,
                "max_tokens": 500,
                "temperature": 0.0,
                "stream": False,
            }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(REMOTE_LLM_URL, json=payload)
            resp.raise_for_status()
            data = resp.json()

            if "/api/generate" in REMOTE_LLM_URL:
                return data.get("response", text).strip()
            else:
                return data.get("choices", [{}])[0].get("text", text).strip()
    except Exception as e:
        logger.warning(f"[translate] Failed: {e}")
        return text

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


def _call_remote_llm(text: str) -> dict | None:
    """
    Call the remote Qwen model over HTTP for sentiment classification.
    Supports both Ollama (/api/generate) and llama.cpp (/v1/completions) endpoints.
    Returns {"score": float, "label": str, "provider": str} or None on failure.
    """
    if not _sentiment_sem.acquire(timeout=10):
        logger.warning("[sentiment] Semaphore timeout — too many concurrent calls")
        return None

    try:
        endpoint = REMOTE_LLM_URL
        truncated = text[:1200]
        prompt = (
            "Classify the sentiment of this real-estate news as Positive, Neutral, or Negative. "
            "Output ONLY the single word.\n\n"
            f"{truncated}"
        )

        if "/api/generate" in endpoint:
            # Ollama format
            payload = {
                "model": "qwen2.5:3b",
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.0, "num_predict": 3},
            }
        else:
            # llama.cpp v1/completions format
            payload = {
                "prompt": prompt,
                "max_tokens": 3,
                "temperature": 0.0,
                "stream": False,
            }

        with httpx.Client(timeout=12.0) as client:
            resp = client.post(endpoint, json=payload)
            resp.raise_for_status()
            data = resp.json()

            if "/api/generate" in endpoint:
                raw = data.get("response", "").strip().lower()
            else:
                raw = data.get("choices", [{}])[0].get("text", "").strip().lower()

            if raw.startswith("posit"):
                return {"score": 8.5, "label": "Bullish", "provider": "qwen-3b"}
            elif raw.startswith("neg"):
                return {"score": 2.5, "label": "Bearish", "provider": "qwen-3b"}
            elif raw.startswith("neut"):
                return {"score": 5.0, "label": "Neutral", "provider": "qwen-3b"}
            else:
                # Try to extract a 0-10 score if the model returned one
                match = re.search(r"(\d+(?:\.\d+)?)", raw)
                if match:
                    score = float(match.group(1))
                    score = max(1.0, min(10.0, score))
                else:
                    score = 5.0

                if score >= 7:
                    label = "Bullish"
                elif score >= 4.5:
                    label = "Neutral"
                else:
                    label = "Bearish"

                return {"score": score, "label": label, "provider": "qwen-3b"}

    except httpx.TimeoutException:
        logger.warning("[sentiment] Remote LLM timed out after 12s")
        return None
    except httpx.HTTPStatusError as e:
        logger.warning(f"[sentiment] Remote LLM HTTP {e.response.status_code}")
        return None
    except Exception as e:
        logger.warning(f"[sentiment] Remote LLM call failed: {type(e).__name__}: {e}")
        return None
    finally:
        _sentiment_sem.release()


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
    Analyze sentiment of text. Tries remote Qwen 3B first, falls back to keyword.

    Args:
        text: Combined article text to analyze.

    Returns:
        dict with: score (float 1-10), label (str), provider (str), explanation (list)
    """
    if not text or not text.strip():
        return {"score": 5.0, "label": "Neutral", "provider": "keyword", "explanation": []}

    # Detect and translate non-English text
    if _detect_non_english(text) > 0.15:
        logger.info(f"[sentiment] Detected non-English text ({_detect_non_english(text):.0%}), translating...")
        text = _translate_text(text)
        if not text:
            return {"score": 5.0, "label": "Neutral", "provider": "keyword", "explanation": []}

    from observability import record_sentiment_call

    # Try remote LLM first
    result = _call_remote_llm(text)
    if result is not None:
        record_sentiment_call(result.get("provider", "unknown"))
        result["explanation"] = _extract_keywords(text.lower())
        return result

    # Keyword fallback
    record_sentiment_call("keyword")
    score = _keyword_sentiment(text)
    if score >= 7:
        label = "Bullish"
    elif score >= 4.5:
        label = "Neutral"
    else:
        label = "Bearish"

    return {
        "score": score,
        "label": label,
        "provider": "keyword",
        "explanation": _extract_keywords(text.lower()),
    }


def _extract_keywords(text: str) -> list:
    """Extract matching sentiment keywords from the text with counts."""
    positive_hits = [(w, text.count(w)) for w in POSITIVE_WORDS if w in text]
    negative_hits = [(w, text.count(w)) for w in NEGATIVE_WORDS if w in text]
    positive_hits.sort(key=lambda x: -x[1])
    negative_hits.sort(key=lambda x: -x[1])

    result = []
    for word, count in positive_hits[:3]:
        result.append({"token": word, "sentiment": "positive", "occurrences": count})
    for word, count in negative_hits[:3]:
        result.append({"token": word, "sentiment": "negative", "occurrences": count})
    return result[:5]
