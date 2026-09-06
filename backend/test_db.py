from database import SessionLocal
from models_v3 import SuburbUIV3
import json

db = SessionLocal()
v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id == 'VIC_MELBOURNE_3000').first()
if v3 and v3.demographics_detail and 'sqm_data' in v3.demographics_detail:
    rents = v3.demographics_detail['sqm_data'].get('rents', [])
    print(f"Rents length: {len(rents)}")
    if len(rents) > 0:
        print(f"First rent: {json.dumps(rents[0])}")
else:
    print("No sqm_data")
db.close()
