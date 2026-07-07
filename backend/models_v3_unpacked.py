"""
models_v3_unpacked.py — Layer 1a: UNPACKED COLUMNAR TABLE
==========================================================
Sits between suburbs_raw_v3 (immutable JSON) and suburbs_ui_v3 (target).
One-time JSON→column extraction eliminates re-parsing 10MB+ JSON per record.
Enrichment to suburbs_ui_v3 becomes pure SQL mapping from this table.
"""
from sqlalchemy import (
    Column, String, JSON, Float, Integer, DateTime, Text,
    Numeric, create_engine, Index
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://realestate_user:realestate_pass@db:5432/realestate"
)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class SuburbUnpackedV3(Base):
    __tablename__ = "suburbs_unpacked_v3"

    id = Column(String, primary_key=True, index=True)
    state = Column(String(3), index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    is_unpacked = Column(String, default="pending")  # pending | complete | error

    # ---- House Market Metrics ----
    house_sale_price = Column(Numeric(14, 2))
    house_median_value = Column(Numeric(14, 2))
    house_change_12m_pct = Column(Numeric(10, 2))
    house_change_5yr_pct = Column(Numeric(10, 2))
    house_median_rent = Column(Numeric(10, 2))
    house_rent_change_pct = Column(Numeric(10, 2))
    house_gross_rental_yield = Column(Numeric(10, 2))
    house_sold_12m = Column(Integer)
    house_price_history = Column(JSONB)
    house_rent_history = Column(JSONB)

    # ---- Unit Market Metrics ----
    unit_sale_price = Column(Numeric(14, 2))
    unit_median_value = Column(Numeric(14, 2))
    unit_change_12m_pct = Column(Numeric(10, 2))
    unit_change_5yr_pct = Column(Numeric(10, 2))
    unit_median_rent = Column(Numeric(10, 2))
    unit_rent_change_pct = Column(Numeric(10, 2))
    unit_gross_rental_yield = Column(Numeric(10, 2))
    unit_sold_12m = Column(Integer)

    # ---- Census Demographics ----
    population_2021 = Column(Integer)
    owner_occupier_rate = Column(Numeric(10, 2))
    investor_rate = Column(Numeric(10, 2))
    median_age = Column(Integer)
    predominant_age_group = Column(String)
    predominant_household = Column(String)
    predominant_income_band = Column(String)
    age_distribution = Column(JSONB)
    household_distribution = Column(JSONB)
    income_distribution = Column(JSONB)

    # ---- Suburb Detail (from description) ----
    description_raw = Column(Text)
    area_sqkm = Column(Numeric(10, 2))
    parks_count = Column(Integer)
    parks_coverage_pct = Column(Numeric(10, 2))
    population_2016 = Column(Integer)
    population_cagr = Column(Numeric(10, 2))
    typical_mortgage_band = Column(String)
    predominant_occupation = Column(String)
    owner_2021_desc = Column(Numeric(10, 2))

    # ---- Property Counts ----
    current_off_market_count = Column(Integer)
    current_sale_listing_count = Column(Integer)
    current_rental_listing_count = Column(Integer)
    current_recent_sales_count = Column(Integer)
    current_recent_sales_count_house = Column(Integer)
    current_recent_sales_count_unit = Column(Integer)

    # ---- Complex Objects ----
    nearby_suburbs = Column(JSONB)
    sales_summary = Column(JSONB)

    # ---- Metadata ----
    unpacked_at = Column(DateTime)

    __table_args__ = (
        Index("idx_unpacked_state", "state"),
    )


print("Unpacked V3 table created/verified.")
Base.metadata.create_all(bind=engine)
