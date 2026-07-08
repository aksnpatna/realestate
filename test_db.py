import os
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3

engine = create_engine(os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate"))
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

req_id = "VIC_Richmond_3121"
print("Querying for:", req_id.upper())
v3 = db.query(SuburbUIV3).filter(func.upper(SuburbUIV3.id) == req_id.upper()).first()
print("Found:", v3.id if v3 else "None")
