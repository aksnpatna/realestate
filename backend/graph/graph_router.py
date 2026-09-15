from typing import List, Dict, Any

# Spatial and proximity keywords that suggest a graph traversal is best
SPATIAL_KEYWORDS = [
    "near", "close to", "walking distance", "next to", "by the", 
    "lake", "river", "water", "waterfront", "waterway",
    "ocean", "beach", "beachside", "coastal", "seaside", "surf",
    "station", "train", "transit", "rail", "metro",
    "park", "national park", "nature reserve", "greenspace", "forest", "bush", "bushland",
    "hospital", "medical", "health"
]

def should_route_to_graph(query: str, intent: Dict[str, Any]) -> bool:
    """
    Decides whether an incoming query should be routed to Neo4j (True) 
    or remain in the standard Postgres metric pipeline (False).
    """
    query_lower = query.lower()
    
    # 1. Explicit spatial signals in the natural language
    for kw in SPATIAL_KEYWORDS:
        if kw in query_lower:
            return True
            
    # 2. Specific intent goals that are inherently discovery-focused
    goal = intent.get("goal")
    
    # If they are searching for an investment but didn't specify a suburb,
    # and they care about transit/parks (which are spatial), use graph.
    priorities = intent.get("priorities", [])
    suburbs = intent.get("suburbs", [])
    
    if goal in ("investment_search", "suburb_discovery") and not suburbs:
        if "transit" in priorities or "parks" in priorities:
            return True
            
    # 3. Development potential queries
    dev_types = ["duplex", "subdivision", "townhouse", "develop"]
    for dt in dev_types:
        if dt in query_lower:
            return True
            
    # Default to standard Postgres pipeline
    return False
