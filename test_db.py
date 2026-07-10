from backend.models_v3 import engine
from sqlalchemy import text
import time

sql = """
SELECT name FROM planet_osm_polygon
WHERE name = 'Abbotsford'
LIMIT 1;
"""
start = time.time()
with engine.connect() as conn:
    row = conn.execute(text(sql)).first()
print(f"Time for '=': {time.time()-start:.2f}s, Row: {row}")

sql2 = """
SELECT name FROM planet_osm_polygon
WHERE name ILIKE 'Abbotsford'
LIMIT 1;
"""
start = time.time()
with engine.connect() as conn:
    row = conn.execute(text(sql2)).first()
print(f"Time for 'ILIKE': {time.time()-start:.2f}s, Row: {row}")
