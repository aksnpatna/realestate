"""
geo_discovery.py — Natural Language Geo-Spatial Suburb Discovery Engine
Handles queries like:
  - "Find suburbs north of Sydney within 20km with good schools"
  - "Highest rental yield in regional TAS"
  - "Best public transport near Melbourne"
  - "50km east of Sydney" → guardrail (ocean)

STRICTLY uses only app database data. No external API calls except Groq for NL parsing.
"""
import math
import json
import re
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text

# ─── City Reference Points (CBD coordinates) ────────────────────────────────
CITY_CBD_COORDS: Dict[str, Tuple[float, float]] = {
    "sydney":         (-33.8688, 151.2093),
    "melbourne":      (-37.8136, 144.9631),
    "brisbane":       (-27.4705, 153.0260),
    "adelaide":       (-34.9285, 138.6007),
    "perth":          (-31.9505, 115.8605),
    "hobart":         (-42.8821, 147.3272),
    "darwin":         (-12.4634, 130.8456),
    "canberra":       (-35.2809, 149.1300),
    "gold coast":     (-28.0167, 153.4000),
    "sunshine coast": (-26.6500, 153.0667),
    "newcastle":      (-32.9272, 151.7789),
    "wollongong":     (-34.4278, 150.8931),
    "geelong":        (-38.1499, 144.3617),
    "townsville":     (-19.2590, 146.8169),
}

CITY_ALIASES: Dict[str, str] = {
    "sydney cbd": "sydney", "melb": "melbourne", "bris": "brisbane",
    "goldy": "gold coast", "gc": "gold coast", "the gold coast": "gold coast",
    "sunshine": "sunshine coast", "newcy": "newcastle",
}

STATE_PRIMARY_CITY: Dict[str, str] = {
    "NSW": "sydney", "VIC": "melbourne", "QLD": "brisbane",
    "SA": "adelaide", "WA": "perth", "TAS": "hobart",
    "NT": "darwin", "ACT": "canberra",
}

# ─── Ocean / Boundary Guardrails ─────────────────────────────────────────────
WATER_GUARDRAILS: Dict[str, Dict[str, Tuple[float, str]]] = {
    "sydney": {
        "east":      (8.0,  "the Pacific Ocean starts just east of Sydney's coast"),
        "north-east":(15.0, "you quickly reach the Pacific Ocean coastline"),
    },
    "melbourne": {
        "south":     (20.0, "Port Phillip Bay fills the southern approach"),
        "south-west":(10.0, "Port Phillip Bay occupies that area"),
    },
    "brisbane": {
        "east":      (35.0, "the Coral Sea / Moreton Bay opens up east of Brisbane"),
    },
    "hobart": {
        "east":      (12.0, "the Tasman Sea lies directly east of Hobart"),
        "south":     (15.0, "you reach the Southern Ocean south of Hobart"),
    },
    "perth": {
        "west":      (5.0,  "the Indian Ocean starts immediately west of Perth"),
        "south-west":(5.0,  "the Indian Ocean is directly to the west"),
    },
    "adelaide": {
        "west":      (12.0, "Gulf St Vincent (the sea) is directly west of Adelaide"),
    },
    "darwin": {
        "north":     (5.0,  "the Timor Sea is immediately north of Darwin"),
        "west":      (10.0, "the Beagle Gulf / Timor Sea is to the west"),
    },
}

# Direction → (low_bearing, high_bearing)
DIRECTION_BEARINGS: Dict[str, Tuple[float, float]] = {
    "north":      (315.0, 45.0),
    "north-east": (22.5,  90.0),
    "east":       (45.0,  135.0),
    "south-east": (90.0,  180.0),
    "south":      (135.0, 225.0),
    "south-west": (180.0, 270.0),
    "west":       (225.0, 315.0),
    "north-west": (270.0, 360.0),
}

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

def bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    dlon = math.radians(lon2 - lon1)
    lat1_r, lat2_r = math.radians(lat1), math.radians(lat2)
    x = math.sin(dlon) * math.cos(lat2_r)
    y = math.cos(lat1_r)*math.sin(lat2_r) - math.sin(lat1_r)*math.cos(lat2_r)*math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360

def is_in_direction(brg: float, direction: str, tolerance: float = 55.0) -> bool:
    if direction not in DIRECTION_BEARINGS:
        return True
    low, high = DIRECTION_BEARINGS[direction]
    if low > high:  # Wraps around north
        return brg >= low or brg <= high
    return (low - tolerance) <= brg <= (high + tolerance)

def normalise_city(text: str) -> Optional[str]:
    t = text.lower()
    for alias, canonical in CITY_ALIASES.items():
        if alias in t:
            return canonical
    for city in CITY_CBD_COORDS:
        if city in t:
            return city
    return None

def normalise_direction(text: str) -> Optional[str]:
    t = text.lower()
    patterns = [
        (r"\bnorth-?\s*east\b", "north-east"),
        (r"\bnorth-?\s*west\b", "north-west"),
        (r"\bsouth-?\s*east\b", "south-east"),
        (r"\bsouth-?\s*west\b", "south-west"),
        (r"\bnorth\b", "north"),
        (r"\bsouth\b", "south"),
        (r"\beast\b", "east"),
        (r"\bwest\b", "west"),
    ]
    for pat, result in patterns:
        if re.search(pat, t):
            return result
    return None

def extract_km(text: str) -> Optional[float]:
    for pat in [r"(\d+(?:\.\d+)?)\s*km", r"within\s+(\d+)\s*k"]:
        m = re.search(pat, text.lower())
        if m:
            return float(m.group(1))
    return None

def extract_state(text: str) -> Optional[str]:
    m = re.search(r"\b(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)\b", text, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    state_map = {
        "new south wales": "NSW", "victoria": "VIC", "queensland": "QLD",
        "south australia": "SA", "western australia": "WA", "tasmania": "TAS",
        "northern territory": "NT", "australian capital territory": "ACT",
    }
    t = text.lower()
    for name, code in state_map.items():
        if name in t:
            return code
    return None

PRIORITY_PATTERNS = {
    "yield":         [r"yield", r"rental\s+return", r"investment", r"cashflow", r"income"],
    "schools":       [r"school", r"education", r"icsea", r"academic", r"learn"],
    "transit":       [r"public\s+transport", r"train", r"bus", r"tram", r"transit", r"commut"],
    "parks":         [r"cafe", r"park", r"green", r"lifestyle", r"walk", r"amenity"],
    "growth":        [r"growth", r"appreciation", r"capital\s+gain", r"long.term"],
    "safety":        [r"safe", r"crime", r"security", r"low.crime"],
    "vacancy":       [r"rental\s+demand", r"tight\s+market", r"vacancy"],
    "affordability": [r"afford", r"cheap", r"budget", r"under\s*\$", r"low.price"],
}

def extract_priorities(text: str) -> List[str]:
    t = text.lower()
    found = []
    for key, patterns in PRIORITY_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, t):
                found.append(key)
                break
    return found or ["growth", "yield"]

def is_regional(text: str) -> bool:
    return bool(re.search(r"\bregional\b|\brural\b|\bcountry\b|\boutside\s+city\b|\bnon.metro\b", text.lower()))

def apply_geo_guardrail(city: str, direction: Optional[str], km: Optional[float]) -> Optional[str]:
    if not city or not direction:
        return None
    city_rules = WATER_GUARDRAILS.get(city.lower(), {})
    if direction in city_rules:
        max_km, hazard = city_rules[direction]
        effective_km = km or 20.0
        if effective_km >= max_km:
            dir_label = direction.replace("-", " ").title()
            return (
                f"🌊 Heads up! {effective_km:.0f}km {dir_label} of {city.title()} "
                f"is largely ocean — {hazard}. "
                f"Try a different direction, or reduce your distance to under {max_km:.0f}km."
            )
    return None

def _normalise_score(val, low, high, invert=False):
    if val is None:
        return 0.0
    span = high - low
    if span == 0:
        return 0.0
    normed = max(0.0, min(1.0, (val - low) / span))
    return (1.0 - normed) if invert else normed

def build_composite_score(row: dict, priorities: List[str]) -> float:
    field_map = {
        "yield":         ("house_gross_rental_yield", 0.0, 10.0, False),
        "schools":       ("school_quality",           0.0, 10.0, False),
        "transit":       ("transit_accessibility",    0.0, 10.0, False),
        "parks":         ("parks_count",              0.0, 50.0, False),
        "growth":        ("population_cagr",          -5.0, 20.0, False),
        "safety":        ("safety_score",             0.0, 10.0, False),
        "vacancy":       ("vacancy_rate",             0.0,  5.0, True),   # lower = better
        "affordability": ("house_median_price", 200000.0, 3000000.0, True), # lower = better
    }
    score = 0.0
    n = len(priorities)
    if n == 0:
        return 0.0
    for p in priorities:
        if p not in field_map:
            continue
        field, low, high, invert = field_map[p]
        val = row.get(field)
        score += _normalise_score(val, low, high, invert) * (100.0 / n)
    return round(score, 1)

from sqlalchemy.orm import Session
from sqlalchemy import func
import re
import math
import time
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

_GEO_CACHE = TTLLRUCache(maxsize=1000, ttl=3600)

def discover_suburbs(db: Session, question: str, budget: Optional[float] = None, limit: int = 5) -> Dict[str, Any]:
    # Check cache first
    cache_key = f"{question.strip().lower()}_{budget}"
    cached_res = _GEO_CACHE.get(cache_key)
    if cached_res is not None:
        return cached_res

    city       = normalise_city(question)
    direction  = normalise_direction(question)
    km         = extract_km(question) or (20.0 if direction else None)
    state      = extract_state(question)
    priorities = extract_priorities(question)
    regional   = is_regional(question)

    # 1. Guardrails (Missing Vector)
    if not city and not state and not regional:
        return {
            "guardrail": True,
            "message": "I couldn't detect a specific area in your query. Please provide a clear spatial vector (e.g. 'near Melbourne', 'in NSW', or 'regional TAS').",
            "results": [],
            "summary": "Missing spatial vector.",
            "query_understood": {"city": city, "direction": direction, "km": km, "priorities": priorities}
        }

    guardrail_msg = apply_geo_guardrail(city, direction, km) if city else None
    if guardrail_msg:
        return {
            "guardrail": True,
            "message": guardrail_msg,
            "results": [],
            "summary": guardrail_msg,
            "query_understood": {"city": city, "direction": direction, "km": km, "priorities": priorities}
        }

    # 2. Build SQL
    filters = []
    params: Dict[str, Any] = {}

    if state:
        filters.append("state = :state")
        params["state"] = state
    elif city:
        city_state_map = {
            "sydney": "NSW", "newcastle": "NSW", "wollongong": "NSW",
            "melbourne": "VIC", "geelong": "VIC",
            "brisbane": "QLD", "gold coast": "QLD", "sunshine coast": "QLD", "townsville": "QLD",
            "adelaide": "SA", "perth": "WA", "hobart": "TAS", "darwin": "NT", "canberra": "ACT",
        }
        inferred_state = city_state_map.get(city.lower())
        if inferred_state:
            filters.append("state = :state")
            params["state"] = inferred_state

    if regional:
        filters.append("(cbd_distance_mins IS NULL OR cbd_distance_mins > 60)")

    if budget:
        filters.append("house_median_price <= :budget")
        params["budget"] = budget

    where_clause = "WHERE coordinates IS NOT NULL AND is_live = true"
    if filters:
        where_clause += " AND " + " AND ".join(filters)

    sql = text(f"""
        SELECT id, name, state, postcode, coordinates, house_median_price,
               house_gross_rental_yield, vacancy_rate, population_cagr,
               school_quality, avg_icsea, top_school_name, transit_accessibility,
               parks_count, safety_score, cbd_distance_mins, metro_cbd,
               house_median_price_12m_change_pct
        FROM suburbs_ui_v3
        {where_clause}
        LIMIT 300
    """)

    rows = db.execute(sql, params).fetchall()
    if not rows:
        return {
            "guardrail": False,
            "message": "No suburbs found matching your criteria in our database. Try broadening your search.",
            "results": [],
            "summary": "No results found.",
            "query_understood": {"city": city, "direction": direction, "km": km, "state": state, "priorities": priorities}
        }

    # 3. Haversine + direction filter
    cbd_coords = None
    if city and city.lower() in CITY_CBD_COORDS:
        cbd_coords = CITY_CBD_COORDS[city.lower()]
    elif state and state in STATE_PRIMARY_CITY:
        primary = STATE_PRIMARY_CITY[state]
        cbd_coords = CITY_CBD_COORDS.get(primary)

    candidates = []
    for row in rows:
        rd = dict(row._mapping)
        coords = rd.get("coordinates")
        if not coords:
            continue
        if isinstance(coords, str):
            try:
                coords = json.loads(coords)
            except Exception:
                continue
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        lat, lon = float(coords[0]), float(coords[1])
        rd["_lat"], rd["_lon"] = lat, lon

        if cbd_coords:
            dist = haversine_km(cbd_coords[0], cbd_coords[1], lat, lon)
            rd["_dist_km"] = round(dist, 1)
            if km and dist > km:
                continue
            if direction:
                brg = bearing_deg(cbd_coords[0], cbd_coords[1], lat, lon)
                if not is_in_direction(brg, direction):
                    continue
        else:
            rd["_dist_km"] = None

        candidates.append(rd)

    if not candidates:
        region_desc = f"{direction} of {city.title()}" if direction and city else (state or "the specified area")
        return {
            "guardrail": False,
            "message": f"No suburbs found in our database for {region_desc}. We may not have data coverage for that exact area yet. Try expanding your km radius or checking the Buy Finder tab for broader results.",
            "results": [],
            "summary": "No results found.",
            "query_understood": {"city": city, "direction": direction, "km": km, "state": state, "priorities": priorities}
        }

    # 4. Score + rank
    for c in candidates:
        c["_score"] = build_composite_score(c, priorities)
    candidates.sort(key=lambda x: x["_score"], reverse=True)
    top = candidates[:limit]

    # 5. Format results
    def format_why(s: dict) -> List[str]:
        reasons = []
        if "yield" in priorities and s.get("house_gross_rental_yield"):
            reasons.append(f"{s['house_gross_rental_yield']:.2f}% gross rental yield")
        if "schools" in priorities and s.get("school_quality"):
            reasons.append(f"School quality: {s['school_quality']:.1f}/10")
            if s.get("top_school_name"):
                reasons.append(f"Top school: {s['top_school_name']}")
        if "transit" in priorities and s.get("transit_accessibility"):
            reasons.append(f"Transit score: {s['transit_accessibility']:.1f}/10")
        if "parks" in priorities and s.get("parks_count"):
            reasons.append(f"{s['parks_count']} parks & amenities")
        if "growth" in priorities and s.get("population_cagr"):
            reasons.append(f"{s['population_cagr']:.1f}% 5yr population growth")
        if "safety" in priorities and s.get("safety_score"):
            reasons.append(f"Safety score: {s['safety_score']:.1f}/10")
        if "vacancy" in priorities and s.get("vacancy_rate") is not None:
            reasons.append(f"{s['vacancy_rate']:.2f}% vacancy rate")
        if s.get("_dist_km"):
            reasons.append(f"{s['_dist_km']:.0f}km from {city.title() if city else 'city centre'}")
        return reasons or ["Matches your criteria based on verified data"]

    results = [{
        "suburb_id": s.get("id"),
        "name": s.get("name"),
        "state": s.get("state"),
        "postcode": s.get("postcode"),
        "match_score": s["_score"],
        "dist_km": s.get("_dist_km"),
        "why_selected": format_why(s),
        "metrics": {
            "median_price": s.get("house_median_price"),
            "yield_pct": s.get("house_gross_rental_yield"),
            "vacancy_rate": s.get("vacancy_rate"),
            "population_cagr": s.get("population_cagr"),
            "school_quality": s.get("school_quality"),
            "transit_accessibility": s.get("transit_accessibility"),
            "parks_count": s.get("parks_count"),
            "safety_score": s.get("safety_score"),
            "top_school_name": s.get("top_school_name"),
            "price_12m_change_pct": s.get("house_median_price_12m_change_pct"),
        }
    } for s in top]

    summary_city = city.title() if city else (state or "your search area")
    dir_str = f"{direction} of {summary_city}" if direction else summary_city
    km_str = f" within {km:.0f}km" if km else ""
    priority_str = ", ".join(p for p in priorities[:3])

    res = {
        "guardrail": False,
        "message": None,
        "query_understood": {
            "city": city, "direction": direction, "km": km,
            "state": state, "priorities": priorities, "regional": regional
        },
        "summary": f"Found {len(results)} suburb{'s' if len(results) != 1 else ''} {dir_str}{km_str} ranked by {priority_str}.",
        "results": results,
    }
    _GEO_CACHE.set(cache_key, res)
    return res
