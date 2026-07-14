"""
buyfinder.py — Versioned backend ranking engine for the POC Buyer Fit Score.

Enforces POC DQ threshold gate, synthetic input exclusion, and minimum yield
hard constraints. Affordability models borrowing capacity, stamp duty, and
purchase costs.

Model: buyer-fit-poc-1.0.0
"""
import os
import math
import uuid
import logging
from typing import Optional
from pydantic import BaseModel

from poc_config import poc_config
from predictive_ai_engine import has_synthetic_recommendation_inputs

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
    annual_income: float = 150000
    existing_monthly_debt: float = 0
    interest_rate: float = 0.062
    serviceability_buffer: float = 0.03
    loan_term_years: int = 30
    purchase_cost_allowance: float = 0.02
    property_type: str = "house"
    maximum_cbd_minutes: int = 60
    minimum_yield: Optional[float] = None
    weights: BuyFinderWeights = BuyFinderWeights()


def calibrate_dq(v3) -> float:
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


def clamp(val, lo, hi):
    return max(lo, min(hi, val))


def calculate_stamp_duty(state: str, price: float) -> float:
    state = state.upper()
    if state == "VIC":
        if price <= 25000: return price * 0.014
        if price <= 130000: return 350 + (price - 25000) * 0.024
        if price <= 960000: return 2870 + (price - 130000) * 0.06
        if price <= 2000000: return price * 0.055
        return price * 0.065
    if state == "NSW":
        if price <= 16000: return price * 0.0125
        if price <= 35000: return 200 + (price - 16000) * 0.015
        if price <= 93000: return 485 + (price - 35000) * 0.0175
        if price <= 351000: return 1500 + (price - 93000) * 0.035
        if price <= 1168000: return 10530 + (price - 351000) * 0.045
        if price <= 3505000: return 47295 + (price - 1168000) * 0.055
        return 175830 + (price - 3505000) * 0.07
    if state == "QLD":
        if price <= 5000: return 0
        if price <= 75000: return (price - 5000) * 0.015
        if price <= 540000: return 1050 + (price - 75000) * 0.035
        if price <= 1000000: return 17325 + (price - 540000) * 0.045
        return 38025 + (price - 1000000) * 0.0575
    return price * 0.05


def compute_borrowing_capacity(annual_income: float, monthly_debt: float,
                                interest_rate: float, serviceability_buffer: float,
                                loan_term_years: int) -> float:
    gross_monthly = annual_income / 12
    net_monthly = gross_monthly * 0.75
    living_expenses = max(2500, net_monthly * 0.3)
    max_repayment = net_monthly - living_expenses - monthly_debt
    
    if max_repayment <= 0:
        return 0.0
    effective_rate = interest_rate + serviceability_buffer
    r = effective_rate / 12
    n = loan_term_years * 12
    if r <= 0:
        return max_repayment * n
    return max_repayment * ((1 - (1 + r) ** -n) / r)


def compute_repayment(loan: float, interest_rate: float, serviceability_buffer: float,
                      loan_term_years: int) -> float:
    effective_rate = interest_rate + serviceability_buffer
    r = effective_rate / 12
    n = loan_term_years * 12
    if r <= 0 or loan <= 0:
        return 0.0
    return loan * r * (1 + r) ** n / ((1 + r) ** n - 1)


def unified_eligibility(v3) -> dict:
    eligibility_dq = calibrate_dq(v3)
    synthetic = has_synthetic_recommendation_inputs(v3)
    reasons = []
    if not v3.is_enriched:
        reasons.append("not_enriched")
    if eligibility_dq < poc_config.public_poc_min_dq_score:
        reasons.append(f"dq_below_threshold ({eligibility_dq:.1f} < {poc_config.public_poc_min_dq_score})")
    if synthetic:
        reasons.append("synthetic_recommendation_inputs")
    eligible = len(reasons) == 0
    return {
        "eligible": eligible,
        "reasons": reasons,
        "raw_dq_score": v3.dq_score,
        "eligibility_dq_score": eligibility_dq,
        "threshold": poc_config.public_poc_min_dq_score,
        "has_synthetic_inputs": synthetic,
    }


def extract_price_and_yield(v3, property_type: str):
    if property_type == "unit":
        return v3.unit_median_price or 0, v3.unit_gross_rental_yield or 0, v3.unit_median_rent or 0
    return v3.house_median_price or 0, v3.house_gross_rental_yield or 0, v3.house_median_rent or 0


def compute_buyer_fit(v3, req: BuyFinderRequest) -> dict:
    price, yld, rent = extract_price_and_yield(v3, req.property_type)
    vacancy = v3.vacancy_rate
    eligibility = unified_eligibility(v3)
    cbd_mins = v3.cbd_distance_mins or 999

    unknowns = []
    if price is None or price <= 0: unknowns.append("median_price")
    if rent is None or rent < 0: unknowns.append("median_rent")

    if eligibility["eligible"]:
        if req.minimum_yield is not None:
            if yld is None or yld <= 0:
                return _excluded_result(v3, "excluded_yield_unknown",
                                        {"actual_value": None, "requested_value": req.minimum_yield})
            if yld < req.minimum_yield:
                return _excluded_result(v3, "below_minimum_yield",
                                        {"actual_value": round(yld, 2), "requested_value": req.minimum_yield})

    if not eligibility["eligible"]:
        reason = eligibility["reasons"][0] if eligibility["reasons"] else "excluded_dq"
        return _excluded_result(v3, reason, eligibility)

    stamp_duty = calculate_stamp_duty(v3.state or req.state, price)
    purchase_costs = price * req.purchase_cost_allowance + stamp_duty
    available_deposit_after_costs = req.deposit - purchase_costs
    if available_deposit_after_costs < 0:
        available_deposit_after_costs = 0
    required_loan = max(0, price - available_deposit_after_costs)
    borrowing_capacity = compute_borrowing_capacity(
        req.annual_income, req.existing_monthly_debt,
        req.interest_rate, req.serviceability_buffer, req.loan_term_years)
    serviceability_passed = required_loan <= borrowing_capacity and borrowing_capacity > 0
    monthly_repayment = compute_repayment(
        required_loan, req.interest_rate, req.serviceability_buffer, req.loan_term_years)

    if borrowing_capacity > 0:
        loan_ratio = required_loan / borrowing_capacity
        affordability_fit = clamp(100 - loan_ratio * 100, 0, 100)
    else:
        affordability_fit = 0

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

    available_metrics = sum(1 for u in ["median_price", "median_rent", "vacancy_rate", "school_quality", "transit_access"]
                            if u not in [x for x in unknowns if "vacancy_rate" in str(x)] + ["vacancy_rate" if vacancy is None else ""])
    evidence_completeness = (max(0, available_metrics) / 5) * 100

    w = req.weights
    total_w = w.affordability + w.income + w.livability + w.access + w.evidence
    if total_w <= 0 or math.isnan(total_w) or math.isinf(total_w):
        buyer_fit_score = 0.0
        total_w_safe = 1
    else:
        total_w_safe = total_w
        buyer_fit_score = (
            (affordability_fit * w.affordability) +
            (income_fit * w.income) +
            (livability_fit * w.livability) +
            (access_fit * w.access) +
            (evidence_completeness * w.evidence)
        ) / total_w_safe

    drivers = []
    if affordability_fit > 70:
        drivers.append("Available deposit supports purchase price")
    if income_fit > 60 and gross_yield is not None:
        drivers.append(f"Rental income matches profile ({gross_yield:.1f}% yield)")
    if livability_fit > 60:
        drivers.append("Good schools, transit and amenity access")
    if evidence_completeness > 80:
        drivers.append("Strong data completeness")
    if serviceability_passed and required_loan > 0:
        drivers.append("Borrowing capacity verified at current rate")

    risks_list = []
    if affordability_fit < 30:
        risks_list.append("Purchase costs or loan exceed capacity")
    if not serviceability_passed and required_loan > 0:
        risks_list.append("Serviceability not met at current rate assumptions")
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
        "eligibility": "eligible",
        "affordability": {
            "score": round(affordability_fit, 1),
            "purchase_price": price,
            "stamp_duty": round(stamp_duty, 2),
            "purchase_costs": round(purchase_costs, 2),
            "available_deposit_after_costs": round(available_deposit_after_costs, 2),
            "required_loan": round(required_loan, 2),
            "estimated_borrowing_capacity": round(borrowing_capacity, 2),
            "monthly_repayment": round(monthly_repayment, 2),
            "serviceability_passed": serviceability_passed,
            "assumptions": {
                "interest_rate": req.interest_rate,
                "serviceability_buffer": req.serviceability_buffer,
                "loan_term_years": req.loan_term_years,
                "annual_income": req.annual_income,
                "monthly_debt": req.existing_monthly_debt,
                "purchase_cost_allowance_pct": req.purchase_cost_allowance,
            },
        },
        "components": {
            "affordability": {"score": round(affordability_fit, 1), "weight": w.affordability,
                              "contribution": round(affordability_fit * w.affordability / total_w_safe, 1) if total_w_safe else 0},
            "income": {"score": round(income_fit, 1), "weight": w.income,
                       "contribution": round(income_fit * w.income / total_w_safe, 1) if total_w_safe else 0},
            "livability": {"score": round(livability_fit, 1), "weight": w.livability,
                           "contribution": round(livability_fit * w.livability / total_w_safe, 1) if total_w_safe else 0},
            "access": {"score": round(access_fit, 1), "weight": w.access,
                       "contribution": round(access_fit * w.access / total_w_safe, 1) if total_w_safe else 0},
            "evidence": {"score": round(evidence_completeness, 1), "weight": w.evidence,
                         "contribution": round(evidence_completeness * w.evidence / total_w_safe, 1) if total_w_safe else 0},
        },
        "drivers": drivers,
        "unknowns": unknowns,
        "risks": risks_list,
        "evidence_ids": _build_evidence_ids(v3, price, yld),
    }


def _excluded_result(v3, reason, detail=None):
    return {
        "rank": -1,
        "suburb_id": v3.id,
        "name": v3.name,
        "state": v3.state,
        "postcode": v3.postcode,
        "buyer_fit_score": 0,
        "confidence_label": "none",
        "eligibility": reason,
        "exclusion_detail": detail,
        "components": {},
        "drivers": [],
        "unknowns": [],
        "risks": [],
        "evidence_ids": [],
    }


def _build_evidence_ids(v3, price, yld):
    ids = []
    ids.append(f"suburb:{v3.id}:dq_score:{v3.dq_score}")
    if price:
        ids.append(f"suburb:{v3.id}:median_price:{price}")
    if yld:
        ids.append(f"suburb:{v3.id}:gross_yield:{yld}")
    sources = v3.abs_sourced_fields or []
    if sources:
        ids.append(f"suburb:{v3.id}:abs_sourced")
    return ids


def rank_suburbs(request: BuyFinderRequest, db_session) -> dict:
    from models_v3 import SuburbUIV3

    query = db_session.query(SuburbUIV3).filter(
        SuburbUIV3.is_enriched == True,
        SuburbUIV3.state == request.state.upper(),
    )
    v3_records = query.all()

    results = []
    excluded_dq = []
    excluded_yield = []
    excluded_synthetic = []

    for v3 in v3_records:
        eligibility = unified_eligibility(v3)
        if not eligibility["eligible"]:
            reason = eligibility["reasons"][0] if eligibility["reasons"] else "excluded_dq"
            if reason == "synthetic_recommendation_inputs":
                excluded_synthetic.append({"suburb_id": v3.id, "name": v3.name, "reason": reason,
                                            "detail": eligibility})
            else:
                excluded_dq.append({"suburb_id": v3.id, "name": v3.name, "reason": reason,
                                    "detail": eligibility})
            continue

        result = compute_buyer_fit(v3, request)
        if result["eligibility"] not in ("eligible",):
            if "yield" in result["eligibility"]:
                excluded_yield.append({"suburb_id": v3.id, "name": v3.name,
                                       "reason": result["eligibility"],
                                       "detail": result.get("exclusion_detail")})
            else:
                excluded_dq.append({"suburb_id": v3.id, "name": v3.name,
                                    "reason": result["eligibility"]})
        else:
            results.append(result)

    results.sort(key=lambda x: x["buyer_fit_score"], reverse=True)
    for i, s in enumerate(results):
        s["rank"] = i + 1

    all_excluded = excluded_dq + excluded_synthetic + excluded_yield
    request_id = str(uuid.uuid4())[:8]

    return {
        "model_version": poc_config.poc_model_version,
        "request_id": request_id,
        "dq_threshold": poc_config.public_poc_min_dq_score,
        "results": results[:poc_config.poc_max_suburbs or 50],
        "excluded_count": len(all_excluded),
        "excluded": all_excluded[:20],
        "total_evaluated": len(v3_records),
        "assumptions": {
            "interest_rate": request.interest_rate,
            "serviceability_buffer": request.serviceability_buffer,
            "loan_term_years": request.loan_term_years,
            "purchase_cost_allowance": request.purchase_cost_allowance,
        },
    }
