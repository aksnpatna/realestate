"""
intent.py — Deterministic-first NL intent parser.
Phase 1 core: replaces frontend detectIntent + dead intent_classifier.py.

Pipeline: deterministic extractors → entity resolution → LLM normalizer
→ Pydantic validation → clarification policy → router.

Never invents entities. Always resolves against the DB gazetteer.
"""
import re
import json
import os
import logging
from typing import Optional, Dict, Any, Tuple, List
from sqlalchemy.orm import Session

from ask.schemas import SuburbReference

logger = logging.getLogger(__name__)

# ─── Qualitative → Threshold mapping (versioned as qualitative_map-v1) ─────────

QUALITATIVE_MAP: Dict[str, Dict[str, Any]] = {
    "good schools":       {"metric": "school_quality", "op": ">=", "value": 7},
    "top schools":         {"metric": "school_quality", "op": ">=", "value": 7},
    "high icsea":          {"metric": "avg_icsea", "op": ">=", "value": 1050},
    "high yield":          {"metric": "gross_yield", "op": ">=", "value": 4.5},
    "strong rental":       {"metric": "gross_yield", "op": ">=", "value": 4.5},
    "rental resilience":   {"metric": "vacancy_rate", "op": "<", "value": 2},
    "tight rental":        {"metric": "vacancy_rate", "op": "<", "value": 2},
    "low vacancy":         {"metric": "vacancy_rate", "op": "<", "value": 2},
    "safe":                {"metric": "safety_score", "op": ">=", "value": 7},
    "family safe":         {"metric": "safety_score", "op": ">=", "value": 7},
    "low crime":           {"metric": "safety_score", "op": ">=", "value": 7},
    "close to cbd":        {"metric": "cbd_distance_mins", "op": "<=", "value": 30},
    "close to the city":   {"metric": "cbd_distance_mins", "op": "<=", "value": 30},
    "inner":               {"metric": "cbd_distance_mins", "op": "<=", "value": 20},
    "affordable":          {"metric": "median_price", "op": "<=", "value": None},  # filled from budget
    "cheap":               {"metric": "median_price", "op": "<=", "value": None},
    "growing":             {"metric": "population_cagr", "op": ">=", "value": 3},
    "booming":             {"metric": "population_cagr", "op": ">=", "value": 5},
    "fast selling":        {"metric": "days_on_market", "op": "<", "value": 30},
    "selling fast":        {"metric": "days_on_market", "op": "<", "value": 30},
    "undersupplied":       {"metric": "vacancy_rate", "op": "<", "value": 1.5},
    "developed":           {"metric": "building_approvals_12m", "op": ">=", "value": 100},
}

# ─── Deterministic extractors ─────────────────────────────────────────────────

STATE_MAP = {
    "NSW": "NSW", "nsw": "NSW",
    "VIC": "VIC", "vic": "VIC",
    "QLD": "QLD", "qld": "QLD",
    "SA": "SA", "sa": "SA",
    "WA": "WA", "wa": "WA",
    "TAS": "TAS", "tas": "TAS",
    "NT": "NT", "nt": "NT",
    "ACT": "ACT", "act": "ACT",
    "new south wales": "NSW", "victoria": "VIC", "queensland": "QLD",
    "south australia": "SA", "western australia": "WA", "tasmania": "TAS",
    "northern territory": "NT", "australian capital territory": "ACT",
}
STATE_PATTERN = re.compile(r"\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT|New South Wales|Victoria|Queensland|South Australia|Western Australia|Tasmania|Northern Territory|Australian Capital Territory|nsw|vic|qld|sa|wa|tas|nt|act)\b")
CITY_STATE = {
    "sydney": "NSW", "melbourne": "VIC", "brisbane": "QLD",
    "adelaide": "SA", "perth": "WA", "hobart": "TAS",
    "darwin": "NT", "canberra": "ACT",
    "newcastle": "NSW", "wollongong": "NSW",
    "geelong": "VIC", "gold coast": "QLD",
    "sunshine coast": "QLD", "townsville": "QLD",
}

def extract_dollars(text: str) -> Optional[float]:
    m = re.search(r'(?:budget|under|for|of)\s*\$?\s*(\d+(?:\.\d+)?)\s*([kKmM])?(?:\s*illion)?', text)
    if m:
        num = float(m.group(1))
        s = (m.group(2) or "").lower()
        if s == "m" or (num < 1000 and "million" in text.lower()):
            num *= 1_000_000
        elif s == "k":
            num *= 1000
        if 10_000 <= num <= 30_000_000:
            return num
    m2 = re.search(r'\b([1-9]\d{4,7})\b', text)
    if m2:
        parsed = int(m2.group(1))
        if 10_000 <= parsed:
            return float(parsed)
    return None

def extract_state(text: str) -> Optional[str]:
    m = STATE_PATTERN.search(text)
    if m:
        raw = m.group(1)
        if raw.upper() in {"NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"}:
            return raw.upper()
        return STATE_MAP.get(raw.lower())
    t = text.lower()
    for name, code in STATE_MAP.items():
        if len(name) > 3 and name in t:
            return code
    # infer from city
    for city, state in CITY_STATE.items():
        if city in t:
            return state
    return None

def extract_km(text: str) -> Optional[float]:
    m = re.search(r'(\d+(?:\.\d+)?)\s*km', text.lower())
    if m:
        return float(m.group(1))
    m = re.search(r'within\s+(\d+)\s*k', text.lower())
    if m:
        return float(m.group(1))
    return None

DIRECTION_MAP = {
    "north": "north", "south": "south", "east": "east", "west": "west",
    "north-east": "north-east", "north west": "north-west",
    "south-east": "south-east", "south west": "south-west",
}
DIR_PATTERN = re.compile(
    r'\b(north-?\s*east|north-?\s*west|south-?\s*east|south-?\s*west|north|south|east|west)\b',
    re.IGNORECASE,
)

def extract_direction(text: str) -> Optional[str]:
    m = DIR_PATTERN.search(text.lower())
    if m:
        raw = m.group(1).replace(" ", "-").replace("--", "-")
        if raw.endswith("-"):
            raw = raw[:-1]
        return raw
    return None

def extract_property_type(text: str) -> str:
    if re.search(r'\bunit|apartment|flat|strata|townhouse\b', text.lower()):
        return "unit"
    return "house"

def extract_tenure(text: str) -> str:
    if re.search(r'\binvest|investor|yield|cashflow|rental\s+income|passive|portfolio\b',
                 text.lower()):
        return "investor"
    if re.search(r'\bdevelop|subdivide|build|construction|developer\b', text.lower()):
        return "developer"
    if re.search(r'\bfirst\s+home|first\s+time|first\s+home\s+buyer|fhb|owner.occup\b',
                 text.lower()):
        return "owner_occupier"
    return "undecided"

def extract_priorities(text: str) -> List[str]:
    priorities = []
    mapping = {
        "school": "schools", "education": "schools",
        "yield": "cashflow", "cashflow": "cashflow", "rental": "cashflow",
        "growth": "growth", "capital gain": "growth",
        "safe": "safety", "crime": "safety",
        "commute": "commute", "transit": "commute",
        "risk": "risk", "downside": "risk",
        "cafe": "amenities", "park": "amenities", "lifestyle": "amenities",
        "afford": "affordability", "cheap": "affordability",
    }
    t = text.lower()
    for k, v in mapping.items():
        if k in t and v not in priorities:
            priorities.append(v)
    return priorities or ["growth", "cashflow"]

def classify_goal_deterministic(text: str, suburbs: list, is_geo: bool) -> str:
    t = text.lower()
    if re.search(r'\bhow much deposit|what is deposit|stamp duty|negative gearing\b', t):
        if not suburbs:
            return "general_advice"
    if is_geo:
        return "suburb_discovery"
    if re.search(r'\bcompare|compar|vs\.?|versus|or\b.*\b(suburb|kenmore|indooroopilly|point cook|werribee)', t) and len(suburbs) >= 2:
        return "suburb_comparison"
    if re.search(r'\binterstate|moving (from|to|interstate)|which state\b', t) and not suburbs:
        return "interstate_discovery"
    if re.search(r'\binvest|yield|cashflow|rental income\b', t):
        if re.search(r'\bcashflow|projection|return|sensitivity\b', t):
            return "cashflow_projection"
        if not suburbs:
            return "investment_search"
    if re.search(r'\brisk|downside|what could go wrong|bearish\b', t):
        return "risks_analysis"
    if re.search(r'\bschool|education|icsea|acara\b', t):
        return "schools_analysis"
    if re.search(r'\bgrowth|long.term|potential|prospect\b', t):
        return "growth_analysis"
    if re.search(r'\bafford|serviceability|can i afford|borrow\b', t):
        return "affordability"
    if re.search(r'\bdevelop|subdivision|build|construction|approval\b', t):
        return "supply_analysis"
    if len(suburbs) >= 2:
        return "suburb_comparison"
    if suburbs:
        return "single_suburb_research"
    if re.search(r'\bgeneral|explain|guide|how does|what is\b', t):
        return "general_advice"
    return "single_suburb_research"

def detect_geo_intent(text: str) -> bool:
    patterns = [
        r'\b(north|south|east|west|north-?east|north-?west|south-?east|south-?west)\s+of\b',
        r'within\s+\d+\s*km\b', r'\d+\s*km\s+(from|north|south|east|west)\b',
        r'\b(near|around|close to)\s+(sydney|melbourne|brisbane|adelaide|perth)',
        r'\bregional\b.*(yield|school|growth|safe)', r'\b(best|highest|lowest|top)\s+(school|yield|return|transit)', r'suburb.*\b(with|having|that have)\s+(high|good|great)', r'\bwhich suburb|find (me )?(a )?suburb', r'\bfind (me )?(a |an )?(area|neighbourhood|neighborhood|location)',
        r'\brecommend (a |an |some |me )?(area|suburb)',
    ]
    return any(re.search(p, text.lower()) for p in patterns)

def extract_qualitative_thresholds(text: str, budget: Optional[float] = None) -> List[Dict[str, Any]]:
    thresholds = []
    t = text.lower()
    for phrase, mapping in QUALITATIVE_MAP.items():
        if phrase in t:
            entry = dict(mapping)
            if entry["value"] is None and budget is not None and phrase in ("affordable", "cheap"):
                entry["value"] = budget
            if entry["value"] is not None:
                thresholds.append(entry)
    return thresholds

def parse_intent_deterministic(
    text: str, resolved_suburbs: list, state_hint: Optional[str] = None
) -> Dict[str, Any]:
    """Deterministic extraction — fast, zero-cost, always available."""
    state = extract_state(text) or state_hint
    is_geo = detect_geo_intent(text) and not resolved_suburbs
    budget = extract_dollars(text)
    direction = extract_direction(text)
    km = extract_km(text)
    property_type = extract_property_type(text)
    tenure = extract_tenure(text)
    priorities = extract_priorities(text)
    thresholds = extract_qualitative_thresholds(text, budget)
    goal = classify_goal_deterministic(text, resolved_suburbs, is_geo)

    suburbs_out = []
    for r in resolved_suburbs:
        suburbs_out.append({
            "name": r.get("name", ""),
            "state": r.get("state", state or ""),
            "postcode": r.get("postcode"),
        })

    result = {
        "question": text,
        "goal": goal,
        "suburbs": suburbs_out,
        "geo": {
            "direction": direction,
            "radius_km": km,
            "anchor_value": state or "",
            "anchor_type": "state" if state else "city",
        } if (direction or km or is_geo) else None,
        "thresholds": thresholds,
        "property_type": property_type,
        "tenure": tenure,
        "budget": budget,
        "priorities": priorities,
        "confidence": 0.85 if resolved_suburbs else 0.60,
        "is_geo_discovery": is_geo,
        "state": state,
    }
    return result


async def parse_intent_llm(query: str, deterministic_hints: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """LLM normaliser — small-model call, JSON-schema constrained, seeded with hints."""
    import openai

    system = """You normalise real-estate natural-language questions into JSON.
Use the provided deterministic hints; correct only obvious errors.
Return valid JSON only. Do not invent suburbs, states or numbers not present in the query.
Valid goals: single_suburb_research, suburb_comparison, suburb_discovery,
  investment_search, investment_cashflow, cashflow_projection, risks_analysis,
  schools_analysis, growth_analysis, supply_analysis, affordability,
  interstate_discovery, general_advice.
If the query is NOT real-estate-related, set goal=out_of_scope.
Output: {"question":"…","goal":"…","suburbs":[{"name":"…","state":"…"}],
"property_type":"house|unit|any","tenure":"owner_occupier|investor|developer|undecided",
"budget":null,"deposit":null,"annual_income":null,"priorities":[],"confidence":0.9}"""

    providers = [
        ("Groq", os.getenv("GROQ_API_KEY")),
        ("NVIDIA", os.getenv("NVIDIA_API_KEY")),
        ("DeepSeek", os.getenv("DEEPSEEK_API_KEY")),
        ("OpenAI", os.getenv("OPENAI_API_KEY")),
    ]

    prompt = f"Hints from deterministic parser: {json.dumps(deterministic_hints)}\n\nUser query: {query}"

    for name, key in providers:
        if not key or key == "sk-mock":
            continue
        try:
            base = None
            model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            if name == "Groq":
                base = "https://api.groq.com/openai/v1"
            elif name == "NVIDIA":
                base = "https://integrate.api.nvidia.com/v1"
                model = "meta/llama-3.1-70b-instruct"
            elif name == "DeepSeek":
                base = "https://api.deepseek.com/v1"
                model = "deepseek-chat"
            else:
                model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

            client = openai.AsyncClient(api_key=key, base_url=base)
            resp = await client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system},
                          {"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=300,
                timeout=5.0,
            )
            raw = resp.choices[0].message.content
            parsed = json.loads(raw)
            if resp.usage:
                logger.info(f"Intent LLM: {name} tokens={resp.usage.total_tokens}")
            return parsed
        except Exception:
            logger.warning(f"Intent LLM: {name} failed", exc_info=False)
            continue
    return None


async def run_intent_pipeline(
    db: Session, question: str, state_hint: Optional[str] = None
) -> Dict[str, Any]:
    """Full pipeline: deterministic → entity resolution → LLM normaliser → validated."""
    from ask.entities import resolve_suburbs

    resolved, ambiguous, clarify_msg = resolve_suburbs(db, question, state_hint)
    state_from_entities = resolved[0]["state"] if resolved else state_hint

    det = parse_intent_deterministic(question, resolved, state_from_entities)

    if ambiguous and len(resolved) >= 2:
        det["needs_clarification"] = True
        det["clarification"] = {"needed": True, "questions": [clarify_msg or f"Which suburb? {', '.join(r['name'] + ' ' + r['state'] for r in resolved)}"],
                                "options": [{"name": r["name"], "state": r["state"]} for r in resolved]}
        det["confidence"] = 0.3
        return det

    det["needs_clarification"] = False
    det["clarification"] = {"needed": False, "questions": [], "options": []}

    if not resolved and not det.get("is_geo_discovery") and det["goal"] not in ("general_advice",):
        llm = await parse_intent_llm(question, det)
        if llm:
            llm["confidence"] = llm.get("confidence", 0.7)
            llm["needs_clarification"] = llm.get("needs_clarification", False)
            llm["clarification"] = llm.get("clarification", {"needed": False, "questions": [], "options": []})
            llm["geo"] = det.get("geo")
            llm["thresholds"] = det.get("thresholds", [])
            llm["property_type"] = llm.get("property_type") or det.get("property_type", "any")
            llm["tenure"] = llm.get("tenure") or det.get("tenure", "undecided")
            llm["priorities"] = llm.get("priorities") or det.get("priorities", [])
            return llm
        if not det.get("suburbs"):
            det["needs_clarification"] = True
            det["clarification"] = {
                "needed": True,
                "questions": ["Which suburb(s) are you researching? Include a name and state or postcode."],
                "options": [],
            }

    return det
