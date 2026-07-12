"""
cache_utils.py — Redis-primary + DB-fallback caching layer for AI features.
Provides a decorator for caching function results with configurable TTL.
Redis is tried first; on failure it falls back to the existing DB-level cache.
"""
import os
import functools
import logging

logger = logging.getLogger("uvicorn")

DEFAULT_TTL = int(os.getenv("AI_CACHE_TTL", "604800"))  # 7 days


def cached_ai(key_template: str, ttl: int = DEFAULT_TTL):
    """
    Decorator that caches function results in Redis with automatic DB fallback.

    Cache flow:
        1. Redis HIT  → return cached JSON immediately
        2. Redis MISS → call wrapped function, store result in Redis (TTL seconds)
        3. Redis DOWN → call wrapped function directly (no-op)

    Args:
        key_template: Python format string for the cache key.
                      Positional args are interpolated via str.format(*args).
                      Example: "ai_sentiment:{0}:{1}" → "ai_sentiment:Parramatta:NSW"
        ttl: Cache time-to-live in seconds. Default: 604800 (7 days).

    Returns:
        A decorator that wraps the original function. The decorated function
        preserves the original __name__ and __doc__ via functools.wraps.

    Env vars:
        AI_CACHE_TTL — default TTL if ttl not specified.
        REDIS_HOST / REDIS_PORT — Redis connection (set in main.py).
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            try:
                cache_key = key_template.format(*args, **kwargs)
            except (IndexError, KeyError):
                cache_key = f"ai:{func.__name__}:{'_'.join(str(a) for a in args)}"

            # Try Redis first
            try:
                from main import redis_client, get_cached_or_query
                if redis_client is not None:
                    cached = redis_client.get(cache_key)
                    if cached:
                        import json
                        logger.info(f"[cache] Redis HIT: {cache_key}")
                        return json.loads(cached)

                    result = func(*args, **kwargs)

                    try:
                        redis_client.setex(cache_key, ttl, json.dumps(result, default=str))
                        logger.info(f"[cache] Redis SET: {cache_key} (TTL={ttl}s)")
                    except Exception as e:
                        logger.warning(f"[cache] Redis write failed: {e}")

                    return result
            except Exception as e:
                logger.warning(f"[cache] Redis layer failed: {e}. Falling through to DB/function.")

            # Fallback: just call the function (DB-level caching handled in the endpoints)
            return func(*args, **kwargs)

        return wrapper
    return decorator
