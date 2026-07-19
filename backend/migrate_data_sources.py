"""
migrate_data_sources.py — Add the data_sources catalogue table
================================================================
Adds a single read-only catalogue table that records what external open-data
sources are available (cadastral WFS/WMS/ArcGIS endpoints discovered via the
keyless data.gov.au CKAN and the equivalent state portals), what licence they
carry, and when each was surveyed.

The data_sources table is intentionally decoupled from suburbs_ui_v3 — it is a
*catalogue*, not a join table. A future pipeline can use the URLs it contains
to pull parcel polygons per state on demand.

IDEMPOTENT — safe to re-run. Nothing else is touched.
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)

DDL = """
CREATE TABLE IF NOT EXISTS data_sources (
    id                  SERIAL PRIMARY KEY,
    category            TEXT NOT NULL,            -- 'cadastre' | 'social_housing' | '...'
    state               TEXT,                     -- 'NSW', 'VIC', ... or 'AUS' for federal
    dataset_name        TEXT NOT NULL,            -- CKAN package name
    dataset_title       TEXT,
    publisher           TEXT,                     -- CKAN organisation slug
    license_id          TEXT,
    is_open             BOOLEAN,
    resource_format     TEXT,                     -- 'WFS', 'WMS', 'ArcGIS REST', 'CSV', etc.
    resource_url        TEXT,
    resource_name       TEXT,
    last_verified       TIMESTAMP,
    raw_metadata        JSONB,
    UNIQUE (category, dataset_name, resource_format, resource_url)
);
CREATE INDEX IF NOT EXISTS idx_data_sources_category ON data_sources (category);
CREATE INDEX IF NOT EXISTS idx_data_sources_state    ON data_sources (state);
"""


def migrate():
    with engine.begin() as conn:
        print("Creating data_sources table (if not exists)...")
        conn.execute(text(DDL))
        print("  ✓ data_sources ready")


if __name__ == "__main__":
    migrate()
    print("data_sources migration complete.")
