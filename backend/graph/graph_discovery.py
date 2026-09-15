import logging
from typing import Dict, Any, List
from graph.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

def discover_suburbs_graph(query: str, intent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a Cypher query against Neo4j for spatial/discovery requests.
    Translates LLM intent into a dynamic Graph DB traversal.
    """
    query_lower = query.lower()
    
    # 1. Base query starting at Suburb and MarketState
    match_clauses = ["MATCH (s:Suburb)-[:HAS_MARKET_STATE]->(m:MarketState)"]
    where_clauses = []
    
    # Track which nodes we've joined to avoid duplicate matches
    joined = set()
    
    negatives = intent.get("negative_constraints", [])
    neg_types = set()
    for neg in negatives:
        neg_lower = neg.lower()
        if any(k in neg_lower for k in ["beach", "ocean", "surf", "coast"]): neg_types.add("beach")
        if any(k in neg_lower for k in ["train", "transit", "station", "rail"]): neg_types.add("transit")
        if any(k in neg_lower for k in ["hospital", "medical"]): neg_types.add("hospital")
        if any(k in neg_lower for k in ["water", "lake", "river"]): neg_types.add("water")
        if any(k in neg_lower for k in ["park", "greenspace", "forest", "bush"]): neg_types.add("greenspace")
        
    # 2. Add spatial traversal based on priorities and query text
    priorities = intent.get("priorities", [])
    
    if "schools" in priorities or "school" in query_lower:
        if "schools" not in joined:
            match_clauses.append("MATCH (s)-[:HAS_SCHOOL]->(sch:School)")
            joined.add("schools")
            
    if any(k in query_lower for k in ["lake", "river", "water", "waterfront", "waterway"]) and "water" not in neg_types:
        water_type = "lake"
        if "river" in query_lower:
            water_type = "river"
        elif "canal" in query_lower:
            water_type = "canal"
        match_clauses.append(f"MATCH (s)-[rw:NEAR_WATER {{water_type: '{water_type}'}}]->(w:WaterBody)")
        joined.add("water")
        
    if any(k in query_lower for k in ["ocean", "beach", "beachside", "coastal", "seaside", "surf"]) and "beach" not in neg_types:
        match_clauses.append("MATCH (s)-[rb:NEAR_BEACH]->(b:Beach)")
        joined.add("beach")
        
    if any(k in query_lower for k in ["park", "national park", "nature reserve", "greenspace", "forest", "bush"]) and "greenspace" not in neg_types:
        space_type = "park"
        if "national park" in query_lower:
            space_type = "national_park"
        elif "forest" in query_lower or "bush" in query_lower:
            space_type = "forest"
        match_clauses.append(f"MATCH (s)-[rg:NEAR_GREENSPACE {{space_type: '{space_type}'}}]->(g:GreenSpace)")
        joined.add("greenspace")
        
    if any(k in query_lower for k in ["station", "train", "transit", "rail", "metro", "walking distance"]) and "transit" not in neg_types:
        match_clauses.append("MATCH (s)-[rt:HAS_TRANSIT]->(st:TrainStation)")
        joined.add("transit")
        
    if any(k in query_lower for k in ["hospital", "medical", "health"]) and "hospital" not in neg_types:
        if "hospital" not in joined:
            match_clauses.append("MATCH (s)-[rh:NEAR_HOSPITAL]->(h:Hospital)")
            joined.add("hospital")
        
    # 2b. Add NER Landmark Filters
    landmarks = intent.get("landmarks", [])
    for lm in landmarks:
        lm_type = lm.get("type", "").lower()
        lm_name = lm.get("name", "").replace("'", "\\'")
        if lm_type == "hospital":
            if "hospital" not in joined:
                match_clauses.append("MATCH (s)-[rh:NEAR_HOSPITAL]->(h:Hospital)")
                joined.add("hospital")
            where_clauses.append(f"h.name =~ '(?i).*{lm_name}.*'")
        elif lm_type == "school":
            if "schools" not in joined:
                match_clauses.append("MATCH (s)-[:HAS_SCHOOL]->(sch:School)")
                joined.add("schools")
            where_clauses.append(f"sch.name =~ '(?i).*{lm_name}.*'")
        elif lm_type == "park":
            if "greenspace" not in joined:
                match_clauses.append("MATCH (s)-[rg:NEAR_GREENSPACE]->(g:GreenSpace)")
                joined.add("greenspace")
            where_clauses.append(f"g.name =~ '(?i).*{lm_name}.*'")
            
    # 2c. Add Negative Constraints (Exclusions)
    negatives = intent.get("negative_constraints", [])
    for neg in negatives:
        neg_lower = neg.lower()
        if any(k in neg_lower for k in ["beach", "ocean", "surf", "coast"]):
            where_clauses.append("NOT EXISTS { MATCH (s)-[:NEAR_BEACH]->(:Beach) }")
        elif any(k in neg_lower for k in ["train", "transit", "station", "rail"]):
            where_clauses.append("NOT EXISTS { MATCH (s)-[:HAS_TRANSIT]->(:TrainStation) }")
        elif any(k in neg_lower for k in ["hospital", "medical"]):
            where_clauses.append("NOT EXISTS { MATCH (s)-[:NEAR_HOSPITAL]->(:Hospital) }")
        elif any(k in neg_lower for k in ["water", "lake", "river"]):
            where_clauses.append("NOT EXISTS { MATCH (s)-[:NEAR_WATER]->(:WaterBody) }")
        elif any(k in neg_lower for k in ["park", "greenspace", "forest", "bush"]):
            where_clauses.append("NOT EXISTS { MATCH (s)-[:NEAR_GREENSPACE]->(:GreenSpace) }")
        
    # 3. Add Metric filters from LLM thresholds and ensure residential validity
    where_clauses.append("m.median_price IS NOT NULL")
    
    state = intent.get("state")
    if state:
        where_clauses.append(f"s.state = '{state.upper()}'")
        
    budget = intent.get("budget")
    if budget:
        where_clauses.append(f"m.median_price <= {budget}")
        
    thresholds = intent.get("thresholds", [])
    for t in thresholds:
        metric = t.get("metric")
        op = t.get("op", ">=")
        val = t.get("value")
        
        if metric == "school_quality":
            if "schools" not in joined:
                match_clauses.append("MATCH (s)-[:HAS_SCHOOL]->(sch:School)")
                joined.add("schools")
            where_clauses.append(f"sch.quality {op} {val}")
        elif metric == "yield_pct":
            where_clauses.append(f"m.yield {op} {val}")
        elif metric == "vacancy_rate":
            where_clauses.append(f"m.vacancy {op} {val}")
        elif metric == "population_cagr":
            where_clauses.append(f"m.population_cagr {op} {val}")
            
    # Assemble Query
    cypher = "\n".join(match_clauses)
    if where_clauses:
        cypher += "\nWHERE " + " AND ".join(where_clauses)
        
    # 4. Return results mapped back to the Ask API format
    return_items = [
        "s.name AS name", "s.state AS state", "s.postcode AS postcode", "s.id AS suburb_id",
        "m.median_price AS median_price", "m.yield AS yield", "m.vacancy AS vacancy",
        "m.population_cagr AS growth"
    ]
    
    if "schools" in joined:
        return_items.extend(["sch.quality AS school_quality", "sch.name AS top_school_name"])
    if "water" in joined:
        return_items.extend(["w.name AS nearest_water", "rw.distance_m AS dist_water"])
    if "beach" in joined:
        return_items.extend(["b.name AS nearest_beach", "rb.distance_m AS dist_beach"])
    if "greenspace" in joined:
        return_items.extend(["g.name AS nearest_greenspace", "rg.distance_m AS dist_greenspace"])
    if "transit" in joined:
        return_items.extend(["st.name AS nearest_station", "rt.distance_m AS dist_station"])
    if "hospital" in joined:
        return_items.extend(["h.name AS nearest_hospital", "rh.distance_m AS dist_hospital"])
        
    # Add a WITH clause to deduplicate Cartesian products (e.g. multiple parks for one suburb)
    with_items = ["s", "m"]
    if "schools" in joined: with_items.append("collect(sch)[0] AS sch")
    if "water" in joined: with_items.extend(["collect(w)[0] AS w", "collect(rw)[0] AS rw"])
    if "beach" in joined: with_items.extend(["collect(b)[0] AS b", "collect(rb)[0] AS rb"])
    if "greenspace" in joined: with_items.extend(["collect(g)[0] AS g", "collect(rg)[0] AS rg"])
    if "transit" in joined: with_items.extend(["collect(st)[0] AS st", "collect(rt)[0] AS rt"])
    if "hospital" in joined: with_items.extend(["collect(h)[0] AS h", "collect(rh)[0] AS rh"])
    
    if len(with_items) > 2:
        cypher += "\nWITH " + ", ".join(with_items)

    cypher += "\nRETURN " + ", ".join(return_items)
    
    cypher += """
    ORDER BY m.yield DESC
    LIMIT 5
    """
    
    logger.info(f"Executing Cypher:\n{cypher}")
    
    try:
        records = neo4j_client.query(cypher)
        results = []
        for r in records:
            res_dict = {
                "suburb_id": r["suburb_id"],
                "name": r["name"],
                "state": r["state"],
                "postcode": r["postcode"],
                "match_score": 90.0,
                "why_selected": ["Selected via Neo4j Spatial Traversal"],
                "metrics": {
                    "median_price": r["median_price"],
                    "yield_pct": r["yield"],
                    "vacancy_rate": r["vacancy"],
                    "population_cagr": r["growth"]
                }
            }
            if "schools" in joined:
                res_dict["metrics"]["school_quality"] = r.get("school_quality")
                res_dict["metrics"]["top_school_name"] = r.get("top_school_name")
                if r.get("school_quality"):
                    res_dict["why_selected"].append(f"Top School: {r.get('top_school_name')} (Quality {r.get('school_quality')})")
            if "water" in joined:
                res_dict["why_selected"].append(f"Near Water: {r.get('nearest_water')} ({r.get('dist_water')}m)")
            if "beach" in joined:
                res_dict["why_selected"].append(f"Near Beach: {r.get('nearest_beach')} ({r.get('dist_beach')}m)")
            if "greenspace" in joined:
                res_dict["why_selected"].append(f"Near Park: {r.get('nearest_greenspace')} ({r.get('dist_greenspace')}m)")
            if "transit" in joined:
                res_dict["why_selected"].append(f"Near Transit: {r.get('nearest_station')} ({r.get('dist_station')}m)")
            if "hospital" in joined:
                res_dict["why_selected"].append(f"Near Hospital: {r.get('nearest_hospital')} ({r.get('dist_hospital')}m)")
                    
            results.append(res_dict)
            
        trace_log = {
            "engine": "neo4j",
            "query": cypher,
            "params": {},
            "dataset_origin": "realestate_graph (Knowledge Graph from ABS, CoreLogic, OSM)"
        }
            
        return {
            "guardrail": False,
            "message": None,
            "query_understood": {"pipeline": "neo4j_graph", "spatial_filters_applied": list(joined)},
            "summary": f"Found {len(results)} suburbs matching your spatial criteria using the Graph Database.",
            "results": results,
            "trace_log": trace_log
        }
    except Exception as e:
        logger.error(f"Graph traversal failed: {e}")
        return {
            "guardrail": True,
            "message": f"Graph traversal failed: {e}",
            "results": []
        }
