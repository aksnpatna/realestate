import os
import sys
import json
import asyncio
import urllib.request
import re
import datetime
from sqlalchemy import Column, String, JSON, Boolean, Float, Integer, DateTime, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SuburbAllModel(Base):
    __tablename__ = "suburbs_all"
    id = Column(String, primary_key=True, index=True)
    state = Column(String)
    name = Column(String)
    postcode = Column(String)
    status = Column(String, index=True, default="pending") # pending, complete, error
    is_live = Column(Boolean, default=False, index=True)
    data = Column(JSON)

class SuburbGeodataModel(Base):
    __tablename__ = "suburbs_geodata"
    suburb_id = Column(String, primary_key=True, index=True)
    lat = Column(Float)
    lon = Column(Float)
    pois = Column(JSON)
    last_updated = Column(DateTime)

class CrimeStatModel(Base):
    __tablename__ = "crime_stats"
    id = Column(String, primary_key=True, index=True) # e.g. "nsw_sydney"
    state = Column(String, index=True)
    lga_name = Column(String, index=True)
    total_incidents = Column(Integer)
    population = Column(Integer)
    crime_rate_per_100k = Column(Float)
    last_updated = Column(DateTime)

class SuburbUIModel(Base):
    __tablename__ = "suburbs_ui"
    id = Column(String, primary_key=True, index=True)
    state = Column(String, index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    is_live = Column(Boolean, default=False, index=True)
    growth_score = Column(Float, index=True)
    median_price = Column(Float)
    weekly_rent = Column(Float)
    rental_yield = Column(Float)
    rental_yield_pct = Column(Float)
    total_properties = Column(Integer)
    owner_occupier_rate = Column(Float)
    population = Column(Integer)
    area_sqkm = Column(Float)
    parks_count = Column(Integer)
    school_quality = Column(Float)
    transit_accessibility = Column(Float)
    cbd_distance_mins = Column(Integer)
    metro_cbd = Column(String)
    
    # Crime/Safety
    safety_score = Column(Float)
    crime_rate_per_100k = Column(Float)
    
    # Store heavy arrays separately
    schools = Column(JSON)
    history = Column(JSON)
    highlights = Column(JSON)
    ai_insights = Column(JSON)
    nearby_pois = Column(JSON)
    demographics = Column(JSON)
    metrics = Column(JSON) # fallback for other metrics
    # Geodata
    lat = Column(Float)
    lon = Column(Float)
    pois = Column(JSON)
    last_updated = Column(DateTime)
# Create table if not exists
Base.metadata.create_all(bind=engine)

