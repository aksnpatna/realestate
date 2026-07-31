import sys
sys.path.append("/home/aksai/projects/realestate/backend")
from ask.geo_discovery import extract_km
print(extract_km("find suburb 15km west of melbourne"))
print(extract_km("find suburb 15 km west of melbourne"))
