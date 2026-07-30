import os
import sys
import zipfile
import logging
import argparse
import subprocess
import pandas as pd
from sqlalchemy import create_engine, text
import shutil

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@localhost:15432/realestate")

def init_db(engine):
    logger.info("Initializing database table abs_sa1_metrics...")
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS abs_sa1_metrics (
                sa1_code_2021 VARCHAR(20) PRIMARY KEY,
                population INTEGER,
                median_household_income INTEGER,
                renter_pct FLOAT,
                family_pct FLOAT,
                geom GEOMETRY(MultiPolygon, 4326)
            );
            CREATE INDEX IF NOT EXISTS idx_abs_sa1_metrics_geom ON abs_sa1_metrics USING GIST (geom);
        """))
        conn.commit()

def load_data(engine, shape_zip, datapack_zip):
    tmp_dir = "/tmp/abs_etl_sa1"
    os.makedirs(tmp_dir, exist_ok=True)
    
    logger.info("Extracting shapefile ZIP...")
    with zipfile.ZipFile(shape_zip, 'r') as zip_ref:
        zip_ref.extractall(tmp_dir)
        
    logger.info("Extracting DataPack ZIP...")
    csv_filename = "2021 Census GCP Statistical Area 1 for AUS/2021Census_G02_AUST_SA1.csv"
    with zipfile.ZipFile(datapack_zip, 'r') as zip_ref:
        zip_ref.extract(csv_filename, tmp_dir)

    # 1. Load CSV into temp table using Pandas
    csv_path = os.path.join(tmp_dir, csv_filename)
    logger.info(f"Loading demographics CSV from {csv_path}...")
    df = pd.read_csv(csv_path, dtype={'SA1_CODE_2021': str})
    
    # Map G02 columns
    if 'Median_tot_hhd_inc_weekly' in df.columns:
        df['median_household_income'] = df['Median_tot_hhd_inc_weekly']
    else:
        df['median_household_income'] = 0
        
    if 'Tot_P_P' in df.columns:
        df['population'] = df['Tot_P_P']
    else:
        df['population'] = 0
        
    df_subset = df[['SA1_CODE_2021', 'population', 'median_household_income']].copy()
    
    logger.info("Uploading demographics to Postgres temp table `tmp_sa1_csv`...")
    df_subset.to_sql('tmp_sa1_csv', engine, if_exists='replace', index=False)
    
    # 2. Use ogr2ogr via ephemeral GDAL Docker container to load shapefile
    shp_file = os.path.join(tmp_dir, "SA1_2021_AUST_GDA2020.shp")
    logger.info("Running ogr2ogr via Docker osgeo/gdal...")
    
    ogr2ogr_cmd = [
        "docker", "run", "--rm", 
        "-v", f"{tmp_dir}:{tmp_dir}", 
        "--network", "host", 
        "osgeo/gdal:ubuntu-small-3.6.3", 
        "ogr2ogr", "-f", "PostgreSQL",
        "PG:dbname=realestate user=realestate_user password=realestate_pass host=127.0.0.1 port=15432",
        shp_file,
        "-nln", "tmp_sa1_geom",
        "-nlt", "MULTIPOLYGON",
        "-t_srs", "EPSG:4326",
        "-overwrite"
    ]
    subprocess.run(ogr2ogr_cmd, check=True)
    
    # 3. Join them inside the database!
    logger.info("Joining geometries and demographics in the database...")
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE abs_sa1_metrics;"))
        conn.execute(text("""
            INSERT INTO abs_sa1_metrics (sa1_code_2021, population, median_household_income, renter_pct, family_pct, geom)
            SELECT 
                g.sa1_code21, 
                COALESCE(c.population, 0), 
                COALESCE(c.median_household_income, 0), 
                0.0, 
                0.0, 
                g.wkb_geometry
            FROM tmp_sa1_geom g
            LEFT JOIN tmp_sa1_csv c ON g.sa1_code21 = c."SA1_CODE_2021"
            WHERE g.sa1_code21 IS NOT NULL;
        """))
        
        # Cleanup temp tables
        conn.execute(text("DROP TABLE IF EXISTS tmp_sa1_geom;"))
        conn.execute(text("DROP TABLE IF EXISTS tmp_sa1_csv;"))
        
    logger.info("Successfully populated abs_sa1_metrics!")
    
    # Cleanup host tmp dir
    shutil.rmtree(tmp_dir)

def create_tile_function(engine):
    logger.info("Ensuring `public.get_sa1_heatmap` tile function exists...")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE OR REPLACE FUNCTION public.get_sa1_heatmap(
                z integer, x integer, y integer, 
                suburb_name text default null,
                metric_type text default 'income'
            )
            RETURNS bytea
            AS $$
            DECLARE
                result bytea;
                bounds geometry;
                target_suburb_geom geometry;
            BEGIN
                bounds := ST_TileEnvelope(z, x, y);
                IF suburb_name IS NOT NULL AND suburb_name != '' THEN
                    SELECT ST_Transform(way, 4326) INTO target_suburb_geom 
                    FROM planet_osm_polygon 
                    WHERE name ILIKE suburb_name AND boundary = 'administrative' AND admin_level = '10' LIMIT 1;
                END IF;

                WITH mvtgeom AS (
                    SELECT 
                        ST_AsMVTGeom(ST_Transform(s.geom, 3857), bounds) AS geom,
                        s.sa1_code_2021, s.population, s.median_household_income, s.renter_pct
                    FROM abs_sa1_metrics s
                    WHERE s.geom && ST_Transform(bounds, 4326)
                    AND ST_Intersects(s.geom, ST_Transform(bounds, 4326))
                    AND (target_suburb_geom IS NULL OR ST_Intersects(s.geom, target_suburb_geom))
                )
                SELECT ST_AsMVT(mvtgeom.*, 'default') INTO result FROM mvtgeom;
                RETURN result;
            END;
            $$ LANGUAGE 'plpgsql' STABLE PARALLEL SAFE;
        """))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ETL script for ABS SA1 Data")
    parser.add_argument("--shape-zip", type=str, default="../data/SA1_2021_AUST_SHP_GDA2020.zip", help="Path to ASGS SA1 Shapefile ZIP")
    parser.add_argument("--datapack-zip", type=str, default="../data/2021_GCP_SA1_for_AUS_short-header.zip", help="Path to ABS Census DataPack ZIP")
    args = parser.parse_args()
    
    engine = create_engine(DATABASE_URL)
    init_db(engine)
    create_tile_function(engine)
    
    if os.path.exists(args.shape_zip) and os.path.exists(args.datapack_zip):
        load_data(engine, args.shape_zip, args.datapack_zip)
    else:
        logger.error(f"ZIP files not found. Ensure {args.shape_zip} and {args.datapack_zip} exist.")
