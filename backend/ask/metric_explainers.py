"""
metric_explainers.py — Single source of truth for natural-language metric interpretations.
Replaces both the frontend METRIC_EXPLAINERS (AskYieldSense.tsx) and the duplicated
string-matching thresholds in synthesis.py's fallback path.

Every metric in the registry gets one explainer fn: (value, unit) → {good, text}.
"""
from typing import Union, Optional

MetricValue = Union[float, int, str, None]

def _f(value: MetricValue, unit: str = "") -> str:
    """Format a metric value for display in explanation text."""
    if value is None:
        return "unavailable"
    if isinstance(value, str):
        return value
    if isinstance(value, float):
        return f"{value:,.2f}" if abs(value) < 50 else f"{value:,.0f}"
    return str(value)

# ─── Explainer functions ──────────────────────────────────────────────────────

def explain_median_price(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Price data is not available for this suburb."}
    v = float(value)
    k = v / 1000
    if v > 1_500_000:
        return {"good": None, "text": f"At ${k:.0f}k, this is a premium suburb — high entry cost but typically strong liquidity and price resilience."}
    if v > 900_000:
        return {"good": None, "text": f"At ${k:.0f}k, this is a mid-to-upper tier suburb with a broad but selective buyer pool."}
    return {"good": None, "text": f"At ${k:.0f}k, this is relatively accessible — strong owner-occupier and first-home-buyer interest."}

def explain_median_rent(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Rent data is not available."}
    v = float(value)
    if v > 900:
        return {"good": True, "text": f"${v:.0f}/week — very strong rental demand with high landlord pricing power."}
    if v > 600:
        return {"good": True, "text": f"${v:.0f}/week — solid rent achievable; healthy tenant pool keeps vacancies low."}
    return {"good": False, "text": f"${v:.0f}/week — below-average rent may compress yields and cashflow."}

def explain_gross_yield(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Yield data is not available."}
    v = float(value)
    if v >= 5:
        return {"good": True, "text": f"{v:.2f}% gross yield — excellent; likely close to cash-flow neutral or positive after expenses."}
    if v >= 4:
        return {"good": True, "text": f"{v:.2f}% gross yield — acceptable; will need some top-up from salary but manageable for most investors."}
    if v >= 3:
        return {"good": False, "text": f"{v:.2f}% gross yield — low; common in high-growth suburbs. Plan for ongoing out-of-pocket costs."}
    return {"good": False, "text": f"{v:.2f}% gross yield — very low; almost purely a capital growth play; cashflow will be negative."}

def explain_vacancy_rate(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Vacancy data is not available."}
    v = float(value)
    if v < 1:
        return {"good": True, "text": f"{v:.2f}% vacancy — critically tight; strong upward rent pressure, very low risk of extended vacancy."}
    if v < 2:
        return {"good": True, "text": f"{v:.2f}% vacancy — tight rental market; landlords have meaningful pricing power."}
    if v < 3:
        return {"good": None, "text": f"{v:.2f}% vacancy — healthy balance; competitive but not oversupplied."}
    if v < 5:
        return {"good": False, "text": f"{v:.2f}% vacancy — elevated; negotiating power shifts to tenants. Factor in potential rent discounts."}
    return {"good": False, "text": f"{v:.2f}% vacancy — significant oversupply risk. Avoid for pure investment."}

def explain_population_cagr(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Population growth data is not available."}
    v = float(value)
    if v > 8:
        return {"good": True, "text": f"{v:.1f}%/year population growth — exceptional; infrastructure demand and price support are very strong."}
    if v > 5:
        return {"good": True, "text": f"{v:.1f}%/year — above-average; good long-term demand fundamentals."}
    if v > 2:
        return {"good": True, "text": f"{v:.1f}%/year — solid steady growth supporting price stability and tenant demand."}
    if v > 0:
        return {"good": False, "text": f"{v:.1f}%/year — modest growth; stable but limited demand uplift."}
    return {"good": False, "text": f"{v:.1f}%/year — population stagnant or declining; a meaningful demand risk."}

def explain_investor_rate(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Investor concentration data is not available."}
    v = float(value)
    if v > 60:
        return {"good": False, "text": f"{v:.0f}% investor-owned — very high; vulnerable to mass sell-off if sentiment or interest rates shift."}
    if v > 40:
        return {"good": False, "text": f"{v:.0f}% investor-owned — moderate-high investor presence; monitor supply pipeline closely."}
    if v < 20:
        return {"good": True, "text": f"{v:.0f}% investor-owned — owner-occupier dominated; typically price-stable with lower volatility."}
    return {"good": True, "text": f"{v:.0f}% investor-owned — healthy mix of investors and owner-occupiers."}

def explain_news_sentiment(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "AI news sentiment is not available."}
    s = str(value)
    if s == "Bullish":
        return {"good": True, "text": "AI sentiment analysis of recent market news detected positive momentum or infrastructure announcements."}
    if s == "Bearish":
        return {"good": False, "text": "Negative catalysts or oversupply risks mentioned in recent media coverage."}
    return {"good": None, "text": "Neutral or mixed sentiment in recent news. No strong directional signal."}

def explain_price_12m_change_pct(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Price change data is not available."}
    v = float(value)
    if v > 10:
        return {"good": True, "text": f"{v:+.1f}% in 12 months — strong growth trajectory; may indicate buyer competition or infrastructure uplift."}
    if v > 5:
        return {"good": True, "text": f"{v:+.1f}% — above-trend growth; solid performance but monitor for overvaluation."}
    if v > 0:
        return {"good": None, "text": f"{v:+.1f}% — modest growth in line with broader market trends."}
    if v >= -5:
        return {"good": False, "text": f"{v:+.1f}% — prices have softened; opportunities but demand-side monitoring needed."}
    return {"good": False, "text": f"{v:+.1f}% — significant decline; potential structural weakness or temporary correction."}

def explain_days_on_market(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Days-on-market data is not available."}
    v = float(value)
    if v < 21:
        return {"good": True, "text": f"{v:.0f} days on market — selling fast; strong current demand."}
    if v < 40:
        return {"good": True, "text": f"{v:.0f} days — healthy pace; no supply-demand imbalance."}
    if v < 70:
        return {"good": None, "text": f"{v:.0f} days — average; no urgency signal either way."}
    return {"good": False, "text": f"{v:.0f} days — selling slowly; potential oversupply or weak demand."}

def explain_school_quality(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "School quality data is not available."}
    v = float(value)
    if v >= 8:
        return {"good": True, "text": f"{v:.1f}/10 — excellent school quality; ICSEA scores in the top national percentiles."}
    if v >= 6:
        return {"good": True, "text": f"{v:.1f}/10 — good schools; above-average ICSEA with solid outcomes."}
    if v >= 4:
        return {"good": None, "text": f"{v:.1f}/10 — average; meets basic expectations."}
    return {"good": False, "text": f"{v:.1f}/10 — below average school zone; families should check specific schools."}

def explain_transit_accessibility(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Transit data is not available."}
    v = float(value)
    if v >= 8:
        return {"good": True, "text": f"{v:.1f}/10 — excellent multi-modal coverage; train, bus and tram options."}
    if v >= 5:
        return {"good": True, "text": f"{v:.1f}/10 — reasonable transit; likely a car-free commute is possible for most destinations."}
    if v >= 3:
        return {"good": None, "text": f"{v:.1f}/10 — basic transit; a car is highly recommended for daily life."}
    return {"good": False, "text": f"{v:.1f}/10 — very limited transit; a car is essential."}

def explain_safety_score(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Safety data is not available."}
    v = float(value)
    if v >= 8:
        return {"good": True, "text": f"{v:.1f}/10 — very low crime; among the safest suburbs in its region."}
    if v >= 6:
        return {"good": True, "text": f"{v:.1f}/10 — above-average safety; standard family neighbourhood profile."}
    if v >= 4:
        return {"good": None, "text": f"{v:.1f}/10 — average; check specific pockets and street-level safety."}
    return {"good": False, "text": f"{v:.1f}/10 — elevated crime rates; inspect the specific location's recent data."}

def explain_estimated_mortgage_repayment(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Mortgage repayment estimate is not available."}
    v = float(value)
    return {"good": None, "text": f"Estimated ${v:,.0f}/mo P&I repayment (80% LVR, 6.20%, 30yr). This is indicative — see a lender for real serviceability."}

def explain_owner_occupier_rate(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Owner-occupier data is not available."}
    v = float(value)
    if v >= 70:
        return {"good": True, "text": f"{v:.0f}% owner-occupier — strong community stability and lower price volatility."}
    if v >= 50:
        return {"good": True, "text": f"{v:.0f}% — a balanced tenure mix."}
    return {"good": False, "text": f"{v:.0f}% — rental-heavy; may experience higher turnover and price sensitivity."}

def explain_cbd_distance_mins(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "CBD distance data is not available."}
    v = float(value)
    if v <= 20:
        return {"good": True, "text": f"~{v:.0f} mins to CBD — inner-ring convenience; expect premium pricing and lifestyle benefits."}
    if v <= 40:
        return {"good": True, "text": f"~{v:.0f} mins — middle-ring commute; balances affordability with city access."}
    if v <= 60:
        return {"good": None, "text": f"~{v:.0f} mins — outer-ring; may suit remote/hybrid workers but budget extra commute time."}
    return {"good": None, "text": f"~{v:.0f} mins — fringe/regional; plan for a car-based lifestyle or deliberate commute."}

def explain_price_to_income_ratio(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    if value is None:
        return {"good": None, "text": "Price-to-income ratio is not available."}
    v = float(value)
    if v <= 5:
        return {"good": True, "text": f"{v:.1f}× — very affordable relative to local incomes."}
    if v <= 8:
        return {"good": True, "text": f"{v:.1f}× — moderate affordability; within typical range for Australian suburbs."}
    if v <= 12:
        return {"good": False, "text": f"{v:.1f}× — stretched affordability; entry may be challenging for local-income households."}
    return {"good": False, "text": f"{v:.1f}× — severely unaffordable; likely investor-dominated or prestige."}

def explain_generic(value: MetricValue, unit: str, _property_type: str = "house") -> dict:
    """Fallback for metrics without a specific explainer."""
    if value is None:
        return {"good": None, "text": "This metric is not available for the selected suburb."}
    if isinstance(value, str):
        return {"good": None, "text": str(value)}
    if unit == "$":
        return {"good": None, "text": f"${float(value):,.0f}{' — higher indicates stronger market demand' if float(value) > 0 else ''}."}
    if unit == "%":
        v = float(value)
        dir_word = "higher" if v > 0 else "lower"
        return {"good": None, "text": f"{v:+.2f}% — {dir_word} values generally indicate{' stronger' if v > 0 else ' weaker'} metrics."}
    return {"good": None, "text": f"{_f(value)} {unit}".strip()}


EXPLAINER_MAP = {
    "median_price": explain_median_price,
    "median_rent": explain_median_rent,
    "gross_yield": explain_gross_yield,
    "vacancy_rate": explain_vacancy_rate,
    "population_cagr": explain_population_cagr,
    "investor_rate": explain_investor_rate,
    "news_sentiment": explain_news_sentiment,
    "median_price_12m_change_pct": explain_price_12m_change_pct,
    "days_on_market": explain_days_on_market,
    "school_quality": explain_school_quality,
    "avg_icsea": explain_school_quality,
    "transit_accessibility": explain_transit_accessibility,
    "safety_score": explain_safety_score,
    "estimated_mortgage_repayment": explain_estimated_mortgage_repayment,
    "owner_occupier_rate": explain_owner_occupier_rate,
    "cbd_distance_mins": explain_cbd_distance_mins,
    "price_to_income_ratio": explain_price_to_income_ratio,
}


def get_explanation(metric_key: str, value: MetricValue, property_type: str = "house") -> dict:
    """Return {good: bool|None, label: str, text: str} for a metric.
    
    good=True  → indicator is positive
    good=False → indicator is negative  
    good=None  → neutral / contextual / informational
    """
    registry = None
    try:
        from ask.metric_registry import METRIC_REGISTRY
        registry = METRIC_REGISTRY
    except ImportError:
        pass

    label = metric_key
    if registry and metric_key in registry:
        label = registry[metric_key].label

    fn = EXPLAINER_MAP.get(metric_key, explain_generic)
    result = fn(value, "", property_type)
    result["label"] = label
    return result
