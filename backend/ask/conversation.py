"""
conversation.py — Multi-turn slot merging for Ask YieldSense.
When a conversation_id is provided, the prior intent's suburbs, budget, and
property_type are inherited; new values from the follow-up override them.
"""
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from models_v3 import AskBrief

FIELD_PRECEDENCE: Dict[str, str] = {
    "question": "new_only",         # always use the new question
    "goal": "new_override",          # follow-up can change goal
    "suburbs": "inherit_merge",      # merge prior + new, deduplicate
    "property_type": "new_override",
    "tenure": "inherit",            # keep prior tenure unless explicitly changed
    "budget": "inherit",            # keep prior budget
    "deposit": "inherit",
    "annual_income": "inherit",
    "monthly_debt": "inherit",
    "priorities": "new_only",
    "thresholds": "new_only",
    "geo": "new_only",
}

def get_latest_brief(db: Session, conversation_id: str, user_id: str) -> Optional[AskBrief]:
    return db.query(AskBrief).filter(
        AskBrief.conversation_id == conversation_id,
        AskBrief.user_id == user_id,
    ).order_by(AskBrief.created_at.desc()).first()

def merge_intent(prior: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    """
    Merge a prior intent (from a previous brief in the conversation) with
    the newly-parsed intent from the current question.
    Returns a merged dict suitable for AskIntentV2.
    """
    merged = dict(new)

    for field, rule in FIELD_PRECEDENCE.items():
        prior_val = prior.get(field)
        new_val = new.get(field)

        if rule == "new_only":
            continue  # already set from new
        elif rule == "new_override":
            if new_val is not None and new_val != [] and new_val != "":
                merged[field] = new_val
            elif prior_val is not None:
                merged[field] = prior_val
        elif rule == "inherit":
            if new_val is None or new_val == [] or new_val == "":
                merged[field] = prior_val
            # else keep new value
        elif rule == "inherit_merge":
            prior_list = _to_list(prior_val)
            new_list = _to_list(new_val)
            # Deduplicate by name+state
            seen = set()
            merged_list = []
            for item in prior_list + new_list:
                if isinstance(item, dict):
                    key = (item.get("name", ""), item.get("state", ""))
                    if key not in seen:
                        seen.add(key)
                        merged_list.append(item)
                elif isinstance(item, str):
                    if item not in seen:
                        seen.add(item)
                        merged_list.append(item)
            merged[field] = merged_list

    # Derive goal from the question context
    if new.get("goal") == "general_advice" and prior.get("suburbs"):
        # If the user had suburbs but then asked an advice question,
        # keep the suburbs context for the response
        pass

    # Budget: new question may mention a different budget
    new_budget = new.get("budget")
    prior_budget = prior.get("budget")
    if new_budget is None and prior_budget is not None:
        merged["budget"] = prior_budget

    return merged

def _to_list(val: Any) -> List[Any]:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    return [val]
