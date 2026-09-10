import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from models_v3 import SuburbUIV3

_db_url = os.environ.get("DATABASE_URL", "postgresql://realestate_user:realestate_pass@localhost:15432/realestate")
_engine = create_engine(_db_url)
SessionLocal = sessionmaker(bind=_engine)
db = SessionLocal()

suburb = db.query(SuburbUIV3).filter(SuburbUIV3.name == 'Point Cook', SuburbUIV3.state == 'VIC').first()
if suburb:
    print(f"ID: {suburb.id}")
    print(f"Name: {suburb.name}")
    print(f"Postcode: {suburb.postcode}")
    print(f"House Median Price: {suburb.house_median_price}")
    print(f"Demographics Detail Keys: {suburb.demographics_detail.keys() if suburb.demographics_detail else 'None'}")
    sqm = suburb.demographics_detail.get('sqm_data', {}) if suburb.demographics_detail else {}
    print(f"SQM Data Keys: {sqm.keys()}")
    if 'history' in sqm:
        print(f"History length: {len(sqm['history'])}")
    else:
        print("NO HISTORY FIELD IN SQM_DATA")
else:
    print("Point Cook not found")
db.close()
