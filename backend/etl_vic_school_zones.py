import os
import json
import logging
from sqlalchemy import create_engine, text

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@localhost:5432/realestate")

def create_table_if_not_exists(engine):
    """Creates the school_zones table in PostGIS."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS school_zones (
                id SERIAL PRIMARY KEY,
                school_name VARCHAR(255),
                school_type VARCHAR(50),
                state VARCHAR(10),
                geom GEOMETRY(Polygon, 4326)
            );
        """))
        # Create a spatial index for fast map querying
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_school_zones_geom 
            ON school_zones USING GIST (geom);
        """))
        logger.info("Table `school_zones` is ready.")

def load_geojson(engine, file_path="victoria_school_zones.geojson"):
    """Reads a GeoJSON file and inserts the polygons into PostGIS."""
    if not os.path.exists(file_path):
        logger.error(f"GeoJSON file not found: {file_path}")
        logger.info("Please download the School Zones GeoJSON from data.vic.gov.au and save it as victoria_school_zones.geojson")
        return

    logger.info(f"Loading {file_path} into PostGIS...")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    features = data.get("features", [])
    if not features:
        logger.error("No features found in the GeoJSON.")
        return

    inserted = 0
    with engine.begin() as conn:
        # Clear existing data to avoid duplicates on re-run
        conn.execute(text("TRUNCATE TABLE school_zones;"))
        
        for feature in features:
            props = feature.get("properties", {})
            geom = feature.get("geometry")
            
            if not geom or geom.get("type") not in ["Polygon", "MultiPolygon"]:
                continue
                
            # Extract names from common property keys used by Vic/NSW Govt
            school_name = props.get("School_Name") or props.get("Entity_Name") or props.get("name") or "Unknown School"
            school_type = props.get("School_Type") or props.get("type") or "Primary/Secondary"
            
            # Convert GeoJSON geometry dict to JSON string for PostGIS ST_GeomFromGeoJSON
            geom_json = json.dumps(geom)
            
            conn.execute(
                text("""
                    INSERT INTO school_zones (school_name, school_type, state, geom)
                    VALUES (:name, :type, 'VIC', ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))
                """),
                {"name": school_name, "type": school_type, "geom": geom_json}
            )
            inserted += 1
            
    logger.info(f"Successfully inserted {inserted} school zones into the database.")
    logger.info("The `school_zones` layer is now available via pg_tileserv at http://localhost:7800/public.school_zones/{z}/{x}/{y}.pbf")

if __name__ == "__main__":
    engine = create_engine(DATABASE_URL)
    create_table_if_not_exists(engine)
    load_geojson(engine)
