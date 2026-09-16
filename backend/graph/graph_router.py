from typing import List, Dict, Any

# Spatial and proximity keywords that suggest a graph traversal is best
SPATIAL_KEYWORDS = [
    "near", "close to", "walking distance", "next to", "by the", 
    "lake", "river", "water", "waterfront", "waterway",
    "ocean", "beach", "beachside", "coastal", "seaside", "surf",
    "station", "train", "transit", "rail", "metro",
    "park", "national park", "nature reserve", "greenspace", "forest", "bush", "bushland",
    "hospital", "medical", "health",
    "cafe", "café", "restaurant", "dining", "food", "pub", "bar",
    "shopping", "retail", "mall", "supermarket", "grocery", "shop",
    "university", "college", "uni", "campus",
    "bus stop", "tram stop", "bus", "tram",
    "police", "fire station"
]

# Priorities that the Neo4j graph pipeline CANNOT handle
# (cafes, restaurants, shopping now supported via osm_sync_enhanced.py)
# (schools now have full ACARA data via school_sync.py)
# (safety still unsupported - no crime statistics in graph, only police stations)
GRAPH_INCOMPATIBLE_PRIORITIES = [
    "demographics", "family-friendly", "safety"
]

def should_route_to_graph(query: str, intent: Dict[str, Any]) -> bool:
    """
    Decides whether an incoming query should be routed to Neo4j (True) 
    or remain in the standard Postgres metric pipeline (False).
    """
    query_lower = query.lower()
    
    # 1. Check if query contains any incompatible priorities that graph can't handle
    priorities = intent.get("priorities", [])
    for p in GRAPH_INCOMPATIBLE_PRIORITIES:
        if p in priorities:
            return False
            
    # 2. Check if query explicitly mentions incompatible topics (even if not in priorities)
    incompatible_topics = [
        "demographic", "demographics",
        "family-friendly", "family friendly",
        "safe", "safety", "crime", "security"
    ]
    for topic in incompatible_topics:
        if topic in query_lower:
            return False
            
    # 3. Explicit spatial signals in the natural language
    for kw in SPATIAL_KEYWORDS:
        if kw in query_lower:
            return True
            
    # 4. Specific intent goals that are inherently discovery-focused
    goal = intent.get("goal")
    
    # If they are searching for an investment but didn't specify a suburb,
    # and they care about transit/parks (which are spatial), use graph.
    suburbs = intent.get("suburbs", [])
    
    if goal in ("investment_search", "suburb_discovery") and not suburbs:
        if "transit" in priorities or "parks" in priorities:
            return True
            
    # 5. Development potential queries
    dev_types = ["duplex", "subdivision", "townhouse", "develop"]
    for dt in dev_types:
        if dt in query_lower:
            return True
            
    # Default to standard Postgres pipeline
    return False
