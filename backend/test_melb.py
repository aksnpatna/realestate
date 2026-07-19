from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3
from buyfinder import calibrate_dq

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

melb = session.query(SuburbUIV3).filter_by(name="Melbourne", state="VIC").first()

print("Raw DQ:", melb.dq_score)
print("Calibrated DQ:", calibrate_dq(melb))
