import logging
from sqlalchemy import text
from graph.neo4j_client import neo4j_client
from models_v3 import SessionLocal

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

import decimal

def dict_to_float(d):
    for k, v in d.items():
        if isinstance(v, decimal.Decimal):
            d[k] = float(v)
        if k in ('osm_id', 'feature_osm_id') and v is not None:
            d[k] = int(v)
    return d

def sync_osm_nodes(db_session):
    logger.info("Starting OSM to Neo4j Node Sync...")

    def sync_nodes_batch(sql_query, cypher_query, log_name):
        nodes = [dict_to_float(dict(r._mapping)) for r in db_session.execute(sql_query).fetchall()]
        logger.info(f"Loading {len(nodes)} {log_name} nodes...")
        batch_size = 5000
        for i in range(0, len(nodes), batch_size):
            if nodes[i:i+batch_size]:
                neo4j_client.query(cypher_query, parameters={"batch": nodes[i:i+batch_size]})

    # 1. WaterBody
    sql_water = text("""
        SELECT 
          osm_id, name,
          CASE 
            WHEN waterway IN ('river','stream','canal') THEN waterway
            ELSE 'lake'
          END AS water_type,
          ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
          ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon,
          ROUND((ST_Area(ST_Transform(way, 28355)) / 1000000.0)::numeric, 3) AS area_sqkm
        FROM planet_osm_polygon
        WHERE ("natural" = 'water' OR waterway IN ('river','stream','canal'))
          AND name IS NOT NULL
          AND ST_Area(ST_Transform(way, 28355)) > 100000 -- 0.1 sqkm min
    """)
    cypher_water = """
    UNWIND $batch AS row
    MERGE (w:WaterBody {osm_id: row.osm_id})
    SET w.name = row.name, w.water_type = row.water_type,
        w.lat = row.lat, w.lon = row.lon, w.area_sqkm = row.area_sqkm
    """
    sync_nodes_batch(sql_water, cypher_water, "WaterBody")

    # 2. Beach — include unnamed beaches with a generated fallback name
    sql_beach = text("""
        SELECT 
          osm_id,
          COALESCE(name, 'Beach ' || osm_id::text) AS name,
          'beach' AS beach_type,
          ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
          ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon,
          ROUND(ST_Perimeter(ST_Transform(way, 28355))::numeric, 1) AS length_m
        FROM planet_osm_polygon
        WHERE "natural" = 'beach'
          AND ST_Perimeter(ST_Transform(way, 28355)) > 200 -- min perimeter ~50m beach
    """)
    cypher_beach = """
    UNWIND $batch AS row
    MERGE (b:Beach {osm_id: row.osm_id})
    SET b.name = row.name, b.beach_type = row.beach_type,
        b.lat = row.lat, b.lon = row.lon, b.length_m = row.length_m
    """
    sync_nodes_batch(sql_beach, cypher_beach, "Beach")

    # 3. GreenSpace
    sql_green = text("""
        SELECT 
          osm_id, name,
          CASE 
            WHEN boundary = 'national_park' OR leisure = 'nature_reserve' THEN 'national_park'
            WHEN landuse IN ('forest','wood') THEN 'forest'
            ELSE 'park'
          END AS space_type,
          ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
          ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon,
          ROUND((ST_Area(ST_Transform(way, 28355)) / 1000000.0)::numeric, 3) AS area_sqkm
        FROM planet_osm_polygon
        WHERE (leisure IN ('park','nature_reserve') OR landuse IN ('forest','recreation_ground') OR boundary = 'national_park')
          AND name IS NOT NULL
          AND ST_Area(ST_Transform(way, 28355)) > 10000 -- min 1ha
    """)
    cypher_green = """
    UNWIND $batch AS row
    MERGE (g:GreenSpace {osm_id: row.osm_id})
    SET g.name = row.name, g.space_type = row.space_type,
        g.lat = row.lat, g.lon = row.lon, g.area_sqkm = row.area_sqkm
    """
    sync_nodes_batch(sql_green, cypher_green, "GreenSpace")

    # 4. TrainStation
    sql_station = text("""
        SELECT 
          osm_id, name,
          'Unknown' AS network,
          ST_Y(ST_Transform(way, 4326)) AS lat,
          ST_X(ST_Transform(way, 4326)) AS lon
        FROM planet_osm_point
        WHERE railway = 'station' AND name IS NOT NULL
    """)
    cypher_station = """
    UNWIND $batch AS row
    MERGE (t:TrainStation {osm_id: row.osm_id})
    SET t.name = row.name, t.network = row.network,
        t.lat = row.lat, t.lon = row.lon
    """
    sync_nodes_batch(sql_station, cypher_station, "TrainStation")

    # 5. Hospital
    sql_hospital = text("""
        SELECT 
          osm_id, name,
          'general' AS hospital_type,
          ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS lat,
          ST_X(ST_Transform(ST_Centroid(way), 4326)) AS lon
        FROM planet_osm_polygon
        WHERE amenity = 'hospital' AND name IS NOT NULL
    """)
    cypher_hospital = """
    UNWIND $batch AS row
    MERGE (h:Hospital {osm_id: row.osm_id})
    SET h.name = row.name, h.hospital_type = row.hospital_type,
        h.lat = row.lat, h.lon = row.lon
    """
    sync_nodes_batch(sql_hospital, cypher_hospital, "Hospital")


def sync_osm_edges(db_session):
    logger.info("Computing and syncing spatial edges (PostGIS -> Neo4j)...")

    def sync_edges_batch(sql, cypher_edge, log_name):
        logger.info(f"Computing {log_name} edges...")
        edges = [dict_to_float(dict(r._mapping)) for r in db_session.execute(text(sql)).fetchall()]
        logger.info(f"Found {len(edges)} {log_name} edges. Loading to Neo4j...")
        batch_size = 5000
        for i in range(0, len(edges), batch_size):
            res = neo4j_client.query(cypher_edge, parameters={"batch": edges[i:i+batch_size]})
            logger.info(f"Loaded batch {i//batch_size + 1}. Result: {res}")

    # 1. NEAR_WATER (5km)
    sql_near_water = """
        SELECT s.id AS suburb_id, p.osm_id AS feature_osm_id, p.water_type AS type_prop, p.dist AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
          SELECT osm_id, 
                 CASE WHEN waterway IN ('river','stream','canal') THEN waterway ELSE 'lake' END AS water_type,
                 ROUND(ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355))::numeric) as dist
          FROM planet_osm_polygon
          WHERE ("natural" = 'water' OR waterway IN ('river','stream','canal')) AND name IS NOT NULL AND ST_Area(ST_Transform(way, 28355)) > 100000
            AND ST_DWithin(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355), 5000)
          ORDER BY ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355)) ASC LIMIT 3
        ) p
        WHERE s.coordinates IS NOT NULL
    """
    cypher_near_water = """
        UNWIND $batch AS row
        MATCH (s:Suburb {id: row.suburb_id}), (f:WaterBody {osm_id: row.feature_osm_id})
        MERGE (s)-[r:NEAR_WATER]->(f)
        SET r.distance_m = row.distance_m, r.water_type = row.type_prop
        RETURN count(r) AS num_created
    """
    sync_edges_batch(sql_near_water, cypher_near_water, "NEAR_WATER")

    # 2. NEAR_BEACH (3km)
    sql_near_beach = """
        SELECT s.id AS suburb_id, p.osm_id AS feature_osm_id, 'beach' AS type_prop, p.dist AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
          SELECT osm_id, ROUND(ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355))::numeric) as dist
          FROM planet_osm_polygon
          WHERE "natural" = 'beach' AND name IS NOT NULL AND ST_Length(ST_Transform(way, 28355)) > 100
            AND ST_DWithin(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355), 3000)
          ORDER BY ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355)) ASC LIMIT 3
        ) p
        WHERE s.coordinates IS NOT NULL
    """
    cypher_near_beach = """
        UNWIND $batch AS row
        MATCH (s:Suburb {id: row.suburb_id}), (f:Beach {osm_id: row.feature_osm_id})
        MERGE (s)-[r:NEAR_BEACH]->(f)
        SET r.distance_m = row.distance_m
        RETURN count(r) AS num_created
    """
    sync_edges_batch(sql_near_beach, cypher_near_beach, "NEAR_BEACH")

    # 3. NEAR_GREENSPACE (3km)
    sql_near_green = """
        SELECT s.id AS suburb_id, p.osm_id AS feature_osm_id, p.space_type AS type_prop, p.dist AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
          SELECT osm_id, 
                 CASE WHEN boundary = 'national_park' OR leisure = 'nature_reserve' THEN 'national_park' WHEN landuse IN ('forest','wood') THEN 'forest' ELSE 'park' END AS space_type,
                 ROUND(ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355))::numeric) as dist
          FROM planet_osm_polygon
          WHERE (leisure IN ('park','nature_reserve') OR landuse IN ('forest','recreation_ground') OR boundary = 'national_park') AND name IS NOT NULL AND ST_Area(ST_Transform(way, 28355)) > 10000
            AND ST_DWithin(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355), 3000)
          ORDER BY ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355)) ASC LIMIT 3
        ) p
        WHERE s.coordinates IS NOT NULL
    """
    cypher_near_green = """
        UNWIND $batch AS row
        MATCH (s:Suburb {id: row.suburb_id}), (f:GreenSpace {osm_id: row.feature_osm_id})
        MERGE (s)-[r:NEAR_GREENSPACE]->(f)
        SET r.distance_m = row.distance_m, r.space_type = row.type_prop
        RETURN count(r) AS num_created
    """
    sync_edges_batch(sql_near_green, cypher_near_green, "NEAR_GREENSPACE")

    # 4. HAS_TRANSIT (2km)
    sql_near_station = """
        SELECT s.id AS suburb_id, p.osm_id AS feature_osm_id, 'Unknown' AS type_prop, p.dist AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
          SELECT osm_id, ROUND(ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(way, 28355))::numeric) as dist
          FROM planet_osm_point
          WHERE railway = 'station' AND name IS NOT NULL
            AND ST_DWithin(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(way, 28355), 2000)
          ORDER BY ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(way, 28355)) ASC LIMIT 3
        ) p
        WHERE s.coordinates IS NOT NULL
    """
    cypher_near_station = """
        UNWIND $batch AS row
        MATCH (s:Suburb {id: row.suburb_id}), (f:TrainStation {osm_id: row.feature_osm_id})
        MERGE (s)-[r:HAS_TRANSIT]->(f)
        SET r.distance_m = row.distance_m, r.network = row.type_prop
        RETURN count(r) AS num_created
    """
    sync_edges_batch(sql_near_station, cypher_near_station, "HAS_TRANSIT")

    # 5. NEAR_HOSPITAL (10km)
    sql_near_hospital = """
        SELECT s.id AS suburb_id, p.osm_id AS feature_osm_id, 'general' AS type_prop, p.dist AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
          SELECT osm_id, ROUND(ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355))::numeric) as dist
          FROM planet_osm_polygon
          WHERE amenity = 'hospital' AND name IS NOT NULL
            AND ST_DWithin(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355), 10000)
          ORDER BY ST_Distance(ST_Transform(ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326), 28355), ST_Transform(ST_Centroid(way), 28355)) ASC LIMIT 3
        ) p
        WHERE s.coordinates IS NOT NULL
    """
    cypher_near_hospital = """
        UNWIND $batch AS row
        MATCH (s:Suburb {id: row.suburb_id}), (f:Hospital {osm_id: row.feature_osm_id})
        MERGE (s)-[r:NEAR_HOSPITAL]->(f)
        SET r.distance_m = row.distance_m, r.hospital_type = row.type_prop
        RETURN count(r) AS num_created
    """
    sync_edges_batch(sql_near_hospital, cypher_near_hospital, "NEAR_HOSPITAL")

def run_osm_sync():
    db = SessionLocal()
    try:
        sync_osm_nodes(db)
        sync_osm_edges(db)
        logger.info("OSM Graph Sync Complete!")
    except Exception as e:
        logger.error(f"Failed OSM sync: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_osm_sync()
