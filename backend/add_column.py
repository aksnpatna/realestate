import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    conn.execute(text("ALTER TABLE suburbs_all ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE;"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_suburbs_all_is_live ON suburbs_all (is_live);"))
    conn.commit()
print("is_live column added successfully")
