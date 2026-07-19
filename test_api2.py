from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3
engine = create_engine("postgresql://realestate_user:realestate_pass@db:5432/realestate")
Session = sessionmaker(bind=engine)
session = Session()
o = session.query(SuburbUIV3).filter_by(name="Ouyen").first()
print("Ouyen raw DQ:", o.dq_score)
