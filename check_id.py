from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.models_v3 import SuburbUIV3

engine = create_engine("postgresql://realestate_user:realestate_pass@db:5432/realestate")
Session = sessionmaker(bind=engine)
db = Session()
record = db.query(SuburbUIV3).first()
print(record.id)
