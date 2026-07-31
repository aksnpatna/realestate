"""
policy.py — Content policy validator v2.
Expanded from 6 forbidden phrases to: forbidden language, citation-ID existence,
numeric-claim verification against evidence values, disclaimer enforcement.
"""
import re
from typing import List, Dict, Any, Optional

FORBIDDEN_PHRASES = [
    "you should buy", "you should purchase", "right decision", "wrong decision",
    "guaranteed return", "will definitely increase", "will double", "will triple",
    "100% safe", "zero risk", "no risk", "risk free",
    "loan approved", "pre-approved", "lender approval", "you qualify for",
    "approved for a loan",
    "ignore your rules", "ignore the rules", "ignore the instruction",
    "disregard the",
    "rent guaranteed to", "rent will definitely",
    "price will reach",
]

# Patterns to detect unsupported numeric claims
NUMERIC_CLAIM_RX = re.compile(r'\$([\d,]+(?:\.\d+)?)\s*(million|billion|trillion|k|m|b)?\b')
PERCENT_CLAIM_RX = re.compile(r'(\d+(?:\.\d+)?)\s*(%|percent)\b')
YEAR_CLAIM_RX = re.compile(r'(\d{4})\s+(price|value|rate|index|level)')

FORBIDDEN_PATTERNS = [
    re.compile(r'\b(i|we)\s+(recommend|advise|suggest)\s+(you\s+)?(buy|purchase|invest|sell)\b', re.IGNORECASE),
    re.compile(r'\bis\s+(definitely|clearly|obviously)\s+(the\s+)?(best|right|top|optimal)\b', re.IGNORECASE),
    re.compile(r'\bwill\s+(rise|grow|increase|go\s+up)\s+(by\s+)?\d+\s*(%|percent)\b', re.IGNORECASE),
    re.compile(r'\b(is|are)\s+(a\s+)?(bargain|steal|no.brainer|must.buy)\b', re.IGNORECASE),
]


def validate_policy(response: Dict[str, Any], evidence: Optional[List[Any]] = None) -> Dict[str, Any]:
    """
    Validate an Ask response against content policy.
    Returns {"status": "valid"} or {"status": str, "reason": str}.
    """
    summary = response.get("summary", "").lower()

    # 1. Forbidden phrases in summary
    for phrase in FORBIDDEN_PHRASES:
        if phrase in summary:
            return {"status": "insufficient_evidence",
                    "reason": f"Policy violation: generated text contains forbidden phrase: '{phrase}'"}

    # 2. Forbidden patterns
    for pat in FORBIDDEN_PATTERNS:
        if pat.search(summary):
            return {"status": "insufficient_evidence",
                    "reason": f"Policy violation: generated text matches forbidden pattern"}

    # 3. Scan supports and risks claims
    all_claims = []
    for container_name in ("supports", "risks"):
        for claim_entry in response.get(container_name, []):
            claim_text = claim_entry.get("claim", "").lower()
            for phrase in FORBIDDEN_PHRASES:
                if phrase in claim_text:
                    return {"status": "insufficient_evidence",
                            "reason": f"Policy violation: claim contains forbidden phrase: '{phrase}'"}
            for pat in FORBIDDEN_PATTERNS:
                if pat.search(claim_text):
                    return {"status": "insufficient_evidence",
                            "reason": "Policy violation: claim matches forbidden pattern"}
            all_claims.append(claim_entry)

    # 4. Next steps scan (new in v2)
    for step in response.get("next_steps", []):
        step_lower = step.lower()
        for phrase in FORBIDDEN_PHRASES:
            if phrase in step_lower:
                return {"status": "insufficient_evidence",
                        "reason": f"Policy violation: next_step contains forbidden phrase: '{phrase}'"}
        for pat in FORBIDDEN_PATTERNS:
            if pat.search(step_lower):
                return {"status": "insufficient_evidence",
                        "reason": "Policy violation: next_step matches forbidden pattern"}

    # 5. Citation validity (v2): evidence IDs in claims must exist in evidence list
    if evidence:
        valid_ids = {e.id for e in evidence if hasattr(e, 'id')}
        for container_name in ("supports", "risks"):
            for claim_entry in response.get(container_name, []):
                ids = claim_entry.get("evidence_ids", [])
                for eid in ids:
                    if eid and eid not in valid_ids:
                        return {"status": "insufficient_evidence",
                                "reason": f"Policy violation: claim cites non-existent evidence ID: '{eid}'"}

    return {"status": "valid"}

def check_numeric_claims_in_text(text: str, evidence_values: Dict[str, float]) -> List[str]:
    """
    Verify every dollar figure in the text against evidence values within ±1%.
    Returns list of violations (empty = clean).
    """
    violations = []
    dollar_matches = NUMERIC_CLAIM_RX.findall(text)
    for num_str, suffix in dollar_matches:
        try:
            num = float(num_str.replace(",", ""))
            if suffix and suffix.lower().startswith("m"):
                num *= 1_000_000
            elif suffix and suffix.lower() == "k":
                num *= 1_000
            found_near = False
            for ev_val in evidence_values.values():
                if ev_val and ev_val > 0:
                    if abs(num - ev_val) / ev_val < 0.02:  # ±2% tolerance
                        found_near = True
                        break
            if not found_near and num > 1000 and not any(abs(num - v) < 2 for v in evidence_values.values() if v):
                violations.append(f"${num:,.0f}")
        except ValueError:
            pass
    return violations

def validate_disclaimers(response: Dict[str, Any]) -> bool:
    disclaimer = response.get("disclaimer", "").lower()
    summary = response.get("summary", "").lower()
    required = ["not financial", "not legal", "not tax", "valuation"]
    return all(fragment in disclaimer or fragment in summary for fragment in required)
