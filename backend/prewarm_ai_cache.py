import os
import time
import requests
from sqlalchemy import create_engine, text
from concurrent.futures import ThreadPoolExecutor, as_completed

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg2://realestate_user:r3alestat3_dev_pass@realestate-db:5432/realestate")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
API_URL = "http://localhost:8100/api/analyze-suburb"

import jwt
def _make_headers():
    # Mint a short-lived login token for a local user, using the backend's own secret
    secret = os.environ.get("JWT_SECRET")
    user_id = os.environ.get("PREWARM_USER_ID")
    if not secret or not user_id:
        raise SystemExit("Set JWT_SECRET and PREWARM_USER_ID")
    token = jwt.encode({"sub": user_id, "exp": int(time.time()) + 24 * 3600}, secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}

HEADERS = None

def analyze_suburb(sid, persona, name="", state=""):
    print(f"Prewarming {sid} ({persona})...")
    # Loop for retries (especially 503 from the gateway queue or 429 rate limits)
    for attempt in range(5):
        try:
            # We set a high timeout because requests wait in the gateway queue (up to 3 min)
            res = requests.post(API_URL, json={"id": sid, "suburb": name, "state": state, "buyer_profile": persona}, headers=HEADERS, timeout=240)
            if res.status_code == 200:
                print(f"  Success for {sid} ({persona})")
                return True
            elif res.status_code == 429:
                print(f"  Rate limited {sid} ({persona}), waiting 15s...")
                time.sleep(15)
            elif res.status_code == 503:
                # Gateway queue is full, wait and retry
                wait_time = int(res.headers.get("Retry-After", 15))
                print(f"  Server busy for {sid} ({persona}), waiting {wait_time}s...")
                time.sleep(wait_time)
            else:
                print(f"  Failed {sid} ({persona}) with {res.status_code}: {res.text}")
                return False
        except Exception as e:
            print(f"  Error {sid} ({persona}): {e}")
            time.sleep(5)
    return False

def prewarm():
    global HEADERS
    HEADERS = _make_headers()
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        # Get top 500 suburbs by sales volume
        result = conn.execute(text("SELECT id, name, state FROM suburbs_ui_v3 WHERE house_sold_12m IS NOT NULL ORDER BY house_sold_12m DESC LIMIT 500"))
        rows = [(row[0], row[1], row[2]) for row in result]
        suburb_ids = [r[0] for r in rows]

    tasks = []
    for sid, name, state in rows:
        for persona in ["first_home_buyer", "investor"]:
            tasks.append((sid, persona, name, state))

    print(f"Loaded {len(suburb_ids)} suburbs ({len(tasks)} tasks) to prewarm.")
    
    # We use 4 workers to match the FAST_SLOTS in the gateway perfectly, keeping the GPU maxed out.
    start = time.time()
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(analyze_suburb, sid, persona, name, state): (sid, persona) for (sid, persona, name, state) in tasks}
        for future in as_completed(futures):
            future.result()  # raise exceptions if any
            
    print(f"Prewarming completed in {time.time() - start:.1f} seconds")

if __name__ == "__main__":
    prewarm()
