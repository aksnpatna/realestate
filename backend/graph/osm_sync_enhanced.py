"""
osm_sync_enhanced.py — Extended OSM sync adding Cafe, Restaurant, Shop,
University, PoliceStation, FireStation, BusStop, TramStop nodes + edges.

Run after the base osm_sync.py to add additional node types for richer
scenario coverage (cafes, shopping, education, safety, transit).
"""
import logging, sys, decimal
from sqlalchemy import text
from graph.neo4j_client import neo4j_client
from models_v3 import SessionLocal

logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

db = SessionLocal()


def dict_to_float(d):
    for k, v in d.items():
        if isinstance(v, decimal.Decimal):
            d[k] = float(v)
        if k in ('osm_id', 'feature_osm_id') and v is not None:
            d[k] = int(v)
    return d


def escape_id(s):
    return s.replace("'", "''")


# ─── Node Sync ──────────────────────────────────────────────────────────────

def sync_enhanced_nodes():
    logger.info("=== Syncing enhanced OSM nodes ===")

    def sync_nodes(sql, cypher, label):
        rows = [dict_to_float(dict(r._mapping)) for r in db.execute(text(sql)).fetchall()]
        logger.info(f"  {label}: {len(rows)} nodes")
        for i in range(0, len(rows), 5000):
            batch = rows[i:i + 5000]
            if batch:
                neo4j_client.query(cypher, parameters={"batch": batch})

    # 1. Cafe
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Cafe ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE amenity = 'cafe'""",
        """UNWIND $batch AS row
           MERGE (n:Cafe {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "Cafe")

    # 2. Restaurant (includes fast_food)
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Restaurant ' || osm_id::text) AS name,
                  amenity AS cuisine,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE amenity IN ('restaurant', 'fast_food', 'pub', 'bar')""",
        """UNWIND $batch AS row
           MERGE (n:Restaurant {osm_id: row.osm_id})
           SET n.name = row.name, n.cuisine = row.cuisine,
               n.lat = row.lat, n.lon = row.lon""",
        "Restaurant")

    # 3. Shop (supermarket, mall, department_store, convenience)
    sync_nodes(
        """SELECT osm_id, COALESCE(name, shop || ' ' || osm_id::text) AS name,
                  shop AS shop_type,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE shop IN ('supermarket', 'mall', 'department_store', 'convenience',
                          'clothes', 'bakery', 'butcher', 'greengrocer',
                          'alcohol', 'chemist', 'pharmacy')""",
        """UNWIND $batch AS row
           MERGE (n:Shop {osm_id: row.osm_id})
           SET n.name = row.name, n.shop_type = row.shop_type,
               n.lat = row.lat, n.lon = row.lon""",
        "Shop")

    # 4. University / College
    sync_nodes(
        """SELECT osm_id, COALESCE(name, amenity || ' ' || osm_id::text) AS name,
                  amenity AS inst_type,
                  ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
                  ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon
           FROM planet_osm_polygon
           WHERE amenity IN ('university', 'college') AND name IS NOT NULL""",
        """UNWIND $batch AS row
           MERGE (n:University {osm_id: row.osm_id})
           SET n.name = row.name, n.inst_type = row.inst_type,
               n.lat = row.lat, n.lon = row.lon""",
        "University")

    # 5. Police Station
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Police ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
                  ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon
           FROM planet_osm_polygon
           WHERE amenity = 'police' AND name IS NOT NULL""",
        """UNWIND $batch AS row
           MERGE (n:PoliceStation {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "PoliceStation")

    # Also police from points
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Police ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE amenity = 'police' AND name IS NOT NULL""",
        """UNWIND $batch AS row
           MERGE (n:PoliceStation {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "PoliceStation (points)")

    # 6. Fire Station
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Fire Station ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
                  ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon
           FROM planet_osm_polygon
           WHERE amenity = 'fire_station' AND name IS NOT NULL""",
        """UNWIND $batch AS row
           MERGE (n:FireStation {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "FireStation")

    # 7. Bus Stop
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Bus Stop ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE highway = 'bus_stop'""",
        """UNWIND $batch AS row
           MERGE (n:BusStop {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "BusStop")

    # 8. Tram Stop
    sync_nodes(
        """SELECT osm_id, COALESCE(name, 'Tram Stop ' || osm_id::text) AS name,
                  ST_Y(ST_Transform(way, 4326)) AS lat,
                  ST_X(ST_Transform(way, 4326)) AS lon
           FROM planet_osm_point
           WHERE railway = 'tram_stop'""",
        """UNWIND $batch AS row
           MERGE (n:TramStop {osm_id: row.osm_id})
           SET n.name = row.name, n.lat = row.lat, n.lon = row.lon""",
        "TramStop")

    logger.info("=== Enhanced node sync complete ===")


# ─── Edge Sync (chunked) ────────────────────────────────────────────────────

CHUNK = 500

suburbs = None


def get_suburbs():
    global suburbs
    if suburbs is None:
        logger.info("Fetching suburb list...")
        suburbs = db.execute(text(
            "SELECT id, (coordinates->>0)::float AS lat, "
            "(coordinates->>1)::float AS lon "
            "FROM suburbs_ui_v3 WHERE coordinates IS NOT NULL"
        )).fetchall()
        logger.info(f"  {len(suburbs)} suburbs loaded")
    return suburbs


def run_edge_sync(label, join_condition, extra_cols, cypher_merge, radius_m,
                  table="planet_osm_polygon"):
    """Chunked spatial edge sync for polygon or point tables."""
    subs = get_suburbs()
    all_edges = []

    centroid_expr = ("ST_Transform(ST_Centroid(p.way), 4326)::geography"
                     if table == "planet_osm_polygon"
                     else "ST_Transform(p.way, 4326)::geography")

    logger.info(f"[{label}] Starting (radius={radius_m}m)...")

    for i in range(0, len(subs), CHUNK):
        chunk = subs[i:i + CHUNK]
        values = ",".join(
            f"('{escape_id(s[0])}', {s[1]}, {s[2]})" for s in chunk)

        sql = f"""
            WITH suburb_pts(suburb_id, lat, lon) AS (VALUES {values})
            SELECT sp.suburb_id, p.osm_id AS feature_osm_id,
                   {extra_cols},
                   ROUND(ST_Distance(
                     ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                     {centroid_expr}
                   )::numeric) AS distance_m
            FROM suburb_pts sp
            JOIN {table} p ON {join_condition}
             AND ST_DWithin(
                   ST_SetSRID(ST_MakePoint(sp.lon, sp.lat), 4326)::geography,
                   {centroid_expr}, {radius_m})
        """
        try:
            rows = db.execute(text(sql)).fetchall()
            all_edges.extend([dict_to_float(dict(r._mapping)) for r in rows])
        except Exception as e:
            logger.error(f"[{label}] Chunk {i // CHUNK + 1} failed: {e}")
            db.rollback()
            continue

        if (i // CHUNK + 1) % 10 == 0:
            logger.info(f"[{label}] {i // CHUNK + 1}/"
                        f"{-(-len(subs) // CHUNK)} done. Edges: {len(all_edges)}")

    logger.info(f"[{label}] Computed {len(all_edges)} edges. Loading to Neo4j...")
    merged = 0
    for i in range(0, len(all_edges), 3000):
        res = neo4j_client.query(cypher_merge,
                                 parameters={"batch": all_edges[i:i + 3000]})
        merged += res[0]["num_created"] if res else 0
    logger.info(f"[{label}] Done. {merged} edges merged.")


def sync_enhanced_edges():
    logger.info("=== Syncing enhanced OSM edges ===")

    # 1. NEAR_CAFE (1km)
    run_edge_sync(
        "NEAR_CAFE",
        join_condition="p.amenity = 'cafe'",
        extra_cols="'cafe' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}), (f:Cafe {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_CAFE]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=1000, table="planet_osm_point")

    # 2. NEAR_RESTAURANT (1km)
    run_edge_sync(
        "NEAR_RESTAURANT",
        join_condition="p.amenity IN ('restaurant', 'fast_food', 'pub', 'bar')",
        extra_cols="p.amenity AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:Restaurant {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_RESTAURANT]->(f)
            SET r.distance_m = row.distance_m, r.cuisine = row.type_prop
            RETURN count(r) AS num_created""",
        radius_m=1000, table="planet_osm_point")

    # 3. NEAR_SHOP (2km)
    run_edge_sync(
        "NEAR_SHOP",
        join_condition="""p.shop IN ('supermarket', 'mall', 'department_store',
            'convenience', 'clothes', 'bakery', 'butcher', 'greengrocer',
            'alcohol', 'chemist')""",
        extra_cols="p.shop AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:Shop {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_SHOP]->(f)
            SET r.distance_m = row.distance_m, r.shop_type = row.type_prop
            RETURN count(r) AS num_created""",
        radius_m=2000, table="planet_osm_point")

    # 4. NEAR_UNIVERSITY (5km)
    run_edge_sync(
        "NEAR_UNIVERSITY",
        join_condition="p.amenity IN ('university', 'college') AND p.name IS NOT NULL",
        extra_cols="p.amenity AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:University {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_UNIVERSITY]->(f)
            SET r.distance_m = row.distance_m, r.inst_type = row.type_prop
            RETURN count(r) AS num_created""",
        radius_m=5000)

    # 5. NEAR_POLICE (5km) - from polygons
    run_edge_sync(
        "NEAR_POLICE",
        join_condition="p.amenity = 'police' AND p.name IS NOT NULL",
        extra_cols="'police' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:PoliceStation {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_POLICE]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=5000)

    # 5b. NEAR_POLICE (5km) - from points
    run_edge_sync(
        "NEAR_POLICE (points)",
        join_condition="p.amenity = 'police' AND p.name IS NOT NULL",
        extra_cols="'police' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:PoliceStation {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_POLICE]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=5000, table="planet_osm_point")

    # 6. NEAR_FIRE (5km)
    run_edge_sync(
        "NEAR_FIRE",
        join_condition="p.amenity = 'fire_station' AND p.name IS NOT NULL",
        extra_cols="'fire' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:FireStation {osm_id: row.feature_osm_id})
            MERGE (s)-[r:NEAR_FIRE]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=5000)

    # 7. HAS_BUS_STOP (500m)
    run_edge_sync(
        "HAS_BUS_STOP",
        join_condition="p.highway = 'bus_stop'",
        extra_cols="'bus' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:BusStop {osm_id: row.feature_osm_id})
            MERGE (s)-[r:HAS_BUS_STOP]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=500, table="planet_osm_point")

    # 8. HAS_TRAM_STOP (500m)
    run_edge_sync(
        "HAS_TRAM_STOP",
        join_condition="p.railway = 'tram_stop'",
        extra_cols="'tram' AS type_prop",
        cypher_merge="""UNWIND $batch AS row
            MATCH (s:Suburb {id: row.suburb_id}),
                  (f:TramStop {osm_id: row.feature_osm_id})
            MERGE (s)-[r:HAS_TRAM_STOP]->(f)
            SET r.distance_m = row.distance_m
            RETURN count(r) AS num_created""",
        radius_m=500, table="planet_osm_point")

    logger.info("=== Enhanced edge sync complete ===")


def run_enhanced_sync():
    try:
        sync_enhanced_nodes()
        sync_enhanced_edges()
        logger.info("=== Enhanced OSM Graph Sync Complete! ===")
    except Exception as e:
        logger.error(f"Failed enhanced sync: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    run_enhanced_sync()
