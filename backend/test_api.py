from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from buyfinder import rank_suburbs, BuyFinderRequest

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

req = BuyFinderRequest()
results = rank_suburbs(req, session)
for r in results["results"]:
    print(r["name"], r["confidence_label"])
