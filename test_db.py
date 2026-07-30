from sqlalchemy import create_engine
engine = create_engine("postgresql://realestate_user:realestate_pass@localhost:15432/realestate")
from sqlalchemy.orm import sessionmaker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()
from sqlalchemy import text
res = db.execute(text("SELECT email FROM users LIMIT 1")).fetchone()
print("Found user:", res[0] if res else "None")
