from typing import Dict, Any

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
    
    for phrase in forbidden_phrases:
        if phrase in summary:
            return {
                "status": "insufficient_evidence",
                "reason": f"Policy violation: Generated summary contains forbidden phrase: '{phrase}'"
            }
    
    # Scan supports and risks claims for forbidden phrases
    for claim_container in response.get('supports', []) + response.get('risks', []):
        claim_text = claim_container.get('claim', '').lower()
        for phrase in forbidden_phrases:
            if phrase in claim_text:
                return {
                    "status": "insufficient_evidence",
                    "reason": f"Policy violation: Claim contains forbidden phrase: '{phrase}'"
                }
            
    return {"status": "valid"}
