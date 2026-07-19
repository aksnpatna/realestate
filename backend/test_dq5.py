from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models_v3 import SuburbUIV3

engine = create_engine(os.environ["DATABASE_URL"])
Session = sessionmaker(bind=engine)
session = Session()

abb = session.query(SuburbUIV3).filter_by(name="Abbotsford", state="VIC").first()
ouyen = session.query(SuburbUIV3).filter_by(name="Ouyen", state="VIC").first()

def get_missing(s):
    return [k for k, v in s.__dict__.items() if v is None or v == 0]

abb_missing = set(get_missing(abb))
ouyen_missing = set(get_missing(ouyen))

print("Missing in Ouyen but PRESENT in Abbotsford:")
for m in sorted(ouyen_missing - abb_missing):
    print(m)

print("\nMissing in Abbotsford but PRESENT in Ouyen:")
for m in sorted(abb_missing - ouyen_missing):
    print(m)
