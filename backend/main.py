import os
import json
import time
import hashlib
import secrets
import asyncio
import logging
from collections import OrderedDict
from datetime import datetime
from typing import Optional
from fastapi import FastAPI, HTTPException, Depends, Header, BackgroundTasks, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from dotenv import load_dotenv
from parallel_scraper import SuburbAllModel, SuburbUIModel
from models_v2 import SuburbUIV2
from models_v3 import SuburbUIV3, PropertyListing

Base = declarative_base()

import jwt
from passlib.context import CryptContext

# Try to import AI agent, fall back gracefully if not available
try:
    from ai_agent import run_investment_committee
    AI_AGENT_AVAILABLE = True
except ImportError:
    AI_AGENT_AVAILABLE = False
    run_investment_committee = None

try:
    from clustering import find_similar_suburbs
except ImportError:
    find_similar_suburbs = None

load_dotenv()

app = FastAPI()

# CORS: In production, restrict to your actual frontend origin(s)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
if "*" in CORS_ORIGINS:
    allow_origins = ["*"]
else:
    allow_origins = [o.strip() for o in CORS_ORIGINS if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip all responses >1KB — reduces /api/suburbs payload by ~80%
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Rate limiting for auth endpoints (20 req/min per IP)
_rate_limit_auth = OrderedDict()
MAX_AUTH_REQUESTS = 20

def _check_auth_rate(client_ip: str):
    now = datetime.utcnow().timestamp()
    if client_ip not in _rate_limit_auth:
        _rate_limit_auth[client_ip] = []
    _rate_limit_auth[client_ip] = [t for t in _rate_limit_auth[client_ip] if now - t < 60]
    if len(_rate_limit_auth[client_ip]) >= MAX_AUTH_REQUESTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again in 1 minute.")
    _rate_limit_auth[client_ip].append(now)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")
engine = create_engine(DATABASE_URL, pool_size=20, max_overflow=30, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class UserModel(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    salt = Column(String)
    created_at = Column(String)

# Ensure tables are created
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    # Wait for DB readiness to avoid race condition
    await asyncio.sleep(10)
    db = SessionLocal()
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1 FROM suburbs_raw_v3 LIMIT 1"))
        from scheduler import start_scheduler
        start_scheduler()
    except Exception as e:
        logging.getLogger("uvicorn").error(f"Scheduler startup failed: {e}")
        raise # Fail fast, don't hide
    finally:
        db.close()

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str

# In-memory rate limiting store for analyze-suburb endpoint
class BoundedRateLimitStore:
    def __init__(self, max_entries=10000):
        self._store = OrderedDict()
        self._max = max_entries
    
    def __getitem__(self, key):
        return self._store[key]

    def __setitem__(self, key, value):
        if key not in self._store and len(self._store) >= self._max:
            self._store.popitem(last=False)
        self._store[key] = value
        
    def __contains__(self, key):
        return key in self._store

_rate_limit_store = BoundedRateLimitStore(max_entries=10000)

import bcrypt

JWT_SECRET = os.getenv("JWT_SECRET", secrets.token_urlsafe(32))
JWT_ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = db.query(UserModel).filter(UserModel.id == payload.get("sub")).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@app.post("/api/register")
def register(request: RegisterRequest, req: Request, db: Session = Depends(get_db)):
    _check_auth_rate(req.client.host if req.client else "127.0.0.1")
    clean_email = request.email.strip().lower()
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if db.query(UserModel).filter(UserModel.email == clean_email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(request.password)
    
    new_user = UserModel(
        id=secrets.token_hex(16),
        email=clean_email,
        password_hash=hashed,
        salt="",
        created_at=datetime.now().isoformat()
    )
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "Registration successful"}

@app.post("/api/login")
def login(request: LoginRequest, response: Response, req: Request, db: Session = Depends(get_db)):
    _check_auth_rate(req.client.host if req.client else "127.0.0.1")
    clean_email = request.email.strip().lower()
    user = db.query(UserModel).filter(UserModel.email == clean_email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if user.salt:
        import hashlib
        legacy_hash = hashlib.pbkdf2_hmac('sha256', request.password.encode('utf-8'), user.salt.encode('utf-8'), 100000).hex()
        if legacy_hash != user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        user.password_hash = hash_password(request.password)
        user.salt = ""
        db.commit()
    else:
        if not verify_password(request.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
            
    token = jwt.encode({"sub": user.id, "exp": datetime.utcnow().timestamp() + 86400}, JWT_SECRET, algorithm=JWT_ALGORITHM)
    response.set_cookie(key="access_token", value=token, httponly=True, samesite="strict", max_age=86400)
    return {"status": "success"}

@app.get("/api/me")
def get_me(user: UserModel = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Lightweight health check for Docker healthcheck and monitoring."""
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {e}")

_cache_suburbs_data = {}
_cache_suburbs_time = {}

def bust_suburbs_cache():
    """Invalidate the in-memory suburbs list cache. Call after any pipeline run."""
    global _cache_suburbs_data, _cache_suburbs_time
    _cache_suburbs_data.clear()
    _cache_suburbs_time.clear()
    logging.getLogger("uvicorn").info("[cache] suburbs cache busted — fresh data will be fetched on next request")

@app.get("/api/suburbs")
def get_suburbs(state: str = None, db: Session = Depends(get_db)):
    global _cache_suburbs_data, _cache_suburbs_time
    cache_key = state or "ALL"
    now = time.time()
    
    # 1-hour cache to protect DB and memory
    if cache_key in _cache_suburbs_data and (now - _cache_suburbs_time.get(cache_key, 0)) < 3600:
        return _cache_suburbs_data[cache_key]

    TARGET_STATES = [state] if state else ['VIC', 'NSW', 'QLD', 'TAS', 'SA']
    result = []
    
    for state_name in TARGET_STATES:
        state_subs = db.query(SuburbUIModel).filter(
            SuburbUIModel.state == state_name,
            SuburbUIModel.median_price.isnot(None),
            SuburbUIModel.median_price > 0
        ).order_by(SuburbUIModel.growth_score.desc().nulls_last()).all()
        
        # Pre-fetch all V3 and V2 data to prevent N+1 queries
        suburb_ids = [s.id.upper() for s in state_subs]
        if not suburb_ids:
            continue
            
        v3_records = db.query(SuburbUIV3).filter(SuburbUIV3.id.in_(suburb_ids)).all()
        v3_map = {r.id: r for r in v3_records}
        
        v2_records = db.query(SuburbUIV2).filter(SuburbUIV2.id.in_(suburb_ids)).all()
        v2_map = {r.id: r for r in v2_records}
        
        for s in state_subs:
            record = {
                "id": s.id,
                "name": s.name,
                "state": s.state,
                "postcode": s.postcode,
                "growthScore": s.growth_score if s.growth_score is not None else 50,
                "isMetro": s.is_live,
                "cbdDistanceMins": s.cbd_distance_mins,
                "metroCBD": s.metro_cbd,
                # Omitted highlights and schools array from list endpoint to prevent memory bloat (P1-1)
                "metrics": {
                    "medianPrice": s.median_price if s.median_price is not None else 0,
                    "weeklyRent": s.weekly_rent if s.weekly_rent is not None else 0,
                    "rentalYield": s.rental_yield if s.rental_yield is not None else 0,
                    "schoolQuality": s.school_quality if s.school_quality is not None else 0,
                    "transitAccessibility": s.transit_accessibility if s.transit_accessibility is not None else 5,
                    "safetyScore": s.safety_score,
                    "crimeRate": s.crime_rate_per_100k,
                }
            }
            
            v3_data = v3_map.get(s.id.upper())
            if v3_data:
                record.update({
                    "v3Enriched": True,
                    "dqScore": min(95, max(5, v3_data.dq_score or 100)),
                    "houseMedianPrice": v3_data.house_median_price,
                    "houseMedianPrice12mChangePct": v3_data.house_median_price_12m_change_pct,
                    "houseMedianRent": v3_data.house_median_rent,
                    "houseGrossRentalYield": _cap_yield(v3_data.house_gross_rental_yield),
                    "houseGrossRentalYieldTrend": v3_data.house_gross_rental_yield_trend,
                    "houseDaysOnMarket": v3_data.house_days_on_market,
                    "houseAuctionClearanceRate": v3_data.house_auction_clearance_rate,
                    "houseStockOnMarket": v3_data.house_stock_on_market,
                    "houseSold12m": v3_data.house_sold_12m,
                    "unitMedianPrice": v3_data.unit_median_price,
                    "unitMedianPrice12mChangePct": v3_data.unit_median_price_12m_change_pct,
                    "unitMedianRent": v3_data.unit_median_rent,
                    "unitGrossRentalYield": _cap_yield(v3_data.unit_gross_rental_yield),
                    "unitGrossRentalYieldTrend": v3_data.unit_gross_rental_yield_trend,
                    "unitDaysOnMarket": v3_data.unit_days_on_market,
                    "totalProperties": v3_data.total_properties or record.get("totalProperties"),
                    "vacancyRate": v3_data.vacancy_rate,
                    "supplyDemandRatio": v3_data.supply_demand_ratio,
                    "priceToRentRatio": v3_data.price_to_rent_ratio,
                    "ownerOccupierRate": v3_data.owner_occupier_rate,
                    "investorRate": v3_data.investor_rate,
                    "medianAge": v3_data.median_age,
                    "lastV3Update": str(v3_data.last_updated) if v3_data.last_updated else None,
                })
            else:
                v2_data = v2_map.get(s.id.upper())
                if v2_data:
                    record.update({
                        "houseGrossRentalYield": _cap_yield(v2_data.house_rental_yield),
                        "houseGrossRentalYieldTrend": v2_data.house_rental_yield_trend,
                        "unitGrossRentalYield": _cap_yield(v2_data.unit_rental_yield),
                        "unitGrossRentalYieldTrend": v2_data.unit_rental_yield_trend,
                        "houseMedianPrice12mChangePct": v2_data.house_median_growth
                    })
            
            result.append(record)
            
    _cache_suburbs_data[cache_key] = result
    _cache_suburbs_time[cache_key] = now
    return result

@app.get("/api/search")
def search_suburbs(q: str = "", db: Session = Depends(get_db)):
    if not q or len(q) < 3 or len(q) > 50:
        return []
    # Simple ILIKE search on name using the trigram index
    suburbs = db.query(SuburbUIModel.id, SuburbUIModel.name, SuburbUIModel.state, SuburbUIModel.postcode).filter(
        SuburbUIModel.name.ilike(f"%{q}%")
    ).limit(20).all()
    return [{"id": s.id, "name": s.name, "state": s.state, "postcode": s.postcode} for s in suburbs]

def _build_v2_only_response(v2) -> dict:
    """Pure V2 fallback when no V3 data exists."""
    coords = [v2.lat, v2.lon] if (v2.lat and v2.lon) else None
    return {
        "id": v2.id, "name": v2.name, "state": v2.state, "postcode": v2.postcode,
        "isLive": v2.is_live, "v3Enriched": False,
        "medianPrice": v2.median_price, "weeklyRent": v2.weekly_rent,
        "rentalYield": v2.rental_yield, "totalProperties": v2.total_properties,
        "ownerOccupierRate": v2.owner_occupier_rate, "population": v2.population,
        "areaSqkm": v2.area_sqkm, "parksCount": v2.parks_count,
        "schoolQuality": v2.school_quality, "transitAccessibility": v2.transit_accessibility,
        "cbdDistance": v2.cbd_distance_mins, "metroCBD": v2.metro_cbd or f"{v2.state} CBD",
        "growthScore": v2.growth_score or 50,
        "metrics": v2.metrics or {}, "safetyScore": v2.safety_score,
        "crimeRate": v2.crime_rate_per_100k, "highlights": v2.highlights or [],
        "history": v2.history or [], "schools": v2.schools or [],
        "acara_schools": v2.schools or [], "ai_insights": v2.ai_insights or {},
        "nearby_pois": v2.nearby_pois or {}, "pois": v2.pois or [],
        "coordinates": coords, "demographics": v2.demographics or {},
        "lastUpdated": str(v2.last_updated) if v2.last_updated else None,
        "populationCagr": None, "typicalMortgageBand": None,
        "houseMedianPrice": v2.median_price, "houseDaysOnMarket": None,
    }

def _build_v3_fallback_response(v3: SuburbUIV3) -> dict:
    """Build a SuburbData-compatible response from V3-only data when V2 record is missing."""
    return {
        "id": v3.id.lower(),
        "name": v3.name,
        "state": v3.state,
        "postcode": v3.postcode,
        "isMetro": False,
        "growthScore": 50,
        "v3Enriched": True,
        "dqScore": _calibrate_dq(v3),
        "dqIssues": v3.dq_issues,
        "lastV3Update": str(v3.last_updated) if v3.last_updated else None,
        "growthScore": _compute_growth_score(v3)["score"],
        "growthFactors": _compute_growth_score(v3)["factors"],
        "history": v3.history_10yr or [],
        "historyRent": v3.history_rent_10yr or [],
        "demographicsDetail": v3.demographics_detail or {},
        "salesSummary": v3.sales_summary or [],
        "nearbySuburbs": v3.nearby_suburbs or [],
        # House
        "houseMedianPrice": v3.house_median_price,
        "houseMedianPrice12mChangePct": v3.house_median_price_12m_change_pct,
        "houseMedianRent": v3.house_median_rent,
        "houseGrossRentalYield": _cap_yield(v3.house_gross_rental_yield),
        "houseStockOnMarket": v3.house_stock_on_market,
        "houseSold12m": v3.house_sold_12m,
        # Unit
        "unitMedianPrice": v3.unit_median_price,
        "unitMedianPrice12mChangePct": v3.unit_median_price_12m_change_pct,
        "unitMedianRent": v3.unit_median_rent,
        "unitGrossRentalYield": _cap_yield(v3.unit_gross_rental_yield),
        # Market
        "vacancyRate": v3.vacancy_rate,
        "supplyDemandRatio": v3.supply_demand_ratio,
        "priceToRentRatio": v3.price_to_rent_ratio,
        "priceToIncomeRatio": v3.price_to_income_ratio,
        "totalProperties": v3.total_properties,
        # Demographics
        "population2021": v3.population_2021,
        "populationCagr": round(_annualize_cagr(v3.population_cagr), 2) if v3.population_cagr else None,
        "ownerOccupierRate": v3.owner_occupier_rate,
        "investorRate": v3.investor_rate,
        "medianAge": v3.median_age,
        "predominantAgeGroup": v3.predominant_age_group,
        "predominantOccupation": v3.predominant_occupation,
        "typicalMortgageBand": v3.typical_mortgage_band,
        # Environment
        "parksCount": v3.parks_count,
        "parksCoveragePct": v3.parks_coverage_pct,
        "areaSqkm": v3.area_sqkm,
        # Metrics (for backward compat)
        "metrics": {
            "medianPrice": v3.house_median_price or 0,
            "weeklyRent": v3.house_median_rent or 0,
            "rentalYield": v3.house_gross_rental_yield or 0,
            "populationGrowth": f"+{_annualize_cagr(v3.population_cagr):.1f}% CAGR" if v3.population_cagr else "N/A",
            "ownerOccupierRate": v3.owner_occupier_rate or 0,
            "investorRate": v3.investor_rate or 0,
            "medianAge": v3.median_age or 0,
            "predominantAgeGroup": v3.predominant_age_group or "",
            "predominantOccupation": v3.predominant_occupation or "",
            "typicalMortgageBand": v3.typical_mortgage_band or "",
            "priceToRentRatio": v3.price_to_rent_ratio or 0,
            "priceToIncomeRatio": v3.price_to_income_ratio or 0,
            "vacancyRate": v3.vacancy_rate or 0,
            "supplyDemandRatio": v3.supply_demand_ratio or 0,
            "stockOnMarket": v3.house_stock_on_market or 0,
            "soldStock": v3.house_sold_12m or 0,
            "population2016": v3.population_2016 or 0,
            "population2021": v3.population_2021 or 0,
            "truePopulationGrowth": v3.population_cagr or 0,
            "parksCount": v3.parks_count or 0,
            "parksCoveragePct": v3.parks_coverage_pct or 0,
            "suburbAreaKm2": v3.area_sqkm or 0,
            "unitMedianPrice": v3.unit_median_price,
            "auctionClearanceRate": 0,
            "daysOnMarket": 0,
        },
        "highlights": [
            f"V3 Enriched | DQ Score: {_calibrate_dq(v3):.0f}%",
            f"{v3.house_sold_12m or 0} sales in 12 months",
            f"Population: {v3.population_2021 or 'N/A'} ({_annualize_cagr(v3.population_cagr):.1f}% CAGR)",
        ],
        "schools": [],
        "demographics": v3.demographics_detail or {},
        "salesSummaryV3": v3.sales_summary or [],
    }


def _annualize_cagr(val) -> float:
    """Convert 5yr total growth % to annual CAGR %. Values >10% treated as total growth."""
    if val is None: return 0
    val = float(val)
    if val > 10:
        return ((1 + val/100) ** (1./5) - 1) * 100
    return val

def _cap_yield(val, max_yield=25.0) -> float | None:
    """Clamp rental yields to prevent absurd outliers from low-price suburbs."""
    if val is None: return None
    val = float(val)
    return min(val, max_yield) if val >= 0 else None

def _calibrate_dq(v3) -> float:
    """Recalibrate DQ Score: subtract points for NULL critical fields."""
    raw = float(v3.dq_score or 100)
    penalties = 0
    # Critical data points — subtract 3 pts each if NULL
    checks = [
        v3.house_days_on_market,
        v3.unit_days_on_market,
        v3.house_auction_clearance_rate,
        v3.predominant_occupation,
        v3.avg_icsea,
        v3.school_count,
        v3.price_to_income_ratio,
        v3.typical_mortgage_band,
        v3.vacancy_rate,
    ]
    for c in checks:
        if c is None or c == 0:
            penalties += 3
    return max(5, min(95, raw - penalties))

def _compute_growth_score(v3: SuburbUIV3) -> dict:
    """
    Compute a 0-92 growth score from real V3 metrics.
    Version: 1.2.0 — Probability-adjusted with data confidence penalties.
    
    Scoring philosophy:
    - Base score from validated data (price CAGR, pop CAGR, yield, supply/demand, vacancy)
    - News sentiment acts as a market-temperature adjustment (-3 to +5)
    - Data confidence penalty for assumed/derived fields (-3 max)
    - Hard cap at 92 (no suburb is a "sure thing")
    
    Changelog:
    - 1.2.0: Reduced caps, news neutral=0, added confidence penalty, cap 92
    - 1.1.0: Removed magic numbers for price CAGR. Capped at 30 pts.
    - 1.0.0: Initial unversioned implementation.
    """
    score = 15  # base (reduced from 20)
    price_cagr_pts = 0
    pop_cagr_pts = 0
    yield_pts = 0
    sd_pts = 0
    vac_pts = 0
    news_pts = 0
    confidence_penalty = 0
    confidence_reasons = []
    
    # 1. Price CAGR from 10yr history (0-25 pts, reduced from 0-30)
    hist = v3.history_10yr or []
    if len(hist) >= 2:
        first = hist[0].get("value", 0) if isinstance(hist[0], dict) else 0
        last = hist[-1].get("value", 0) if isinstance(hist[-1], dict) else 0
        years = max(1, len(hist) - 1)
        if first > 0 and years > 0:
            cagr = ((last / first) ** (1 / years) - 1) * 100
            # 4.5 points per 1% CAGR, max 25 pts (~5.5% CAGR for max)
            price_cagr_pts = min(25, max(0, round(cagr * 4.5)))
            score += price_cagr_pts
    else:
        confidence_penalty += 1
        confidence_reasons.append("No 10-year history; price growth assumed")

    # 2. Population CAGR (0-15 pts, reduced from 0-20)
    pop_cagr = v3.population_cagr or 0
    # Description text gives total 5yr growth, not annual. Annualize if >10%
    if pop_cagr > 10:
        pop_cagr = pop_cagr / 5  # Total 5yr growth → approximate annual
    
    # Also compute true annual CAGR from census years if available
    if v3.population_2016 and v3.population_2021 and v3.population_2016 > 0:
        try:
            true_cagr = ((v3.population_2021 / v3.population_2016) ** (1/5) - 1) * 100
            pop_cagr = round(true_cagr, 2)  # Use real census CAGR
        except:
            pass
    
    pop_cagr_pts = min(15, max(0, round(pop_cagr * 2.5)))  # 6% annual → 15 pts
    score += pop_cagr_pts
    if pop_cagr <= 0:
        confidence_penalty += 1
        confidence_reasons.append("No population CAGR data; growth rate assumed")

    # 3. Yield (0-10 pts, reduced from 0-15)
    yld = v3.house_gross_rental_yield or 0
    yield_pts = min(10, max(0, round(yld * 2)))  # 5% yield → 10 pts
    score += yield_pts

    # 4. Supply/Demand (0-8 pts, reduced from 0-10)
    sd = v3.supply_demand_ratio
    if sd is not None and sd > 0:
        sd_pts = max(0, min(8, round((1 - min(sd, 1)) * 8)))
        score += sd_pts

    # 5. Vacancy Rate (0-5 pts, reduced from 0-8)
    vac = v3.vacancy_rate
    if vac is not None:
        if vac < 1: vac_pts = 5
        elif vac < 2: vac_pts = 3
        elif vac < 3: vac_pts = 1
        else: vac_pts = 0
        score += vac_pts

    # 6. News Sentiment (-3 to +5, CHANGED from 0-10)
    #    Neutral = 0 (no bonus for uncertainty)
    #    Bullish = +5 (market tailwind confirmed)
    #    Bearish = -3 (headwind warning)
    ns = v3.news_sentiment or {}
    if isinstance(ns, dict):
        label = ns.get("label", "")
        if label == "Bullish": news_pts = 5
        elif label == "Bearish": news_pts = -3
        else: news_pts = 0  # Neutral or unknown — no bonus
        score += news_pts
    else:
        news_pts = -1  # No sentiment data available
        score += news_pts
        confidence_reasons.append("No news sentiment data")

    # 7. Data Confidence Penalty (0 to -3)
    #    Penalize for assumed/derived fields not verified against onthehouse
    confidence_penalty = min(3, confidence_penalty)
    score -= confidence_penalty
    if confidence_penalty > 0:
        confidence_reasons.append(f"Confidence gap; {confidence_penalty}pts deducted")

    # 8. Hard cap at 92 and floor at 5
    final_score = min(92, max(5, score))
    
    return {
        "score": final_score,
        "factors": {
            "base": 15,
            "price_cagr": price_cagr_pts,
            "pop_cagr": pop_cagr_pts,
            "yield": yield_pts,
            "supply_demand": sd_pts,
            "vacancy": vac_pts,
            "news_sentiment": news_pts,
            "confidence_penalty": -confidence_penalty,
            "raw_pre_cap": score,
        },
        "confidence_notes": confidence_reasons,
    }


@app.get("/api/suburbs/{suburb_id}")
def get_suburb(suburb_id: str, db: Session = Depends(get_db)):
    """V3-only endpoint — all data from suburbs_ui_v3 (self-sufficient)."""
    v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id == suburb_id.upper()).first()
    if not v3:
        raise HTTPException(status_code=404, detail="Suburb not found")
    
    current_median = v3.current_median_price or v3.house_median_price
    
    growth = _compute_growth_score(v3)
    
    response = {
        "id": v3.id.lower(),
        "name": v3.name, "state": v3.state, "postcode": v3.postcode,
        "isLive": bool(v3.is_live) if v3.is_live is not None else True,
        "v3Enriched": bool(v3.is_enriched),
        "lastV3Update": str(v3.last_updated) if v3.last_updated else None,
        "dqScore": _calibrate_dq(v3),
        "dqIssues": v3.dq_issues,
        # House — current AVM median for display, V3 history for charts
        "medianPrice": current_median,
        "weeklyRent": v3.house_median_rent,
        "rentalYield": v3.house_gross_rental_yield,
        "houseMedianPrice": current_median,
        "houseMedianPrice12mChangePct": v3.house_median_price_12m_change_pct,
        "houseMedianRent": v3.house_median_rent,
        "houseGrossRentalYield": _cap_yield(v3.house_gross_rental_yield),
        "houseGrossRentalYieldTrend": v3.house_gross_rental_yield_trend,
        "houseDaysOnMarket": v3.house_days_on_market,
        "houseAuctionClearanceRate": v3.house_auction_clearance_rate,
        "houseStockOnMarket": v3.house_stock_on_market,
        "houseSold12m": v3.house_sold_12m,
        # Unit
        "unitMedianPrice": v3.unit_median_price,
        "unitMedianPrice12mChangePct": v3.unit_median_price_12m_change_pct,
        "unitMedianRent": v3.unit_median_rent,
        "unitGrossRentalYield": _cap_yield(v3.unit_gross_rental_yield),
        "unitGrossRentalYieldTrend": v3.unit_gross_rental_yield_trend,
        "unitDaysOnMarket": v3.unit_days_on_market,
        # Market
        "vacancyRate": v3.vacancy_rate,
        "supplyDemandRatio": v3.supply_demand_ratio,
        "priceToRentRatio": v3.price_to_rent_ratio,
        "priceToIncomeRatio": v3.price_to_income_ratio,
        "totalProperties": v3.total_properties,
        "typicalMortgageBand": v3.typical_mortgage_band,
        # Demographics
        "ownerOccupierRate": v3.owner_occupier_rate,
        "investorRate": v3.investor_rate,
        "medianAge": v3.median_age,
        "predominantAgeGroup": v3.predominant_age_group,
        "predominantOccupation": v3.predominant_occupation,
        "averageHouseholdSize": v3.average_household_size,
        "populationCagr": round(_annualize_cagr(v3.population_cagr), 2) if v3.population_cagr else None,
        "population": v3.population or v3.population_2021,
        "population_baseline": v3.population or v3.population_2021,
        # Geo & infrastructure
        "areaSqkm": v3.area_sqkm, "sqkm": v3.area_sqkm,
        "parksCount": v3.parks_count, "parksCoveragePct": v3.parks_coverage_pct,
        # Schools
        "schoolQuality": v3.school_quality or 5.0,
        "schools": v3.schools or [],
        "acara_schools": v3.schools or [],
        "avgIcsea": v3.avg_icsea, "schoolCount": v3.school_count,
        "topSchoolName": v3.top_school_name,
        # Transit & safety
        "transitAccessibility": v3.transit_accessibility or 5.0,
        "cbdDistance": v3.cbd_distance_mins or 30,
        "metroCBD": v3.metro_cbd or (f"{v3.state} CBD" if v3.state else ""),
        "safetyScore": v3.safety_score or 60.0,
        "crimeRate": v3.crime_rate or 5000.0,
        # Content
        "highlights": v3.highlights or [],
        "history": v3.history_10yr or [],
        "historyRent": v3.history_rent_10yr or [],
        "demographics": v3.demographics_detail or {},
        "demographicsDetailV3": v3.demographics_detail or {},
        "salesSummaryV3": v3.sales_summary or [],
        "nearbySuburbsV3": v3.nearby_suburbs or [],
        "ai_insights": v3.ai_insights or {},
        "nearby_pois": v3.nearby_pois or {},
        "pois": v3.pois or [],
        "coordinates": v3.coordinates,
        "metrics": {"rentalStock": v3.rental_stock},
        # Derived indicators
        "unemploymentRate": v3.unemployment_rate,
        "buildingApprovals12m": v3.building_approvals_12m,
        "infrastructureInvestment": v3.infrastructure_investment,
        # Growth Score
        "growthScore": growth["score"],
        "growthFactors": growth["factors"],
        "confidenceNotes": growth.get("confidence_notes", []),
        "lastUpdated": str(v3.last_updated) if v3.last_updated else None,
    }
    db.close()
    return response
        
    db.close()
    return response



class AnalyzeRequest(BaseModel):
    suburb: str
    state: str
    id: str

def _check_rate_limit(client_key: str, max_requests: int = 10, window_seconds: int = 60):
    now = time.time()
    
    if client_key not in _rate_limit_store:
        _rate_limit_store[client_key] = []
    
    # Remove old entries for current client
    active_times = [t for t in _rate_limit_store[client_key] if now - t < window_seconds]
    _rate_limit_store[client_key] = active_times
    
    if len(active_times) >= max_requests:
        return False
    
    active_times.append(now)
    _rate_limit_store[client_key] = active_times # Refresh LRU position
    return True

@app.post("/api/analyze-suburb")
def analyze_suburb(req: AnalyzeRequest, db: Session = Depends(get_db)):
    # Rate limiting: max 10 requests per minute per suburb
    client_key = f"{req.id}:{datetime.now().strftime('%Y%m%d%H%M')}"
    if not _check_rate_limit(client_key, max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 10 requests per minute per suburb.")
    
    if not AI_AGENT_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI sentiment service not available")
    
    try:
        suburb_record = db.query(SuburbAllModel).filter(SuburbAllModel.id == req.id).first()
        if not suburb_record:
            return {"status": "error", "message": "Suburb not found in database"}
            
        data = suburb_record.data
        if "metrics" not in data:
            data["metrics"] = {}
            
        # P0 FIX: Check if already analyzed to prevent LLM API exhaustion
        if data["metrics"].get("aiCommitteeVerdict"):
            return {
                "bull": data["metrics"].get("aiCommitteeDebate", {}).get("bull", ""),
                "bear": data["metrics"].get("aiCommitteeDebate", {}).get("bear", ""),
                "urban": data["metrics"].get("aiCommitteeDebate", {}).get("urban", ""),
                "reality_check": data["metrics"].get("aiCommitteeDebate", {}).get("reality_check", ""),
                "verdict": data["metrics"]["aiCommitteeVerdict"],
                "playbook": data["metrics"]["aiCommitteePlaybook"]
            }
            
        # Run the full multi-agent committee (pass metrics in)
        ai_result = run_investment_committee(req.suburb, req.state, data["metrics"])

        # Save results back to SuburbAllModel
        data["metrics"]["aiCommitteeVerdict"] = ai_result["verdict"]
        data["metrics"]["aiCommitteePlaybook"] = ai_result["playbook"]
        data["metrics"]["aiCommitteeDebate"] = {
            "bull": ai_result["bull"],
            "bear": ai_result["bear"],
            "urban": ai_result["urban"],
            "reality_check": ai_result["reality_check"]
        }
        from sqlalchemy.orm.attributes import flag_modified
        suburb_record.data = data
        flag_modified(suburb_record, "data")
        db.commit()
        
        # Also update suburbs_ui for immediate UI visibility
        ui_record = db.query(SuburbUIModel).filter(SuburbUIModel.id == req.id).first()
        if ui_record:
            ui_metrics = ui_record.metrics or {}
            ui_metrics["aiCommitteeVerdict"] = ai_result["verdict"]
            ui_metrics["aiCommitteePlaybook"] = ai_result["playbook"]
            ui_metrics["aiCommitteeDebate"] = {
                "bull": ai_result["bull"],
                "bear": ai_result["bear"],
                "urban": ai_result["urban"],
                "reality_check": ai_result["reality_check"]
            }
            ui_record.metrics = ui_metrics
            flag_modified(ui_record, "metrics")
            db.commit()
            
        return {"status": "success", "result": ai_result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/similar-suburbs")
def get_similar_suburbs(req: AnalyzeRequest, db: Session = Depends(get_db)):
    if not find_similar_suburbs:
        raise HTTPException(status_code=503, detail="Clustering service not available")
        
    try:
        target_suburb = db.query(SuburbAllModel).filter(SuburbAllModel.id == req.id).first()
        if not target_suburb:
            return {"status": "error", "message": "Suburb not found in database"}
            
        # Fix P0-2 Unbounded Memory: Only load live suburbs in the same state
        all_suburbs = db.query(SuburbAllModel).filter(
            SuburbAllModel.is_live == True,
            SuburbAllModel.state == target_suburb.state
        ).all()
        print(f"[cluster] Loaded {len(all_suburbs)} live suburbs in {target_suburb.state}")
        all_data = [{**s.data, "id": s.id, "name": s.name, "state": s.state, "postcode": s.postcode} for s in all_suburbs]
        target_data = {**target_suburb.data, "id": target_suburb.id, "name": target_suburb.name, "state": target_suburb.state, "postcode": target_suburb.postcode}
        
        similar = find_similar_suburbs(target_data, all_data, limit=5)
        print(f"[cluster] Found {len(similar)} similar suburbs for {req.suburb}")
        return {"status": "success", "similar": similar}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/suburbs/{suburb_id}/news-sentiment")
def get_news_sentiment(suburb_id: str, db: Session = Depends(get_db)):
    """On-demand news sentiment for a suburb. Cached for 24h. Only calls Tavily if needed."""
    v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id.ilike(suburb_id)).first()
    if not v3:
        raise HTTPException(status_code=404, detail="Suburb not found")
        
    # Check cache (within 24h)
    cached = v3.news_sentiment or {}
    if isinstance(cached, dict):
        fetched = cached.get("fetched_at")
        if fetched:
            try:
                from datetime import datetime, timedelta
                fetched_dt = datetime.fromisoformat(fetched)
                if datetime.utcnow() - fetched_dt < timedelta(hours=24):
                    return {"cached": True, **cached}
            except (ValueError, TypeError):
                pass
    
    # Fetch fresh from Tavily
    from ai_agent import get_news_sentiment as fetch_sentiment
    result = fetch_sentiment(v3.name or "", v3.state or "")
    
    # Cache in DB
    v3.news_sentiment = result
    db.commit()
    
    return {"cached": False, **result}
def reload_suburbs():
    """Triggers V3 pipeline enrichment from unpacked table (replaces old transform_data)."""
    from enrich_from_unpacked import enrich_all
    enrich_all()
    db = SessionLocal()
    try:
        total = db.query(SuburbUIModel).count()
        return {"status": "ok", "suburbs": total, "pipeline": "v3"}
    finally:
        db.close()


@app.get("/api/mortgage-rate")
def get_mortgage_rate():
    # In a full production environment, this would call a banking API (e.g. CoreLogic or RBA proxy).
    # Since direct RBA scraping is blocked by Cloudflare, we simulate the dynamic fetch here.
    # Base RBA Cash Rate (currently ~4.35%) + Average Retail Bank Margin (~1.85%) = 6.2%
    # This endpoint allows the frontend to be fully dynamic.
    return {
        "status": "success",
        "base_cash_rate": 4.35,
        "retail_margin": 1.85,
        "effective_mortgage_rate": 6.20,
        "source": "Simulated Live RBA + Margin API",
        "last_updated": "Today",
        "disclaimer": "This rate is indicative only. Always verify with your lender for actual rates."
    }

# =============================================================================
# V3 INSTITUTIONAL API — serves enriched data from OnTheHouse extraction
# =============================================================================

@app.get("/api/v3/suburbs")
def get_suburbs_v3(state: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Returns V3-enriched suburbs for the institutional dashboard view."""
    query = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True)
    if state:
        query = query.filter(SuburbUIV3.state == state.upper())
    query = query.order_by(SuburbUIV3.house_median_price.desc().nulls_last()).limit(limit)
    results = query.all()
    return [
        {
            "id": r.id,
            "state": r.state,
            "name": r.name,
            "postcode": r.postcode,
            "house": {
                "medianPrice": r.house_median_price,
                "medianPrice12mChangePct": r.house_median_price_12m_change_pct,
                "medianRent": r.house_median_rent,
                "grossRentalYield": r.house_gross_rental_yield,
                "grossRentalYieldTrend": r.house_gross_rental_yield_trend,
                "daysOnMarket": r.house_days_on_market,
                "auctionClearanceRate": r.house_auction_clearance_rate,
                "stockOnMarket": r.house_stock_on_market,
                "sold12m": r.house_sold_12m,
            },
            "unit": {
                "medianPrice": r.unit_median_price,
                "medianPrice12mChangePct": r.unit_median_price_12m_change_pct,
                "medianRent": r.unit_median_rent,
                "grossRentalYield": r.unit_gross_rental_yield,
                "grossRentalYieldTrend": r.unit_gross_rental_yield_trend,
                "daysOnMarket": r.unit_days_on_market,
            },
            "market": {
                "totalProperties": r.total_properties,
                "vacancyRate": r.vacancy_rate,
                "supplyDemandRatio": r.supply_demand_ratio,
            },
            "demographics": {
                "population2021": r.population_2021,
                "populationCagr": round(_annualize_cagr(r.population_cagr), 2) if r.population_cagr else None,
                "ownerOccupierRate": r.owner_occupier_rate,
                "investorRate": r.investor_rate,
                "medianAge": r.median_age,
                "predominantAgeGroup": r.predominant_age_group,
                "predominantOccupation": r.predominant_occupation,
                "averageHouseholdSize": r.average_household_size,
            },
            "financial": {
                "typicalMortgageBand": r.typical_mortgage_band,
                "priceToIncomeRatio": r.price_to_income_ratio,
                "priceToRentRatio": r.price_to_rent_ratio,
            },
            "environment": {
                "parksCount": r.parks_count,
                "parksCoveragePct": r.parks_coverage_pct,
                "areaSqkm": r.area_sqkm,
            },
            "history10yr": r.history_10yr,
            "historyRent10yr": r.history_rent_10yr,
            "demographicsDetail": r.demographics_detail,
            "salesSummary": r.sales_summary,
            "dqScore": _calibrate_dq(r) if hasattr(r, 'dq_score') else min(95, max(5, r.dq_score or 100)),
            "dqIssues": r.dq_issues,
            "lastUpdated": str(r.last_updated) if r.last_updated else None,
        }
        for r in results
    ]


@app.get("/api/v3/suburbs/{suburb_id}")
def get_suburb_v3(suburb_id: str, db: Session = Depends(get_db)):
    """Returns full V3 institutional data for a single suburb."""
    r = db.query(SuburbUIV3).filter(SuburbUIV3.id == suburb_id).first()
    if not r:
        # Try case-insensitive
        r = db.query(SuburbUIV3).filter(SuburbUIV3.id.ilike(suburb_id)).first()
    if not r:
        raise HTTPException(status_code=404, detail="Suburb not found in V3 enriched dataset")
    return {
        "id": r.id,
        "state": r.state,
        "name": r.name,
        "postcode": r.postcode,
        "isEnriched": r.is_enriched,
        "house": {
            "medianPrice": r.house_median_price,
            "medianPrice12mChangePct": r.house_median_price_12m_change_pct,
            "medianRent": r.house_median_rent,
            "grossRentalYield": r.house_gross_rental_yield,
            "grossRentalYieldTrend": r.house_gross_rental_yield_trend,
            "daysOnMarket": r.house_days_on_market,
            "auctionClearanceRate": r.house_auction_clearance_rate,
            "stockOnMarket": r.house_stock_on_market,
            "sold12m": r.house_sold_12m,
        },
        "unit": {
            "medianPrice": r.unit_median_price,
            "medianPrice12mChangePct": r.unit_median_price_12m_change_pct,
            "medianRent": r.unit_median_rent,
            "grossRentalYield": r.unit_gross_rental_yield,
            "grossRentalYieldTrend": r.unit_gross_rental_yield_trend,
            "daysOnMarket": r.unit_days_on_market,
        },
        "market": {
            "totalProperties": r.total_properties,
            "vacancyRate": r.vacancy_rate,
            "supplyDemandRatio": r.supply_demand_ratio,
        },
        "demographics": {
            "population2021": r.population_2021,
            "populationCagr": round(_annualize_cagr(r.population_cagr), 2) if r.population_cagr else None,
            "ownerOccupierRate": r.owner_occupier_rate,
            "investorRate": r.investor_rate,
            "medianAge": r.median_age,
            "predominantAgeGroup": r.predominant_age_group,
            "predominantOccupation": r.predominant_occupation,
            "averageHouseholdSize": r.average_household_size,
        },
        "financial": {
            "typicalMortgageBand": r.typical_mortgage_band,
            "priceToIncomeRatio": r.price_to_income_ratio,
            "priceToRentRatio": r.price_to_rent_ratio,
        },
        "environment": {
            "parksCount": r.parks_count,
            "parksCoveragePct": r.parks_coverage_pct,
            "areaSqkm": r.area_sqkm,
        },
        "history10yr": r.history_10yr,
        "historyRent10yr": r.history_rent_10yr,
        "demographicsDetail": r.demographics_detail,
        "salesSummary": r.sales_summary,
        "nearbySuburbs": r.nearby_suburbs,
        "dqScore": _calibrate_dq(r) if hasattr(r, 'dq_score') else min(95, max(5, r.dq_score or 100)),
        "dqIssues": r.dq_issues,
        "lastUpdated": str(r.last_updated) if r.last_updated else None,
    }


@app.get("/api/osm/livability")
def get_osm_livability(lat: float, lng: float, radius: int = 2500):
    """Returns local POI data and livability scores from PostGIS OSM tables.
    Replaces direct Overpass API calls.
    """
    from osm_local import get_livability
    data = get_livability(lat, lng, radius)

    def _format_pois(category):
        items = data["pois"].get(category, [])
        return [{
            "id": i,
            "name": p["name"],
            "type": category,
            "lat": p.get("lat", lat),
            "lon": p.get("lng", lng),
        } for i, p in enumerate(items)]

    return {
        "cafes": _format_pois("cafe"),
        "parks": _format_pois("park"),
        "transit": _format_pois("transit"),
        "schools": _format_pois("school"),
        "walkabilityScore": data["walkScore"],
        "transitScoreStandalone": data["transitScore"],
        "liveabilityScore": data["liveabilityScore"],
    }

@app.get("/api/osm/boundary")
def get_osm_boundary(suburb: str, state: str = ""):
    """Returns suburb boundary geojson and center coordinates from local PostGIS."""
    from osm_local import get_boundary
    data = get_boundary(suburb, state)
    if not data:
        raise HTTPException(status_code=404, detail="Boundary not found")
    return data

@app.get("/api/suburbs/{suburb_id}/properties")
def get_suburb_properties(suburb_id: str, db: Session = Depends(get_db)):
    """
    Returns authentic property listings scraped from onthehouse.com.au
    Only returns properties strictly matching the V3 primary key (suburb_id).
    """
    listings = db.query(PropertyListing).filter(PropertyListing.suburb_id == suburb_id.upper()).all()
    
    if not listings:
        # Lazy loading: Try to extract properties from raw JSON if not yet populated
        from models_v3 import SuburbRawV3
        raw = db.query(SuburbRawV3).filter(SuburbRawV3.id == suburb_id.upper()).first()
        print(f"LAZY LOAD for {suburb_id.upper()}: raw={raw is not None}")
        if raw and raw.raw_json:
            import json
            from etl_transform_v3 import extract_property_listings
            data = raw.raw_json if isinstance(raw.raw_json, dict) else json.loads(raw.raw_json)
            print(f"LAZY LOAD data keys: {list(data.keys())}")
            extract_property_listings(data, raw.id, db)
            db.commit()
            # Fetch the newly inserted listings
            listings = db.query(PropertyListing).filter(PropertyListing.suburb_id == suburb_id.upper()).all()
            print(f"LAZY LOAD finished, found {len(listings)} listings")
            
        if not listings:
            return []
        
    properties = []
    for item in listings:
        properties.append({
            "id": item.id,
            "address": item.address,
            "type": item.property_type,
            "listingType": item.listing_type,
            "bedrooms": item.bedrooms,
            "bathrooms": item.bathrooms,
            "carSpaces": item.car_spaces,
            "price": item.estimated_price or 0,
            "priceDisplay": item.price_display or "",
            "imgUrl": item.images_json[0] if item.images_json and len(item.images_json) > 0 else None,
            "crawlSource": item.crawl_source,
            # Placeholder distances (will be computed on frontend or dynamically later)
            "schoolDistanceM": 0,
            "schoolName": "Local School",
            "stationDistanceM": 0,
            "stationName": "Local Station",
            "tags": [item.listing_type.capitalize()]
        })
        
    return properties
