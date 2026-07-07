import os
from sqlalchemy import text
from models_v3 import engine

def run_vacuum_maintenance():
    """
    Runs Postgres VACUUM ANALYZE to prevent database bloat,
    especially on the raw JSON table which is updated frequently.
    """
    print("Starting database vacuum maintenance...")
    # SQLAlchemy requires isolation_level='AUTOCOMMIT' for VACUUM
    with engine.execution_options(isolation_level='AUTOCOMMIT').connect() as conn:
        print("  Vacuuming suburbs_raw_v3...")
        conn.execute(text("VACUUM ANALYZE suburbs_raw_v3"))
        
        print("  Vacuuming property_listings...")
        conn.execute(text("VACUUM ANALYZE property_listings"))
        
        print("  Vacuuming suburbs_ui_v3...")
        conn.execute(text("VACUUM ANALYZE suburbs_ui_v3"))
        
    print("Database maintenance complete.")

if __name__ == "__main__":
    run_vacuum_maintenance()
