"""Migration: Add external cross-validation columns to suburbs_ui_v3."""
from sqlalchemy import text
from models_v3 import SessionLocal

ADD_COLUMNS_SQL = """
ALTER TABLE suburbs_ui_v3
ADD COLUMN IF NOT EXISTS external_dom_house INTEGER,
ADD COLUMN IF NOT EXISTS external_dom_unit INTEGER,
ADD COLUMN IF NOT EXISTS external_median_price DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS external_source VARCHAR,
ADD COLUMN IF NOT EXISTS external_fetched_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS external_validation JSONB,
ADD COLUMN IF NOT EXISTS metric_provenance JSONB;
"""

def main():
    db = SessionLocal()
    try:
        db.execute(text(ADD_COLUMNS_SQL))
        db.commit()
        print("External validation columns added.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
