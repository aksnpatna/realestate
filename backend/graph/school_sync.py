"""
school_sync.py — Load ALL Australian schools from ACARA Excel files into Neo4j
with spatial matching to suburbs.

Replaces the single-top-school-per-suburb approach in graph_sync.py with
a comprehensive load of all ~9,500 schools with proper names, ICSEA scores,
enrolment data, and spatial HAS_SCHOOL relationships with distance metadata.
"""
import logging, sys
import pandas as pd
from sqlalchemy import text
from graph.neo4j_client import neo4j_client
from models_v3 import SessionLocal

logging.basicConfig(level=logging.INFO, stream=sys.stdout,
                    format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def load_acara_schools():
    """Load and merge ACARA Location + Profile data into a single DataFrame."""
    logger.info("Loading ACARA SchoolLocation2025.xlsx...")
    loc = pd.read_excel("SchoolLocation2025.xlsx",
                        sheet_name="SchoolLocations 2025",
                        engine="openpyxl")

    logger.info("Loading ACARA SchoolProfile2025.xlsx...")
    prof = pd.read_excel("SchoolProfile2025.xlsx",
                         sheet_name="SchoolProfile 2025",
                         engine="openpyxl")

    # Merge on ACARA SML ID
    merged = loc.merge(
        prof[["ACARA SML ID", "ICSEA", "ICSEA Percentile",
              "Total Enrolments", "Teaching Staff",
              "Full Time Equivalent Teaching Staff",
              "Year Range", "School URL", "School Sector"]],
        on="ACARA SML ID", how="left", suffixes=("", "_prof")
    )

    # Filter to rows with valid coordinates
    merged = merged.dropna(subset=["Latitude", "Longitude"])
    merged = merged[merged["Latitude"].between(-45, -10)]
    merged = merged[merged["Longitude"].between(110, 160)]

    logger.info(f"Loaded {len(merged)} schools with coordinates")
    return merged


def sync_schools_to_neo4j(df):
    """Load all school nodes into Neo4j."""
    logger.info("Creating School nodes in Neo4j...")

    batch = []
    for _, row in df.iterrows():
        batch.append({
            "acara_id": int(row["ACARA SML ID"]),
            "name": str(row["School Name"]),
            "suburb_name": str(row.get("Suburb", "")),
            "state": str(row.get("State", "")),
            "postcode": str(row.get("Postcode", "")),
            "sector": str(row.get("School Sector", "")),
            "school_type": str(row.get("School Type", "")),
            "year_range": str(row.get("Year Range", "")) if pd.notna(row.get("Year Range")) else "",
            "lat": float(row["Latitude"]),
            "lon": float(row["Longitude"]),
            "icsea": float(row["ICSEA"]) if pd.notna(row.get("ICSEA")) else None,
            "icsea_pct": float(row["ICSEA Percentile"]) if pd.notna(row.get("ICSEA Percentile")) else None,
            "enrolments": int(row["Total Enrolments"]) if pd.notna(row.get("Total Enrolments")) else None,
            "teaching_staff": float(row["Full Time Equivalent Teaching Staff"]) if pd.notna(row.get("Full Time Equivalent Teaching Staff")) else None,
        })

    cypher = """
    UNWIND $batch AS row
    MERGE (sch:School {acara_id: row.acara_id})
    SET sch.name = row.name,
        sch.suburb_name = row.suburb_name,
        sch.state = row.state,
        sch.postcode = row.postcode,
        sch.sector = row.sector,
        sch.school_type = row.school_type,
        sch.year_range = row.year_range,
        sch.lat = row.lat,
        sch.lon = row.lon,
        sch.icsea = row.icsea,
        sch.icsea_pct = row.icsea_pct,
        sch.enrolments = row.enrolments,
        sch.teaching_staff = row.teaching_staff
    """

    for i in range(0, len(batch), 3000):
        chunk = batch[i:i + 3000]
        neo4j_client.query(cypher, parameters={"batch": chunk})
        logger.info(f"  School nodes: {i + len(chunk)}/{len(batch)}")

    # Create index on acara_id if not exists
    neo4j_client.query("CREATE INDEX school_acara_id IF NOT EXISTS FOR (s:School) ON (s.acara_id)")
    neo4j_client.query("CREATE INDEX school_lat_lon IF NOT EXISTS FOR (s:School) ON (s.lat, s.lon)")

    logger.info(f"Created {len(batch)} School nodes")


def sync_school_suburb_edges(db_session, df):
    """Spatial join: create HAS_SCHOOL edges between suburbs and nearby schools."""
    logger.info("Computing HAS_SCHOOL spatial edges...")

    # First, ensure PostGIS has school points as a temp table
    db_session.execute(text("""
        DROP TABLE IF EXISTS tmp_acara_schools;
        CREATE TEMP TABLE tmp_acara_schools (
            acara_id INTEGER PRIMARY KEY,
            name TEXT,
            geom GEOMETRY(Point, 4326)
        );
    """))
    db_session.commit()

    for _, row in df.iterrows():
        db_session.execute(text("""
            INSERT INTO tmp_acara_schools (acara_id, name, geom)
            VALUES (:id, :name, ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))
            ON CONFLICT (acara_id) DO NOTHING
        """), {
            "id": int(row["ACARA SML ID"]),
            "name": str(row["School Name"]),
            "lon": float(row["Longitude"]),
            "lat": float(row["Latitude"]),
        })
    db_session.commit()
    logger.info("  Temp school points table populated")

    # Spatial join: suburb to schools within 5km, up to 10 schools per suburb
    sql = text("""
        SELECT s.id AS suburb_id,
               sch.acara_id AS feature_acara_id,
               sch.name AS school_name,
               ROUND(ST_Distance(
                 ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326)::geography,
                 sch.geom::geography
               )::numeric) AS distance_m
        FROM suburbs_ui_v3 s
        CROSS JOIN LATERAL (
            SELECT t.acara_id, t.name, t.geom,
                   ST_Distance(
                     ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326)::geography,
                     t.geom::geography
                   ) as dist
            FROM tmp_acara_schools t
            WHERE ST_DWithin(
              ST_SetSRID(ST_MakePoint((s.coordinates->>1)::float, (s.coordinates->>0)::float), 4326)::geography,
              t.geom::geography, 5000)
            ORDER BY dist ASC
            LIMIT 10
        ) sch
        WHERE s.coordinates IS NOT NULL AND s.is_live = true
    """)

    rows = db_session.execute(sql).fetchall()
    logger.info(f"  Computed {len(rows)} school-suburb edges")

    # Load into Neo4j
    batch = []
    for r in rows:
        d = dict(r._mapping)
        batch.append({
            "suburb_id": str(d["suburb_id"]),
            "acara_id": int(d["feature_acara_id"]),
            "distance_m": float(d["distance_m"]),
        })

    cypher = """
    UNWIND $batch AS row
    MATCH (s:Suburb {id: row.suburb_id})
    MATCH (sch:School {acara_id: row.acara_id})
    MERGE (s)-[r:HAS_SCHOOL]->(sch)
    SET r.distance_m = row.distance_m
    RETURN count(r) AS num_created
    """

    total = 0
    for i in range(0, len(batch), 3000):
        chunk = batch[i:i + 3000]
        res = neo4j_client.query(cypher, parameters={"batch": chunk})
        total += res[0]["num_created"] if res else 0

    # Clean up
    db_session.execute(text("DROP TABLE IF EXISTS tmp_acara_schools;"))
    db_session.commit()

    logger.info(f"  Created {total} HAS_SCHOOL edges")


def run_school_sync():
    db = SessionLocal()
    try:
        df = load_acara_schools()
        sync_schools_to_neo4j(df)
        sync_school_suburb_edges(db, df)
        logger.info("=== School Graph Sync Complete! ===")
    except Exception as e:
        logger.error(f"School sync failed: {e}", exc_info=True)
    finally:
        db.close()


if __name__ == "__main__":
    run_school_sync()
