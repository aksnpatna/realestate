import urllib.request
import json
import re
from sqlalchemy import text
from models_v3 import SessionLocal

# Fetch Australian postcodes
url = "https://raw.githubusercontent.com/matthewproctor/australianpostcodes/master/australian_postcodes.json"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

db = SessionLocal()
try:
    existing_ids = {r[0] for r in db.execute(text("SELECT id FROM suburbs_all")).fetchall()}
    
    count = 0
    for row in data:
        state = row.get("state")
        if state not in ["WA", "NT"]:
            continue
            
        name = row.get("locality")
        # Ignore PO boxes and general deliveries
        if not name or " PO " in name or "GPO" in name or name.endswith(" DC") or "MAIL CENTRE" in name:
            continue
            
        postcode = row.get("postcode")
        
        # Create standard ID format
        safe_name = re.sub(r'[^A-Za-z0-9 ]', '', name).strip().upper().replace(' ', '_')
        if not safe_name: continue
        
        db_id = f"{state.lower()}-{name.lower().replace(' ', '-')}-{postcode}"
        
        if db_id not in existing_ids:
            try:
                db.execute(text(
                    "INSERT INTO suburbs_all (id, name, postcode, state, is_live) "
                    "VALUES (:id, :name, :postcode, :state, false)"
                ), {
                    "id": db_id,
                    "name": name.title(),
                    "postcode": postcode,
                    "state": state
                })
                existing_ids.add(db_id)
                count += 1
            except Exception as e:
                print(f"Failed to insert {name}: {e}")
                
    db.commit()
    print(f"Successfully inserted {count} WA/NT suburbs into suburbs_all.")
finally:
    db.close()
