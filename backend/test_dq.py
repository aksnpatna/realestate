from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3
from buyfinder import unified_eligibility, calibrate_dq, compute_buyer_fit, BuyFinderRequest

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

kaniva = session.query(SuburbUIV3).filter_by(name="Kaniva").first()

print("Raw DQ:", kaniva.dq_score)
print("Calibrated DQ:", calibrate_dq(kaniva))

el = unified_eligibility(kaniva)
print("Eligibility:", el)

req = BuyFinderRequest()
fit = compute_buyer_fit(kaniva, req)
print("Fit Eligibility:", fit["eligibility"])
