import sys
import os
import asyncio
sys.path.append("/home/aksai/projects/realestate/backend")
from ask.geo_discovery import discover_suburbs
from main import SessionLocal

db = SessionLocal()
q = "find the suburb 15 km north of melbourne with good rental yield"
res = discover_suburbs(db, q)
print(res)
db.close()
