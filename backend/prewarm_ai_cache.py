import os
import time
import requests
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://realestate_user:r3alestat3_dev_pass@realestate-db:5432/realestate")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
API_URL = "http://localhost:8000/api/analyze-suburb"

def prewarm():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Get top 500 suburbs by sales volume
        result = conn.execute(text("SELECT id FROM suburbs_ui_v3 WHERE house_sold_12m IS NOT NULL ORDER BY house_sold_12m DESC LIMIT 500"))
        suburb_ids = [row[0] for row in result]

    print(f"Loaded {len(suburb_ids)} suburbs to prewarm.")

    for sid in suburb_ids:
        print(f"Prewarming {sid}...")
        for persona in ["first_home_buyer", "investor"]:
            try:
                res = requests.post(API_URL, json={"id": sid, "buyer_profile": persona}, timeout=60)
                if res.status_code == 200:
                    print(f"  Success for {sid} ({persona})")
                elif res.status_code == 429:
                    print("  Rate limited, waiting 60s...")
                    time.sleep(60)
                else:
                    print(f"  Failed with {res.status_code}: {res.text}")
            except Exception as e:
                print(f"  Error: {e}")
            time.sleep(6) # Max 10 requests per minute per rate limit

if __name__ == "__main__":
    prewarm()
