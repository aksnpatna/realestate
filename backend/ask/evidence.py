from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from models_v3 import SuburbUIV3
from ask.schemas import SuburbReference, EvidenceMetric

def get_suburb_ui(db: Session, ref: SuburbReference) -> Optional[SuburbUIV3]:
    query = db.query(SuburbUIV3).filter(SuburbUIV3.name.ilike(ref.name), SuburbUIV3.state.ilike(ref.state))
    if ref.postcode:
        query = query.filter(SuburbUIV3.postcode == ref.postcode)
    return query.first()

def extract_evidence(v3: SuburbUIV3, property_type: str = "house") -> List[EvidenceMetric]:
    evidence = []
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # helper
    def add(met_id, name, val, unit, src="NPG/CoreLogic", qual="verified"):
        if val is not None:
            if hasattr(val, 'quantize'):  # Duck typing for Decimal
                val = float(val)
            evidence.append(EvidenceMetric(
                id=f"{v3.id}_{met_id}",
                metric=name,
                value=val,
                unit=unit,
                as_of=today,
                source=src,
                quality=qual,
                suburb_id=v3.id
            ))
            
    if property_type == "house":
        add("price", "Median House Price", v3.house_median_price, "$")
        add("rent", "Median House Rent", v3.house_median_rent, "$/week")
        add("yield", "Gross House Yield", v3.house_gross_rental_yield, "%")
    elif property_type == "unit":
        add("price", "Median Unit Price", v3.unit_median_price, "$")
        add("rent", "Median Unit Rent", v3.unit_median_rent, "$/week")
        add("yield", "Gross Unit Yield", v3.unit_gross_rental_yield, "%")
        
    add("vacancy", "Vacancy Rate", v3.vacancy_rate, "%", "SQM")
    add("pop_cagr", "Population 5Yr CAGR", v3.population_cagr, "%", "ABS")
    add("investor_pct", "Investor Rate", v3.investor_rate, "%", "ABS")
    
    if v3.news_sentiment:
        label = v3.news_sentiment.get("label")
        if label:
            add("news", "AI News Sentiment", label, "Sentiment", "YieldSense AI", "verified")
    
    return evidence

def calculate_data_quality(v3: SuburbUIV3) -> dict:
    return {
        "coverage": 1.0 if v3.is_enriched else 0.5,
        "stale_metric_count": 0,
        "dq_score": v3.dq_score
    }
