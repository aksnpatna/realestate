import logging
from typing import Dict, Any, List
from graph.neo4j_client import neo4j_client

logger = logging.getLogger(__name__)

# Keyword → (match_clause, label, rel_var, node_var, joined_key, return_label, return_dist)
NODE_REGISTRY = {
    "water":      ("MATCH (s)-[rw:NEAR_WATER]->(w:WaterBody)", "water", "rw", "w"),
    "beach":      ("MATCH (s)-[rb:NEAR_BEACH]->(b:Beach)", "beach", "rb", "b"),
    "greenspace": ("MATCH (s)-[rg:NEAR_GREENSPACE]->(g:GreenSpace)", "greenspace", "rg", "g"),
    "transit":    ("MATCH (s)-[rt:HAS_TRANSIT]->(st:TrainStation)", "transit", "rt", "st"),
    "hospital":   ("MATCH (s)-[rh:NEAR_HOSPITAL]->(h:Hospital)", "hospital", "rh", "h"),
    "cafe":       ("MATCH (s)-[rc:NEAR_CAFE]->(c:Cafe)", "cafe", "rc", "c"),
    "restaurant": ("MATCH (s)-[rr:NEAR_RESTAURANT]->(r:Restaurant)", "restaurant", "rr", "r"),
    "shop":       ("MATCH (s)-[rs:NEAR_SHOP]->(sh:Shop)", "shop", "rs", "sh"),
    "university": ("MATCH (s)-[ru:NEAR_UNIVERSITY]->(u:University)", "university", "ru", "u"),
    "police":     ("MATCH (s)-[rp:NEAR_POLICE]->(p:PoliceStation)", "police", "rp", "p"),
    "fire":       ("MATCH (s)-[rf:NEAR_FIRE]->(f:FireStation)", "fire", "rf", "f"),
    "bus":        ("MATCH (s)-[rbu:HAS_BUS_STOP]->(bu:BusStop)", "bus", "rbu", "bu"),
    "tram":       ("MATCH (s)-[rtr:HAS_TRAM_STOP]->(tr:TramStop)", "tram", "rtr", "tr"),
}

# Keyword triggers for each node type
KEYWORD_TRIGGERS = {
    "water":      ["lake", "river", "water", "waterfront", "waterway", "canal", "creek"],
    "beach":      ["ocean", "beach", "beachside", "coastal", "seaside", "surf"],
    "greenspace": ["park", "national park", "nature reserve", "greenspace", "forest", "bush", "bushland"],
    "transit":    ["station", "train", "transit", "rail", "metro", "walking distance", "commut"],
    "hospital":   ["hospital", "medical", "health"],
    "cafe":       ["cafe", "café", "coffee"],
    "restaurant": ["restaurant", "dining", "food", "pub", "bar", "fast food", "eat"],
    "shop":       ["shopping", "retail", "mall", "supermarket", "grocery", "shop", "store"],
    "university": ["university", "college", "uni", "tafe", "campus"],
    "police":     ["police", "law enforcement"],
    "fire":       ["fire station", "fire brigade", "firefighter"],
    "bus":        ["bus stop", "bus route", "bus"],
    "tram":       ["tram stop", "tram", "light rail"],
}

NEGATIVE_MAP = {
    "beach":      ["beach", "ocean", "surf", "coast"],
    "transit":    ["train", "transit", "station", "rail"],
    "hospital":   ["hospital", "medical"],
    "water":      ["water", "lake", "river"],
    "greenspace": ["park", "greenspace", "forest", "bush"],
}

RETURN_LABELS = {
    "water":      ("nearest_water", "dist_water"),
    "beach":      ("nearest_beach", "dist_beach"),
    "greenspace": ("nearest_greenspace", "dist_greenspace"),
    "transit":    ("nearest_station", "dist_station"),
    "hospital":   ("nearest_hospital", "dist_hospital"),
    "cafe":       ("nearest_cafe", "dist_cafe"),
    "restaurant": ("nearest_restaurant", "dist_restaurant"),
    "shop":       ("nearest_shop", "dist_shop"),
    "university": ("nearest_university", "dist_university"),
    "police":     ("nearest_police", "dist_police"),
    "fire":       ("nearest_fire", "dist_fire"),
    "bus":        ("nearest_bus", "dist_bus"),
    "tram":       ("nearest_tram", "dist_tram"),
}

WHY_LABELS = {
    "water":      "Near Water",
    "beach":      "Near Beach",
    "greenspace": "Near Park",
    "transit":    "Near Transit",
    "hospital":   "Near Hospital",
    "cafe":       "Near Cafe",
    "restaurant": "Near Restaurant",
    "shop":       "Near Shop",
    "university": "Near University",
    "police":     "Near Police",
    "fire":       "Near Fire Station",
    "bus":        "Near Bus Stop",
    "tram":       "Near Tram Stop",
}

NEGATIVE_CYPHER = {
    "beach":      "NOT EXISTS { MATCH (s)-[:NEAR_BEACH]->(:Beach) }",
    "transit":    "NOT EXISTS { MATCH (s)-[:HAS_TRANSIT]->(:TrainStation) }",
    "hospital":   "NOT EXISTS { MATCH (s)-[:NEAR_HOSPITAL]->(:Hospital) }",
    "water":      "NOT EXISTS { MATCH (s)-[:NEAR_WATER]->(:WaterBody) }",
    "greenspace": "NOT EXISTS { MATCH (s)-[:NEAR_GREENSPACE]->(:GreenSpace) }",
}


def discover_suburbs_graph(query: str, intent: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes a Cypher query against Neo4j for spatial/discovery requests.
    Translates LLM intent into a dynamic Graph DB traversal.
    """
    query_lower = query.lower()

    match_clauses = ["MATCH (s:Suburb)-[:HAS_MARKET_STATE]->(m:MarketState)"]
    where_clauses = []
    joined = set()

    # ── Negative constraints ────────────────────────────────────────────────
    negatives = intent.get("negative_constraints", [])
    neg_types = set()
    for neg in negatives:
        neg_lower = neg.lower()
        for nkey, nwords in NEGATIVE_MAP.items():
            if any(k in neg_lower for k in nwords):
                neg_types.add(nkey)

    # ── Priority-based joins ────────────────────────────────────────────────
    priorities = intent.get("priorities", [])

    if "schools" in priorities or "school" in query_lower:
        if "schools" not in joined:
            match_clauses.append("MATCH (s)-[:HAS_SCHOOL]->(sch:School)")
            joined.add("schools")

    # Keyword-triggered joins for all spatial node types
    for node_key, keywords in KEYWORD_TRIGGERS.items():
        if any(k in query_lower for k in keywords) and node_key not in neg_types:
            if node_key not in joined and node_key in NODE_REGISTRY:
                clause, jk, _, _ = NODE_REGISTRY[node_key]
                match_clauses.append(clause)
                joined.add(jk)

    # ── NER Landmark Filters ────────────────────────────────────────────────
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

    # ── Negative Constraints (Exclusions) ───────────────────────────────────
    for neg in negatives:
        neg_lower = neg.lower()
        for nkey, nwords in NEGATIVE_MAP.items():
            if any(k in neg_lower for k in nwords):
                where_clauses.append(NEGATIVE_CYPHER[nkey])

    # ── Metric Filters ──────────────────────────────────────────────────────
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
            where_clauses.append(f"sch.icsea {op} {val}")
        elif metric == "yield_pct":
            where_clauses.append(f"m.yield {op} {val}")
        elif metric == "vacancy_rate":
            where_clauses.append(f"m.vacancy {op} {val}")
        elif metric == "population_cagr":
            where_clauses.append(f"m.population_cagr {op} {val}")

    # ── Assemble Cypher ─────────────────────────────────────────────────────
    cypher = "\n".join(match_clauses)
    if where_clauses:
        cypher += "\nWHERE " + " AND ".join(where_clauses)

    # ── Return items ────────────────────────────────────────────────────────
    return_items = [
        "s.name AS name", "s.state AS state", "s.postcode AS postcode",
        "s.id AS suburb_id",
        "m.median_price AS median_price", "m.yield AS yield",
        "m.vacancy AS vacancy", "m.population_cagr AS growth"
    ]

    if "schools" in joined:
        return_items.extend([
            "sch[0].name AS top_school_name",
            "sch[0].icsea AS school_quality"
        ])

    # Explicit return mappings per joined node type (use [0] since collected)
    RETURN_MAP = {
        "water":      ("w[0].name AS nearest_water", "rw[0].distance_m AS dist_water"),
        "beach":      ("b[0].name AS nearest_beach", "rb[0].distance_m AS dist_beach"),
        "greenspace": ("g[0].name AS nearest_greenspace", "rg[0].distance_m AS dist_greenspace"),
        "transit":    ("st[0].name AS nearest_station", "rt[0].distance_m AS dist_station"),
        "hospital":   ("h[0].name AS nearest_hospital", "rh[0].distance_m AS dist_hospital"),
        "cafe":       ("c[0].name AS nearest_cafe", "rc[0].distance_m AS dist_cafe"),
        "restaurant": ("r[0].name AS nearest_restaurant", "rr[0].distance_m AS dist_restaurant"),
        "shop":       ("sh[0].name AS nearest_shop", "rs[0].distance_m AS dist_shop"),
        "university": ("u[0].name AS nearest_university", "ru[0].distance_m AS dist_university"),
        "police":     ("p[0].name AS nearest_police", "rp[0].distance_m AS dist_police"),
        "fire":       ("f[0].name AS nearest_fire", "rf[0].distance_m AS dist_fire"),
        "bus":        ("bu[0].name AS nearest_bus", "rbu[0].distance_m AS dist_bus"),
        "tram":       ("tr[0].name AS nearest_tram", "rtr[0].distance_m AS dist_tram"),
    }

    for jk in joined:
        if jk in RETURN_MAP:
            return_items.extend(RETURN_MAP[jk])

    # ── WITH dedup clause ───────────────────────────────────────────────────
    WITH_COLLECT = {
        "water":      ("w", "rw"),
        "beach":      ("b", "rb"),
        "greenspace": ("g", "rg"),
        "transit":    ("st", "rt"),
        "hospital":   ("h", "rh"),
        "cafe":       ("c", "rc"),
        "restaurant": ("r", "rr"),
        "shop":       ("sh", "rs"),
        "university": ("u", "ru"),
        "police":     ("p", "rp"),
        "fire":       ("f", "rf"),
        "bus":        ("bu", "rbu"),
        "tram":       ("tr", "rtr"),
    }

    with_items = ["s", "m"]
    if "schools" in joined:
        with_items.append("collect(sch) AS sch")
    for jk in joined:
        if jk in WITH_COLLECT:
            nv, rv = WITH_COLLECT[jk]
            with_items.extend([f"collect({nv}) AS {nv}", f"collect({rv}) AS {rv}"])

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
                    res_dict["why_selected"].append(
                        f"Top School: {r.get('top_school_name')} "
                        f"(ICSEA {r.get('school_quality')})"
                    )

            for jk in joined:
                if jk in RETURN_LABELS and jk != "schools":
                    name_label, dist_label = RETURN_LABELS[jk]
                    name_val = r.get(name_label)
                    dist_val = r.get(dist_label)
                    if name_val:
                        res_dict["why_selected"].append(
                            f"{WHY_LABELS.get(jk, jk.title())}: {name_val} "
                            f"({dist_val}m)"
                        )

            results.append(res_dict)

        trace_log = {
            "engine": "neo4j",
            "query": cypher,
            "params": {},
            "dataset_origin": "realestate_graph (ABS, CoreLogic, OSM, ACARA)"
        }

        return {
            "guardrail": False,
            "message": None,
            "query_understood": {
                "pipeline": "neo4j_graph",
                "spatial_filters_applied": list(joined)
            },
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
