"""
models_v3.py — Clean ETL Architecture v3
=========================================
LAYER 1 (RAW / EXTRACTION): suburbs_raw_v3
  - Pure, unmodified JSON payload from OnTheHouse window.REDUX_DATA
  - Zero transformation at extraction time
  - Serves as immutable audit trail

LAYER 2 (NORMALIZED / TRANSFORM): suburbs_ui_v3
  - Clean columnar schema designed for instutional investor consumption
  - All field names match exactly what the frontend expects
  - Data quality rules applied during transform, not extraction

KEY PRINCIPLES:
  - Extraction layer NEVER modifies data
  - Transform layer is idempotent — can be re-run at any time
  - Separate DQ view for quality reporting
"""
import os
from sqlalchemy import (
    Column, String, JSON, Boolean, Float, Integer,
    DateTime, Text, create_engine, Index
)
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://realestate_user:realestate_pass@db:5432/realestate"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# =============================================================================
# LAYER 1 — RAW EXTRACTION (immutable source of truth)
# =============================================================================
class SuburbRawV3(Base):
    __tablename__ = "suburbs_raw_v3"
    id = Column(String, primary_key=True, index=True)       # e.g. "VIC_WYNDHAM_VALE_3024"
    state = Column(String(3), index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    status = Column(String, index=True, default="pending")   # pending | complete | error | not_found | skipped
    error_log = Column(Text)
    raw_json = Column(JSON)                                   # Full window.REDUX_DATA payload
    raw_json_size = Column(Integer)                           # Byte count for quick quality flag
    url = Column(String)
    last_scraped = Column(DateTime)

    __table_args__ = (
        Index("idx_raw_v3_status_state", "status", "state"),
    )

# =============================================================================
# LAYER 2 — NORMALIZED / TRANSFORM (ready for frontend consumption)
# =============================================================================
class SuburbUIV3(Base):
    __tablename__ = "suburbs_ui_v3"
    id = Column(String, primary_key=True, index=True)
    state = Column(String(3), index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    is_enriched = Column(Boolean, default=False, index=True)  # True if raw data was available

    # ---- HOUSE METRICS ----
    house_median_price = Column(Float)
    house_median_price_12m_change = Column(Float)             # 12-month $ change
    house_median_price_12m_change_pct = Column(Float)          # 12-month % change
    house_median_rent = Column(Float)                          # Weekly rent
    house_median_rent_12m_change = Column(Float)               # Rent 12-month $ change
    house_gross_rental_yield = Column(Float)                   # Gross yield %
    house_gross_rental_yield_trend = Column(Float)             # 12-month yield change
    house_days_on_market = Column(Integer)
    house_auction_clearance_rate = Column(Float)               # %
    house_stock_on_market = Column(Integer)
    house_sold_12m = Column(Integer)                           # 12-month sales volume

    # ---- UNIT METRICS ----
    unit_median_price = Column(Float)
    unit_median_price_12m_change_pct = Column(Float)
    unit_median_rent = Column(Float)
    unit_gross_rental_yield = Column(Float)
    unit_gross_rental_yield_trend = Column(Float)
    unit_days_on_market = Column(Integer)

    # ---- GENERAL MARKET ----
    total_properties = Column(Integer)
    vacancy_rate = Column(Float)
    supply_demand_ratio = Column(Float)                       # Listings / Sales

    # ---- DEMOGRAPHICS & HOUSING ----
    population_2021 = Column(Integer)
    population_2016 = Column(Integer)
    population_cagr = Column(Float)                            # 5-year CAGR %
    population_density = Column(Float)                         # per sqkm
    owner_occupier_rate = Column(Float)                        # %
    investor_rate = Column(Float)                              # %
    median_age = Column(Integer)
    predominant_age_group = Column(String)
    predominant_occupation = Column(String)
    average_household_size = Column(Float)
    area_sqkm = Column(Float)

    # ---- FINANCIAL ----
    typical_mortgage_band = Column(String)                     # "$1800 - $2100/month"
    price_to_income_ratio = Column(Float)
    price_to_rent_ratio = Column(Float)

    # ---- ENVIRONMENT ----
    parks_count = Column(Integer)
    parks_coverage_pct = Column(Float)

    # ---- SCHOOLS (from ACARA) ----
    school_count = Column(Integer)
    avg_icsea = Column(Float)                                  # ICSEA index average
    top_school_name = Column(String)

    # ---- TIME SERIES ----
    history_10yr = Column(JSON)                                # [{date: "2016-01", value: 450000}, ...]
    history_rent_10yr = Column(JSON)                           # [{date: "2016-01", value: 350}, ...]

    # ---- COMPLEX OBJECTS ----
    demographics_detail = Column(JSON)                         # Age distribution, household type, etc.
    sales_summary = Column(JSON)                               # Recent sales, price segments
    nearby_suburbs = Column(JSON)                              # Comparable suburbs with metrics

    # ---- ENRICHMENT (migrated from V2 for self-sufficiency) ----
    schools = Column(JSON)
    pois = Column(JSON)
    highlights = Column(JSON)
    school_quality = Column(Float)
    transit_accessibility = Column(Float)
    cbd_distance_mins = Column(Integer)
    metro_cbd = Column(String)
    safety_score = Column(Float)
    crime_rate = Column(Float)
    coordinates = Column(JSON)
    ai_insights = Column(JSON)
    nearby_pois = Column(JSON)
    population = Column(Integer)
    is_live = Column(Boolean, default=True)
    rental_stock = Column(Integer)
    current_median_price = Column(Float)
    unemployment_rate = Column(Float)
    building_approvals_12m = Column(Integer)
    infrastructure_investment = Column(String)

    # ---- SOCIAL INFRASTRUCTURE & FUTURE-GROWTH INDICATORS (new) ----
    # Places of worship (from OSM planet_osm_* — amenity=place_of_worship)
    worship_total = Column(Integer)
    worship_christian = Column(Integer)
    worship_muslim = Column(Integer)
    worship_buddhist = Column(Integer)
    worship_hindu = Column(Integer)
    worship_sikh = Column(Integer)
    worship_jewish = Column(Integer)
    worship_other = Column(Integer)
    worship_detail = Column(JSON)

    # Social infrastructure (from OSM — shelter/community_centre/retirement_home)
    shelter_count = Column(Integer)
    community_centre_count = Column(Integer)
    retirement_home_count = Column(Integer)
    social_infra_detail = Column(JSON)

    # ---- SUBDIVISION PRECEDENT ----
    # Real-world subdivision precedent
    approved_subdivisions_12m = Column(Integer, default=0)

    # ---- DERIVED INDICATORS (from OSM landuse & building) ----
    construction_sqkm = Column(Float)
    greenfield_sqkm = Column(Float)
    brownfield_sqkm = Column(Float)
    building_construction_count = Column(Integer)
    osm_enriched_at = Column(DateTime)
    osm_enrich_radius_m = Column(Integer)

    # Social housing (from ABS Census 2021 G37 — tenure & landlord type)
    public_housing_dwellings = Column(Integer)        # landlord type 4 (state/territory housing authority)
    community_housing_dwellings = Column(Integer)     # landlord type 5 (community housing provider)
    renter_state_housing_pct = Column(Float)
    renter_community_housing_pct = Column(Float)
    social_housing_pct = Column(Float)                # combined 4+5 as % of total dwellings
    abs_g37_sourced = Column(Boolean, default=False)
    abs_g37_run_date = Column(DateTime)

    # Cadastral / subdivision signal (from state land registries via data.gov.au)
    cadastral_source = Column(String)
    cadastral_last_synced = Column(DateTime)

    # ---- DATA PROVENANCE (legal defensibility) ----
    abs_demographics_sourced = Column(Boolean, default=False)  # True = ABS Census 2021 is the source for demographics fields
    abs_sourced_fields = Column(JSON)                          # List of field names confirmed from ABS e.g. ["population_2021", "median_age"]
    abs_etl_run_date = Column(DateTime)                        # When ABS data was last applied

    # ---- DQ METADATA & LINEAGE ----
    dq_issues = Column(JSON)                                   # [{field: "house_yield", issue: "negative", severity: "warning"}, ...]
    dq_score = Column(Float, default=100.0)                    # 0-100 quality score
    transform_version = Column(Integer, default=3)
    last_updated = Column(DateTime)
    source_raw_id = Column(String)                             # Lineage: points to suburbs_raw_v3.id
    transform_run_id = Column(String)                          # Lineage: UUID of the ETL run
    transform_timestamp = Column(DateTime)                     # Lineage: exact time of transform

    # ---- ON-DEMAND AI ANALYSIS (lazy, cached) ----
    news_sentiment = Column(JSON)  # {score, label, summary, articles, fetched_at}

# =============================================================================
# LAYER 3 — ANALYTICS / TIME-SERIES (High Performance)
# =============================================================================
class SuburbPriceHistory(Base):
    """
    Time-series table for 10-year historical price data.
    Separated from SuburbUIV3 to prevent JSONB extraction overhead during
    analytical queries. Designed for fast indexed filtering by suburb and date.
    """
    __tablename__ = "suburb_price_history"
    id = Column(Integer, primary_key=True, autoincrement=True)
    suburb_id = Column(String, index=True)
    property_type = Column(String, index=True)  # "house" or "unit"
    record_date = Column(DateTime, index=True)  # e.g., "2016-01-01"
    median_price = Column(Float)
    median_rent = Column(Float)

    __table_args__ = (
        Index('idx_suburb_date_type', 'suburb_id', 'property_type', 'record_date'),
    )

# =============================================================================
# LAYER 4 — PROPERTY LISTINGS (Bridging "Where" to "What")
# =============================================================================
class PropertyListing(Base):
    __tablename__ = "property_listings"
    id = Column(String, primary_key=True, index=True)          # Unique ID from source
    suburb_id = Column(String, index=True)                     # Foreign key logically to suburbs_ui_v3.id
    address = Column(String)
    bedrooms = Column(Integer)
    bathrooms = Column(Integer)
    car_spaces = Column(Integer)
    property_type = Column(String)                             # House, Unit, Townhouse, etc.
    listing_type = Column(String, index=True)                  # sale | rent | sold
    price_display = Column(String)
    estimated_price = Column(Float)                            # Parsed numeric price
    images_json = Column(JSON)                                 # Array of image URLs
    crawl_source = Column(String)                              # e.g., onthehouse.com.au
    last_crawled = Column(DateTime)
    
    __table_args__ = (
        Index("idx_property_suburb_type", "suburb_id", "listing_type"),
    )

class CommitteeMemory(Base):
    """Store committee analyses for similarity-based few-shot retrieval."""
    __tablename__ = "committee_memory"
    id = Column(Integer, primary_key=True, autoincrement=True)
    suburb = Column(String, index=True)
    state = Column(String(3), index=True)
    growth_score = Column(Float, index=True)
    rental_yield = Column(Float)
    vacancy_rate = Column(Float)
    median_price = Column(Float)
    verdict = Column(String)
    bull_argument = Column(Text)
    bear_argument = Column(Text)
    urban_argument = Column(Text)
    playbook = Column(Text)
    risk_rating = Column(String)
    raw_metrics_payload = Column(JSON)
    created_at = Column(DateTime)
    prompt_version = Column(String, default="ciov1-text-1.0")
    model_version = Column(String, default="buyfit-1.0.0")
    provider = Column(String, default="unknown")
    input_hash = Column(String, default="")
    review_status = Column(String, default="unreviewed")
    outcome_status = Column(String, default="pending")
    outcome_score = Column(Float, default=0.0)
    benchmark_return = Column(Float, default=0.0)
    verified_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("idx_cm_state_growth", "state", "growth_score"),
        Index("idx_cm_state_yield", "state", "rental_yield"),
        Index("idx_cm_review", "review_status", "outcome_status"),
    )

class ModelDiary(Base):
    """
    Time-based outcome tracking for model predictions (Priority 6).
    Stores the deterministic score and AI verdict at time T, enabling retrospective 
    evaluation of accuracy at T+6m, T+12m, and T+36m before attempting fine-tuning.
    """
    __tablename__ = "model_diary"
    id = Column(Integer, primary_key=True, autoincrement=True)
    suburb_id = Column(String, index=True)
    prediction_date = Column(DateTime, index=True, default=datetime.utcnow)
    
    # What was predicted?
    predicted_fit_score = Column(Float)
    ai_verdict = Column(String)
    
    # What was the state of the world at time T?
    baseline_median_price = Column(Float)
    baseline_rental_yield = Column(Float)
    baseline_vacancy_rate = Column(Float)
    data_quality_score = Column(Float)
    
    # Outcome tracking (populated later by a scheduled job)
    realized_price_6m = Column(Float)
    realized_price_12m = Column(Float)
    realized_price_36m = Column(Float)
    outcome_rating = Column(String)

Base.metadata.create_all(bind=engine)
print("V3 tables created/verified.")
