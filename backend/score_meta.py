"""
score_meta.py — Plain-English metadata for the scores surfaced to users.

Centralises the "what does this number mean" strings so the frontend Score
Legend and inline tooltips stay consistent with the backend's intent. Scores
themselves are NOT changed here — only their presentation metadata.
"""

from typing import Any, Dict


GROWTH_FACTOR_LABELS: Dict[str, Dict[str, Any]] = {
    "price_cagr": {
        "label": "Price growth (10yr CAGR)",
        "impact": "Sustained median-price growth signals realised demand for the suburb.",
        "max": 25,
    },
    "pop_cagr": {
        "label": "Population growth",
        "impact": "Population inflow supports both rental demand and longer-term price support.",
        "max": 15,
    },
    "yield": {
        "label": "Gross rental yield",
        "impact": "Higher current yield supports cashflow and reduces holding-cost risk.",
        "max": 10,
    },
    "supply_demand": {
        "label": "Demand vs supply",
        "impact": "A tight demand-to-supply ratio (low listings vs sales) often precedes price pressure.",
        "max": 8,
    },
    "vacancy": {
        "label": "Vacancy rate",
        "impact": "Low vacancy indicates rental scarcity and stronger negotiating power for landlords.",
        "max": 5,
    },
    "news_sentiment": {
        "label": "News market sentiment",
        "impact": "Bullish media sentiment is a market-temperature signal, not a price guarantee.",
        "max": 5,
    },
    "confidence_penalty": {
        "label": "Data confidence penalty",
        "impact": "Deducted where underlying growth inputs were assumed rather than observed.",
        "max": 0,
    },
}


def enrich_growth_factors(factors: Dict[str, Any]) -> Dict[str, Any]:
    """Attach label/impact/max to raw growth-score factors."""
    enriched: Dict[str, Any] = {}
    for key, val in (factors or {}).items():
        meta = GROWTH_FACTOR_LABELS.get(key, {})
        enriched[key] = {
            "key": key,
            "label": meta.get("label", key.replace("_", " ").title()),
            "impact": meta.get("impact", ""),
            "value": val,
            "max": meta.get("max"),
        }
    return enriched


SCORE_METADATA: Dict[str, Dict[str, Any]] = {
    "growth": {
        "name": "Market Momentum",
        "range": "0-92",
        "meaning": "A deterministic composite of realised price growth, population, yield, demand/supply, vacancy and sentiment.",
        "caveat": "Not a price forecast. Not a calibrated probability. Past growth does not guarantee future returns.",
        "disclaimer_key": "growth_score",
    },
    "buyer_fit": {
        "name": "Fit For Your Inputs",
        "range": "0-100",
        "meaning": "How well this suburb fits YOUR budget, serviceability and stated preferences. Personalised, not market-wide.",
        "caveat": "Only meaningful for the inputs you entered. Not a recommendation to buy.",
        "disclaimer_key": "buyer_fit",
    },
    "dq": {
        "name": "Data Confidence",
        "range": "0-100",
        "meaning": "How complete and reliable the underlying data is for THIS suburb, not the suburb's quality.",
        "caveat": "A low score means verify with other sources before acting, not that the suburb is bad.",
        "disclaimer_key": "dq_score",
    },
}


def get_score_meta(score_key: str) -> Dict[str, Any]:
    return SCORE_METADATA.get(score_key, {})


def all_score_meta() -> Dict[str, Dict[str, Any]]:
    return {k: dict(v) for k, v in SCORE_METADATA.items()}
