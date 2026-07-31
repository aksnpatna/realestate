import json
from models_v3 import SessionLocal, SuburbUIV3
db = SessionLocal()
s = db.query(SuburbUIV3).filter(SuburbUIV3.news_sentiment.isnot(None)).first()
if s:
    print(f"Found news for {s.name}:")
    print(json.dumps(s.news_sentiment, indent=2))
else:
    print("No news sentiment found in DB")
