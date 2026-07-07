import json
import time
import requests
import math

# Load suburbs
with open('backend/suburbs_data.json', 'r') as f:
    suburbs = json.load(f)

headers = {'User-Agent': 'RealEstateApp/1.0 (Geocoding Fixer)'}

def geocode(query):
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
        res = requests.get(url, headers=headers)
        time.sleep(1) # Be nice to OSM
        if res.status_code == 200 and len(res.json()) > 0:
            return [float(res.json()[0]['lat']), float(res.json()[0]['lon'])]
    except Exception as e:
        print(f"Error geocoding {query}: {e}")
    return None

def distance(coord1, coord2):
    # Returns rough distance in degrees
    return math.sqrt((coord1[0] - coord2[0])**2 + (coord1[1] - coord2[1])**2)

print("Starting geocoding verification for 78 suburbs...")
updates = 0

for s in suburbs:
    suburb_name = s['name']
    state = s['state']
    
    # 1. Verify Suburb Coordinates
    q_suburb = f"{suburb_name}, {state}, Australia"
    c_suburb = geocode(q_suburb)
    if c_suburb and distance(s['coordinates'], c_suburb) > 0.05:
        print(f"Updated {suburb_name} center from {s['coordinates']} to {c_suburb}")
        s['coordinates'] = c_suburb
        updates += 1
        
    # 2. Verify POIs
    for poi in s.get('pois', []):
        q_poi = f"{poi['name']}, {suburb_name}, {state}, Australia"
        c_poi = geocode(q_poi)
        if not c_poi:
            # Fallback without suburb
            q_poi2 = f"{poi['name']}, {state}, Australia"
            c_poi = geocode(q_poi2)
            
        if c_poi and distance(poi['coordinates'], c_poi) > 0.02:
            print(f"Updated POI {poi['name']} in {suburb_name} from {poi['coordinates']} to {c_poi}")
            poi['coordinates'] = c_poi
            updates += 1
            
    # 3. Verify Schools
    for school in s.get('schools', []):
        q_school = f"{school['name']}, {suburb_name}, {state}, Australia"
        c_school = geocode(q_school)
        if not c_school:
            # Fallback without suburb
            q_school2 = f"{school['name']}, {state}, Australia"
            c_school = geocode(q_school2)
            
        if c_school and distance(school['coordinates'], c_school) > 0.02:
            print(f"Updated School {school['name']} in {suburb_name} from {school['coordinates']} to {c_school}")
            school['coordinates'] = c_school
            updates += 1

print(f"\nVerification complete! Made {updates} coordinate corrections.")

with open('backend/suburbs_data.json', 'w') as f:
    json.dump(suburbs, f, indent=2)

# Generate src/data/suburbs.ts
ts_content = "import { SuburbData } from '../types';\n\nexport const mockSuburbsData: SuburbData[] = "
ts_content += json.dumps(suburbs, indent=2)
ts_content += ";\n"

with open('src/data/suburbs.ts', 'w') as f:
    f.write(ts_content)

print("Updated backend/suburbs_data.json and src/data/suburbs.ts")
