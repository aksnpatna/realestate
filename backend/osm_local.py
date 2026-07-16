"""
osm_local.py — Local PostGIS OSM queries (replaces Overpass API)
=================================================================
All spatial queries hit the local planet_osm_* tables loaded by
osm2pgsql (updated weekly by realestate-osm-updater container).

No external API, no rate limits, no HTTP overhead.
"""
from sqlalchemy import text
from models_v3 import engine
import math
import json


# Categories mapped to their OSM keys/values
CATEGORIES = {
    "cafe":       ("amenity", ("cafe", "restaurant", "fast_food", "pub", "bar", "ice_cream", "food_court")),
    "park":       ("leisure", ("park", "nature_reserve", "recreation_ground", "playground", "garden")),
    "transit":    (None,      None),  # handled separately below
    "train_station": ("railway", ("station",)), # Specific category for train stations
    "school":     ("amenity", ("school", "college", "university", "kindergarten", "childcare")),
    "shopping":   ("shop",    ("mall", "supermarket", "department_store", "convenience", "bakery", "butcher")),
    "hospital":   ("amenity", ("hospital", "clinic", "pharmacy", "doctors", "dentist")),
    "sports":     ("leisure", ("sports_centre", "fitness_centre", "stadium", "pitch", "golf_course", "swimming_pool")),
    "worship":    ("amenity", ("place_of_worship", "church", "mosque", "temple", "synagogue")),
    "shelter":    ("amenity", ("shelter",)),
    "community_centre": ("amenity", ("community_centre",)),
    "retirement_home":  ("amenity", ("retirement_home",)),
}

# Transit: needs special handling — multiple key/value combos
TRANSIT_KEY_VAL = [
    ("public_transport", ("station", "stop_position")),
    ("railway", ("tram_stop", "halt")), # 'station' moved to train_station
    ("highway", ("bus_stop",)),
    ("amenity", ("bus_station", "ferry_terminal")),
]


def _build_category_query(category, lat, lng, radius_m=2500):
    """Build a SQL SELECT for POIs using the native 3857 GiST index for speed.
    Returns: name, distance_m, lat, lng"""
    # Convert radius in meters to approximate 3857 units (cos(lat) correction)
    import math
    lat_rad = abs(math.radians(lat))
    mercator_radius = radius_m / math.cos(lat_rad)

    parts = []

    if category == "transit":
        for key, vals in TRANSIT_KEY_VAL:
            vlist = ", ".join(f"'{v}'" for v in vals)
            parts.append(f"""
            SELECT name, way,
                   ST_Y(ST_Transform(way, 4326)) AS plat,
                   ST_X(ST_Transform(way, 4326)) AS plng,
                   '{category}'::text AS category
            FROM planet_osm_point
            WHERE {key} IN ({vlist})
              AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
            """)
            parts.append(f"""
            SELECT name, ST_Centroid(way) AS way,
                   ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS plat,
                   ST_X(ST_Transform(ST_Centroid(way), 4326)) AS plng,
                   '{category}'::text AS category
            FROM planet_osm_polygon
            WHERE {key} IN ({vlist})
              AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
            """)
    else:
        key, vals = CATEGORIES[category]
        vlist = ", ".join(f"'{v}'" for v in vals)
        parts.append(f"""
        SELECT name, way,
               ST_Y(ST_Transform(way, 4326)) AS plat,
               ST_X(ST_Transform(way, 4326)) AS plng,
               '{category}'::text AS category
        FROM planet_osm_point
        WHERE {key} IN ({vlist})
          AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
        """)
        parts.append(f"""
        SELECT name, ST_Centroid(way) AS way,
               ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS plat,
               ST_X(ST_Transform(ST_Centroid(way), 4326)) AS plng,
               '{category}'::text AS category
        FROM planet_osm_polygon
        WHERE {key} IN ({vlist})
          AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
        """)

    union = " UNION ALL ".join(parts)
    return f"""
    WITH center AS (
        SELECT ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857) AS geom_3857,
               ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326)::geography AS geog
    )
    SELECT name, category,
           ROUND(ST_Distance(pois.geog_4326, center.geog)::numeric, 0)::int AS dist_m,
           plat, plng
    FROM (
        SELECT name, category,
               ST_Transform(way, 4326)::geography AS geog_4326,
               plat, plng
        FROM (
            {union}
        ) raw
    ) pois, center
    WHERE ST_DWithin(pois.geog_4326, center.geog, {radius_m})
    ORDER BY dist_m
    """


def get_pois(lat, lng, radius_m=2500, categories=None):
    """Return POIs within radius_m of (lat, lng).

    Args:
        lat, lng: Center point in WGS84
        radius_m: Search radius in meters (default 2500)
        categories: List of category names or None for all

    Returns:
        dict: {category: [{"name": str, "distance": int}, ...]}
    """
    if categories is None:
        categories = list(CATEGORIES.keys()) + ["transit"]

    result = {}
    for cat in categories:
        try:
            sql = _build_category_query(cat, lat, lng, radius_m)
            with engine.connect() as conn:
                rows = conn.execute(text(sql)).fetchall()
                conn.commit()
            result[cat] = [{"name": r[0] or f"Unnamed {cat}",
                           "distance": r[2] if len(r) > 2 else 0,
                           "lat": float(r[3]) if len(r) > 3 and r[3] else None,
                           "lng": float(r[4]) if len(r) > 4 and r[4] else None}
                           for r in rows]
        except Exception as e:
            print(f"  OSM query error for {cat}: {e}")
            result[cat] = []

    total_items = sum(len(v) for v in result.values())
    if total_items == 0:
        import requests
        print("Local DB empty, falling back to Overpass API...")
        overpass_url = "http://overpass-api.de/api/interpreter"
        overpass_query = f"""
        [out:json][timeout:10];
        (
          nwr["amenity"~"cafe|restaurant|fast_food|pub"](around:{radius_m},{lat},{lng});
          nwr["leisure"~"park|playground"](around:{radius_m},{lat},{lng});
          nwr["public_transport"="station"](around:{radius_m},{lat},{lng});
          nwr["highway"="bus_stop"](around:{radius_m},{lat},{lng});
          nwr["railway"="station"](around:{radius_m},{lat},{lng});
          nwr["amenity"~"school|college|kindergarten"](around:{radius_m},{lat},{lng});
        );
        out center;
        """
        try:
            headers = {"User-Agent": "RealEstateApp/1.0"}
            resp = requests.post(overpass_url, data={'data': overpass_query}, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                elements = data.get('elements', [])
                for el in elements:
                    tags = el.get('tags', {})
                    lat_val = el.get('lat') or el.get('center', {}).get('lat')
                    lon_val = el.get('lon') or el.get('center', {}).get('lon')
                    name = tags.get('name', 'Unnamed')
                    if 'amenity' in tags and tags['amenity'] in ['cafe', 'restaurant', 'fast_food', 'pub']:
                        result.setdefault('cafe', []).append({"name": name, "distance": 0, "lat": lat_val, "lng": lon_val})
                    elif 'leisure' in tags and tags['leisure'] in ['park', 'playground']:
                        result.setdefault('park', []).append({"name": name, "distance": 0, "lat": lat_val, "lng": lon_val})
                    elif 'railway' in tags and tags['railway'] == 'station':
                        result.setdefault('train_station', []).append({"name": name, "distance": 0, "lat": lat_val, "lng": lon_val})
                    elif 'public_transport' in tags or 'highway' in tags:
                        result.setdefault('transit', []).append({"name": name, "distance": 0, "lat": lat_val, "lng": lon_val})
                    elif 'amenity' in tags and tags['amenity'] in ['school', 'college', 'kindergarten']:
                        result.setdefault('school', []).append({"name": name, "distance": 0, "lat": lat_val, "lng": lon_val})
        except Exception as e:
            print(f"Overpass fallback failed: {e}")

    return result


def compute_scores(pois):
    """Compute walkability, transit, and liveability scores from POI counts.

    Same scoring logic as the frontend osmApi.ts for consistency.
    Scores are 0-100.

    Added worship_diversity, social_infra density, and community amenities
    to the liveability formula (v2).
    """
    def diminishing_score(count, max_count, max_score):
        if count == 0:
            return 0
        if count >= max_count:
            return max_score
        return round(max_score * (1 - math.exp(-count / (max_count / 3))))

    dining = len(pois.get("cafe", []))
    parks = len(pois.get("park", []))
    transit = len(pois.get("transit", []))
    schools = len(pois.get("school", []))
    shops = len(pois.get("shopping", []))
    hospitals = len(pois.get("hospital", []))
    sports = len(pois.get("sports", []))

    worship = len(pois.get("worship", []))
    shelters = len(pois.get("shelter", []))
    community_centres = len(pois.get("community_centre", []))
    retirement_homes = len(pois.get("retirement_home", []))

    walk = min(100,
               diminishing_score(dining, 30, 40) +
               diminishing_score(parks, 15, 20) +
               diminishing_score(transit, 20, 30) +
               diminishing_score(schools, 5, 10) +
               diminishing_score(shops, 10, 5) +
               diminishing_score(hospitals, 10, 5))

    transit_score = min(100, transit * 4)

    # Social infra: community_centres + retirement_homes signal established community
    social_infra = community_centres + retirement_homes + shelters
    social_score = min(15, social_infra * 3)

    # Worship diversity: more religious options = more culturally diverse area
    worship_score = min(10, worship * 2)

    liveability = round(0.5 * walk + 0.3 * transit_score + 1.5 * schools + social_score + worship_score)

    return {
        "walkScore": walk,
        "transitScore": transit_score,
        "liveabilityScore": min(100, liveability),
        "socialInfraScore": social_score,
        "worshipDiversityScore": worship_score,
        "counts": {
            "cafes": dining,
            "parks": parks,
            "transit": transit,
            "schools": schools,
            "shops": shops,
            "hospitals": hospitals,
            "sports": sports,
            "worship": worship,
            "shelters": shelters,
            "communityCentres": community_centres,
            "retirementHomes": retirement_homes,
        },
        "topAmenities": _top_unique_names(pois, min(dining, 5)),
    }


def _top_unique_names(pois, limit=5):
    """Return top-N unique names from all POI categories."""
    seen = set()
    names = []
    for items in pois.values():
        for item in items:
            n = item["name"].strip()
            if n and n not in seen and "Unnamed" not in n:
                seen.add(n)
                names.append(n)
                if len(names) >= limit:
                    return names
    return names


def get_livability(lat, lng, radius_m=2500):
    """Full livability analysis: POIs + scores for a single location."""
    pois = get_pois(lat, lng, radius_m)
    scores = compute_scores(pois)
    return {
        "location": {"lat": lat, "lng": lng},
        "radius": radius_m,
        "pois": pois,
        **scores
    }

def get_boundary(suburb_name: str, state: str = ""):
    """Fetch geojson boundary and center coordinates from local PostGIS.
    When state is provided, finds the polygon closest to the state's approximate center
    to disambiguate suburbs with the same name across states."""
    # State approximate centroid coordinates (lat, lng)
    STATE_CENTERS = {
        "VIC": (-37.0, 145.0),
        "NSW": (-33.0, 147.0),
        "QLD": (-23.0, 145.0),
        "WA":  (-26.0, 121.0),
        "SA":  (-32.0, 136.0),
        "TAS": (-42.0, 147.0),
        "NT":  (-20.0, 133.0),
        "ACT": (-35.3, 149.1),
    }
    sql = """
    SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) as geojson,
           ST_Y(ST_Transform(ST_Centroid(way), 4326)) as lat,
           ST_X(ST_Transform(ST_Centroid(way), 4326)) as lng
    FROM planet_osm_polygon
    WHERE name ILIKE :name
      AND (boundary = 'administrative' OR place IN ('suburb', 'locality', 'town'))
    ORDER BY way_area DESC NULLS LAST LIMIT 10
    """
    params = {"name": suburb_name}
    
    with engine.connect() as conn:
        rows = conn.execute(text(sql), params).all()
    
    if not rows:
        # Fallback to Nominatim API if local DB is empty/importing
        import requests
        try:
            q = f"{suburb_name}, {state}, Australia" if state else f"{suburb_name}, Australia"
            url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&polygon_geojson=1&limit=1"
            headers = {"User-Agent": "RealEstateApp/1.0"}
            resp = requests.get(url, headers=headers, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                if data and len(data) > 0:
                    item = data[0]
                    return {
                        "geojson": item.get("geojson"),
                        "center": [float(item.get("lat")), float(item.get("lon"))]
                    }
        except Exception as e:
            print(f"Nominatim fallback failed: {e}")
        return None
    
    # If state provided, pick the polygon whose centroid is closest to the state center
    if state and state.upper() in STATE_CENTERS:
        sc = STATE_CENTERS[state.upper()]
        best_row = None
        best_dist = float('inf')
        for row in rows:
            rlat, rlng = row[1] or 0, row[2] or 0
            dist = (rlat - sc[0])**2 + (rlng - sc[1])**2
            if dist < best_dist:
                best_dist = dist
                best_row = row
        row = best_row
    else:
        row = rows[0]
    
    if row:
        return {
            "geojson": json.loads(row[0]) if row[0] else None,
            "center": [float(row[1]), float(row[2])] if row[1] and row[2] else None
        }
    return None

if __name__ == "__main__":
    # Quick test
    import json
    data = get_livability(-37.7994, 144.8988, 2500)
    print(json.dumps(data, indent=2, default=str))
