import sys
sys.path.append('backend')
import os
os.environ['DATABASE_URL'] = "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/realestate"
os.environ['ALLOW_INSECURE_CORS'] = "1"
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import get_suburb

engine = create_engine(os.environ['DATABASE_URL'])
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    res = get_suburb("point-cook-vic-3030", db=db, current_user=None)
    demog = res.get("demographicsDetailV3", {})
    sqm = demog.get("sqm_data", {})
    rents = sqm.get("rents", [])
    for idx, r in enumerate(rents):
        ha = r.get("houses_all")
        if ha is not None and ha != "":
            try:
                float(ha)
            except:
                print(f"NaN found in houses_all at idx {idx}: {ha}")
        ua = r.get("units_all")
        if ua is not None and ua != "":
            try:
                float(ua)
            except:
                print(f"NaN found in units_all at idx {idx}: {ua}")
    print("DONE CHECKING RENTS")
except Exception as e:
    print("ERROR:", e)
