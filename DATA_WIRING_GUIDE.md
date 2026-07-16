## New Data Fields Available in API (Post-Fix)

All fields are populated and tested. Below is the complete map for UI consumption.

### 1. Suburb Detail API (`GET /api/suburbs/{id}`)

**New demographics fields (ABS Census 2021):**
| Field | Type | Example | Source |
|-------|------|---------|--------|
| `absDemographicsSourced` | bool | `true` | ABS Census 2021 |
| `absSourcedFields` | [str] | `["population_2021","median_age",...]` | ABS |
| `demographics.median_annual_income_abs` | int | `38532` | G02 personal median × 52 |
| `demographics.predominant_income_band` | str | `"$2,000-$2,499"` | G17 income bands (weekly household) |
| `demographics.income_distribution` | obj | `{"$1-$149":0.9,"$150-$299":1.7,...}` | 17 income bands as pct |
| `demographics.age_distribution` | obj | `{"0-4":6.1,"5-14":9.5,...}` | 11 age bands as pct |
| `demographics.median_rent_weekly_abs` | float | `400.0` | G02 Census median rent |
| `demographics.median_mortgage_monthly_abs` | float | `1900.0` | G02 Census mortgage median |
| `demographics.median_hhd_inc_weekly_abs` | float | `1926.0` | G02 household income median |

**Social housing (ABS Census 2021 G37):**
| Field | Type | Example | Source |
|-------|------|---------|--------|
| `socialHousingPct` | float | `5.11` | Combined state + community housing % |
| `publicHousingDwellings` | int | `946` | State housing authority dwellings |
| `communityHousingDwellings` | int/null | `120` | Community housing provider dwellings |
| `renterStateHousingPct` | float | `2.8` | % renters in state housing |
| `renterCommunityHousingPct` | float | `0.6` | % renters in community housing |
| `absG37Sourced` | bool | `true` | G37 tenure data provenance |

**Social infrastructure (OSM via PostGIS):**
| Field | Type | Example | Source |
|-------|------|---------|--------|
| `worshipTotal` | int | `18` | Total places of worship |
| `worshipChristian/muslim/buddhist/hindu/sikh/jewish/other` | int | `16` | By religion |
| `worshipDetail` | [obj] | `[{name,dist_m,religion}]` | Detailed worship POI list |
| `shelterCount` | int | `7` | amenity=shelter |
| `communityCentreCount` | int | `3` | amenity=community_centre |
| `retirementHomeCount` | int | `1` | amenity=retirement_home |
| `socialInfraDetail` | [obj] | `[{name,dist_m}]` | Detailed social infra list |

**Development indicators (OSM landuse):**
| Field | Type | Example | Source |
|-------|------|---------|--------|
| `constructionSqkm` | float | `0.002` | landuse=construction area |
| `greenfieldSqkm` | float | `0.005` | landuse=greenfield area |
| `brownfieldSqkm` | float | `0.010` | landuse=brownfield area |
| `buildingConstructionCount` | int | `5` | building=construction count |

### 2. OSM Livability API (`GET /api/osm/livability`)

New query params: `suburb_id` (optional — returns aggregate pre-computed data)

New POI categories returned:
- `worship` — places of worship within radius
- `shelters` — homeless/emergency shelters
- `community_centres` — community centres
- `retirement_homes` — retirement villages/homes
- `shops`, `hospitals`, `sports` — existing but now included in scoring

New scores:
- `socialInfraScore` (0-15): community_centres + shelters + retirement_homes × 3
- `worshipDiversityScore` (0-10): worship venues × 2
- `liveabilityScore` now includes social infra + worship diversity

New aggregate section (when `suburb_id` provided):
```json
"aggregate": {
  "worship_total": 44,
  "worship_christian": 39,
  "worship_muslim": 2,
  "shelter_count": 90,
  "construction_sqkm": 0.099,
  "greenfield_sqkm": 0.001,
  "brownfield_sqkm": 0.054
}
```

### 3. Cadastral Parcels

NSW-only, via ArcGIS REST (Cadastre_History). Table: `cadastral_parcels`.
- 23,823 parcels loaded for Blacktown
- Each parcel has: `cad_id`, `lot_number`, `plan_label`, `area_sqm`, `geom` (MultiPolygon, EPSG:4326), `suburb_id`
- Suburb-level: `cadastral_source` = "NSW Spatial Services ArcGIS REST", `cadastral_last_synced` timestamp

Run for more suburbs:
```bash
docker exec realestate-backend python etl_nsw_cadastre.py --limit 10
```

### 4. UI Integration Checklist

**Suburb Detail Card:**
- [ ] Add "ABS Census 2021" badge when `absDemographicsSourced` is true
- [ ] Show `median_annual_income_abs` as "$38,532/yr (ABS)" in Demographics section
- [ ] Display `predominant_income_band` as weekly household income band
- [ ] Add income distribution bar chart using `demographics.income_distribution`
- [ ] Add age distribution bar chart using `demographics.age_distribution`
- [ ] Show `socialHousingPct` in Demographics section (e.g., "Social Housing: 5.1%")
- [ ] Add Social Infrastructure panel: worship breakdown, shelters, community centres
- [ ] Add Development Indicators panel: construction/greenfield/brownfield sqkm

**Livability Panel:**
- [ ] Show worship and shelter POIs alongside existing cafe/park/transit lists
- [ ] Display socialInfraScore and worshipDiversityScore
- [ ] When suburb_id available, show aggregate pre-computed counts

**Cadastral (NSW only):**
- [ ] Add parcel count and avg lot size to suburb detail
- [ ] Show cadastral_source provenance
