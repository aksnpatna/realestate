import os
import glob
import zipfile
import subprocess
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

DATA_DIR = "/app/data/data"
DB_URL = "PG:host=db user=realestate_user password=realestate_pass dbname=realestate"

def create_table():
    logger.info("Creating school_zones table if not exists...")
    sql = """
    CREATE TABLE IF NOT EXISTS school_zones (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255),
        school_type VARCHAR(50),
        state VARCHAR(10),
        geom GEOMETRY(MultiPolygon, 4326)
    );
    CREATE INDEX IF NOT EXISTS idx_school_zones_geom 
    ON school_zones USING GIST (geom);
    """
    subprocess.run(["psql", "-h", "db", "-U", "realestate_user", "-d", "realestate", "-c", sql], env=dict(os.environ, PGPASSWORD="realestate_pass"))


def extract_zips():
    for zip_path in glob.glob(os.path.join(DATA_DIR, "*.zip")):
        extract_dir = zip_path.replace(".zip", "")
        if not os.path.exists(extract_dir):
            os.makedirs(extract_dir)
        logger.info(f"Extracting {zip_path} to {extract_dir}")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

def get_spatial_files():
    # Find all .shp, .kml, .geojson files in DATA_DIR and subdirectories
    spatial_files = []
    for root, dirs, files in os.walk(DATA_DIR):
        for file in files:
            if file.lower().endswith(('.shp', '.kml', '.geojson')):
                # Filter out old years to avoid duplicates and numeric overflow bugs
                if any(old_year in file.lower() for old_year in ['2015', '2017', '2018', '2019', '2020']):
                    continue
                spatial_files.append(os.path.join(root, file))
    return spatial_files

def run_ogr2ogr(file_path):
    logger.info(f"Loading {file_path} into PostGIS...")
    
    # We will load everything into a temporary table first, then map it into school_zones
    table_name = "temp_zones"
    
    # Drop temp table if exists
    subprocess.run(["psql", "-h", "db", "-U", "realestate_user", "-d", "realestate", "-c", f"DROP TABLE IF EXISTS {table_name};"], env=dict(os.environ, PGPASSWORD="realestate_pass"))

    # Load file into temp_zones
    cmd = [
        "ogr2ogr", "-f", "PostgreSQL", DB_URL,
        file_path,
        "-nln", table_name,
        "-nlt", "PROMOTE_TO_MULTI", # Ensure polygons become multipolygons
        "-overwrite",
        "-t_srs", "EPSG:4326",
        "-dim", "XY" # Strip Z dimension
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        logger.error(f"ogr2ogr failed for {file_path}:\n{result.stderr}")
        return
        
    logger.info(f"Loaded {file_path} successfully into temp table. Merging into school_zones...")
    
    # Now merge temp_zones into school_zones
    # We need to map the columns. Spatial data has wildly different column names.
    # We'll run a quick python check to see what columns exist in the temp table.
    
    cols_result = subprocess.run([
        "psql", "-h", "db", "-U", "realestate_user", "-d", "realestate", 
        "-t", "-c", "SELECT column_name FROM information_schema.columns WHERE table_name = 'temp_zones';"
    ], env=dict(os.environ, PGPASSWORD="realestate_pass"), capture_output=True, text=True)
    
    columns = [c.strip().lower() for c in cols_result.stdout.split('\n') if c.strip()]
    
    # Heuristics for school name
    name_col = 'NULL'
    for c in columns:
        if c in ['school_name', 'name', 'school_nam', 'facility_n', 'entity_name']:
            name_col = c
            break
            
    # Heuristics for school type
    type_col = 'NULL'
    for c in columns:
        if c in ['school_type', 'type', 'facility_t', 'school_typ']:
            type_col = c
            break
            
    state = "Unknown"
    if "vic" in file_path.lower(): state = "VIC"
    elif "nsw" in file_path.lower() or "catchment" in file_path.lower(): state = "NSW" # heuristic based on typical naming
    if "qld" in file_path.lower() or file_path.lower().endswith(".kml"): state = "QLD"
    if "sa" in file_path.lower() or "ey.zip" in file_path.lower() or "zones20" in file_path.lower(): state = "SA"
            
    merge_sql = f"""
        INSERT INTO school_zones (school_name, school_type, state, geom)
        SELECT 
            COALESCE(CAST({name_col} AS VARCHAR), 'Unknown School'),
            COALESCE(CAST({type_col} AS VARCHAR), 'Unknown Type'),
            '{state}',
            wkb_geometry
        FROM {table_name}
        WHERE wkb_geometry IS NOT NULL;
    """
    
    merge_res = subprocess.run(["psql", "-h", "db", "-U", "realestate_user", "-d", "realestate", "-c", merge_sql], env=dict(os.environ, PGPASSWORD="realestate_pass"), capture_output=True, text=True)
    if merge_res.returncode != 0:
        logger.error(f"Merge failed: {merge_res.stderr}")
    else:
        logger.info(f"Merged successfully: {merge_res.stdout.strip()}")

def main():
    create_table()
    logger.info("Extracting ZIP files...")
    extract_zips()
    
    spatial_files = get_spatial_files()
    logger.info(f"Found {len(spatial_files)} spatial files: {spatial_files}")
    
    for f in spatial_files:
        run_ogr2ogr(f)
        
    logger.info("All files processed.")

if __name__ == "__main__":
    main()
