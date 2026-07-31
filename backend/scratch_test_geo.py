import sys
import os
sys.path.append("/home/aksai/projects/realestate/backend")
from ask.geo_discovery import normalise_city, normalise_direction, extract_km, extract_priorities

q = "find the suburb 15 km north of melbourne with good rental yield"
print("City:", normalise_city(q))
print("Direction:", normalise_direction(q))
print("KM:", extract_km(q))
print("Priorities:", extract_priorities(q))
