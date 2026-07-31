import re
import time
from typing import Dict, Tuple, Any
from collections import OrderedDict

class TTLLRUCache:
    def __init__(self, maxsize: int, ttl: float):
        self.cache = OrderedDict()
        self.maxsize = maxsize
        self.ttl = ttl

    def get(self, key: str):
        if key not in self.cache:
            return None
        timestamp, value = self.cache[key]
        if time.time() - timestamp > self.ttl:
            del self.cache[key]
            return None
        self.cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = (time.time(), value)
        if len(self.cache) > self.maxsize:
            self.cache.popitem(last=False)

# Rate Limiter Config
# In-memory rate limiting (user_id -> (count, reset_time))
_RATE_LIMITS = TTLLRUCache(maxsize=10000, ttl=60.0)
MAX_REQUESTS_PER_MINUTE = 10

def is_rate_limited(user_id: str) -> bool:
    now = time.time()
    record = _RATE_LIMITS.get(user_id)
    if record is not None:
        count, reset_time = record
        if now > reset_time:
            _RATE_LIMITS.set(user_id, (1, now + 60.0))
            return False
        if count >= MAX_REQUESTS_PER_MINUTE:
            return True
        _RATE_LIMITS.set(user_id, (count + 1, reset_time))
        return False
    else:
        _RATE_LIMITS.set(user_id, (1, now + 60.0))
        return False

# Prompt Injection Defense
_INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous\s+)?instructions",
    r"disregard\s+(all\s+)?(previous\s+)?instructions",
    r"system\s+prompt",
    r"you\s+are\s+now",
    r"new\s+persona",
    r"output\s+only",
    r"forget\s+everything",
    r"bypass\s+filters"
]

def is_prompt_injection(query: str) -> bool:
    query_lower = query.lower()
    for pattern in _INJECTION_PATTERNS:
        if re.search(pattern, query_lower):
            return True
    return False

# Abuse Filter
_ABUSIVE_WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'stupid', 'idiot', 'dick', 'crap']

def is_abusive(query: str) -> bool:
    query_lower = query.lower()
    return any(w in query_lower for w in _ABUSIVE_WORDS)
