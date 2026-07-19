"""
migrate_social_infra.py — Additive schema migration
====================================================
Adds new columns to suburbs_ui_v3 for social infrastructure, places of
worship, growth/development indicators, and social-housing counts.

IDEMPOTENT — safe to re-run. Does NOT alter or drop any existing column.

Sources that populate these columns:
  - etl_osm_enrich.py        : worship_*, shelter_count, community_centre_count,
                               retirement_home_count, construction_*_sqkm
  - etl_abs_social_housing.py: public_housing_dwellings, community_housing_dwellings,
                               social_housing_pct, abs_g37_sourced
"""
import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)

# (column_name, PostgreSQL DDL fragment) — every new column is nullable and additive.
NEW_COLUMNS = [
    # ── Places of worship (OSM) ───────────────────────────────────────
    ("worship_total",          "INTEGER"),
    ("worship_christian",      "INTEGER"),
    ("worship_muslim",         "INTEGER"),
    ("worship_buddhist",       "INTEGER"),
    ("worship_hindu",          "INTEGER"),
    ("worship_sikh",           "INTEGER"),
    ("worship_jewish",         "INTEGER"),
    ("worship_other",          "INTEGER"),
    ("worship_detail",         "JSONB"),     # [{"name","religion","dist_m"}]

    # ── Social infrastructure (OSM) ───────────────────────────────────
    ("shelter_count",          "INTEGER"),
    ("community_centre_count", "INTEGER"),
    ("retirement_home_count",  "INTEGER"),
    ("social_infra_detail",    "JSONB"),

    # ── Development / growth indicators (OSM landuse & building) ──────
    ("construction_sqkm",      "DOUBLE PRECISION"),    # landuse=construction area
    ("greenfield_sqkm",        "DOUBLE PRECISION"),    # landuse=greenfield area
    ("brownfield_sqkm",        "DOUBLE PRECISION"),    # landuse=brownfield area
    ("building_construction_count", "INTEGER"),        # building=construction count
    ("osm_enriched_at",        "TIMESTAMP"),
    ("osm_enrich_radius_m",    "INTEGER"),

    # ── Social housing (ABS Census 2021 G37 — tenure & landlord type) ─
    ("public_housing_dwellings",     "INTEGER"),   # landlord type 4 (state/territory housing authority)
    ("community_housing_dwellings",  "INTEGER"),   # landlord type 5 (community housing provider)
    ("renter_state_housing_pct",     "DOUBLE PRECISION"),
    ("renter_community_housing_pct", "DOUBLE PRECISION"),
    ("social_housing_pct",           "DOUBLE PRECISION"),  # combined 4+5 as % of total dwellings
    ("abs_g37_sourced",              "BOOLEAN DEFAULT FALSE"),
    ("abs_g37_run_date",             "TIMESTAMP"),

    # ── Cadastral / subdivision signal (state land registries via data.gov.au) ─
    ("cadastral_source",      "TEXT"),       # which state WFS endpoint was used
    ("cadastral_last_synced", "TIMESTAMP"),
]


def migrate():
    with engine.begin() as conn:
        print("Enabling PostGIS (no-op if already enabled)...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))

        existing = {
            row[0]
            for row in conn.execute(text("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'suburbs_ui_v3'
            """)).fetchall()
        }

        added = 0
        for col, ddl in NEW_COLUMNS:
            if col in existing:
                continue
            print(f"  + suburbs_ui_v3.{col}  ({ddl})")
            conn.execute(text(f"ALTER TABLE suburbs_ui_v3 ADD COLUMN {col} {ddl};"))
            added += 1

        if added == 0:
            print("  ✓ All social-infra columns already present — nothing to do.")


if __name__ == "__main__":
    migrate()
    print("Social infrastructure migration complete.")
