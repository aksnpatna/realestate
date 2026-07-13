"""
predictive_ai_engine.py — Demo-only predictive analysis engine.

Production (DEMO_MODE=false): engine is disabled. No synthetic predictions are
written into the database. Authoritative data sources are required for production.

Demo (DEMO_MODE=true): runs infrastructure/environmental risk analysis using
OSM proxy data. All results are labelled 'synthetic_demo' and must never
contribute to production Buy Finder or recommendation rankings.
"""
import os
import sys
import json
import logging
from datetime import datetime
from sqlalchemy import text
import pandas as pd
import numpy as np

try:
    import yfinance as yf
    from scipy.stats import gaussian_kde
    MACRO_AVAILABLE = True
except ImportError:
    MACRO_AVAILABLE = False

from models_v3 import SessionLocal, SuburbUIV3
from poc_config import poc_config

logger = logging.getLogger("uvicorn")


class ASXPredictor:
    def __init__(self):
        self.reit_index = yf.Ticker("VAP.AX") if MACRO_AVAILABLE else None
        
    def fetch_macro_data(self):
        if not MACRO_AVAILABLE or not self.reit_index:
            return {"rsi": 50.0, "status": "unavailable", "kde_peak": 0.0}
        try:
            hist = self.reit_index.history(period="2y")
            if hist.empty:
                return {"rsi": 50.0, "status": "no_data", "kde_peak": 0.0}
            returns = hist['Close'].pct_change().dropna()
            kde = gaussian_kde(returns.values)
            x_grid = np.linspace(returns.min(), returns.max(), 100)
            kde_peak = x_grid[np.argmax(kde(x_grid))]
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            current_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
            return {
                "rsi": round(current_rsi, 2),
                "kde_peak_return": round(float(kde_peak) * 100, 3),
                "status": "live",
                "last_price": round(float(hist['Close'].iloc[-1]), 2)
            }
        except Exception as e:
            logger.warning(f"ASX Predictor error: {e}")
            return {"rsi": 50.0, "status": "error", "kde_peak": 0.0}


def fetch_infrastructure_zoning_data(db, lat, lng, radius_m=5000):
    if not lat or not lng:
        return []
    try:
        import math
        mercator_radius = radius_m / math.cos(abs(math.radians(lat)))
        sql = f'''
            SELECT name, landuse, building
            FROM planet_osm_polygon
            WHERE (landuse='construction' OR building='construction')
              AND name IS NOT NULL
              AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
            LIMIT 5
        '''
        res = db.execute(text(sql)).fetchall()
        return [{"name": r[0], "type": "construction", "source": "osm_proxy"} for r in res]
    except Exception:
        return []


def fetch_environmental_risks(db, lat, lng, radius_m=3000):
    if not lat or not lng:
        return []
    try:
        import math
        mercator_radius = radius_m / math.cos(abs(math.radians(lat)))
        sql = f'''
            SELECT name, landuse, "natural", waterway
            FROM planet_osm_polygon
            WHERE (landuse='forest' OR "natural"='wood' OR "natural"='water' OR waterway='river')
              AND name IS NOT NULL
              AND way && ST_Expand(ST_Transform(ST_SetSRID(ST_MakePoint({lng}, {lat}), 4326), 3857), {mercator_radius})
            LIMIT 5
        '''
        res = db.execute(text(sql)).fetchall()
        risks = []
        for r in res:
            risk_type = "flood_risk" if r[2] == 'water' or r[3] == 'river' else "bushfire_risk"
            risks.append({"name": r[0], "type": risk_type, "source": "osm_proxy"})
        return risks
    except Exception:
        return []


def calculate_predictive_score(suburb_data, infra_events, env_risks, macro_data):
    base_score = 50.0
    dom = suburb_data.house_days_on_market or 45
    vacancy = suburb_data.vacancy_rate or 2.0
    if dom < 30: base_score += 10
    elif dom > 60: base_score -= 10
    if vacancy < 1.0: base_score += 15
    elif vacancy > 3.0: base_score -= 10
    oo_rate = suburb_data.owner_occupier_rate or 65.0
    if oo_rate > 70.0: base_score += 5
    if macro_data.get("status") == "live":
        rsi = macro_data.get("rsi", 50.0)
        if 55 <= rsi <= 70: base_score += 5
        elif rsi > 70: base_score -= 5
        kde_peak = macro_data.get("kde_peak_return", 0.0)
        if kde_peak > 0: base_score += (kde_peak * 10)
    infra_points = len(infra_events)
    if infra_points > 0: base_score += min(10, infra_points * 2)
    flood_risks = sum(1 for r in env_risks if r['type'] == 'flood_risk')
    fire_risks = sum(1 for r in env_risks if r['type'] == 'bushfire_risk')
    if flood_risks > 0: base_score -= min(10, flood_risks * 3)
    if fire_risks > 0: base_score -= min(5, fire_risks * 2)
    return min(100.0, max(0.0, base_score))


def run_predictive_engine():
    if not poc_config.demo_mode:
        logger.info(f"[predictive] Engine disabled — DEMO_MODE=false. Production uses authoritative data only.")
        return

    logger.info(f"[predictive] Starting DEMO-ONLY predictive engine (DEMO_MODE=true)")
    db = SessionLocal()
    try:
        macro = ASXPredictor().fetch_macro_data()
        logger.info(f"  Macro REIT status: {macro}")
        suburbs = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True).limit(200).all()
        logger.info(f"  Scoring {len(suburbs)} suburbs (DEMO ONLY)...")
        updates = 0
        for suburb in suburbs:
            lat = suburb.coordinates[0] if suburb.coordinates else None
            lng = suburb.coordinates[1] if suburb.coordinates else None
            infra_events = fetch_infrastructure_zoning_data(db, lat, lng)
            env_risks = fetch_environmental_risks(db, lat, lng)
            predicted_score = calculate_predictive_score(suburb, infra_events, env_risks, macro)
            dq = suburb.dq_issues or {}
            if isinstance(dq, list):
                dq = {"issues": dq}
            dq["predictive_analysis"] = {
                "score": round(predicted_score, 1),
                "macro_reit_rsi": macro.get("rsi"),
                "infrastructure_events": infra_events,
                "environmental_risks": env_risks,
                "calculated_at": datetime.utcnow().isoformat(),
                "quality_status": "synthetic_demo",
                "warning": "DEMO MODE — uses crowd-sourced OSM proxy data. Not authoritative. Excluded from production rankings."
            }
            suburb.dq_issues = dq
            updates += 1
        db.commit()
        logger.info(f"  Demo scoring complete for {updates} suburbs.")
    except Exception as e:
        logger.error(f"  Predictive Engine Error: {e}")
        db.rollback()
    finally:
        db.close()


def has_synthetic_recommendation_inputs(v3) -> bool:
    dq = v3.dq_issues or {}
    if isinstance(dq, dict):
        pa = dq.get("predictive_analysis", {})
        if isinstance(pa, dict) and pa.get("quality_status") == "synthetic_demo":
            return True
    return False


if __name__ == "__main__":
    run_predictive_engine()
