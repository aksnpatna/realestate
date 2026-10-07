import sys
sys.path.append('backend')
import os
os.environ['DATABASE_URL'] = "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/realestate"
os.environ['LOCAL_LLM_URL'] = "http://localhost:8002/v1"
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import get_suburb, app

engine = create_engine(os.environ['DATABASE_URL'])
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    res = get_suburb("point-cook-vic-3030", db=db, current_user=None)
    print("KEYS:", list(res.keys()))
    print("METRICS:", res.get("metrics"))
except Exception as e:
    print("ERROR:", e)
