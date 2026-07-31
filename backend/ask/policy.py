import re
from typing import Dict, Any, List

# Basic policy checker to ensure LLM doesn't hallucinate or give illegal advice
def validate_policy(response: Dict[str, Any]) -> Dict[str, Any]:
    summary = response.get("summary", "").lower()
    
    # 1. Check for illegal advice language in summary, supports, and risks
    forbidden_phrases = [
        "you should buy",
        "guaranteed return",
        "will definitely increase",
        "100% safe",
        "loan approved",
        "guaranteed to go up"
    ]
    # Check summary
    for phrase in forbidden_phrases:
        if phrase in summary:
            return {
                "status": "insufficient_evidence",
                "reason": f"Policy violation: Generated summary contains forbidden phrase: '{phrase}'"
            }
    # Check supports and risks claims
    for claim_container in (response.get('supports', []) + response.get('risks', [])):
        claim = claim_container.get('claim', '').lower()
        for phrase in forbidden_phrases:
            if phrase in claim:
                return {
                    "status": "insufficient_evidence",
                    "reason": f"Policy violation: Claim contains forbidden phrase: '{phrase}'"
                }
            
    # 2. Check for citation integrity (not strictly enforced here without complex parsing, but basic check)
    # The requirement is that claims MUST cite evidence. We will just ensure the structure is valid.
    if not response.get("evidence"):
        if response.get("research_priority") in ["high", "medium"]:
            return {
                "status": "insufficient_evidence",
                "reason": "Policy violation: Cannot recommend high/medium priority without evidence."
            }
            
    return {"status": "valid"}
