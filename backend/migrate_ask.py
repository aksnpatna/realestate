import os
import sys
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")
engine = create_engine(DATABASE_URL)

with engine.begin() as conn:
    try:
        conn.execute(text("ALTER TABLE decision_brief_snapshots ADD COLUMN user_id VARCHAR;"))
        conn.execute(text("CREATE INDEX idx_decision_brief_user_id ON decision_brief_snapshots (user_id);"))
        conn.execute(text("ALTER TABLE decision_brief_snapshots ADD COLUMN visibility VARCHAR DEFAULT 'private';"))
        conn.execute(text("ALTER TABLE decision_brief_snapshots ADD COLUMN share_token_hash VARCHAR;"))
        conn.execute(text("CREATE INDEX idx_decision_brief_share_token ON decision_brief_snapshots (share_token_hash);"))
        print("Migration applied successfully.")
    except Exception as e:
        print("Migration likely already applied or error:", e)

# Also ensure models_v3 runs its create_all
import models_v3
