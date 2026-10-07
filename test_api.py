import sys
sys.path.append('backend')
import os
os.environ['DATABASE_URL'] = "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/realestate"
os.environ['LOCAL_LLM_URL'] = "http://localhost:8002/v1"
os.environ['ALLOW_INSECURE_CORS'] = "1"
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from main import get_suburb

engine = create_engine(os.environ['DATABASE_URL'])
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

try:
    res = get_suburb("point-cook-vic-3030", db=db, current_user=None)
    metrics = res.get("metrics", {})
    print("AI DEBATE:", metrics.get("aiCommitteeDebate"))
except Exception as e:
    print("ERROR:", e)
