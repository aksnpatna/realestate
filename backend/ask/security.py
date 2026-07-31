import re
import time
from typing import Dict, Tuple

# Rate Limiter Config
# In-memory rate limiting (IP -> (count, reset_time))
_RATE_LIMITS: Dict[str, Tuple[int, float]] = {}
MAX_REQUESTS_PER_MINUTE = 10

def is_rate_limited(client_ip: str) -> bool:
    now = time.time()
    if client_ip in _RATE_LIMITS:
        count, reset_time = _RATE_LIMITS[client_ip]
        if now > reset_time:
            _RATE_LIMITS[client_ip] = (1, now + 60.0)
            return False
        if count >= MAX_REQUESTS_PER_MINUTE:
            return True
        _RATE_LIMITS[client_ip] = (count + 1, reset_time)
        return False
    else:
        _RATE_LIMITS[client_ip] = (1, now + 60.0)
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
