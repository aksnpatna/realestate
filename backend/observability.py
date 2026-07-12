"""
observability.py — Prometheus metrics for AI feature monitoring.
Exposes counters and gauges for sentiment calls, cache hits, and fallbacks.
"""
import logging

logger = logging.getLogger("uvicorn")

_metrics = {
    "sentiment_calls_total": 0,
    "sentiment_remote_success": 0,
    "sentiment_fallback_keyword": 0,
    "committee_calls_total": 0,
    "cache_hits_redis": 0,
    "cache_hits_db": 0,
    "cache_misses": 0,
}


def record_sentiment_call(provider: str):
    _metrics["sentiment_calls_total"] += 1
    if provider == "qwen-3b":
        _metrics["sentiment_remote_success"] += 1
    elif provider == "keyword":
        _metrics["sentiment_fallback_keyword"] += 1


def record_committee_call():
    _metrics["committee_calls_total"] += 1


def record_cache_hit(layer: str):
    if layer == "redis":
        _metrics["cache_hits_redis"] += 1
    elif layer == "db":
        _metrics["cache_hits_db"] += 1


def record_cache_miss():
    _metrics["cache_misses"] += 1


def get_metrics_text() -> str:
    """Return Prometheus text format metrics."""
    m = _metrics
    lines = [
        "# HELP ai_sentiment_calls_total Total sentiment analysis calls",
        "# TYPE ai_sentiment_calls_total counter",
        f"ai_sentiment_calls_total {m['sentiment_calls_total']}",
        "# HELP ai_sentiment_remote_success_total Successful remote LLM calls",
        "# TYPE ai_sentiment_remote_success_total counter",
        f"ai_sentiment_remote_success_total {m['sentiment_remote_success']}",
        "# HELP ai_sentiment_fallback_keyword_total Keyword fallback calls",
        "# TYPE ai_sentiment_fallback_keyword_total counter",
        f"ai_sentiment_fallback_keyword_total {m['sentiment_fallback_keyword']}",
        "# HELP ai_committee_calls_total Total committee invocations",
        "# TYPE ai_committee_calls_total counter",
        f"ai_committee_calls_total {m['committee_calls_total']}",
        "# HELP ai_cache_hits_total Cache hits by layer",
        "# TYPE ai_cache_hits_total counter",
        f'ai_cache_hits_total{{layer="redis"}} {m["cache_hits_redis"]}',
        f'ai_cache_hits_total{{layer="db"}} {m["cache_hits_db"]}',
        "# HELP ai_cache_misses_total Cache misses (fresh fetches)",
        "# TYPE ai_cache_misses_total counter",
        f"ai_cache_misses_total {m['cache_misses']}",
    ]
    return "\n".join(lines) + "\n"
