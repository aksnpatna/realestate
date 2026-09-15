"""
fast_sync_edges.py — Chunked edge sync per edge type.
Strategy: iterate over suburbs in Python chunks of 500, run a small spatial
JOIN per chunk using GEOGRAPHY types for accurate Australia-wide matching.
All results accumulated, then loaded to Neo4j in bulk.
"""
import logging, sys, decimal
from sqlalchemy import text
from graph.neo4j_client import neo4j_client
from models_v3 import SessionLocal

logging.basicConfig(level=logging.INFO, stream=sys.stdout, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

def dict_to_float(d):
    for k, v in d.items():
        if isinstance(v, decimal.Decimal): d[k] = float(v)
        if k in ('osm_id', 'feature_osm_id') and v is not None: d[k] = int(v)
    return d

def escape_id(s): return s.replace("'", "''")

db = SessionLocal()

# Get all suburb IDs + coordinates once
logger.info("Fetching suburb list...")
suburbs = db.execute(text(
    "SELECT id, (coordinates->>0)::float AS lat, (coordinates->>1)::float AS lon "
    "FROM suburbs_ui_v3 WHERE coordinates IS NOT NULL"
)).fetchall()
logger.info(f"  {len(suburbs)} suburbs to process")

CHUNK = 500

def run_chunked_sync(log_name, join_condition, extra_cols, cypher_merge, neo4j_match_label, radius_m):
    logger.info(f"[{log_name}] Starting chunked sync (radius={radius_m}m)...")
    all_edges = []
    
    for i in range(0, len(suburbs), CHUNK):
        chunk = suburbs[i:i+CHUNK]
        values = ",".join(f"('{escape_id(s[0])}', {s[1]}, {s[2]})" for s in chunk)
        
        sql = f"""
            WITH suburb_pts(suburb_id, lat, lon) AS (VALUES {values})
            SELECT sp.suburb_id,
                   p.osm_id AS feature_osm_id,
                   {extra_cols},
                   ROUND(ST_Distance(
                     ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                     ST_Transform(ST_Centroid(p.way), 4326)::geography
                   )::numeric) AS distance_m
            FROM suburb_pts sp
            JOIN planet_osm_polygon p
              ON {join_condition}
             AND ST_DWithin(
                   ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                   ST_Transform(ST_Centroid(p.way), 4326)::geography,
                   {radius_m}
                 )
        """
        try:
            rows = db.execute(text(sql)).fetchall()
            all_edges.extend([dict_to_float(dict(r._mapping)) for r in rows])
        except Exception as e:
            logger.error(f"[{log_name}] Chunk {i//CHUNK+1} failed: {e}")
            db.rollback()
            continue
        
        if (i // CHUNK + 1) % 5 == 0:
            logger.info(f"[{log_name}] Chunk {i//CHUNK+1}/{-(-len(suburbs)//CHUNK)} done. Edges so far: {len(all_edges)}")
    
    logger.info(f"[{log_name}] Computed {len(all_edges)} edges. Loading to Neo4j...")
    merged = 0
    batch_size = 3000
    for i in range(0, len(all_edges), batch_size):
        res = neo4j_client.query(cypher_merge, parameters={"batch": all_edges[i:i+batch_size]})
        merged += res[0]["num_created"] if res else 0
    logger.info(f"[{log_name}] Done. {merged} edges merged into Neo4j.")

def run_chunked_sync_point(log_name, join_condition, extra_cols, cypher_merge, radius_m):
    logger.info(f"[{log_name}] Starting chunked sync (radius={radius_m}m, point table)...")
    all_edges = []

    for i in range(0, len(suburbs), CHUNK):
        chunk = suburbs[i:i+CHUNK]
        values = ",".join(f"('{escape_id(s[0])}', {s[1]}, {s[2]})" for s in chunk)

        sql = f"""
            WITH suburb_pts(suburb_id, lat, lon) AS (VALUES {values})
            SELECT sp.suburb_id,
                   p.osm_id AS feature_osm_id,
                   {extra_cols},
                   ROUND(ST_Distance(
                     ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                     ST_Transform(p.way, 4326)::geography
                   )::numeric) AS distance_m
            FROM suburb_pts sp
            JOIN planet_osm_point p
              ON {join_condition}
             AND ST_DWithin(
                   ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                   ST_Transform(p.way, 4326)::geography,
                   {radius_m}
                 )
        """
        try:
            rows = db.execute(text(sql)).fetchall()
            all_edges.extend([dict_to_float(dict(r._mapping)) for r in rows])
        except Exception as e:
            logger.error(f"[{log_name}] Chunk {i//CHUNK+1} failed: {e}")
            db.rollback()
            continue

        if (i // CHUNK + 1) % 5 == 0:
            logger.info(f"[{log_name}] Chunk {i//CHUNK+1}/{-(-len(suburbs)//CHUNK)} done. Edges so far: {len(all_edges)}")

    logger.info(f"[{log_name}] Computed {len(all_edges)} edges. Loading to Neo4j...")
    merged = 0
    for i in range(0, len(all_edges), 3000):
        res = neo4j_client.query(cypher_merge, parameters={"batch": all_edges[i:i+3000]})
        merged += res[0]["num_created"] if res else 0
    logger.info(f"[{log_name}] Done. {merged} edges merged into Neo4j.")

if __name__ == '__main__':
    # ─── NEAR_BEACH ───────────────────────────────────────────────────────────────
    run_chunked_sync(
        "NEAR_BEACH",
        join_condition="p.\"natural\" = 'beach' AND ST_Perimeter(ST_Transform(p.way, 3112)) > 200",
        extra_cols="'beach' AS type_prop",
        cypher_merge="""
            UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:Beach {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_BEACH]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created
        """,
        neo4j_match_label="Beach",
        radius_m=3000,
    )

    # ─── NEAR_GREENSPACE ──────────────────────────────────────────────────────────
    run_chunked_sync(
        "NEAR_GREENSPACE",
        join_condition="""
            (p.leisure IN ('park','nature_reserve') OR p.landuse IN ('forest','recreation_ground','wood') OR p.boundary = 'national_park')
            AND p.name IS NOT NULL AND ST_Area(ST_Transform(p.way, 3112)) > 10000
        """,
        extra_cols="""
            CASE WHEN p.boundary='national_park' OR p.leisure='nature_reserve' THEN 'national_park'
                 WHEN p.landuse IN ('forest','wood') THEN 'forest' ELSE 'park' END AS type_prop
        """,
        cypher_merge="""
            UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:GreenSpace {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_GREENSPACE]->(f)
            SET r.distance_m = row.distance_m, r.space_type = row.type_prop
            RETURN count(r) AS num_created
        """,
        neo4j_match_label="GreenSpace",
        radius_m=3000,
    )

    # ─── HAS_TRANSIT ─────────────────────────────────────────────────────────────
    run_chunked_sync_point(
        "HAS_TRANSIT",
        join_condition="p.railway = 'station' AND p.name IS NOT NULL",
        extra_cols="'Unknown' AS type_prop",
        cypher_merge="""
            UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:TrainStation {osm_id: row.feature_osm_id})
            MERGE (s)-[r:HAS_TRANSIT]->(f)
            SET r.distance_m = row.distance_m, r.network = row.type_prop
            RETURN count(r) AS num_created
        """,
        radius_m=2000,
    )

    # ─── NEAR_HOSPITAL ────────────────────────────────────────────────────────────
    run_chunked_sync(
        "NEAR_HOSPITAL",
        join_condition="p.amenity = 'hospital' AND p.name IS NOT NULL",
        extra_cols="'general' AS type_prop",
        cypher_merge="""
            UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:Hospital {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_HOSPITAL]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created
        """,
        neo4j_match_label="Hospital",
        radius_m=10000,
    )

    # ─── NEAR_WATER ───────────────────────────────────────────────────────────────
    run_chunked_sync(
        "NEAR_WATER",
        join_condition="""
            (p.\"natural\" = 'water' OR p.waterway IN ('river','stream','canal'))
            AND p.name IS NOT NULL AND ST_Area(ST_Transform(p.way, 3112)) > 100000
        """,
        extra_cols="CASE WHEN p.waterway IN ('river','stream','canal') THEN p.waterway ELSE 'lake' END AS type_prop",
        cypher_merge="""
            UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:WaterBody {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_WATER]->(f)
            SET r.distance_m = row.distance_m, r.water_type = row.type_prop
            RETURN count(r) AS num_created
        """,
        neo4j_match_label="WaterBody",
        radius_m=5000,
    )

    logger.info("All done!")
    db.close()
