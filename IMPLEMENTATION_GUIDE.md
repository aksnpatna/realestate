# Growth Impact Data - Implementation Guide

## Quick Start: What You Can Use TODAY

Your system already has OpenStreetMap data loaded in PostGIS. Here's how to immediately access religious institutions and construction activity data.

---

## Part 1: Religious Institutions (Already Available)

### Step 1: Test Queries on Your Database

```bash
# Connect to your PostGIS database
docker exec -it realestate-db psql -U postgres -d realestate
```

Run this query to find all religious institutions near a location:

```sql
-- Test query: Find religious institutions near Parramatta, NSW
SELECT 
    name,
    CASE 
        WHEN amenity = 'place_of_worship' THEN COALESCE(religion, 'general')
        WHEN amenity IN ('church', 'mosque', 'temple', 'synagogue') THEN amenity
        ELSE 'other'
    END as religion_type,
    amenity,
    ROUND(ST_Distance(
        ST_Transform(way, 4326)::geography,
        ST_SetSRID(ST_MakePoint(151.003, -33.815), 4326)::geography
    )::numeric / 1000, 2) as distance_km
FROM planet_osm_point
WHERE (
    amenity IN ('place_of_worship', 'church', 'mosque', 'temple', 'synagogue')
    OR building = 'religious'
)
AND way && ST_Expand(
    ST_Transform(ST_SetSRID(ST_MakePoint(151.003, -33.815), 4326), 3857),
    2500 / COS(RADIANS(-33.815))
)
ORDER BY distance_km
LIMIT 20;
```

Expected output:
```
        name         | religion_type |    amenity    | distance_km 
---------------------+---------------+---------------+-------------
 St Patrick's        | christian     | place_of_worship |        0.35
 Parramatta Mosque   | muslim        | mosque        |        0.52
 Chinese Temple      | buddhist      | temple        |        0.78
 ...
```

### Step 2: Add to osm_local.py

Edit `/home/aksai/projects/realestate/backend/osm_local.py`:

```python
# Line 15 - Add to CATEGORIES dict:
CATEGORIES = {
    "cafe":       ("amenity", ("cafe", "restaurant", "fast_food", "pub", "bar", "ice_cream", "food_court")),
    "park":       ("leisure", ("park", "nature_reserve", "recreation_ground", "playground", "garden")),
    "transit":    (None,      None),
    "train_station": ("railway", ("station",)),
    "school":     ("amenity", ("school", "college", "university", "kindergarten", "childcare")),
    "shopping":   ("shop",    ("mall", "supermarket", "department_store", "convenience", "bakery", "butcher")),
    "hospital":   ("amenity", ("hospital", "clinic", "pharmacy", "doctors", "dentist")),
    "sports":     ("leisure", ("sports_centre", "fitness_centre", "stadium", "pitch", "golf_course", "swimming_pool")),
    "religious":  ("amenity", ("place_of_worship", "church", "mosque", "temple", "synagogue")),  # ADD THIS
}
```

### Step 3: Create Python Test Script

Create `/home/aksai/projects/realestate/test_religious_data.py`:

```python
#!/usr/bin/env python3
"""
Test script to query religious institutions from local PostGIS
"""
from sqlalchemy import create_engine, text
import json

# Use your existing database connection
DB_URL = "postgresql://postgres:postgres@localhost:5432/realestate"
engine = create_engine(DB_URL)

def get_religious_institutions(lat, lng, radius_m=2500):
    """Query religious institutions within radius of a point"""
    
    sql = """
    WITH center AS (
        SELECT ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857) AS geom_3857,
               ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography AS geog
    )
    SELECT 
        name,
        CASE 
            WHEN amenity = 'place_of_worship' THEN COALESCE(religion, 'general')
            WHEN amenity IN ('church', 'mosque', 'temple', 'synagogue') THEN amenity
            ELSE 'other'
        END as religion_type,
        amenity,
        ROUND(ST_Distance(pois.way_geog, center.geog)::numeric, 0)::int AS dist_m,
        ST_Y(ST_Transform(way, 4326)) as latitude,
        ST_X(ST_Transform(way, 4326)) as longitude
    FROM (
        SELECT 
            name, amenity, religion, way,
            ST_Transform(way, 4326)::geography AS way_geog
        FROM planet_osm_point
        WHERE (
            amenity IN ('place_of_worship', 'church', 'mosque', 'temple', 'synagogue')
            OR building = 'religious'
        )
        AND way && ST_Expand(
            ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857),
            :radius_m / COS(RADIANS(:lat))
        )
    ) pois, center
    WHERE ST_DWithin(pois.way_geog, center.geog, :radius_m)
    ORDER BY dist_m
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(sql), {
            'lat': lat, 'lng': lng, 'radius_m': radius_m
        })
        rows = result.fetchall()
        
    institutions = []
    for row in rows:
        institutions.append({
            'name': row[0] or f"Unnamed {row[2]}",
            'religion_type': row[1],
            'amenity': row[2],
            'distance_m': row[3],
            'lat': float(row[4]) if row[4] else None,
            'lng': float(row[5]) if row[5] else None
        })
    
    # Calculate diversity score
    religion_counts = {}
    for inst in institutions:
        religion_counts[inst['religion_type']] = religion_counts.get(inst['religion_type'], 0) + 1
    
    # Diversity score: more types = higher score
    unique_religions = len(religion_counts)
    total_institutions = len(institutions)
    
    if total_institutions == 0:
        diversity_score = 0
    else:
        # Shannon diversity index adapted for this use case
        diversity_score = round((unique_religions / max(total_institutions, 1)) * 50 + 
                               min(total_institutions, 10) * 5, 1)
    
    return {
        'total': total_institutions,
        'by_type': religion_counts,
        'diversity_score': diversity_score,
        'institutions': institutions
    }

if __name__ == "__main__":
    # Test with Parramatta NSW
    print("Testing religious institutions near Parramatta NSW...")
    data = get_religious_institutions(-33.815, 151.003, 2500)
    print(json.dumps(data, indent=2))
    
    # Test with Melbourne CBD
    print("\n\nTesting religious institutions near Melbourne CBD...")
    data = get_religious_institutions(-37.8136, 144.9631, 2500)
    print(json.dumps(data, indent=2))
EOF
```

Run the test:
```bash
cd /home/aksai/projects/realestate
python3 test_religious_data.py
```

---

## Part 2: Construction Activity Proxies

### Query New Construction from OSM

Create `/home/aksai/projects/realestate/test_construction.py`:

```python
#!/usr/bin/env python3
"""
Detect construction activity as proxy for subdivision/development
"""
from sqlalchemy import create_engine, text
import json

DB_URL = "postgresql://postgres:postgres@localhost:5432/realestate"
engine = create_engine(DB_URL)

def get_construction_activity(lat, lng, radius_m=5000):
    """Find construction sites and new developments"""
    
    sql = """
    SELECT 
        name,
        landuse,
        building,
        ROUND(ST_Distance(
            ST_Transform(way, 4326)::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )::numeric, 0)::int AS dist_m,
        ST_Y(ST_Transform(way, 4326)) as latitude,
        ST_X(ST_Transform(way, 4326)) as longitude,
        ST_Area(way) / 10000 as area_hectares
    FROM planet_osm_polygon
    WHERE (
        landuse = 'construction'
        OR building = 'construction'
        OR (landuse = 'residential')
    )
    AND way && ST_Expand(
        ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857),
        :radius_m / COS(RADIANS(:lat))
    )
    ORDER BY dist_m
    LIMIT 50
    """
    
    with engine.connect() as conn:
        result = conn.execute(text(sql), {
            'lat': lat, 'lng': lng, 'radius_m': radius_m
        })
        rows = result.fetchall()
    
    sites = []
    for row in rows:
        sites.append({
            'name': row[0] or 'Unnamed construction site',
            'type': row[1] or row[2] or 'unknown',
            'distance_m': row[3],
            'area_hectares': round(float(row[6]), 2) if row[6] else None,
            'lat': float(row[4]) if row[4] else None,
            'lng': float(row[5]) if row[5] else None
        })
    
    construction_count = sum(1 for s in sites if s['type'] == 'construction')
    residential_count = sum(1 for s in sites if s['type'] == 'residential')
    
    activity_score = min(100, construction_count * 10 + residential_count * 2)
    
    return {
        'total_sites': len(sites),
        'construction_sites': construction_count,
        'residential_areas': residential_count,
        'activity_score': activity_score,
        'sites': sites[:20]  # Return top 20
    }

if __name__ == "__main__":
    print("Testing construction activity near Growth Corridor...")
    # Test with a growth area (e.g., outer Melbourne)
    data = get_construction_activity(-37.65, 144.95, 5000)  # Near Craigieburn
    print(json.dumps(data, indent=2))
```

---

## Part 3: Social Housing Integration

### Create ETL Script for CKAN States

Create `/home/aksai/projects/realestate/backend/etl_social_housing.py`:

```python
#!/usr/bin/env python3
"""
etl_social_housing.py - Fetch social housing data from state CKAN APIs
"""
import requests
import json
from sqlalchemy import create_engine, text
from datetime import datetime

DB_URL = "postgresql://postgres:postgres@localhost:5432/realestate"
engine = create_engine(DB_URL)

# CKAN API endpoints for each state
STATE_CKAN_APIS = {
    'NSW': 'https://www.data.nsw.gov.au/data/api/action',
    'VIC': 'https://www.data.vic.gov.au/api/action',
    'SA': 'https://data.sa.gov.au/api/action',
    'ACT': 'https://data.act.gov.au/api/action',
    'WA': 'https://catalogue.data.wa.gov.au/api/action',
}

# Resource IDs for social housing datasets (need to be discovered/updated)
SOCIAL_HOUSING_RESOURCES = {
    'NSW': 'social-housing-locations',  # Example - actual ID needed
    'VIC': 'victorian-social-housing-stock',
    'SA': 'sa-housing-trust-properties',
    'ACT': 'public-housing-locations',
    'WA': 'social-housing-properties',
}

def discover_ckan_resource(api_base, search_query):
    """Search CKAN for relevant datasets"""
    search_url = f"{api_base}/package_search?q={search_query}"
    try:
        resp = requests.get(search_url, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success') and data['result']['count'] > 0:
                return data['result']['results'][0]
    except Exception as e:
        print(f"Error searching {api_base}: {e}")
    return None

def fetch_ckan_datastore(api_base, resource_id, limit=1000):
    """Fetch data from CKAN datastore"""
    url = f"{api_base}/datastore_search"
    params = {
        'resource_id': resource_id,
        'limit': limit
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            if data.get('success'):
                return data['result']['records']
    except Exception as e:
        print(f"Error fetching datastore: {e}")
    return []

def create_table():
    """Create social housing table if not exists"""
    create_sql = """
    CREATE TABLE IF NOT EXISTS social_housing_properties (
        id SERIAL PRIMARY KEY,
        property_address VARCHAR,
        suburb VARCHAR,
        postcode VARCHAR,
        state VARCHAR,
        housing_type VARCHAR,
        dwelling_count INT,
        development_status VARCHAR,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        source VARCHAR,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_social_housing_suburb 
    ON social_housing_properties(suburb, state);
    CREATE INDEX IF NOT EXISTS idx_social_housing_location 
    ON social_housing_properties(latitude, longitude);
    """
    with engine.connect() as conn:
        conn.execute(text(create_sql))
        conn.commit()

def insert_housing_data(records, state):
    """Insert social housing records into database"""
    insert_sql = """
    INSERT INTO social_housing_properties 
    (property_address, suburb, postcode, state, housing_type, 
     dwelling_count, development_status, latitude, longitude, source)
    VALUES 
    (:address, :suburb, :postcode, :state, :housing_type,
     :dwelling_count, :status, :latitude, :longitude, :source)
    ON CONFLICT DO NOTHING
    """
    
    inserted = 0
    with engine.connect() as conn:
        for record in records:
            # Map fields based on common patterns (adjust per state)
            params = {
                'address': record.get('address') or record.get('property_address', ''),
                'suburb': record.get('suburb') or record.get('locality', ''),
                'postcode': record.get('postcode') or record.get('postal_code', ''),
                'state': state,
                'housing_type': record.get('housing_type') or record.get('tenure_type', 'public'),
                'dwelling_count': record.get('dwellings') or record.get('num_dwellings', 1),
                'status': record.get('status') or record.get('development_status', 'existing'),
                'latitude': float(record.get('latitude') or record.get('lat', 0)),
                'longitude': float(record.get('longitude') or record.get('lon', 0)),
                'source': f"{state}_CKAN"
            }
            
            # Only insert if we have coordinates
            if params['latitude'] and params['longitude']:
                conn.execute(text(insert_sql), params)
                inserted += 1
        
        conn.commit()
    
    return inserted

def run_etl():
    """Run full ETL pipeline for all CKAN states"""
    create_table()
    
    total_inserted = 0
    
    for state, api_base in STATE_CKAN_APIS.items():
        print(f"\n{'='*60}")
        print(f"Processing {state}...")
        print(f"{'='*60}")
        
        # First, try to discover the dataset
        resource_name = SOCIAL_HOUSING_RESOURCES.get(state, 'social housing')
        package = discover_ckan_resource(api_base, 'social housing')
        
        if not package:
            print(f"  No social housing dataset found for {state}")
            continue
        
        # Get the first resource ID
        if package.get('resources'):
            resource_id = package['resources'][0].get('id')
            print(f"  Found dataset: {package.get('title', 'Unknown')}")
            print(f"  Resource ID: {resource_id}")
            
            # Fetch the data
            records = fetch_ckan_datastore(api_base, resource_id, limit=5000)
            print(f"  Fetched {len(records)} records")
            
            # Insert into database
            if records:
                inserted = insert_housing_data(records, state)
                print(f"  Inserted {inserted} records")
                total_inserted += inserted
        else:
            print(f"  No resources found in dataset for {state}")
    
    print(f"\n{'='*60}")
    print(f"ETL Complete. Total records inserted: {total_inserted}")
    print(f"{'='*60}")

if __name__ == "__main__":
    run_etl()
```

Run the ETL:
```bash
cd /home/aksai/projects/realestate/backend
python3 etl_social_housing.py
```

---

## Part 4: API Endpoint Integration

### Add to backend/main.py

```python
# Add these imports at the top
from sqlalchemy import text
import json

# Add new API endpoint after line ~300 (after other suburb endpoints)

@app.get("/api/suburbs/{suburb}/religious-institutions")
async def get_religious_institutions_endpoint(suburb: str, state: str, radius_m: int = 2500):
    """Get religious institutions near a suburb"""
    
    # First get suburb center from your existing data
    with engine.connect() as conn:
        suburb_query = text("""
        SELECT centre_lat, centre_lng 
        FROM suburbs_ui_v3 
        WHERE id ILIKE :suburb 
        AND state = :state
        LIMIT 1
        """)
        result = conn.execute(suburb_query, {'suburb': f"%{suburb}%", 'state': state})
        row = result.first()
        
        if not row:
            return {"error": "Suburb not found"}
        
        lat, lng = row[0], row[1]
    
    # Query religious institutions
    from osm_local import get_pois
    pois = get_pois(lat, lng, radius_m, categories=["religious"])
    
    # Calculate statistics
    institutions = pois.get("religious", [])
    religion_counts = {}
    for inst in institutions:
        # Would need to enhance osm_local.py to return religion type
        religion_counts['place_of_worship'] = religion_counts.get('place_of_worship', 0) + 1
    
    diversity_score = min(100, len(religion_counts) * 15 + len(institutions) * 2)
    
    return {
        "suburb": f"{suburb}, {state}",
        "total": len(institutions),
        "by_type": religion_counts,
        "diversity_score": diversity_score,
        "institutions": institutions[:20],  # Limit response
        "radius_m": radius_m
    }


@app.get("/api/suburbs/{suburb}/social-housing")
async def get_social_housing_endpoint(suburb: str, state: str, radius_m: int = 5000):
    """Get social housing concentration near a suburb"""
    
    with engine.connect() as conn:
        suburb_query = text("""
        SELECT centre_lat, centre_lng 
        FROM suburbs_ui_v3 
        WHERE id ILIKE :suburb 
        AND state = :state
        LIMIT 1
        """)
        result = conn.execute(suburb_query, {'suburb': f"%{suburb}%", 'state': state})
        row = result.first()
        
        if not row:
            return {"error": "Suburb not found"}
        
        lat, lng = row[0], row[1]
    
    # Query social housing from database
    housing_query = text("""
    SELECT 
        property_address,
        suburb,
        housing_type,
        dwelling_count,
        development_status,
        ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        )::numeric, 0)::int AS dist_m
    FROM social_housing_properties
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
        :radius_m
    )
    ORDER BY dist_m
    LIMIT 100
    """)
    
    result = conn.execute(housing_query, {
        'lat': lat, 'lng': lng, 'radius_m': radius_m
    })
    rows = result.fetchall()
    
    properties = []
    total_dwellings = 0
    by_type = {}
    
    for row in rows:
        properties.append({
            'address': row[0],
            'suburb': row[1],
            'housing_type': row[2],
            'dwellings': row[3],
            'status': row[4],
            'distance_m': row[5]
        })
        total_dwellings += row[3] or 0
        by_type[row[2]] = by_type.get(row[2], 0) + 1
    
    return {
        "suburb": f"{suburb}, {state}",
        "total_properties": len(properties),
        "total_dwellings": total_dwellings,
        "by_type": by_type,
        "properties": properties[:20],
        "radius_m": radius_m
    }


@app.get("/api/suburbs/{suburb}/construction-activity")
async def get_construction_activity_endpoint(suburb: str, state: str, radius_m: int = 5000):
    """Get construction activity as subdivision proxy"""
    
    with engine.connect() as conn:
        suburb_query = text("""
        SELECT centre_lat, centre_lng 
        FROM suburbs_ui_v3 
        WHERE id ILIKE :suburb 
        AND state = :state
        LIMIT 1
        """)
        result = conn.execute(suburb_query, {'suburb': f"%{suburb}%", 'state': state})
        row = result.first()
        
        if not row:
            return {"error": "Suburb not found"}
        
        lat, lng = row[0], row[1]
    
    # Query construction sites from OSM
    construction_query = text("""
    SELECT 
        name,
        landuse,
        building,
        ROUND(ST_Distance(
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            ST_Transform(way, 4326)::geography
        )::numeric, 0)::int AS dist_m,
        ST_Y(ST_Transform(way, 4326)) as latitude,
        ST_X(ST_Transform(way, 4326)) as longitude
    FROM planet_osm_polygon
    WHERE (
        landuse = 'construction'
        OR building = 'construction'
    )
    AND way && ST_Expand(
        ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857),
        :radius_m / COS(RADIANS(:lat))
    )
    ORDER BY dist_m
    LIMIT 50
    """)
    
    result = conn.execute(construction_query, {
        'lat': lat, 'lng': lng, 'radius_m': radius_m
    })
    rows = result.fetchall()
    
    sites = []
    construction_count = 0
    for row in rows:
        sites.append({
            'name': row[0] or 'Construction site',
            'type': row[1] or row[2],
            'distance_m': row[3],
            'lat': float(row[4]) if row[4] else None,
            'lng': float(row[5]) if row[5] else None
        })
        if row[1] == 'construction' or row[2] == 'construction':
            construction_count += 1
    
    activity_score = min(100, construction_count * 15)
    
    return {
        "suburb": f"{suburb}, {state}",
        "total_sites": len(sites),
        "construction_sites": construction_count,
        "activity_score": activity_score,
        "sites": sites[:20],
        "radius_m": radius_m
    }
```

---

## Part 5: Testing

### Run All Tests

```bash
cd /home/aksai/projects/realestate

# Test 1: Religious institutions
python3 test_religious_data.py

# Test 2: Construction activity
python3 test_construction.py

# Test 3: Social housing ETL (optional, requires API access)
cd backend
python3 etl_social_housing.py

# Test 4: API endpoints (start server first)
cd ..
docker compose up -d backend

# Then test via curl or browser:
curl "http://localhost:8000/api/suburbs/Parramatta/NSW/religious-institutions?radius_m=2500" | jq
```

---

## Troubleshooting

### Issue: planet_osm_point table doesn't exist
**Solution:** Wait for OSM updater to run, or manually import:
```bash
docker exec -it realestate-osm-updater ./import_osm.sh
```

### Issue: No religious institutions found
**Solution:** The area may have no tagged religious buildings in OSM. Try a different location (e.g., Sydney CBD, Melbourne CBD).

### Issue: CKAN API returns 404
**Solution:** Dataset resource IDs change. Use the `discover_ckan_resource()` function to search for current datasets.

---

## Next Steps After Implementation

1. **Add to Frontend UI** - Create new sections in suburb profile for:
   - Religious diversity (pie chart)
   - Social housing concentration
   - Construction activity heatmap

2. **Growth Impact Score** - Combine all indicators:
   ```python
   growth_score = (
       religious_diversity * 0.2 +
       (100 - social_housing_concentration) * 0.3 +
       construction_activity * 0.3 +
       subdivision_pipeline * 0.2
   )
   ```

3. **Historical Tracking** - Store snapshots monthly to track changes

4. **Correlation Analysis** - Compare growth indicators with actual price growth
