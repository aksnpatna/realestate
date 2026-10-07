import sys
sys.path.append('backend')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os
os.environ['DATABASE_URL'] = "postgresql+psycopg2://realestate_user:realestate_pass@localhost:15432/realestate"
os.environ['LOCAL_LLM_URL'] = "http://localhost:8002/v1"
from ai_agent import ai_committee
from database import SuburbUIV3

engine = create_engine(os.environ['DATABASE_URL'])
Session = sessionmaker(bind=engine)
db = Session()
v3 = db.query(SuburbUIV3).filter_by(id="VIC_POINT_COOK_3030").first()
print("Running AI for", v3.name)
res = ai_committee(v3.id, v3.name, v3.state, db, force_refresh=True, persona="first_home_buyer")
print(res.get("urban"))
