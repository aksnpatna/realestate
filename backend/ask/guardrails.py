import re
import logging

logger = logging.getLogger(__name__)

# Basic PII Regex Patterns
EMAIL_REGEX = re.compile(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})')
# Australian Phone Numbers (Mobile: 04XX XXX XXX, Landline: 02/03/07/08 XXXX XXXX)
PHONE_REGEX = re.compile(r'(\b0[2-478](?:\s*\d){8}\b)')
# TFN / SSN like patterns (9 digits)
TFN_REGEX = re.compile(r'(\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b)')

def mask_pii(text: str) -> str:
    """
    Enterprise Data Privacy: Scans and masks Personally Identifiable Information (PII) 
    before it hits the LLM or analytics logs.
    """
    if not text:
        return text
        
    masked_text = text
    masked_text = EMAIL_REGEX.sub('[EMAIL REDACTED]', masked_text)
    masked_text = PHONE_REGEX.sub('[PHONE REDACTED]', masked_text)
    masked_text = TFN_REGEX.sub('[ID REDACTED]', masked_text)
    
    if masked_text != text:
        logger.info("Guardrail triggered: PII masked from user input.")
        
    return masked_text


# Off-topic / Prompt Injection detection
PROMPT_INJECTION_KEYWORDS = [
    "ignore all previous instructions",
    "ignore previous instructions",
    "system prompt",
    "you are a",
    "forget everything",
    "act as a",
    "write a poem",
    "write a story",
    "tell me a joke"
]

REAL_ESTATE_KEYWORDS = [
    "suburb", "yield", "rent", "buy", "sell", "house", "unit", "property",
    "invest", "mortgage", "deposit", "stamp duty", "price", "growth",
    "school", "park", "risk", "safe", "capital gain", "capital growth", "roi", "cashflow", "market",
    "building", "approval", "development", "zone", "zoning", "clearance",
    "family", "home", "compare", "versus", "vs ", "area", "apartment",
    "townhouse", "land", "estate", "rental", "tenant", "lease",
    "auction", "listing", "agent", "neighbourhood", "neighborhood",
    "affordable", "affordability", "loan", "borrow", "lender", "interest rate",
    "cbd", "metro", "regional", "rural", "coastal", "inner city",
]

def check_off_topic(text: str) -> bool:
    """
    Enterprise Guardrail: Prevents prompt injection and off-topic conversations 
    that could lead to reputation damage or wasted API credits.
    Returns True if the prompt violates policy.
    """
    text_lower = text.lower()
    
    # 1. Check for prompt injection attempts
    for keyword in PROMPT_INJECTION_KEYWORDS:
        if keyword in text_lower:
            logger.warning(f"Guardrail triggered: Prompt injection attempt detected. Blocked: '{keyword}'")
            return True
            
    # 2. Heuristic for totally unrelated topics
    # If the text is long enough but contains ZERO real-estate related keywords, flag it.
    if len(text.split()) > 4:
        has_re_keyword = any(k in text_lower for k in REAL_ESTATE_KEYWORDS)
        # If no real estate keywords and no geographic terms (which are harder to hardcode),
        # this might be off-topic. But we don't want to false-positive on "Where should I live?"
        # So we include live, where, etc.
        expanded_keywords = REAL_ESTATE_KEYWORDS + ["live", "where", "best", "which", "state", "city", "regional"]
        has_expanded = any(k in text_lower for k in expanded_keywords)
        if not has_expanded:
            logger.warning(f"Guardrail triggered: Off-topic prompt detected.")
            return True
            
    return False
