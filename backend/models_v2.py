import os
from sqlalchemy import Column, String, JSON, Boolean, Float, Integer, DateTime, create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SuburbRawV2(Base):
    """
    Ingestion Target Layer. Stores the pure, unprocessed JSON payload extracted from OnTheHouse.
    Built for extremely fast writing without blocking the scraper.
    """
    __tablename__ = "suburbs_raw_v2"
    id = Column(String, primary_key=True, index=True) # e.g. "VIC_WYNDHAM_VALE_3024"
    state = Column(String, index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    status = Column(String, index=True, default="pending") # pending, complete, error, not_found
    error_log = Column(String) # Capture error trace if any
    raw_json = Column(JSON) # The exact window.REDUX_DATA payload
    last_scraped = Column(DateTime)

class SuburbUIV2(Base):
    """
    Normalized and Transformed Layer. 
    Ready for immediate frontend consumption.
    """
    __tablename__ = "suburbs_ui_v2"
    id = Column(String, primary_key=True, index=True)
    state = Column(String, index=True)
    name = Column(String, index=True)
    postcode = Column(String)
    is_live = Column(Boolean, default=False, index=True)
    
    # House specific metrics
    house_median_price = Column(Float)
    house_median_growth = Column(Float)
    house_weekly_rent = Column(Float)
    house_rental_yield = Column(Float)
    house_rental_yield_trend = Column(Float)
    
    # Unit specific metrics
    unit_median_price = Column(Float)
    unit_median_growth = Column(Float)
    unit_weekly_rent = Column(Float)
    unit_rental_yield = Column(Float)
    unit_rental_yield_trend = Column(Float)
    
    # General Metrics
    total_properties = Column(Integer)
    vacancy_rate = Column(Float)
    days_on_market = Column(Integer)
    
    # Demographics & Environment
    population = Column(Integer)
    owner_occupier_rate = Column(Float) # 0-100
    parks_count = Column(Integer)
    area_sqkm = Column(Float)
    
    # Complex JSON stores
    history = Column(JSON)      # Actual 10 year time-series data [{year: 2017, price: ...}, ...]
    demographics = Column(JSON) # Age distribution, occupancy etc
    schools = Column(JSON)
    pois = Column(JSON)
    
    last_updated = Column(DateTime)

# Create tables if not exists
Base.metadata.create_all(bind=engine)
