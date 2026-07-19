from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3

engine = create_engine("postgresql://realestate_user:realestate_pass@db:5432/realestate")
Session = sessionmaker(bind=engine)
session = Session()

abbotsford = session.query(SuburbUIV3).filter_by(name="Abbotsford", state="VIC").first()

checks = [
    ("house_days_on_market", abbotsford.house_days_on_market),
    ("unit_days_on_market", abbotsford.unit_days_on_market),
    ("house_auction_clearance_rate", abbotsford.house_auction_clearance_rate),
    ("predominant_occupation", abbotsford.predominant_occupation),
    ("avg_icsea", abbotsford.avg_icsea),
    ("school_count", abbotsford.school_count),
    ("price_to_income_ratio", abbotsford.price_to_income_ratio),
    ("typical_mortgage_band", abbotsford.typical_mortgage_band),
    ("vacancy_rate", abbotsford.vacancy_rate),
]

for name, val in checks:
    print(f"{name}: {val}")

