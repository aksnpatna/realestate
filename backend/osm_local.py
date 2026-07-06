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
    "school":     ("amenity", ("school", "college", "university", "kindergarten", "childcare")),
    "shopping":   ("shop",    ("mall", "supermarket", "department_store", "convenience", "bakery", "butcher")),
    "hospital":   ("amenity", ("hospital", "clinic", "pharmacy", "doctors", "dentist")),
    "sports":     ("leisure", ("sports_centre", "fitness_centre", "stadium", "pitch", "golf_course", "swimming_pool")),
}

# Transit: needs special handling — multiple key/value combos
TRANSIT_KEY_VAL = [
    ("public_transport", ("station", "stop_position")),
    ("railway", ("station", "tram_stop", "halt")),
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

    return result


def compute_scores(pois):
    """Compute walkability, transit, and liveability scores from POI counts.

    Same scoring logic as the frontend osmApi.ts for consistency.
    Scores are 0-100.
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

    walk = min(100,
               diminishing_score(dining, 30, 40) +
               diminishing_score(parks, 15, 20) +
               diminishing_score(transit, 20, 30) +
               diminishing_score(schools, 5, 10))

    transit_score = min(100, transit * 4)

    liveability = round(0.5 * walk + 0.3 * transit_score + 2 * schools)

    return {
        "walkScore": walk,
        "transitScore": transit_score,
        "liveabilityScore": min(100, liveability),
        "counts": {
            "cafes": dining,
            "parks": parks,
            "transit": transit,
            "schools": schools,
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
    """Fetch geojson boundary and center coordinates from PostGIS.
    Filters by state bounding box when provided to disambiguate suburbs with same name."""
    # State bounding boxes (approx lat/lng ranges)
    STATE_BOUNDS = {
        "VIC": (141.0, 150.0, -39.2, -34.0),
        "NSW": (141.0, 154.0, -37.5, -28.0),
        "QLD": (138.0, 154.0, -29.2, -10.0),
        "WA":  (113.0, 129.0, -35.0, -14.0),
        "SA":  (129.0, 141.0, -38.0, -26.0),
        "TAS": (144.5, 148.5, -43.7, -39.5),
        "NT":  (129.0, 138.0, -26.0, -11.0),
        "ACT": (148.8, 149.4, -35.9, -35.1),
    }
    sql = """
    SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) as geojson,
           ST_Y(ST_Transform(ST_Centroid(way), 4326)) as lat,
           ST_X(ST_Transform(ST_Centroid(way), 4326)) as lng
    FROM planet_osm_polygon
    WHERE name ILIKE :name
      AND (boundary = 'administrative' OR place IN ('suburb', 'locality', 'town'))
    """
    params = {"name": suburb_name}
    if state and state.upper() in STATE_BOUNDS:
        bounds = STATE_BOUNDS[state.upper()]
        sql += " AND way && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)"
        params.update({"minx": bounds[0], "miny": bounds[2], "maxx": bounds[1], "maxy": bounds[3]})
    sql += " ORDER BY way_area DESC NULLS LAST LIMIT 1;"
    with engine.connect() as conn:
        row = conn.execute(text(sql), params).first()
    
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
