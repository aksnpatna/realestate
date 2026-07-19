from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

suburb = session.query(SuburbUIV3).filter_by(name="Orbost").first()

checks = [
    ("house_days_on_market", suburb.house_days_on_market),
    ("unit_days_on_market", suburb.unit_days_on_market),
    ("house_auction_clearance_rate", suburb.house_auction_clearance_rate),
    ("predominant_occupation", suburb.predominant_occupation),
    ("avg_icsea", suburb.avg_icsea),
    ("school_count", suburb.school_count),
    ("price_to_income_ratio", suburb.price_to_income_ratio),
    ("typical_mortgage_band", suburb.typical_mortgage_band),
    ("vacancy_rate", suburb.vacancy_rate),
    ("population_cagr", suburb.population_cagr),
    ("rental_stock", suburb.rental_stock)
]

for name, val in checks:
    if val is None or val == 0:
        print(f"MISSING: {name}")
