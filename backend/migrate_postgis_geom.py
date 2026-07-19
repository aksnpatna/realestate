import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)

def setup_postgis():
    with engine.begin() as conn:
        print("Enabling PostGIS extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
        
        print("Checking if geom column exists in suburbs_ui_v3...")
        # Check if geom exists
        res = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='suburbs_ui_v3' and column_name='geom'
        """)).fetchone()
        
        if not res:
            print("Adding geom column to suburbs_ui_v3...")
            conn.execute(text("ALTER TABLE suburbs_ui_v3 ADD COLUMN geom Geometry(Point, 4326);"))
            print("Creating spatial index...")
            conn.execute(text("CREATE INDEX idx_suburbs_geom ON suburbs_ui_v3 USING GIST(geom);"))
        
        print("Populating geom from JSON coordinates [lat, lon]...")
        # coordinates is [lat, lon]. ST_MakePoint takes (lon, lat)
        conn.execute(text("""
            UPDATE suburbs_ui_v3 
            SET geom = ST_SetSRID(ST_MakePoint(
                CAST(coordinates->>1 AS FLOAT), 
                CAST(coordinates->>0 AS FLOAT)
            ), 4326)
            WHERE coordinates IS NOT NULL AND geom IS NULL;
        """))
        print("PostGIS migration complete!")

if __name__ == "__main__":
    setup_postgis()
