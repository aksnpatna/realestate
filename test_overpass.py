import requests
import json
lat, lng = -33.8688, 151.2093 # Sydney
radius_m = 2500
overpass_query = f"""
[out:json][timeout:10];
(
    node["amenity"~"cafe|restaurant|fast_food|pub"](around:{radius_m},{lat},{lng});
    node["public_transport"="station"](around:{radius_m},{lat},{lng});
);
out body;
"""
headers = {"User-Agent": "RealEstateApp/1.0"}
resp = requests.post("http://overpass-api.de/api/interpreter", data={'data': overpass_query}, headers=headers, timeout=10)
if resp.status_code == 200:
    print("Success:", len(resp.json().get('elements', [])))
else:
    print("Failed:", resp.status_code, resp.text)
