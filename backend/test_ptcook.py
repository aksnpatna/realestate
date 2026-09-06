from core.database import SessionLocal
from models_v3 import SuburbUIV3
import json

db = SessionLocal()
v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id == 'VIC_POINT_COOK_3030').first()
if v3 and v3.demographics_detail and 'sqm_data' in v3.demographics_detail:
    sqm = v3.demographics_detail['sqm_data']
    print(f"rents length: {len(sqm.get('rents', []))}")
    print(f"prices length: {len(sqm.get('prices', []))}")
else:
    print("No sqm_data or not found")
db.close()
