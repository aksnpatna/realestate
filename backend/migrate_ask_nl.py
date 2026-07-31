"""
migration: pg_trgm extension, suburb_aliases table, region_aliases table.
Run once: python migration_ask_nl.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import create_engine, text

DB_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@localhost:15432/realestate")

def run():
    engine = create_engine(DB_URL)
    with engine.connect() as conn:
        conn.execution_options(isolation_level="AUTOCOMMIT")

        print("Enabling pg_trgm extension...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))

        print("Creating trigram index on suburbs_ui_v3.name...")
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_suburbs_v3_name_trgm
            ON suburbs_ui_v3 USING gin (name gin_trgm_ops)
        """))

        print("Creating suburb_aliases table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS suburb_aliases (
                id SERIAL PRIMARY KEY,
                alias VARCHAR(200) NOT NULL,
                suburb_id VARCHAR(50) NOT NULL REFERENCES suburbs_ui_v3(id),
                source VARCHAR(50) DEFAULT 'manual',
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(alias, suburb_id)
            )
        """))
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_suburb_aliases_alias ON suburb_aliases(LOWER(alias))
        """))

        print("Creating region_aliases table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS region_aliases (
                id SERIAL PRIMARY KEY,
                region_name VARCHAR(200) NOT NULL UNIQUE,
                suburb_ids TEXT[] NOT NULL,
                version INTEGER DEFAULT 1,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        """))

        print("Seeding initial aliases...")
        from sqlalchemy.orm import Session
        from models_v3 import SessionLocal
        db = SessionLocal()
        try:
            # Seed common misspellings + colloquial names
            seed_aliases = [
                ("kenmor", "qld_kenmore"),
                ("indooroopilly", "qld_indooroopilly"),
                ("indro", "qld_indooroopilly"),
                ("pointcook", "vic_point_cook"),
                ("werribe", "vic_werribee"),
                ("glenny", "vic_glen_waverley"),
                ("donny", "vic_doncaster"),
                ("foots", "vic_footscray"),
                ("bruns", "vic_brunswick"),
                ("fitz", "vic_fitzroy"),
                ("stkilda", "vic_st_kilda"),
                ("surry", "nsw_surry_hills"),
                ("newy", "nsw_newtown"),
                ("chatsy", "nsw_chatswood"),
                ("parra", "nsw_parramatta"),
                ("norw", "sa_norwood"),
                ("glenlg", "sa_glenelg"),
            ]
            for alias, sid in seed_aliases:
                try:
                    db.execute(text(
                        "INSERT INTO suburb_aliases (alias, suburb_id, source) "
                        "VALUES (:alias, :sid, 'seed') "
                        "ON CONFLICT DO NOTHING"
                    ), {"alias": alias, "sid": sid})
                except Exception:
                    pass
            db.commit()
            print(f"  Seeded {len(seed_aliases)} aliases.")
        finally:
            db.close()

        print("\nMigration complete. pg_trgm ✓  trigram index ✓  aliases ✓")

if __name__ == "__main__":
    run()
