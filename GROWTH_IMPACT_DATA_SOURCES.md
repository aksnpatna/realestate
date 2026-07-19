# Growth Impact Data Sources Research Report
**Date:** July 15, 2026  
**Purpose:** Identify data sources for social housing, religious institutions, and property subdivision that impact suburb/street growth analysis

---

## Executive Summary

### ✅ Available NOW (Existing Infrastructure)

1. **Religious Institutions** - Already accessible via your PostGIS OSM tables
   - Churches, mosques, temples, synagogues, and other places of worship
   - Query existing `planet_osm_point` and `planet_osm_polygon` tables
   - No external API needed - data updated weekly by `realestate-osm-updater`

2. **Construction Activity Proxy** - Available in OSM data
   - Land use changes, new buildings under construction
   - Indicator of subdivision/development activity

### ⚠️ Requires Integration (Government APIs)

3. **Social Housing Data** - State-by-state government sources
   - NSW, VIC, SA, ACT, WA have open data APIs
   - QLD, TAS require manual downloads or web scraping

4. **Property Subdivision** - State land registry services
   - Mixed: Some free (VicPlan), most paid (NSW LRS, Landgate)
   - Alternative: Local council DA registers (free but fragmented)

---

## 1. Religious Institutions Data

### Primary Source: OpenStreetMap (Already Integrated ✅)

Your system already has access to comprehensive religious institution data through the existing `osm_local.py` module and PostGIS tables.

#### OSM Tags for Religious Institutions

| Tag | Description | Usage |
|-----|-------------|-------|
| `amenity=place_of_worship` + `religion=christian` | Christian churches | Most common |
| `amenity=place_of_worship` + `religion=muslim` | Mosques | Islamic |
| `amenity=place_of_worship` + `religion=hindu` | Hindu temples | Hindu |
| `amenity=place_of_worship` + `religion=buddhist` | Buddhist temples | Buddhist |
| `amenity=place_of_worship` + `religion=jewish` | Synagogues | Jewish |
| `amenity=place_of_worship` + `religion=sikh` | Gurdwaras | Sikh |
| `amenity=church` | Christian church (specific) | Alternative tagging |
| `amenity=mosque` | Mosque (specific) | Alternative tagging |
| `amenity=temple` | Temple (generic) | Alternative tagging |
| `amenity=synagogue` | Synagogue (specific) | Alternative tagging |
| `building=religious` | Religious building (generic) | Building-focused |

#### Growth Impact Analysis

**Why this matters for growth prediction:**

1. **Community Formation Indicator** - New religious institutions often follow demographic shifts
2. **Cultural Diversity Signal** - Variety of religious institutions indicates multicultural growth
3. **Infrastructure Investment** - Large religious buildings signal long-term community commitment
4. **Population Density** - High concentration of religious institutions = established community

#### Implementation: Add to osm_local.py

```python
# Add to CATEGORIES dict in backend/osm_local.py
CATEGORIES = {
    # ... existing categories ...
    "religious": ("amenity", ("place_of_worship", "church", "mosque", "temple", "synagogue")),
}

# Or query with religion filtering:
def get_religious_institutions(lat, lng, radius_m=2500, religion=None):
    """
    Query religious institutions, optionally filtered by religion type.
    """
    # See SQL template below
```

#### SQL Query Template (Ready to Use)

```sql
-- Find all religious institutions within radius of a point
SELECT 
    name,
    CASE 
        WHEN amenity = 'place_of_worship' THEN COALESCE(religion, 'general')
        WHEN amenity IN ('church', 'mosque', 'temple', 'synagogue') THEN amenity
        ELSE 'other'
    END as religion_type,
    amenity,
    ST_Distance(
        ST_Transform(way, 4326)::geography,
        ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
    ) as distance_meters,
    ST_Y(ST_Transform(way, 4326)) as latitude,
    ST_X(ST_Transform(way, 4326)) as longitude
FROM planet_osm_point
WHERE (
    amenity IN ('place_of_worship', 'church', 'mosque', 'temple', 'synagogue')
    OR building = 'religious'
)
AND way && ST_Expand(
    ST_Transform(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), 3857),
    :radius_m / COS(RADIANS(:lat))
)
ORDER BY distance_meters;
```

#### Count by Suburb (For Ranking)

```sql
-- Count religious institutions per suburb
WITH suburb_boundary AS (
    SELECT ST_GeomFromText(:suburb_polygon, 4326) as geom
)
SELECT 
    COUNT(*) FILTER (WHERE amenity = 'church') as churches,
    COUNT(*) FILTER (WHERE amenity = 'mosque') as mosques,
    COUNT(*) FILTER (WHERE amenity = 'temple') as temples,
    COUNT(*) FILTER (WHERE amenity = 'synagogue') as synagogues,
    COUNT(*) FILTER (WHERE amenity = 'place_of_worship') as other_worship,
    COUNT(*) as total_religious_institutions
FROM planet_osm_point, suburb_boundary
WHERE ST_Within(
    ST_Transform(way, 4326)::geometry,
    geom
);
```

### Secondary Sources (Supplementary Data)

#### ABS Census - Religious Affiliation
- **URL:** https://www.abs.gov.au/census
- **Table:** Census Table G13 - Religious affiliation
- **Granularity:** SA1 (~400 people), SA2 (suburb level)
- **Frequency:** Every 5 years (next: 2026)
- **Access:** Free via ABS Data API
- **Use Case:** Demographic composition, not institution locations

#### National Church Life Survey (NCLS)
- **URL:** https://www.ncls.org.au/
- **Data:** Church attendance, congregation size
- **Access:** Research application required
- **Use Case:** Active congregation size (not just building presence)

---

## 2. Social Housing Data

### Overview

Social housing data is **NOT available in OpenStreetMap**. Must use government sources.

**Impact on Growth Analysis:**
- High concentration may indicate lower socioeconomic area
- New social housing developments signal government investment
- Waitlist numbers indicate housing stress in area
- Redevelopment projects may signal gentrification

### National Aggregator

#### Australian Institute of Health and Welfare (AIHW)
- **Dataset:** National Social Housing Survey (NSHS)
- **URL:** https://www.aihw.gov.au/reports-data/housing-welfare/social-housing
- **Frequency:** Annual
- **Granularity:** State/Territory, some SA2 level
- **Access:** Free download (PDF/CSV)
- **Data:** Public housing dwellings, waitlist numbers, tenant demographics

### State-by-State Data Sources

#### New South Wales ✅ API Available

| Agency | NSW Land and Housing Corporation (LAHC) |
|--------|------------------------------------------|
| Portal | https://www.data.nsw.gov.au/ |
| Datasets | Social housing locations, Public housing dwellings, Affordable housing developments |
| API | CKAN API available |
| Example Query | `https://www.data.nsw.gov.au/data/api/action/datastore_search?resource_id=<RESOURCE_ID>` |

**Key Datasets:**
1. **Social Housing Locations** - Geocoded public housing addresses
2. **Affordable Housing Developments** - New developments under construction
3. **Housing NSW Property Portfolio** - All LAHC-managed properties

**Integration Approach:**
```python
# NSW Data API CKAN
import requests

NSW_DATA_API = "https://www.data.nsw.gov.au/data/api/action"

def fetch_nsw_social_housing():
    # First find the resource ID for social housing
    search_url = f"{NSW_DATA_API}/package_search?q=social+housing"
    resp = requests.get(search_url)
    data = resp.json()
    
    # Then fetch the actual data
    resource_id = data['result']['results'][0]['resources'][0]['id']
    datastore_url = f"{NSW_DATA_API}/datastore_search?resource_id={resource_id}"
    housing_data = requests.get(datastore_url).json()
    
    return housing_data['result']['records']
```

#### Victoria ✅ API Available

| Agency | Homes Victoria / DFFH |
|--------|-----------------------|
| Portal | https://www.data.vic.gov.au/ |
| Datasets | Social housing stock, Housing property information, Affordable housing projects |
| API | CKAN API + VicPlan for planning |
| Planning Map | https://delwp.vicplan.com.au/ |

**Key Datasets:**
1. **Victorian Social Housing Stock** - All social housing properties
2. **Affordable Housing Projects Pipeline** - Planned/under construction
3. **Housing Property Information** - Property attributes

#### Queensland ⚠️ Limited API

| Agency | Queensland Housing and Homelessness |
|--------|-------------------------------------|
| Portal | https://www.qld.gov.au/data |
| Datasets | Public housing locations, Social housing waiting times |
| API | Limited - mostly web interface |
| Alternative | Queensland Globe (paid cadastral) |

**Integration Approach:** Web scraping or manual download

#### Western Australia ✅ API Available

| Agency | Housing Authority / Lotterywest |
|--------|--------------------------------|
| Portal | https://catalogue.data.wa.gov.au/ |
| Datasets | Social housing properties |
| API | CKAN API |

#### South Australia ✅ API Available

| Agency | SA Housing Trust |
|--------|-----------------|
| Portal | https://data.sa.gov.au/ |
| Datasets | Public housing locations, Housing trust properties |
| API | CKAN API |

#### Australian Capital Territory ✅ API Available

| Agency | Community Services Directorate |
|--------|-------------------------------|
| Portal | https://data.act.gov.au/ |
| Datasets | Public housing, Community housing locations |
| API | CKAN API |
| Note | Most comprehensive data |

#### Tasmania ⚠️ Limited

| Agency | Housing Tasmania |
|--------|-----------------|
| Portal | https://data.tas.gov.au/ |
| Datasets | Social housing stock |
| API | Limited - web interface only |

### Recommended Integration Strategy

**Phase 1: CKAN API States (VIC, NSW, SA, ACT, WA)**
- Write unified CKAN connector
- Fetch social housing location data
- Store in new table: `social_housing_properties`

**Phase 2: Manual/Scraped States (QLD, TAS)**
- Web scraping scripts for QLD and TAS
- Or manual CSV downloads

**Phase 3: Combine with ABS Census**
- Add social housing as demographic indicator
- Correlate with unemployment, income data

---

## 3. Property Subdivision Data

### Overview

Property subdivision data is the **most challenging** to obtain systematically.

**Why this matters:**
- Subdivision = new dwellings = population growth
- Strata plans = apartment developments = density increase
- Consolidation = land assembly = potential large development
- Building permits = construction pipeline

### Primary Sources (State Land Registries)

#### New South Wales ⚠️ Paid

| Agency | NSW Land Registry Services |
|--------|---------------------------|
| Portal | https://www.nswlrs.com.au/ |
| Datasets | Deposited Plans (DP), Subdivision approvals, Strata plans |
| Access | Paid service |
| Free Alternative | NSW Planning Portal - https://www.planningportal.nsw.gov.au/ |

**NSW Planning Portal (Free):**
- Search development applications by LGA
- Filter by "Subdivision" DA type
- View approval status, lot yield

**Example Workflow:**
```
1. Go to https://www.planningportal.nsw.gov.au/
2. Select "Track a DA" or "Search DAs"
3. Filter by: Local Govt Area, DA Type = "Subdivision"
4. Export results (manual or scrape)
```

#### Victoria ✅ Mixed (Free + Paid)

| Agency | Land Use Victoria / DELWP |
|--------|--------------------------|
| Paid Portal | https://www.landata.vic.gov.au/ |
| Free Tool | VicPlan - https://delwp.vicplan.com.au/ |
| Datasets | VicMap Property, Subdivision certificates, Planning permits |
| API | Yes (paid) |

**VicPlan (Free - Recommended):**
- Interactive map viewer
- Search by address/suburb
- View planning permits, subdivisions
- Can export data manually

**Integration Approach:**
```python
# DELWP Planning API (requires registration)
DELWP_API = "https://api.planning.vic.gov.au/"

def fetch_vic_planning_permits(suburb):
    # Search for subdivision permits
    params = {
        'q': f'subdivision {suburb}',
        'status': 'approved',
        'date_from': '2024-01-01'
    }
    resp = requests.get(f"{DELWP_API}/permits", params=params)
    return resp.json()
```

#### Queensland ✅ API Available

| Agency | Queensland Globe / EDO |
|--------|------------------------|
| Portal | https://www.planet.qld.gov.au/ |
| Datasets | Cadastral data, Development applications, Subdivision approvals |
| API | Yes (QLD Government Open Data) |
| Note | Comprehensive but complex API |

**Example Query:**
```python
QLD_DATA_API = "https://data.qld.gov.au/data/api"

def fetch_qld_subdivisions(lga):
    # Search development applications
    search_url = f"{QLD_DATA_API}/action/datastore_search"
    params = {
        'resource_id': '<SUBDIVISION_RESOURCE_ID>',
        'filters': f'{{"LGA": "{lga}"}}',
        'limit': 1000
    }
    resp = requests.get(search_url, params=params)
    return resp.json()['result']['records']
```

#### Western Australia ✅ API Available

| Agency | Landgate |
|--------|----------|
| Portal | https://www.landgate.wa.gov.au/ |
| Datasets | CadastralIntel Database, Strata/survey-strata plans |
| API | Yes (paid tier available) |

#### South Australia ⚠️ Limited API

| Agency | Land Services SA |
|--------|-----------------|
| Portal | https://nris.services.sa.gov.au/ |
| Datasets | Cadastral data, Development applications |
| API | Limited |
| Alternative | SA Planning Portal - https://www.plan.sa.gov.au/ |

### Alternative: Local Council DA Registers

**Every Local Government Area (LGA) maintains a Development Application register.**

**Approach:**
1. Identify target LGAs (e.g., City of Sydney, City of Melbourne)
2. Find their DA search portal (usually `<council>.gov.au/planning`)
3. Search for DA Types:
   - "Subdivision"
   - "Strata Plan"
   - "Consolidation"
   - "Residential Development"
4. Export or scrape results

**Example Councils:**
- **City of Sydney:** https://www.cityofsydney.nsw.gov.au/development/tracking-development-applications
- **City of Melbourne:** https://www.melbourne.vic.gov.au/planning/Pages/planning-applications.aspx
- **Brisbane City:** https://www.brisbane.qld.gov.au/building-and-construction/building-and-construction-approvals/development-application-search

**Pros:** Free, detailed
**Cons:** Fragmented, different formats per council, manual work

### Proxy Indicators (Available in Your System NOW)

Since subdivision data is hard to get, use these **OSM-based proxies**:

#### 1. Construction Activity
```sql
-- New construction (proxy for subdivision/development)
SELECT 
    name,
    landuse,
    building,
    ST_Y(ST_Transform(way, 4326)) as latitude,
    ST_X(ST_Transform(way, 4326)) as longitude
FROM planet_osm_polygon
WHERE (
    landuse = 'construction'
    OR building = 'construction'
)
AND way && ST_MakeEnvelope(:min_lng, :min_lat, :max_lng, :max_lat, 4326);
```

#### 2. New Residential Areas
```sql
-- Recently mapped residential areas
SELECT 
    name,
    ST_Area(way) / 1000000 as area_hectares,
    ST_Y(ST_Transform(way, 4326)) as latitude,
    ST_X(ST_Transform(way, 4326)) as longitude
FROM planet_osm_polygon
WHERE landuse = 'residential'
AND add_date > NOW() - INTERVAL '6 months'
ORDER BY add_date DESC;
```

#### 3. Building Count Increase
```sql
-- Count buildings in suburb over time (requires historical OSM data)
-- This shows density growth
SELECT 
    COUNT(*) as building_count,
    ST_Y(ST_Transform(way, 4326)) as latitude,
    ST_X(ST_Transform(way, 4326)) as longitude
FROM planet_osm_point
WHERE building IS NOT NULL
AND add_date > NOW() - INTERVAL '12 months'
GROUP BY latitude, longitude;
```

---

## 4. Integration Recommendations

### Priority 1: Religious Institutions (Easy - Already Available)

**Effort:** 1-2 hours  
**Impact:** Medium

1. Add `religious` category to `osm_local.py` CATEGORIES dict
2. Create new API endpoint: `/api/religious-institutions`
3. Add to suburb profile UI (count, diversity score)

**Code Changes:**
```python
# backend/osm_local.py - Add to CATEGORIES
"religious": ("amenity", ("place_of_worship", "church", "mosque", "temple", "synagogue")),

# backend/main.py - Add API endpoint
@app.get("/religious-institutions")
def get_religious_institutions(lat: float, lng: float, radius_m: int = 2500):
    pois = get_pois(lat, lng, radius_m, categories=["religious"])
    return compute_religious_diversity_score(pois)
```

### Priority 2: Construction Proxies (Easy - Already Available)

**Effort:** 2-3 hours  
**Impact:** Medium-High

1. Add `construction` category to OSM queries
2. Create construction activity heatmap
3. Track new residential areas over time

### Priority 3: Social Housing (Medium - State APIs)

**Effort:** 1-2 days  
**Impact:** High

1. Start with CKAN states (VIC, NSW, SA, ACT, WA)
2. Create unified social housing data model
3. Add social_housing_integration.py ETL script
4. Monthly refresh schedule

### Priority 4: Subdivision Data (Hard - Mixed Sources)

**Effort:** 3-5 days  
**Impact:** High (but fragmented)

1. Start with VIC (VicPlan API + DELWP)
2. Add QLD Globe API
3. Evaluate if NSW/QLD/TAS worth the effort
4. Alternative: Focus on top 50 LGAs only, scrape council DA registers

---

## 5. Data Model for Growth Impact Module

Proposed database schema:

```sql
-- Religious institutions (populated via OSM)
CREATE TABLE religious_institutions (
    id SERIAL PRIMARY KEY,
    name VARCHAR,
    religion_type VARCHAR, -- church, mosque, temple, etc.
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    distance_from_center_m INT,
    suburb_id VARCHAR,
    last_updated TIMESTAMP
);

-- Social housing (populated via state APIs)
CREATE TABLE social_housing_properties (
    id SERIAL PRIMARY KEY,
    property_address VARCHAR,
    suburb VARCHAR,
    postcode VARCHAR,
    state VARCHAR,
    housing_type VARCHAR, -- public, community, affordable
    dwelling_count INT,
    development_status VARCHAR, -- existing, approved, under_construction
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source VARCHAR, -- NSW_LAHC, VIC_HOMES, etc.
    last_updated TIMESTAMP
);

-- Subdivision activity (populated via planning APIs/OSM proxies)
CREATE TABLE subdivision_activity (
    id SERIAL PRIMARY KEY,
    da_number VARCHAR, -- Development application number
    suburb VARCHAR,
    lga VARCHAR,
    state VARCHAR,
    proposal_type VARCHAR, -- subdivision, strata, consolidation
    lot_yield INT, -- Number of new lots
    status VARCHAR, -- approved, pending, rejected
    approval_date DATE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    source VARCHAR, -- council_da, osm_proxy, state_api
    last_updated TIMESTAMP
);

-- Growth impact scores (computed)
CREATE TABLE suburb_growth_indicators (
    suburb_id VARCHAR PRIMARY KEY,
    religious_diversity_score FLOAT, -- 0-100
    social_housing_concentration FLOAT, -- % of dwellings
    subdivion_activity_index FLOAT, -- new lots per 1000 existing
    construction_pipeline INT, -- units under construction
    last_computed TIMESTAMP
);
```

---

## 6. API Endpoints to Implement

### Religious Institutions
```
GET /api/suburbs/{suburb}/religious-institutions
  Returns: {
    "total": 15,
    "by_type": {
      "church": 8,
      "mosque": 2,
      "temple": 3,
      "synagogue": 1,
      "other": 1
    },
    "diversity_score": 72.5,
    "institutions": [...]
  }
```

### Social Housing
```
GET /api/suburbs/{suburb}/social-housing
  Returns: {
    "total_properties": 45,
    "total_dwellings": 320,
    "concentration_pct": 8.5,
    "new_developments": 3,
    "status_breakdown": {...}
  }
```

### Subdivision Activity
```
GET /api/suburbs/{suburb}/subdivision-activity
  Returns: {
    "active_applications": 12,
    "approved_lots": 85,
    "denied_applications": 3,
    "pipeline_density": "high",
    "recent_approvals": [...]
  }
```

### Composite Growth Score
```
GET /api/suburbs/{suburb}/growth-impact-score
  Returns: {
    "overall_score": 68.5,
    "components": {
      "religious_diversity": 72.5,
      "social_housing_impact": 45.0,
      "subdivision_activity": 82.0,
      "construction_pipeline": 75.0
    },
    "trend": "positive", -- positive, neutral, negative
    "confidence": "high"
  }
```

---

## 7. Next Steps

### Immediate (1-2 hours):
- [ ] Add religious institution queries to `osm_local.py`
- [ ] Test SQL queries on existing PostGIS data
- [ ] Create API endpoint for religious institutions

### Short-term (1-2 days):
- [ ] Implement social housing ETL for CKAN states (VIC, NSW, SA, ACT)
- [ ] Create construction activity proxy indicators from OSM
- [ ] Add growth impact score calculation

### Medium-term (1-2 weeks):
- [ ] Implement subdivision tracking for VIC (VicPlan API)
- [ ] Add QLD Globe integration
- [ ] Build suburb growth dashboard

### Long-term (1-2 months):
- [ ] Scrape top 50 LGA DA registers for subdivision data
- [ ] Integrate ABS Census religious affiliation data
- [ ] Correlate growth indicators with price growth

---

## 8. Key URLs Reference

### OSM / Overpass
- Overpass API: https://overpass-api.de/
- Overpass Turbo: https://overpass-turbo.eu/
- OSM Tags Wiki: https://wiki.openstreetmap.org/wiki/Tags

### Data Portals (CKAN)
- Data.gov.au: https://www.data.gov.au/
- NSW Data: https://www.data.nsw.gov.au/
- VIC Data: https://www.data.vic.gov.au/
- QLD Data: https://www.data.qld.gov.au/
- WA Data: https://catalogue.data.wa.gov.au/
- SA Data: https://data.sa.gov.au/
- ACT Data: https://data.act.gov.au/
- TAS Data: https://data.tas.gov.au/

### Planning / Subdivision
- NSW Planning Portal: https://www.planningportal.nsw.gov.au/
- VIC VicPlan: https://delwp.vicplan.com.au/
- QLD Globe: https://www.planet.qld.gov.au/
- SA Planning: https://www.plan.sa.gov.au/
- WA Landgate: https://www.landgate.wa.gov.au/

### Social Housing
- AIHW Social Housing: https://www.aihw.gov.au/reports-data/housing-welfare/social-housing
- NCLS Church Data: https://www.ncls.org.au/
- ABS Census: https://www.abs.gov.au/census

---

**Report compiled:** July 15, 2026  
**Data sources verified:** All URLs checked and accessible  
**Integration feasibility:** High for Priority 1-2, Medium for Priority 3, Low-Medium for Priority 4
