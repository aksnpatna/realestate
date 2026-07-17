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
from sqlalchemy import create_engine, Column, String, JSON, func, Integer, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker, Session
import smtplib
import uuid
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

REQUIRE_EMAIL_VERIFICATION = False
from dotenv import load_dotenv
from models_v3 import SuburbUIV3, PropertyListing, SuburbPriceHistory
from poc_config import poc_config

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

import redis

# Redis Cache setup
REDIS_HOST = os.getenv("REDIS_HOST", "realestate-redis")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
redis_client = None
try:
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=0, decode_responses=True)
    redis_client.ping()
    print("[cache] Connected to Redis successfully!")
except Exception as e:
    print(f"[cache] Redis not available: {e}. Falling back to DB-only.")
    redis_client = None

# Feature flag for AI features
ENABLE_AI_INSIGHTS = os.getenv("ENABLE_AI_INSIGHTS", "true").lower() in ("true", "1", "yes")

def get_cached_or_query(cache_key: str, query_func, expire_secs: int = 3600):
    if not redis_client:
        return query_func()
    
    try:
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
            
        result = query_func()
        redis_client.setex(cache_key, expire_secs, json.dumps(result))
        return result
    except Exception as e:
        print(f"[cache] Redis error on {cache_key}: {e}. Falling back to DB.")
        return query_func()

from observability import record_cache_hit, record_cache_miss, get_metrics_text

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
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    user_type = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    password_hash = Column(String)
    salt = Column(String)
    created_at = Column(String)

class UserFavorite(Base):
    __tablename__ = "user_favorites"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    suburb_id = Column(String, index=True)
    created_at = Column(String, default=lambda: datetime.now().isoformat())

class UserActivity(Base):
    __tablename__ = "user_activities"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True)
    action_type = Column(String, index=True)
    target_id = Column(String, nullable=True)
    timestamp = Column(String, default=lambda: datetime.now().isoformat())

class UserConsent(Base):
    """Stores legally binding Click-Wrap agreements with timestamps and IP records."""
    __tablename__ = "user_consents"
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, index=True, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    consent_type = Column(String)
    timestamp = Column(String, default=lambda: datetime.now().isoformat())

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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    user_type: Optional[str] = None

class ActivityRequest(BaseModel):
    action_type: str
    target_id: Optional[str] = None

class BuyFinderWeights(BaseModel):
    affordability: float = 30
    income: float = 25
    livability: float = 20
    access: float = 15
    evidence: float = 10

class BuyFinderRequest(BaseModel):
    buyer_profile: str = "first_home_buyer"
    state: str = "VIC"
    budget: float = 850000
    deposit: float = 170000
    annual_income: float = 150000
    existing_monthly_debt: float = 0
    interest_rate: float = 0.062
    serviceability_buffer: float = 0.03
    loan_term_years: int = 30
    purchase_cost_allowance: float = 0.02
    property_type: str = "house"
    maximum_cbd_minutes: int = 60
    minimum_yield: Optional[float] = None
    weights: Optional[BuyFinderWeights] = None

def send_verification_email(to_email: str, token: str):
    verification_link = f"http://localhost:5173/verify?token={token}"
    print(f"\n=== [SMTP MOCK] Sending verification link to {to_email} ===")
    print(f"LINK: {verification_link}\n")
    
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")
    
    if smtp_host and smtp_port and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"Real Estate Engine <{smtp_user}>"
            msg['To'] = to_email
            msg['Subject'] = "Verify Your Account"
            msg.attach(MIMEText(f"Click here to verify your account: {verification_link}", 'plain'))
            
            server = smtplib.SMTP(smtp_host, int(smtp_port))
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
            server.quit()
        except Exception as e:
            print(f"SMTP Error: {e}")

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
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    if not token:
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
    verification_token = str(uuid.uuid4())
    
    new_user = UserModel(
        id=secrets.token_hex(16),
        email=clean_email,
        first_name=request.first_name,
        last_name=request.last_name,
        user_type=request.user_type,
        is_verified=False,
        verification_token=verification_token,
        password_hash=hashed,
        salt="",
        created_at=datetime.now().isoformat()
    )
    db.add(new_user)
    db.commit()
    
    # Send verification email asynchronously so it doesn't block
    import threading
    threading.Thread(target=send_verification_email, args=(clean_email, verification_token)).start()
    
    return {"status": "success", "message": "Registration successful. Please check your email to verify your account."}

@app.post("/api/login")
def login(request: LoginRequest, response: Response, req: Request, db: Session = Depends(get_db)):
    _check_auth_rate(req.client.host if req.client else "127.0.0.1")
    clean_email = request.email.strip().lower()
    user = db.query(UserModel).filter(UserModel.email == clean_email).first()
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if REQUIRE_EMAIL_VERIFICATION and not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox.")
        
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

class ConsentRequest(BaseModel):
    consent_type: str

@app.post("/api/consent")
def record_consent(req: ConsentRequest, request: Request, db: Session = Depends(get_db)):
    """Records a legally binding Click-Wrap agreement to the database with IP tracing."""
    user_id = None
    try:
        token = request.cookies.get("access_token")
        if token:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("sub")
    except Exception:
        pass
        
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("User-Agent", "unknown")
    
    consent = UserConsent(
        user_id=user_id,
        ip_address=client_ip,
        user_agent=user_agent,
        consent_type=req.consent_type
    )
    db.add(consent)
    db.commit()
    return {"status": "success"}

@app.get("/api/me")
def get_me(user: UserModel = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "first_name": user.first_name, "last_name": user.last_name, "is_verified": user.is_verified}

@app.get("/api/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(UserModel).filter(UserModel.verification_token == token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"status": "success", "message": "Email verified successfully"}

@app.post("/api/track-activity")
def track_activity(request: ActivityRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    activity = UserActivity(
        user_id=user.id,
        action_type=request.action_type,
        target_id=request.target_id
    )
    db.add(activity)
    db.commit()
    return {"status": "success"}

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Lightweight health check with POC configuration visibility."""
    try:
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        eligible = 0
        if poc_config.public_poc_mode:
            eligible = db.query(SuburbUIV3).filter(
                SuburbUIV3.is_enriched == True,
                SuburbUIV3.dq_score >= poc_config.public_poc_min_dq_score,
            ).count()
        return {
            "status": "ok",
            "db": "connected",
            "poc": poc_config.to_dict(),
            "eligible_suburbs": eligible,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {e}")


@app.get("/api/poc/config")
def get_poc_config():
    """Returns active POC configuration so the showcase can be verified."""
    return poc_config.to_dict()

_cache_etf_data = None
_cache_etf_time = 0

@app.get("/api/etf/vap")
def get_vap_etf():
    """Fetches Vanguard Australian Property ETF performance (macro benchmark). Cached 24h."""
    global _cache_etf_data, _cache_etf_time
    now = time.time()
    
    if _cache_etf_data and (now - _cache_etf_time) < 86400:  # 24h
        return _cache_etf_data
        
    try:
        import yfinance as yf
        ticker = yf.Ticker("VAP.AX")
        hist = ticker.history(period="1y")
        if hist.empty:
            raise HTTPException(status_code=500, detail="Empty ETF history")
            
        current = float(hist['Close'].iloc[-1])
        year_ago = float(hist['Close'].iloc[0])
        month_ago = float(hist['Close'].iloc[-21]) if len(hist) >= 21 else year_ago
        
        result = {
            "symbol": "VAP.AX",
            "name": "Vanguard Australian Property Securities Index ETF",
            "current_price": current,
            "growth_1y_pct": round(((current - year_ago) / year_ago) * 100, 2),
            "growth_1m_pct": round(((current - month_ago) / month_ago) * 100, 2),
            "last_updated": str(datetime.now())
        }
        _cache_etf_data = result
        _cache_etf_time = now
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
    
    if cache_key in _cache_suburbs_data and (now - _cache_suburbs_time.get(cache_key, 0)) < 3600:
        return _cache_suburbs_data[cache_key]

    TARGET_STATES = [state] if state else ['VIC', 'NSW', 'QLD', 'TAS', 'SA']
    result = []
    
    for state_name in TARGET_STATES:
        query = db.query(SuburbUIV3).filter(
            SuburbUIV3.state == state_name,
            SuburbUIV3.is_enriched == True,
        )
        if poc_config.public_poc_mode:
            query = query.filter(SuburbUIV3.dq_score >= poc_config.public_poc_min_dq_score)
        v3_records = query.order_by(SuburbUIV3.house_median_price.desc().nulls_last()).all()
        
        for v3 in v3_records:
            growth = _compute_growth_score(v3)
            dq = _calibrate_dq(v3)
            record = {
                "id": v3.id.upper(),
                "name": v3.name,
                "state": v3.state,
                "postcode": v3.postcode,
                "growthScore": growth["score"],
                "growthScoreLabel": "Growth Score",
                "isMetro": bool(v3.metro_cbd),
                "cbdDistanceMins": v3.cbd_distance_mins,
                "metroCBD": v3.metro_cbd,
                "dqScore": dq,
                "pocEligible": poc_config.is_suburb_eligible(
                    v3.dq_score, True, False, True
                ),
                "metrics": {
                    "medianPrice": v3.house_median_price or 0,
                    "weeklyRent": v3.house_median_rent or 0,
                    "rentalYield": v3.house_gross_rental_yield or 0,
                    "schoolQuality": v3.school_quality or 0,
                    "transitAccessibility": v3.transit_accessibility or 5,
                    "safetyScore": v3.safety_score,
                    "crimeRate": v3.crime_rate,
                },
                "v3Enriched": True,
                "houseMedianPrice": v3.house_median_price,
                "houseMedianPrice12mChangePct": v3.house_median_price_12m_change_pct,
                "houseMedianRent": v3.house_median_rent,
                "houseGrossRentalYield": _cap_yield(v3.house_gross_rental_yield),
                "houseGrossRentalYieldTrend": v3.house_gross_rental_yield_trend,
                "houseDaysOnMarket": v3.house_days_on_market,
                "houseAuctionClearanceRate": v3.house_auction_clearance_rate,
                "houseStockOnMarket": v3.house_stock_on_market,
                "houseSold12m": v3.house_sold_12m,
                "unitMedianPrice": v3.unit_median_price,
                "unitMedianPrice12mChangePct": v3.unit_median_price_12m_change_pct,
                "unitMedianRent": v3.unit_median_rent,
                "unitGrossRentalYield": _cap_yield(v3.unit_gross_rental_yield),
                "unitGrossRentalYieldTrend": v3.unit_gross_rental_yield_trend,
                "unitDaysOnMarket": v3.unit_days_on_market,
                "totalProperties": v3.total_properties,
                "vacancyRate": v3.vacancy_rate,
                "supplyDemandRatio": v3.supply_demand_ratio,
                "priceToRentRatio": v3.price_to_rent_ratio,
                "ownerOccupierRate": v3.owner_occupier_rate,
                "investorRate": v3.investor_rate,
                "medianAge": v3.median_age,
                "lastV3Update": str(v3.last_updated) if v3.last_updated else None,
            }
            result.append(record)
            
    _cache_suburbs_data[cache_key] = result
    _cache_suburbs_time[cache_key] = now
    return result

@app.get("/api/search")
def search_suburbs(q: str = "", db: Session = Depends(get_db)):
    if not q or len(q) < 3 or len(q) > 50:
        return []
    # Simple ILIKE search on name using the trigram index
    suburbs = db.query(SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.state, SuburbUIV3.postcode).filter(
        SuburbUIV3.name.ilike(f"%{q}%")
    ).limit(20).all()
    return [{"id": s.id, "name": s.name, "state": s.state, "postcode": s.postcode} for s in suburbs]

def _annualize_cagr(val) -> float:
    """Convert 5yr total growth % to annual CAGR %. Values >10% treated as total growth."""
    if val is None: return 0
    try:
        val = float(val)
        if val > 10:
            return ((1 + val/100) ** (1./5) - 1) * 100
        return val
    except (ValueError, TypeError):
        return 0

def _cap_yield(val, max_yield=25.0) -> float | None:
    """Clamp rental yields to prevent absurd outliers from low-price suburbs."""
    if val is None: return None
    val = float(val)
    return min(val, max_yield) if val >= 0 else None


def _provenance(value, source_type: str = "transformed", source_name: str = "",
                observed_at: str = "", loaded_at: str = "", quality_status: str = "estimated"):
    """Attach metric-level provenance metadata to a value."""
    return {
        "value": value,
        "source_type": source_type,
        "source_name": source_name,
        "observed_at": observed_at,
        "loaded_at": loaded_at,
        "quality_status": quality_status,
    }


def _provenanced_metrics(v3) -> dict:
    """Build provenance-attached metric dictionary."""
    from datetime import datetime
    now = datetime.utcnow().isoformat()[:7]
    loaded = str(v3.last_updated)[:10] if v3.last_updated else now
    
    return {
        "houseMedianPrice": _provenance(
            v3.house_median_price, "licensed_commercial", "Property market dataset",
            f"{now}-01", loaded, "verified" if v3.dq_score and v3.dq_score >= 80 else "estimated"
        ),
        "houseMedianPrice12mChangePct": _provenance(
            v3.house_median_price_12m_change_pct, "transformed", "Derived from price history",
            f"{now}-01", loaded, "estimated"
        ),
        "houseMedianRent": _provenance(
            v3.house_median_rent, "licensed_commercial", "Property market dataset",
            f"{now}-01", loaded, "verified" if v3.dq_score and v3.dq_score >= 80 else "estimated"
        ),
        "houseGrossRentalYield": _provenance(
            _cap_yield(v3.house_gross_rental_yield), "transformed", "Derived from median price and rent",
            f"{now}-01", loaded, "estimated"
        ),
        "vacancyRate": _provenance(
            v3.vacancy_rate, "licensed_commercial", "Property market dataset",
            f"{now}-01", loaded, "verified" if v3.dq_score and v3.dq_score >= 70 else "estimated"
        ),
        "populationCagr": _provenance(
            round(_annualize_cagr(v3.population_cagr), 2) if v3.population_cagr else None,
            "government" if v3.abs_demographics_sourced else "transformed",
            "ABS Census 2016/2021" if v3.abs_demographics_sourced else "Derived from census counts",
            "2021-08-09" if v3.abs_demographics_sourced else f"{now}-01",
            loaded,
            "verified" if v3.abs_demographics_sourced else "estimated"
        ),
        "population": _provenance(
            v3.population or v3.population_2021,
            "government" if v3.abs_demographics_sourced else "transformed",
            "ABS Census 2021" if v3.abs_demographics_sourced else "Public data",
            "2021-08-09" if v3.abs_demographics_sourced else None,
            loaded,
            "verified" if v3.abs_demographics_sourced else "estimated"
        ),
        "schoolQuality": _provenance(
            v3.school_quality or 5.0,
            "government", "ACARA ICSEA Index",
            "2021-01-01", loaded, "verified"
        ),
        "transitAccessibility": _provenance(
            v3.transit_accessibility or 5.0,
            "open_data", "OpenStreetMap transit data",
            f"{now}-01", loaded, "estimated"
        ),
        "dqScore": _provenance(
            _calibrate_dq(v3),
            "transformed", "Internal data quality metric",
            f"{now}-01", loaded, "derived"
        ),
        "socialHousingPct": _provenance(
            v3.social_housing_pct,
            "government" if v3.abs_g37_sourced else "derived",
            "ABS Census 2021 G37" if v3.abs_g37_sourced else "Derived from census tenure data",
            "2021-08-09" if v3.abs_g37_sourced else None,
            loaded,
            "verified" if v3.abs_g37_sourced else "estimated"
        ),
        "socialInfra": _provenance(
            {
                "worship_total": v3.worship_total,
                "shelter_count": v3.shelter_count,
                "community_centre_count": v3.community_centre_count,
                "retirement_home_count": v3.retirement_home_count,
                "construction_sqkm": v3.construction_sqkm,
            },
            "open_data", "OpenStreetMap via PostGIS",
            str(v3.osm_enriched_at)[:10] if v3.osm_enriched_at else None,
            loaded,
            "estimated"
        ),
    }

def _calibrate_dq(v3) -> float:
    """Recalibrate DQ Score: subtract points for NULL critical fields."""
    raw = float(v3.dq_score or 100)
    penalties = 0
    
    # Critical institutional metrics (heavy penalty if missing)
    critical_checks = [
        v3.vacancy_rate, 
        v3.price_to_income_ratio, 
        v3.predominant_occupation,
        v3.population_cagr,
        v3.rental_stock
    ]
    for c in critical_checks:
        if c is None or c == 0:
            penalties += 15
            
    # Secondary metrics (light penalty if missing)
    minor_checks = [
        v3.avg_icsea, 
        v3.school_count, 
        v3.typical_mortgage_band
    ]
    for c in minor_checks:
        if c is None or c == 0:
            penalties += 3
            
    return max(5, min(100, raw - penalties))

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
    
    # Query optimized time-series table for history
    history_records = db.query(SuburbPriceHistory).filter(SuburbPriceHistory.suburb_id == v3.id).order_by(SuburbPriceHistory.record_date.asc()).all()
    formatted_history = [{"date": r.record_date.strftime("%Y-%m"), "value": r.median_price} for r in history_records if r.median_price]
    formatted_rent_history = [{"date": r.record_date.strftime("%Y-%m"), "value": r.median_rent} for r in history_records if r.median_rent]
    
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
        # Social infrastructure (OSM)
        "worshipTotal": v3.worship_total,
        "worshipChristian": v3.worship_christian,
        "worshipMuslim": v3.worship_muslim,
        "worshipBuddhist": v3.worship_buddhist,
        "worshipHindu": v3.worship_hindu,
        "worshipSikh": v3.worship_sikh,
        "worshipJewish": v3.worship_jewish,
        "worshipOther": v3.worship_other,
        "worshipDetail": v3.worship_detail,
        "shelterCount": v3.shelter_count,
        "communityCentreCount": v3.community_centre_count,
        "retirementHomeCount": v3.retirement_home_count,
        "socialInfraDetail": v3.social_infra_detail,
        # Development indicators (OSM landuse)
        "constructionSqkm": v3.construction_sqkm,
        "greenfieldSqkm": v3.greenfield_sqkm,
        "brownfieldSqkm": v3.brownfield_sqkm,
        "buildingConstructionCount": v3.building_construction_count,
        # Schools
        "schoolQuality": v3.school_quality or 5.0,
        "schools": v3.schools or [],
        "acara_schools": v3.schools or [],
        "avgIcsea": v3.avg_icsea, "schoolCount": v3.school_count,
        "topSchoolName": v3.top_school_name,
        # Transit & safety
        "transitAccessibility": v3.transit_accessibility or 5.0,
        "cbdDistance": v3.cbd_distance_mins,
        "metroCBD": v3.metro_cbd or (f"{v3.state} CBD" if v3.state else ""),
        "safetyScore": v3.safety_score or 60.0,
        "crimeRate": v3.crime_rate or 5000.0,
        # Content
        "highlights": v3.highlights or [],
        "history": formatted_history if formatted_history else (v3.history_10yr or []),
        "historyRent": formatted_rent_history if formatted_rent_history else (v3.history_rent_10yr or []),
        "historyPocNote": "Historical charts use existing dataset. Source rights and observation accuracy not yet validated for POC. Future forecasts not yet enabled.",
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
        # Social housing (ABS Census G37)
        "publicHousingDwellings": v3.public_housing_dwellings,
        "communityHousingDwellings": v3.community_housing_dwellings,
        "renterStateHousingPct": v3.renter_state_housing_pct,
        "renterCommunityHousingPct": v3.renter_community_housing_pct,
        "socialHousingPct": v3.social_housing_pct,
        "absG37Sourced": v3.abs_g37_sourced,
        # Subdivision potential heuristic
        "avgBlockSqm": round((v3.area_sqkm * 1000000 * 0.4) / v3.total_properties, 1) if v3.area_sqkm and v3.total_properties and v3.total_properties > 0 else None,
        "subdivisionPotential": (
            "High" if (v3.area_sqkm and v3.total_properties and v3.total_properties > 0 and ((v3.area_sqkm * 1000000 * 0.4) / v3.total_properties) > 600)
            else "Medium" if (v3.area_sqkm and v3.total_properties and v3.total_properties > 0 and ((v3.area_sqkm * 1000000 * 0.4) / v3.total_properties) > 400)
            else "Low"
        ),
        "approvedSubdivisions12m": v3.approved_subdivisions_12m,
        # ABS data provenance
        "absDemographicsSourced": v3.abs_demographics_sourced,
        "absSourcedFields": v3.abs_sourced_fields,
        # Growth Score
        "growthScore": growth["score"],
        "growthFactors": growth["factors"],
        "confidenceNotes": growth.get("confidence_notes", []),
        "lastUpdated": str(v3.last_updated) if v3.last_updated else None,
        "_provenance": _provenanced_metrics(v3),
    }
    return response


@app.get("/api/suburbs/{suburb_id}/evidence")
def get_suburb_evidence(suburb_id: str, db: Session = Depends(get_db)):
    """Evidence contract: trace every material metric to its source.
    Returns null observed_at when source timestamp is unavailable."""
    v3 = _get_suburb_or_404(suburb_id, db)
    loaded_at = str(v3.last_updated) if v3.last_updated else None
    raw_id = v3.source_raw_id
    transform_id = v3.transform_run_id

    def _ev(evidence_id: str, metric_name: str, value, unit: str, source_type: str,
             source_name: str, source_url, source_record_id,
             observed_at, direct_derived: str = "direct",
             quality_status: str = "observation_date_unknown",
             derived_from=None) -> dict:
        entry = {
            "evidence_id": evidence_id,
            "metric_name": metric_name,
            "value": value,
            "unit": unit,
            "source_type": source_type,
            "source_name": source_name,
            "source_url": source_url,
            "source_record_id": source_record_id,
            "observed_at": observed_at,
            "loaded_at": loaded_at,
            "transform_run_id": transform_id,
            "direct_or_derived": direct_derived,
            "quality_status": quality_status,
            "raw_snapshot_ref": raw_id,
            "dq_issue": None,
        }
        if derived_from:
            entry["derived_from"] = derived_from
        return entry

    evidence = {
        "suburb_id": v3.id,
        "suburb_name": v3.name,
        "state": v3.state,
        "model_version": poc_config.poc_model_version,
        "entries": [
            _ev(f"raw:{raw_id}:house_median_price:2026-06-30",
                "Median House Price", v3.house_median_price, "AUD",
                "scraped_source", "OnTheHouse property dataset", None, raw_id,
                "2026-06-30T00:00:00Z", "direct", "verified"),
            _ev(f"raw:{raw_id}:house_median_rent:2026-06-30",
                "Median Weekly Rent", v3.house_median_rent, "AUD/week",
                "scraped_source", "OnTheHouse property dataset", None, raw_id,
                "2026-06-30T00:00:00Z", "direct", "verified"),
            _ev(f"derived:gross_yield:{loaded_at}",
                "Gross Rental Yield", _cap_yield(v3.house_gross_rental_yield), "percent",
                "derived", "Computed from price and rent", None, None,
                None, "derived", "estimated",
                derived_from=[f"raw:{raw_id}:house_median_price:2026-06-30",
                             f"raw:{raw_id}:house_median_rent:2026-06-30"]),
            _ev(f"raw:{raw_id}:vacancy_rate:2026-06-30",
                "Vacancy Rate", v3.vacancy_rate, "percent",
                "scraped_source", "OnTheHouse property dataset", None, raw_id,
                "2026-06-30T00:00:00Z", "direct",
                "verified" if (v3.dq_score or 0) >= 70 else "estimated"),
            _ev(f"abs:census:population:2021" if v3.abs_demographics_sourced else f"derived:population:{loaded_at}",
                "Population", v3.population or v3.population_2021, "people",
                "government" if v3.abs_demographics_sourced else "derived",
                "ABS Census 2021" if v3.abs_demographics_sourced else "Derived from census snapshot",
                None, None,
                "2021-08-09" if v3.abs_demographics_sourced else None,
                "direct" if v3.abs_demographics_sourced else "derived",
                "verified" if v3.abs_demographics_sourced else "observation_date_unknown"),
            _ev(f"acara:icsea:{v3.id}",
                "School Quality (ICSEA)", v3.school_quality or 5.0, "index",
                "government", "ACARA ICSEA Index", None, None,
                "2021-01-01", "direct", "verified"),
            _ev(f"osm:transit_access:{v3.id}",
                "Transit Accessibility", v3.transit_accessibility or 5.0, "score",
                "open_data", "OpenStreetMap transit data", None, None,
                None, "direct", "observation_date_unknown"),
            _ev(f"derived:dq_score:{v3.id}",
                "Data Quality Score", _calibrate_dq(v3), "score",
                "derived", "Internal data quality assessment", None, None,
                None, "derived", "derived"),
        ],
    }
    return evidence


@app.get("/api/suburbs/{suburb_id}/decision-brief")
def get_decision_brief(suburb_id: str, db: Session = Depends(get_db)):
    """Returns a versioned decision snapshot for the Decision Brief UI component."""
    import uuid as _uuid
    v3 = _get_suburb_or_404(suburb_id, db)
    from buyfinder import compute_buyer_fit, BuyFinderRequest as BFR, BuyFinderWeights, unified_eligibility

    request = BFR(state=v3.state, weights=BuyFinderWeights())
    result = compute_buyer_fit(v3, request)
    eligibility = unified_eligibility(v3)

    return {
        "decision_snapshot_id": str(_uuid.uuid4())[:8],
        "model_version": poc_config.poc_model_version,
        "suburb_id": v3.id,
        "suburb_name": v3.name,
        "state": v3.state,
        "score": result["buyer_fit_score"],
        "components": result["components"],
        "drivers": result["drivers"],
        "risks": result["risks"],
        "unknowns": result["unknowns"],
        "evidence_ids": result["evidence_ids"],
        "confidence_label": result["confidence_label"],
        "eligibility": eligibility,
        "generated_at": __import__('datetime').datetime.utcnow().isoformat(),
    }



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
def analyze_suburb(req: AnalyzeRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if not ENABLE_AI_INSIGHTS:
        raise HTTPException(status_code=503, detail="AI insights have been temporarily disabled (ENABLE_AI_INSIGHTS=false)")
    # Rate limiting: max 10 requests per minute per suburb
    client_key = f"{req.id}:{datetime.now().strftime('%Y%m%d%H%M')}"
    if not _check_rate_limit(client_key, max_requests=10, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 10 requests per minute per suburb.")
    
    if not AI_AGENT_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI sentiment service not available")
    
    try:
        v3 = db.query(SuburbUIV3).filter(func.upper(SuburbUIV3.id) == req.id.upper()).first()
        if not v3:
            return {"status": "error", "message": "Suburb not found in database"}
            
        ai_cache = v3.ai_insights or {}
            
        # P0 FIX: Check if already analyzed to prevent LLM API exhaustion
        if ai_cache.get("aiCommitteeVerdict") and ai_cache.get("fetched_at"):
            try:
                fetched_dt = datetime.fromisoformat(ai_cache["fetched_at"])
                if (datetime.utcnow() - fetched_dt).total_seconds() < AI_CACHE_TTL_SECONDS:
                    return {
                        "status": "success",
                        "cached": True,
                        "cache_ttl": AI_CACHE_TTL_SECONDS,
                        "result": {
                            "bull": ai_cache.get("aiCommitteeDebate", {}).get("bull", ""),
                            "bear": ai_cache.get("aiCommitteeDebate", {}).get("bear", ""),
                            "urban": ai_cache.get("aiCommitteeDebate", {}).get("urban", ""),
                            "reality_check": ai_cache.get("aiCommitteeDebate", {}).get("reality_check", ""),
                            "verdict": ai_cache["aiCommitteeVerdict"],
                            "playbook": ai_cache["aiCommitteePlaybook"],
                            "catalysts": v3.highlights or [],
                            "source_snippets": ai_cache.get("source_snippets", []),
                            "risk_assessment": ai_cache.get("risk_assessment"),
                            "policy_warnings": ai_cache.get("policy_warnings", []),
                        }
                    }
            except (ValueError, TypeError):
                pass
            
        # Compile rich V3 metrics for the AI to analyze
        # Fetch ETF for macro benchmark comparison
        try:
            etf_data = get_vap_etf()
        except:
            etf_data = None
            
        metrics = {
            "houseMedianPrice": v3.house_median_price,
            "houseMedianRent": v3.house_median_rent,
            "houseRentalYield": v3.house_gross_rental_yield,
            "12mGrowthPct": v3.house_median_price_12m_change_pct,
            "populationCagr": v3.population_cagr,
            "ownerOccupierRate": v3.owner_occupier_rate,
            "investorRate": v3.investor_rate,
            "vacancyRate": v3.vacancy_rate,
            "supplyDemandRatio": v3.supply_demand_ratio,
            "typicalMortgageBand": v3.typical_mortgage_band,
            "averageHouseholdSize": v3.average_household_size,
            "medianAge": v3.median_age,
            "predominantOccupation": v3.predominant_occupation,
            "macro_benchmark_etf": etf_data
        }

        # Run the full multi-agent committee (pass rich V3 metrics in)
        ai_result = run_investment_committee(req.suburb, req.state, metrics)

        # Save results back to SuburbUIV3
        ai_cache["aiCommitteeVerdict"] = ai_result["verdict"]
        ai_cache["aiCommitteePlaybook"] = ai_result["playbook"]
        ai_cache["aiCommitteeDebate"] = {
            "bull": ai_result["bull"],
            "bear": ai_result["bear"],
            "urban": ai_result["urban"],
            "reality_check": ai_result["reality_check"]
        }
        ai_cache["source_snippets"] = ai_result.get("source_snippets", [])
        ai_cache["risk_assessment"] = ai_result.get("risk_assessment")
        ai_cache["policy_warnings"] = ai_result.get("policy_warnings", [])
        ai_cache["fetched_at"] = datetime.utcnow().isoformat()
        
        v3.ai_insights = ai_cache
        
        if ai_result.get("catalysts") and len(ai_result["catalysts"]) > 0:
            v3.highlights = ai_result["catalysts"]
            
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(v3, "ai_insights")
        if v3.highlights:
            flag_modified(v3, "highlights")
            
        db.commit()
            
        return {
            "status": "success",
            "cached": False,
            "cache_ttl": AI_CACHE_TTL_SECONDS,
            "result": ai_result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/similar-suburbs")
def get_similar_suburbs(req: AnalyzeRequest, db: Session = Depends(get_db)):
    if not find_similar_suburbs:
        raise HTTPException(status_code=503, detail="Clustering service not available")
        
    try:
        target_suburb = db.query(SuburbUIV3).filter(SuburbUIV3.id == req.id).first()
        if not target_suburb:
            return {"status": "error", "message": "Suburb not found in database"}
            
        all_suburbs = db.query(SuburbUIV3).filter(
            SuburbUIV3.is_live == True,
            SuburbUIV3.state == target_suburb.state,
            SuburbUIV3.dq_score >= poc_config.public_poc_min_dq_score,
        ).all()
        
        def _build_cluster_data(v3):
            return {
                "id": v3.id.upper(),
                "name": v3.name,
                "state": v3.state,
                "postcode": v3.postcode,
                "metrics": {
                    "medianPrice": v3.house_median_price or 0,
                    "schoolQuality": v3.school_quality or 0,
                    "rentalYield": v3.house_gross_rental_yield or 0,
                    "populationDensity": v3.population_density or 1000,
                    "growthScore": _compute_growth_score(v3)["score"],
                }
            }

        print(f"[cluster] Loaded {len(all_suburbs)} live suburbs in {target_suburb.state}")
        all_data = [_build_cluster_data(s) for s in all_suburbs]
        target_data = _build_cluster_data(target_suburb)
        
        similar = find_similar_suburbs(target_data, all_data, limit=5)
        print(f"[cluster] Found {len(similar)} similar suburbs for {req.suburb}")
        return {"status": "success", "similar": similar}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _normalize_suburb_id(suburb_id: str) -> str:
    """Convert frontend ID format (parramatta-nsw-2150) to DB format (NSW_PARRAMATTA_2150)."""
    from suburb_utils import normalize_suburb_id
    return normalize_suburb_id(suburb_id)


def _get_suburb_or_404(suburb_id: str, db: Session):
    """Look up a SuburbUIV3 by normalized ID. Raises 404 if not found."""
    normalized = _normalize_suburb_id(suburb_id)
    v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id == normalized).first()
    if not v3:
        v3 = db.query(SuburbUIV3).filter(SuburbUIV3.id.ilike(f"%{suburb_id.replace('-', '_')}%")).first()
    if not v3:
        raise HTTPException(status_code=404, detail="Suburb not found")
    return v3


# Cache TTL for AI features (default 7 days)
AI_CACHE_TTL_SECONDS = int(os.getenv("AI_CACHE_TTL", "604800"))

@app.post("/api/suburbs/{suburb_id}/news-sentiment")
def get_news_sentiment(suburb_id: str, db: Session = Depends(get_db)):
    """On-demand news sentiment for a suburb.
    Caching: DB (TTL=AI_CACHE_TTL) → Redis (TTL=AI_CACHE_TTL) → Tavily+Transformers.
    """
    if not ENABLE_AI_INSIGHTS:
        raise HTTPException(status_code=503, detail="AI insights have been temporarily disabled (ENABLE_AI_INSIGHTS=false)")
    
    v3 = _get_suburb_or_404(suburb_id, db)
    
    # Layer 1: DB cache
    cached = v3.news_sentiment or {}
    if isinstance(cached, dict):
        fetched = cached.get("fetched_at")
        if fetched:
            try:
                from datetime import datetime
                fetched_dt = datetime.fromisoformat(fetched)
                if (datetime.utcnow() - fetched_dt).total_seconds() < AI_CACHE_TTL_SECONDS:
                    return {
                        "cached": True,
                        "cache_ttl": AI_CACHE_TTL_SECONDS,
                        **cached,
                    }
            except (ValueError, TypeError):
                pass
    
    # Layer 2: Redis (via cached_ai wrapper on get_news_sentiment)
    # Layer 3: Fresh fetch from Tavily + Transformers
    record_cache_miss()
    from ai_agent import get_news_sentiment as fetch_sentiment
    cache_key = f"ai_sentiment:{v3.name}:{v3.state}"
    
    def _fetch():
        return fetch_sentiment(v3.name or "", v3.state or "")
    
    result = get_cached_or_query(cache_key, _fetch, expire_secs=AI_CACHE_TTL_SECONDS)
    
    # Persist to DB for cold-start
    v3.news_sentiment = result
    db.commit()
    
    return {
        "cached": False,
        "cache_ttl": AI_CACHE_TTL_SECONDS,
        **result,
    }
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


from pydantic import BaseModel

class ROICalcRequest(BaseModel):
    purchase_price: float
    weekly_rent: float
    state: str = "VIC"
    deposit_pct: float = 20.0
    interest_rate: float = 6.2
    loan_type: str = "io"
    strata_fees: float = 0.0
    council_rates: float = 1800.0
    water_rates: float = 900.0
    insurance: float = 1500.0
    pm_fee_pct: float = 7.5
    vacancy_weeks: float = 2.0
    maintenance_pct: float = 0.35
    salary: float = 100000.0
    depreciation: float = 8000.0

def calculate_stamp_duty(state: str, price: float) -> float:
    state = state.upper()
    if state == "VIC":
        if price <= 25000: return price * 0.014
        elif price <= 130000: return 350 + (price - 25000) * 0.024
        elif price <= 960000: return 2870 + (price - 130000) * 0.06
        elif price <= 2000000: return price * 0.055
        else: return price * 0.065
    elif state == "NSW":
        if price <= 16000: return price * 0.0125
        elif price <= 35000: return 200 + (price - 16000) * 0.015
        elif price <= 93000: return 485 + (price - 35000) * 0.0175
        elif price <= 351000: return 1500 + (price - 93000) * 0.035
        elif price <= 1168000: return 10530 + (price - 351000) * 0.045
        elif price <= 3505000: return 47295 + (price - 1168000) * 0.055
        else: return 175830 + (price - 3505000) * 0.07
    elif state == "QLD":
        if price <= 5000: return 0
        elif price <= 75000: return (price - 5000) * 0.015
        elif price <= 540000: return 1050 + (price - 75000) * 0.035
        elif price <= 1000000: return 17325 + (price - 540000) * 0.045
        else: return 38025 + (price - 1000000) * 0.0575
    elif state == "SA":
        if price <= 12000: return price * 0.01
        elif price <= 30000: return 120 + (price - 12000) * 0.02
        elif price <= 50000: return 480 + (price - 30000) * 0.03
        elif price <= 100000: return 1080 + (price - 50000) * 0.04
        elif price <= 200000: return 3080 + (price - 100000) * 0.0475
        elif price <= 250000: return 7830 + (price - 200000) * 0.05
        elif price <= 300000: return 10330 + (price - 250000) * 0.0525
        elif price <= 500000: return 12955 + (price - 300000) * 0.055
        else: return 23955 + (price - 500000) * 0.055
    elif state == "WA":
        if price <= 120000: return price * 0.019
        elif price <= 150000: return 2280 + (price - 120000) * 0.0285
        elif price <= 360000: return 3135 + (price - 150000) * 0.038
        elif price <= 725000: return 11115 + (price - 360000) * 0.0475
        else: return 28453 + (price - 725000) * 0.0515
    elif state == "TAS":
        if price <= 3000: return 50
        elif price <= 25000: return 50 + (price - 3000) * 0.0175
        elif price <= 75000: return 435 + (price - 25000) * 0.0225
        elif price <= 200000: return 1560 + (price - 75000) * 0.035
        elif price <= 375000: return 5935 + (price - 200000) * 0.04
        elif price <= 725000: return 12935 + (price - 375000) * 0.0425
        else: return 27810 + (price - 725000) * 0.045
    elif state == "NT":
        if price <= 525000:
            V = price / 1000
            return (0.06571441 * V**2) + 15 * V
        elif price < 3000000: return price * 0.0495
        elif price < 5000000: return price * 0.0575
        else: return price * 0.0595
    elif state == "ACT":
        if price <= 260000: return price * 0.012
        elif price <= 300000: return 3120 + (price - 260000) * 0.022
        elif price <= 500000: return 4000 + (price - 300000) * 0.034
        elif price <= 750000: return 10800 + (price - 500000) * 0.0432
        elif price <= 1000000: return 21600 + (price - 750000) * 0.059
        elif price <= 1455000: return 36350 + (price - 1000000) * 0.064
        else: return price * 0.0454
    else:
        return price * 0.05

@app.post("/api/calc/roi")
def calculate_roi(req: ROICalcRequest):
    stamp_duty = calculate_stamp_duty(req.state, req.purchase_price)
    deposit_amount = req.purchase_price * (req.deposit_pct / 100)
    loan_amount = req.purchase_price - deposit_amount
    total_upfront = deposit_amount + stamp_duty
    
    annual_rent = req.weekly_rent * (52 - req.vacancy_weeks)
    pm_fees = annual_rent * (req.pm_fee_pct / 100)
    maintenance = req.purchase_price * (req.maintenance_pct / 100)
    
    annual_expenses = req.strata_fees + req.council_rates + req.water_rates + req.insurance + pm_fees + maintenance
    
    # Interest-only approximation
    if req.loan_type == "io":
        annual_interest = loan_amount * (req.interest_rate / 100)
    else:
        # P&I rough approximation
        r = (req.interest_rate / 100) / 12
        n = 30 * 12
        if r > 0 and loan_amount > 0:
            monthly_payment = loan_amount * (r * (1 + r)**n) / ((1 + r)**n - 1)
            annual_interest = (monthly_payment * 12) - (loan_amount * 0.02)
        else:
            annual_interest = 0
            
    net_annual_cashflow_pre_tax = annual_rent - annual_expenses - annual_interest
    net_weekly_cashflow_pre_tax = net_annual_cashflow_pre_tax / 52
    
    # Marginal Tax Rate Calculation (including 2% Medicare Levy)
    tax_rate = 0.0
    if req.salary > 190000: tax_rate = 0.47
    elif req.salary > 135000: tax_rate = 0.39
    elif req.salary > 45000: tax_rate = 0.32
    elif req.salary > 18200: tax_rate = 0.18
    
    # Tax Adjusted Cashflow
    # On-paper tax loss/gain = Cashflow (excluding P&I principal) - Depreciation
    # Note: annual_interest is just the interest portion for IO, and rough estimate for P&I.
    taxable_position = net_annual_cashflow_pre_tax - req.depreciation
    tax_rebate = 0
    if taxable_position < 0:
        # Negative gearing rebate
        tax_rebate = abs(taxable_position) * tax_rate
    else:
        # Positive gearing tax to pay
        tax_rebate = - (taxable_position * tax_rate)
        
    net_annual_cashflow_post_tax = net_annual_cashflow_pre_tax + tax_rebate
    net_weekly_cashflow_post_tax = net_annual_cashflow_post_tax / 52
    
    cash_on_cash_return = (net_annual_cashflow_pre_tax / total_upfront) * 100 if total_upfront > 0 else 0
    gross_yield = (req.weekly_rent * 52 / req.purchase_price) * 100 if req.purchase_price > 0 else 0
    net_yield = ((annual_rent - annual_expenses) / req.purchase_price) * 100 if req.purchase_price > 0 else 0
    
    return {
        "status": "success",
        "metrics": {
            "purchase_price": req.purchase_price,
            "deposit_amount": deposit_amount,
            "loan_amount": loan_amount,
            "stamp_duty": stamp_duty,
            "total_upfront": total_upfront,
            "gross_yield_pct": round(gross_yield, 2),
            "net_yield_pct": round(net_yield, 2),
            "annual_rent": round(annual_rent, 2),
            "annual_expenses": round(annual_expenses, 2),
            "annual_interest": round(annual_interest, 2),
            "taxable_position": round(taxable_position, 2),
            "tax_rebate": round(tax_rebate, 2),
            "net_annual_cashflow_pre_tax": round(net_annual_cashflow_pre_tax, 2),
            "net_weekly_cashflow_pre_tax": round(net_weekly_cashflow_pre_tax, 2),
            "net_annual_cashflow_post_tax": round(net_annual_cashflow_post_tax, 2),
            "net_weekly_cashflow_post_tax": round(net_weekly_cashflow_post_tax, 2),
            "cash_on_cash_return_pct": round(cash_on_cash_return, 2),
            "gearing_status": "positive" if net_annual_cashflow_pre_tax > 0 else ("neutral" if net_annual_cashflow_pre_tax == 0 else "negative")
        }
    }

@app.get("/api/mortgage-rate")
def get_mortgage_rate():
    return {
        "status": "success",
        "base_cash_rate": 4.35,
        "retail_margin": 1.85,
        "effective_mortgage_rate": 6.20,
        "source": "Simulated (indicative only; not live RBA data)",
        "last_updated": "Today",
        "data_status": "simulated",
        "disclaimer": "This rate is indicative only and simulated. Always verify with your lender for actual rates. Not for production decision-making."
    }

# =============================================================================
# V3 INSTITUTIONAL API — serves enriched data from OnTheHouse extraction
# =============================================================================

@app.get("/api/v3/suburbs")
def get_suburbs_v3(state: Optional[str] = None, limit: int = 50, db: Session = Depends(get_db)):
    """Returns V3-enriched suburbs for the institutional dashboard view."""
    
    def _fetch():
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
            "dqScore": _calibrate_dq(r) if hasattr(r, 'dq_score') else min(100, max(5, r.dq_score or 100)),
            "dqIssues": r.dq_issues,
            "lastUpdated": str(r.last_updated) if r.last_updated else None,
        }
        for r in results
    ]
    
    cache_key = f"v3_suburbs:{state or 'ALL'}:{limit}"
    return get_cached_or_query(cache_key, _fetch, expire_secs=3600)

from fastapi.responses import StreamingResponse
import io
import csv

@app.get("/api/v3/export")
def export_suburbs_csv(state: Optional[str] = None, limit: int = 1000, db: Session = Depends(get_db)):
    """Exports the V3 suburbs table to a CSV file."""
    query = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True)
    if state:
        query = query.filter(SuburbUIV3.state == state.upper())
    query = query.order_by(SuburbUIV3.house_median_price.desc().nulls_last()).limit(limit)
    results = query.all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "ID", "State", "Name", "Postcode", "House_Median_Price", "House_Yield", 
        "House_12m_Growth", "Population", "DQ_Score", "Safety_Score"
    ])
    
    for r in results:
        writer.writerow([
            r.id, r.state, r.name, r.postcode, 
            r.house_median_price, r.house_gross_rental_yield, 
            r.house_median_price_12m_change_pct, r.population_2021,
            r.dq_score, r.safety_score
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=realestate_export_{state or 'national'}.csv"}
    )

class FavoriteRequest(BaseModel):
    suburb_id: str

@app.get("/api/favorites")
def get_favorites(db: Session = Depends(get_db), user=Depends(get_current_user)):
    favs = db.query(UserFavorite).filter(UserFavorite.user_id == user.id).all()
    suburb_ids = [f.suburb_id for f in favs]
    return {"status": "success", "favorites": suburb_ids}

@app.post("/api/favorites")
def toggle_favorite(req: FavoriteRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    existing = db.query(UserFavorite).filter(UserFavorite.user_id == user.id, UserFavorite.suburb_id == req.suburb_id).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"status": "success", "action": "removed"}
    else:
        new_fav = UserFavorite(user_id=user.id, suburb_id=req.suburb_id)
        db.add(new_fav)
        db.commit()
        return {"status": "success", "action": "added"}

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
        "dqScore": _calibrate_dq(r) if hasattr(r, 'dq_score') else min(100, max(5, r.dq_score or 100)),
        "dqIssues": r.dq_issues,
        "lastUpdated": str(r.last_updated) if r.last_updated else None,
    }


@app.get("/api/osm/livability")
def get_osm_livability(lat: float, lng: float, radius: int = 2500, suburb_id: str = None):
    """Returns local POI data and livability scores from PostGIS OSM tables.
    Replaces direct Overpass API calls.

    If suburb_id is provided, also returns pre-computed aggregate columns
    (worship_total, shelter_count, construction_sqkm, etc.) from suburbs_ui_v3.
    """
    from osm_local import get_livability, get_boundary
    from sqlalchemy import func, text as sqla_text
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

    response = {
        "cafes": _format_pois("cafe"),
        "parks": _format_pois("park"),
        "transit": _format_pois("transit"),
        "train_stations": _format_pois("train_station"),
        "schools": _format_pois("school"),
        "shops": _format_pois("shopping"),
        "hospitals": _format_pois("hospital"),
        "sports": _format_pois("sports"),
        "worship": _format_pois("worship"),
        "shelters": _format_pois("shelter"),
        "community_centres": _format_pois("community_centre"),
        "retirement_homes": _format_pois("retirement_home"),
        "walkabilityScore": data["walkScore"],
        "transitScoreStandalone": data["transitScore"],
        "liveabilityScore": data["liveabilityScore"],
        "socialInfraScore": data.get("socialInfraScore", 0),
        "worshipDiversityScore": data.get("worshipDiversityScore", 0),
        "counts": data.get("counts", {}),
    }

    # Optionally enrich with pre-computed suburb-level aggregate data
    db = SessionLocal()
    try:
        if suburb_id:
            row = db.query(SuburbUIV3).filter(SuburbUIV3.id == suburb_id.upper()).first()
        else:
            row = None
        if row and row.osm_enriched_at:
            response["aggregate"] = {
                "worship_total": row.worship_total,
                "worship_christian": row.worship_christian,
                "worship_muslim": row.worship_muslim,
                "worship_buddhist": row.worship_buddhist,
                "worship_hindu": row.worship_hindu,
                "worship_other": row.worship_other,
                "shelter_count": row.shelter_count,
                "community_centre_count": row.community_centre_count,
                "retirement_home_count": row.retirement_home_count,
                "construction_sqkm": row.construction_sqkm,
                "greenfield_sqkm": row.greenfield_sqkm,
                "brownfield_sqkm": row.brownfield_sqkm,
                "building_construction_count": row.building_construction_count,
            }
    finally:
        db.close()

    return response

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

@app.get("/metrics")
def metrics():
    """Prometheus-compatible metrics endpoint for AI observability."""
    return Response(content=get_metrics_text(), media_type="text/plain; version=0.0.4")


@app.get("/api/risk/what-if")
def risk_what_if(
    price: float = 800000,
    rate: float = 6.2,
    yield_val: float = 4.0,
    vacancy: float = 3.0,
    growth_score: float = 50,
):
    """Backend what-if scenario using the same Monte Carlo engine as the committee."""
    macro = {
        "cash_rate": rate,
        "cpi_annual": 3.2,
        "unemployment": 4.1,
        "population_growth": 2.4,
        "building_approvals": 1.0,
    }
    try:
        from risk_engine import compute_risk_rating
        result = compute_risk_rating(price, yield_val, growth_score, macro=macro)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ModelDiaryEntry(BaseModel):
    suburb_id: str
    property_type: str = "house"
    predicted_fit_score: float
    ai_verdict: str = ""
    baseline_median_price: float
    baseline_rental_yield: float
    baseline_vacancy_rate: float
    data_quality_score: float


@app.post("/api/model-diary/predictions")
def create_model_diary_entry(req: ModelDiaryEntry, db: Session = Depends(get_db)):
    """Persist a prediction for later outcome tracking."""
    from models_v3 import ModelDiary as MD
    import uuid
    entry = MD(
        suburb_id=req.suburb_id,
        prediction_date=datetime.utcnow(),
        predicted_fit_score=req.predicted_fit_score,
        ai_verdict=req.ai_verdict,
        baseline_median_price=req.baseline_median_price,
        baseline_rental_yield=req.baseline_rental_yield,
        baseline_vacancy_rate=req.baseline_vacancy_rate,
        data_quality_score=req.data_quality_score,
    )
    db.add(entry)
    db.commit()
    return {"status": "success", "id": entry.id}


@app.get("/api/model-diary/{suburb_id}")
def get_model_diary(suburb_id: str, db: Session = Depends(get_db)):
    """Retrieve historical predictions for a suburb."""
    from models_v3 import ModelDiary as MD
    entries = db.query(MD).filter(MD.suburb_id == suburb_id.upper()).order_by(MD.prediction_date.desc()).all()
    return {
        "suburb_id": suburb_id,
        "entries": [
            {
                "id": e.id,
                "prediction_date": str(e.prediction_date),
                "predicted_fit_score": e.predicted_fit_score,
                "ai_verdict": e.ai_verdict,
                "baseline_median_price": e.baseline_median_price,
                "baseline_rental_yield": e.baseline_rental_yield,
                "baseline_vacancy_rate": e.baseline_vacancy_rate,
                "data_quality_score": e.data_quality_score,
                "realized_price_6m": e.realized_price_6m,
                "realized_price_12m": e.realized_price_12m,
                "realized_price_36m": e.realized_price_36m,
                "outcome_rating": e.outcome_rating,
            }
            for e in entries
        ],
    }


@app.get("/api/model-diary/summary")
def get_model_diary_summary(db: Session = Depends(get_db)):
    """Summary of model prediction performance."""
    from models_v3 import ModelDiary as MD
    from sqlalchemy import func as sa_func

    total = db.query(MD).count()
    rated = db.query(MD).filter(MD.outcome_rating.isnot(None)).count()

    entries = db.query(MD).filter(MD.outcome_rating.isnot(None)).all()
    outperformed = sum(1 for e in entries if e.outcome_rating == "outperformed" or e.outcome_rating == "correct")

    summary = {
        "total_predictions": total,
        "rated_predictions": rated,
        "outperformed_or_correct": outperformed,
        "hit_rate": round(outperformed / rated * 100, 1) if rated > 0 else None,
        "status": "incomplete" if rated < 10 else "limited",
        "note": "Insufficient outcome data for statistical calibration. Do not treat as validated probability model."
    }
    return summary


@app.post("/api/buy-finder/rank")
def buy_finder_rank(request: BuyFinderRequest, db: Session = Depends(get_db)):
    """Versioned backend ranking endpoint for the POC Buyer Fit Score."""
    import math
    if request.budget <= 0:
        raise HTTPException(422, "budget must be greater than zero")
    if request.deposit < 0:
        raise HTTPException(422, "deposit must be non-negative")
    if request.annual_income < 0:
        raise HTTPException(422, "annual_income must be non-negative")
    if request.existing_monthly_debt < 0:
        raise HTTPException(422, "existing_monthly_debt must be non-negative")
    if request.interest_rate <= 0 or request.interest_rate > 0.20:
        raise HTTPException(422, "interest_rate out of range (0, 0.20]")
    if request.serviceability_buffer < 0:
        raise HTTPException(422, "serviceability_buffer must be non-negative")
    if request.loan_term_years < 1 or request.loan_term_years > 40:
        raise HTTPException(422, "loan_term_years out of range [1, 40]")
    if request.purchase_cost_allowance < 0:
        raise HTTPException(422, "purchase_cost_allowance must be non-negative")
    if request.minimum_yield is not None and (request.minimum_yield < 0 or request.minimum_yield > 50):
        raise HTTPException(422, "minimum_yield out of range [0, 50]")
    if not math.isfinite(request.budget) or not math.isfinite(request.deposit) or not math.isfinite(request.annual_income):
        raise HTTPException(422, "non-finite numeric value in request")
    if request.weights:
        for fname, fval in request.weights.dict().items():
            if fval < 0 or not math.isfinite(fval):
                raise HTTPException(422, f"weight {fname} must be non-negative and finite")
    from buyfinder import rank_suburbs, BuyFinderRequest as BFR, BuyFinderWeights

    weights_dict = request.weights.dict() if request.weights else {}

    bf_request = BFR(
        buyer_profile=request.buyer_profile,
        state=request.state,
        budget=request.budget,
        deposit=request.deposit,
        annual_income=request.annual_income,
        existing_monthly_debt=request.existing_monthly_debt,
        interest_rate=request.interest_rate,
        serviceability_buffer=request.serviceability_buffer,
        loan_term_years=request.loan_term_years,
        purchase_cost_allowance=request.purchase_cost_allowance,
        property_type=request.property_type,
        maximum_cbd_minutes=request.maximum_cbd_minutes,
        minimum_yield=request.minimum_yield,
        weights=weights_dict,
    )
    return rank_suburbs(bf_request, db)
