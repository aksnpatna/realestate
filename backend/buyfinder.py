"""
buyfinder.py — Versioned backend ranking engine for the POC Buyer Fit Score.

Enforces POC DQ threshold gate (PUBLIC_POC_MIN_DQ_SCORE, default 80).
Suburbs below the gate are excluded from ranking. Suburbs with synthetic
recommendation inputs are also excluded.

Model: buyer-fit-poc-1.0.0
"""
import os
import logging
import math
import uuid
from typing import Optional
from pydantic import BaseModel

from poc_config import poc_config

logger = logging.getLogger("uvicorn")


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
    property_type: str = "house"
    maximum_cbd_minutes: int = 60
    minimum_yield: Optional[float] = None
    weights: BuyFinderWeights = BuyFinderWeights()


def _calibrate_dq(v3) -> float:
    raw = float(v3.dq_score or 100)
    penalties = 0
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


def extract_price_and_yield(v3, property_type: str):
    if property_type == "unit":
        price = v3.unit_median_price or 0
        yld = v3.unit_gross_rental_yield or 0
        rent = v3.unit_median_rent or 0
    else:
        price = v3.house_median_price or 0
        yld = v3.house_gross_rental_yield or 0
        rent = v3.house_median_rent or 0
    return price, yld, rent


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def compute_buyer_fit(v3, req: BuyFinderRequest) -> dict:
    price, yld, rent = extract_price_and_yield(v3, req.property_type)
    vacancy = v3.vacancy_rate
    dq = _calibrate_dq(v3)
    cbd_mins = v3.cbd_distance_mins or 999

    has_synthetic = False
    dq_issues = v3.dq_issues or {}
    if isinstance(dq_issues, dict):
        pa = dq_issues.get("predictive_analysis", {})
        if isinstance(pa, dict) and pa.get("quality_status") == "synthetic_demo":
            has_synthetic = True

    eligibility = "eligible"
    if dq < poc_config.public_poc_min_dq_score:
        eligibility = "excluded_dq"
    elif has_synthetic:
        eligibility = "excluded_synthetic"
    elif not v3.is_enriched:
        eligibility = "excluded_unenriched"

    unknowns = []
    if price is None or price <= 0:
        unknowns.append("median_price")
    if rent is None or rent < 0:
        unknowns.append("median_rent")
    if vacancy is None:
        unknowns.append("vacancy_rate")
    if v3.school_quality is None:
        unknowns.append("school_quality")
    if v3.transit_accessibility is None:
        unknowns.append("transit_access")

    if eligibility != "eligible":
        return {
            "rank": 0,
            "suburb_id": v3.id,
            "name": v3.name,
            "state": v3.state,
            "postcode": v3.postcode,
            "buyer_fit_score": 0,
            "confidence_label": "none",
            "eligibility": eligibility,
            "components": {},
            "drivers": [],
            "unknowns": unknowns,
            "risks": [],
            "evidence_ids": [],
        }

    available_budget = req.deposit + (req.budget - req.deposit)
    if available_budget <= 0:
        affordability_fit = 0
    else:
        affordability_fit = clamp(100 - ((price - available_budget) / available_budget) * 100, 0, 100)

    if price > 0 and rent > 0:
        gross_yield = rent * 52 / price * 100
        income_fit = clamp(gross_yield * 10, 0, 100)
    else:
        gross_yield = None
        income_fit = 0

    school_score = (v3.school_quality or 5) * 5
    transit_score = (v3.transit_accessibility or 5) * 5
    safety_score = (v3.safety_score or 60) * 0.2
    park_score = min(20, (v3.parks_count or 0) * 2)
    oo_score = (v3.owner_occupier_rate or 65) * 0.1
    livability_fit = clamp(school_score + transit_score + safety_score + park_score + oo_score, 0, 100)

    cbd_score = 100 if cbd_mins <= req.maximum_cbd_minutes else max(0, 100 - (cbd_mins - req.maximum_cbd_minutes))
    access_fit = clamp((cbd_score + transit_score) / 2, 0, 100)

    available_metrics = sum(1 for u in ["median_price", "median_rent", "vacancy_rate", "school_quality", "transit_access"] if u not in unknowns)
    evidence_completeness = (available_metrics / 5) * 100

    w = req.weights
    total_w = w.affordability + w.income + w.livability + w.access + w.evidence
    if total_w <= 0:
        buyer_fit_score = 0
    else:
        buyer_fit_score = (
            (affordability_fit * w.affordability) +
            (income_fit * w.income) +
            (livability_fit * w.livability) +
            (access_fit * w.access) +
            (evidence_completeness * w.evidence)
        ) / total_w

    drivers = []
    if affordability_fit > 70:
        drivers.append("Affordable within budget")
    if income_fit > 60 and gross_yield is not None:
        drivers.append(f"Rental yield matches profile ({gross_yield:.1f}%)")
    if livability_fit > 60:
        drivers.append("Good schools, transit and amenity access")
    if evidence_completeness > 80:
        drivers.append("Strong data completeness")

    risks_list = []
    if affordability_fit < 30:
        risks_list.append("High entry price relative to budget")
    if evidence_completeness < 40:
        risks_list.append(f"Low data completeness ({evidence_completeness:.0f}/100)")
    if vacancy is not None and vacancy > 4:
        risks_list.append(f"Elevated vacancy ({vacancy:.1f}%)")

    confidence_label = "high" if evidence_completeness >= 80 else "medium" if evidence_completeness >= 50 else "low"

    return {
        "rank": 0,
        "suburb_id": v3.id,
        "name": v3.name,
        "state": v3.state,
        "postcode": v3.postcode,
        "buyer_fit_score": round(buyer_fit_score, 1),
        "confidence_label": confidence_label,
        "eligibility": eligibility,
        "components": {
            "affordability": {"score": round(affordability_fit, 1), "weight": w.affordability, "contribution": round(affordability_fit * w.affordability / total_w, 1) if total_w else 0},
            "income": {"score": round(income_fit, 1), "weight": w.income, "contribution": round(income_fit * w.income / total_w, 1) if total_w else 0},
            "livability": {"score": round(livability_fit, 1), "weight": w.livability, "contribution": round(livability_fit * w.livability / total_w, 1) if total_w else 0},
            "access": {"score": round(access_fit, 1), "weight": w.access, "contribution": round(access_fit * w.access / total_w, 1) if total_w else 0},
            "evidence": {"score": round(evidence_completeness, 1), "weight": w.evidence, "contribution": round(evidence_completeness * w.evidence / total_w, 1) if total_w else 0},
        },
        "drivers": drivers,
        "unknowns": unknowns,
        "risks": risks_list,
        "evidence_ids": [f"{'price' if price else ''}_{'yield' if gross_yield else ''}_{'vacancy' if vacancy else ''}".strip("_")],
    }


def rank_suburbs(request: BuyFinderRequest, db_session) -> dict:
    from models_v3 import SuburbUIV3
    from predictive_ai_engine import has_synthetic_recommendation_inputs

    query = db_session.query(SuburbUIV3).filter(
        SuburbUIV3.is_enriched == True,
        SuburbUIV3.dq_score >= poc_config.public_poc_min_dq_score,
        SuburbUIV3.state == request.state.upper(),
    )
    v3_records = query.all()

    scored = []
    excluded = []
    for v3 in v3_records:
        if has_synthetic_recommendation_inputs(v3):
            excluded.append({"suburb_id": v3.id, "name": v3.name, "reason": "synthetic_recommendation_inputs"})
            continue
        result = compute_buyer_fit(v3, request)
        if result["eligibility"] != "eligible":
            excluded.append({"suburb_id": v3.id, "name": v3.name, "reason": result["eligibility"]})
        else:
            scored.append(result)

    scored.sort(key=lambda x: x["buyer_fit_score"], reverse=True)

    for i, s in enumerate(scored):
        s["rank"] = i + 1

    request_id = str(uuid.uuid4())[:8]

    return {
        "model_version": poc_config.poc_model_version,
        "request_id": request_id,
        "dq_threshold": poc_config.public_poc_min_dq_score,
        "results": scored[:poc_config.poc_max_suburbs or 50],
        "excluded_count": len(excluded),
        "excluded": excluded[:10],
        "total_evaluated": len(v3_records),
    }
