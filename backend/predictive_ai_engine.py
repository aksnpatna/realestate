import os
import sys
import json
from datetime import datetime
from sqlalchemy import text
import pandas as pd
import numpy as np

# We handle missing yfinance/scipy gracefully if not installed
try:
    import yfinance as yf
    from scipy.stats import gaussian_kde
    MACRO_AVAILABLE = True
except ImportError:
    MACRO_AVAILABLE = False

from models_v3 import SessionLocal, SuburbUIV3

class ASXPredictor:
    def __init__(self):
        # AREV.AX is a proxy for Australian Real Estate Investment Trusts (A-REITs)
        self.reit_index = yf.Ticker("VAP.AX") if MACRO_AVAILABLE else None
        
    def fetch_macro_data(self):
        if not MACRO_AVAILABLE or not self.reit_index:
            return {"rsi": 50.0, "status": "mocked", "kde_peak": 0.0}
            
        try:
            hist = self.reit_index.history(period="2y")
            if hist.empty:
                return {"rsi": 50.0, "status": "no_data", "kde_peak": 0.0}
                
            returns = hist['Close'].pct_change().dropna()
            
            # Kernel Density Estimation to find the most common daily return
            kde = gaussian_kde(returns.values)
            x_grid = np.linspace(returns.min(), returns.max(), 100)
            kde_peak = x_grid[np.argmax(kde(x_grid))]
            
            # RSI Calculation (14-day)
            delta = hist['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            rsi = 100 - (100 / (1 + rs))
            current_rsi = float(rsi.iloc[-1]) if not pd.isna(rsi.iloc[-1]) else 50.0
            
            return {
                "rsi": round(current_rsi, 2),
                "kde_peak_return": round(float(kde_peak) * 100, 3), # as percentage
                "status": "live",
                "last_price": round(float(hist['Close'].iloc[-1]), 2)
            }
        except Exception as e:
            print(f"ASX Predictor error: {e}")
            return {"rsi": 50.0, "status": "error", "kde_peak": 0.0}

def fetch_infrastructure_zoning_data(postcode):
    """
    Mock function representing an API call to State Government Planning Portals.
    Looks for new train stations, hospital upgrades, or high-density rezoning.
    """
    has_major_infra = int(postcode) % 7 == 0
    rezoning_approved = int(postcode) % 11 == 0
    
    events = []
    if has_major_infra:
        events.append({"type": "Infrastructure", "desc": "New Metro Station Approved", "impact_year": datetime.now().year + 3})
    if rezoning_approved:
        events.append({"type": "Zoning", "desc": "Low-to-Medium Density Rezoning", "impact_year": datetime.now().year + 1})
        
    return events

def fetch_environmental_risks(postcode):
    """
    Mock function representing an API call to GeoScience Australia or State SES APIs.
    Identifies if a suburb is in a high-risk flood or bushfire zone.
    """
    is_flood_prone = int(postcode) % 9 == 0
    is_fire_prone = int(postcode) % 13 == 0
    
    risks = []
    if is_flood_prone:
        risks.append({"type": "Flood", "severity": "High", "desc": "1-in-100 Year Flood Zone"})
    if is_fire_prone:
        risks.append({"type": "Bushfire", "severity": "Medium", "desc": "BAL-29 Bushfire Attack Level"})
        
    return risks

def calculate_predictive_score(suburb_data, infra_events, env_risks, macro_data):
    """
    Algorithm combining leading indicators for Capital Growth:
    - Falling Days on Market
    - Falling Vacancy Rates
    - Macro-economic REIT health (RSI)
    - Upcoming Infrastructure/Zoning changes
    - PENALTY: Environmental Risks (Flood/Fire)
    """
    base_score = 50.0
    
    # 1. Supply/Demand Dynamics
    dom = suburb_data.house_days_on_market or 45
    vacancy = suburb_data.vacancy_rate or 2.0
    
    if dom < 30: base_score += 10
    elif dom > 60: base_score -= 10
    
    if vacancy < 1.0: base_score += 15
    elif vacancy > 3.0: base_score -= 10
    
    # 2. Demographic Shifts
    oo_rate = suburb_data.owner_occupier_rate or 65.0
    if oo_rate > 70.0: base_score += 5 
    
    # 3. Macro REIT health (Real Estate Investment Trust momentum)
    if macro_data.get("status") == "live":
        rsi = macro_data.get("rsi", 50.0)
        # If REITs are in strong uptrend (RSI 55-70) or oversold rebound (<30)
        if 55 <= rsi <= 70:
            base_score += 5
        elif rsi > 70:
            base_score -= 5 # Overbought, macro headwinds possible
            
        # Add KDE momentum
        kde_peak = macro_data.get("kde_peak_return", 0.0)
        if kde_peak > 0:
            base_score += (kde_peak * 10) # 0.1% daily peak adds 1 pt
    
    # 4. Infrastructure & Zoning
    for event in infra_events:
        if event["type"] == "Infrastructure":
            base_score += 12
        elif event["type"] == "Zoning":
            base_score += 8
            
    # 5. Environmental Risk Penalties
    for risk in env_risks:
        if risk["type"] == "Flood":
            base_score -= 15 
        elif risk["type"] == "Bushfire":
            base_score -= 10 
            
    return min(100.0, max(0.0, base_score))

def run_predictive_engine():
    print(f"[{datetime.now()}] Starting Real Estate Predictive AI Engine (V3)")
    db = SessionLocal()
    
    try:
        macro = ASXPredictor().fetch_macro_data()
        print(f"  Macro-economic REIT status: {macro}")
        
        suburbs = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True).limit(200).all()
        print(f"  Scoring {len(suburbs)} suburbs for future capital growth...")
        
        updates = 0
        for suburb in suburbs:
            infra_events = fetch_infrastructure_zoning_data(suburb.postcode)
            env_risks = fetch_environmental_risks(suburb.postcode)
            
            predicted_score = calculate_predictive_score(suburb, infra_events, env_risks, macro)
            
            dq = suburb.dq_issues or {}
            if isinstance(dq, list):
                 dq = {"issues": dq}
            
            dq["predictive_analysis"] = {
                "score": round(predicted_score, 1),
                "macro_reit_rsi": macro.get("rsi"),
                "infrastructure_events": infra_events,
                "environmental_risks": env_risks,
                "calculated_at": datetime.utcnow().isoformat()
            }
            
            suburb.dq_issues = dq
            updates += 1
            
        db.commit()
        print(f"  ✓ Predictive scoring complete for {updates} suburbs.")
        
    except Exception as e:
        print(f"  ✗ Predictive Engine Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_predictive_engine()
