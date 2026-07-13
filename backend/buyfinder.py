"""
buyfinder.py — Versioned backend ranking engine for Buy Finder.

Implements the Investment Fit Score as a buyer-weighted composite of
separately computed component scores: Growth, Income, Affordability,
Risk, and Livability.

Model version: buyfit-1.0.0
"""
import os
import logging
import math
from typing import Optional
from pydantic import BaseModel

logger = logging.getLogger("uvicorn")

MODEL_VERSION = "buyfit-1.0.0"


class BuyFinderWeights(BaseModel):
    growth: float = 30
    income: float = 25
    affordability: float = 20
    risk: float = 15
    livability: float = 10


class BuyFinderRequest(BaseModel):
    budget: float = 850000
    deposit: float = 170000
    annual_income: float = 150000
    property_type: str = "house"
    holding_period_years: int = 7
    objective: str = "balanced"
    minimum_yield: float = 3.5
    maximum_vacancy: float = 4.0
    maximum_cbd_minutes: int = 60
    exclude_flood_risk: bool = True
    exclude_bushfire_risk: bool = True
    weights: BuyFinderWeights = BuyFinderWeights()


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
    return price * 0.05


def compute_borrowing_capacity(annual_income: float, interest_rate: float = 6.2) -> float:
    monthly_income = annual_income / 12
    max_monthly_repayment = monthly_income * 0.30
    r = (interest_rate / 100) / 12
    n = 30 * 12
    if r > 0:
        max_loan = max_monthly_repayment * ((1 - (1 + r) ** -n) / r)
    else:
        max_loan = max_monthly_repayment * n
    return max_loan


def normalise_score(raw: float, cohort_values: list[float], cap: float = 100) -> float:
    if len(cohort_values) < 3:
        return max(0, min(cap, raw))
    sorted_vals = sorted(cohort_values)
    p10 = sorted_vals[int(len(sorted_vals) * 0.1)]
    p90 = sorted_vals[int(len(sorted_vals) * 0.9)]
    span = p90 - p10
    if span <= 0:
        return 50.0
    return max(0, min(cap, 50 + ((raw - p10) / span) * 50))


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


def compute_buyfit_score(v3, req: BuyFinderRequest, cohort_prices: list[float],
                         cohort_yields: list[float], cohort_vacancies: list[float]) -> dict:
    price, yld, rent = extract_price_and_yield(v3, req.property_type)
    vacancy = v3.vacancy_rate or 3.0

    # Hard constraint checks
    hard_constraints_passed = True
    hard_failures = []
    if price <= 0 or price > req.budget:
        hard_constraints_passed = False
        hard_failures.append(f"Price ${price:,.0f} exceeds budget ${req.budget:,.0f}")
    if yld < req.minimum_yield:
        hard_constraints_passed = False
        hard_failures.append(f"Yield {yld:.1f}% below minimum {req.minimum_yield}%")
    if vacancy > req.maximum_vacancy:
        hard_constraints_passed = False
        hard_failures.append(f"Vacancy {vacancy:.1f}% exceeds maximum {req.maximum_vacancy}%")
    cbd_mins = v3.cbd_distance_mins or 999
    if req.maximum_cbd_minutes and cbd_mins > req.maximum_cbd_minutes:
        hard_constraints_passed = False
        hard_failures.append(f"CBD distance {cbd_mins}min exceeds max {req.maximum_cbd_minutes}min")

    # Growth score (0-100)
    price_cagr = v3.house_median_price_12m_change_pct or 0
    pop_cagr = v3.population_cagr or 0
    if pop_cagr > 10:
        pop_cagr = pop_cagr / 5
    if v3.population_2016 and v3.population_2021 and v3.population_2016 > 0:
        try:
            pop_cagr = ((v3.population_2021 / v3.population_2016) ** (1/5) - 1) * 100
        except:
            pass
    growth_raw = max(0, min(100, (price_cagr * 3) + (pop_cagr * 10) + 30))
    growth_score = normalise_score(growth_raw, cohort_prices, 100)

    # Income score (0-100)
    income_raw = max(0, min(100, (yld * 10) + (max(0, 5 - vacancy) * 8) + (yld - req.minimum_yield) * 5 + 20))
    income_score = normalise_score(income_raw, cohort_yields, 100)

    # Affordability score (0-100)
    borrowing = compute_borrowing_capacity(req.annual_income)
    stamp = calculate_stamp_duty(v3.state, price)
    total_needed = price + stamp
    actual_deposit = req.deposit - stamp
    if actual_deposit <= 0:
        afford_score = 0.0
    else:
        loan_needed = total_needed - req.deposit
        if loan_needed <= 0:
            afford_score = 100.0
        elif borrowing <= 0:
            afford_score = 0.0
        else:
            lvr = (loan_needed / borrowing) * 100
            afford_score = max(0, 100 - lvr)

    # Risk score (0-100) — lower is better, invert for composite
    dq = v3.dq_score or 70
    supply_ratio = v3.supply_demand_ratio or 0.5
    supply_risk = min(50, max(0, supply_ratio * 50))
    dq_penalty = max(0, (100 - dq) * 0.5)
    risk_score = max(0, 100 - supply_risk - dq_penalty)

    # Livability score (0-100)
    school = v3.school_quality or 5
    transit = v3.transit_accessibility or 5
    safety = v3.safety_score or 60
    parks = v3.parks_count or 0
    oo_rate = v3.owner_occupier_rate or 65
    live_raw = (school * 5) + (transit * 5) + (safety * 0.2) + min(20, parks * 2) + (oo_rate * 0.1)
    livability_score = min(100, max(0, live_raw))

    # Weighted composite
    w = req.weights
    total_w = w.growth + w.income + w.affordability + w.risk + w.livability
    if total_w <= 0:
        fit_score = 0.0
    else:
        fit_score = (
            (growth_score * w.growth) +
            (income_score * w.income) +
            (afford_score * w.affordability) +
            (risk_score * w.risk) +
            (livability_score * w.livability)
        ) / total_w

    components = {
        "growth": {"score": round(growth_score, 1), "weight": w.growth, "contribution": round(growth_score * w.growth / total_w, 1)},
        "income": {"score": round(income_score, 1), "weight": w.income, "contribution": round(income_score * w.income / total_w, 1)},
        "affordability": {"score": round(afford_score, 1), "weight": w.affordability, "contribution": round(afford_score * w.affordability / total_w, 1)},
        "risk": {"score": round(risk_score, 1), "weight": w.risk, "contribution": round(risk_score * w.risk / total_w, 1)},
        "livability": {"score": round(livability_score, 1), "weight": w.livability, "contribution": round(livability_score * w.livability / total_w, 1)},
    }

    confidence = min(0.95, max(0.1, dq / 100))
    confidence_band = [max(0, round(fit_score - confidence * 10)), min(100, round(fit_score + confidence * 10))]

    drivers = []
    if growth_score > 60:
        drivers.append(f"Strong price/population growth signal ({round(growth_score, 0)}/100)")
    if income_score > 60:
        drivers.append(f"Sustainable rental income ({round(income_score, 0)}/100, yield {yld:.1f}%)")
    if afford_score > 60:
        drivers.append(f"Affordable within your budget (score {round(afford_score, 0)}/100)")

    risks = []
    if risk_score < 40:
        risks.append(f"Data quality concerns (DQ {round(dq)}/100)")
    if vacancy > 3.0:
        risks.append(f"Elevated vacancy ({vacancy:.1f}%)")
    if supply_ratio > 0.7:
        risks.append(f"High supply relative to demand (ratio {supply_ratio:.2f})")

    return {
        "suburb_id": v3.id,
        "name": v3.name,
        "state": v3.state,
        "postcode": v3.postcode,
        "median_price": price,
        "rental_yield": round(yld, 2),
        "vacancy_rate": round(vacancy, 2),
        "cbd_mins": cbd_mins,
        "hard_constraints_passed": hard_constraints_passed,
        "hard_failures": hard_failures,
        "fit_score": round(fit_score, 1),
        "components": components,
        "confidence": round(confidence, 2),
        "confidence_band": confidence_band,
        "drivers": drivers,
        "risks": risks,
    }


def rank_suburbs(request: BuyFinderRequest, db_session) -> dict:
    from models_v3 import SuburbUIV3
    from sqlalchemy import func

    v3_records = db_session.query(SuburbUIV3).filter(
        SuburbUIV3.is_enriched == True
    ).all()

    if not v3_records:
        return {"model_version": MODEL_VERSION, "request_id": "", "results": []}

    cohort_prices = []
    cohort_yields = []
    cohort_vacancies = []
    for v3 in v3_records:
        price, yld, _ = extract_price_and_yield(v3, request.property_type)
        if price > 0:
            cohort_prices.append(price)
        if yld > 0:
            cohort_yields.append(yld)
        vac = v3.vacancy_rate or 3.0
        if vac > 0:
            cohort_vacancies.append(vac)

    scored = []
    for v3 in v3_records:
        result = compute_buyfit_score(v3, request, cohort_prices, cohort_yields, cohort_vacancies)
        scored.append(result)

    passed = [s for s in scored if s["hard_constraints_passed"]]
    failed = [s for s in scored if not s["hard_constraints_passed"]]

    passed.sort(key=lambda x: x["fit_score"], reverse=True)

    import uuid
    request_id = str(uuid.uuid4())[:8]

    return {
        "model_version": MODEL_VERSION,
        "request_id": request_id,
        "results": passed[:20],
        "excluded_count": len(failed),
        "total_evaluated": len(scored),
    }
