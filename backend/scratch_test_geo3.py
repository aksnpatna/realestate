import sys
import os
sys.path.append("/home/aksai/projects/realestate/backend")
from main import SessionLocal
from sqlalchemy import text

db = SessionLocal()
res = db.execute(text("SELECT COUNT(*) FROM suburbs_ui_v3")).scalar()
print("Total Suburbs:", res)
