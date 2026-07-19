from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

suburbs = session.query(SuburbUIV3).filter(SuburbUIV3.state == "VIC").limit(50).all()

for v3 in suburbs:
    checks = [
        v3.house_days_on_market, v3.unit_days_on_market,
        v3.house_auction_clearance_rate, v3.predominant_occupation,
        v3.avg_icsea, v3.school_count, v3.price_to_income_ratio,
        v3.typical_mortgage_band, v3.vacancy_rate,
    ]
    missing = sum(1 for c in checks if c is None or c == 0)
    if missing > 0:
        print(f"{v3.name}: missing {missing}")
