"""
evidence_packs.py — Goal-driven evidence selection.
Each goal declares which metrics to retrieve and the minimum gate.
"""
from typing import List, Dict, Set
from ask.metric_registry import METRIC_REGISTRY

class EvidencePack:
    __slots__ = ("goal", "metrics", "minimum")
    def __init__(self, goal: str, metrics: List[str], minimum: List[str]):
        self.goal = goal
        self.metrics = metrics
        self.minimum = minimum

def _pack(goal: str, metrics: List[str], minimum: List[str]) -> EvidencePack:
    return EvidencePack(goal, metrics, minimum)

EVIDENCE_PACKS: Dict[str, EvidencePack] = {
    "single_suburb_research": _pack("single_suburb_research", [
        "median_price", "median_rent", "gross_yield",
        "median_price_12m_change_pct", "days_on_market",
        "vacancy_rate", "population_cagr", "investor_rate",
        "owner_occupier_rate", "estimated_mortgage_repayment",
        "price_to_income_ratio", "price_to_rent_ratio",
        "school_quality", "avg_icsea", "top_school_name",
        "transit_accessibility", "safety_score", "parks_count",
        "cbd_distance_mins", "news_sentiment",
        "history_10yr", "history_rent_10yr",
    ], ["median_price"]),

    "suburb_comparison": _pack("suburb_comparison", [
        "median_price", "median_rent", "gross_yield",
        "median_price_12m_change_pct", "days_on_market",
        "vacancy_rate", "population_cagr", "investor_rate",
        "owner_occupier_rate", "estimated_mortgage_repayment",
        "price_to_income_ratio", "price_to_rent_ratio",
        "school_quality", "avg_icsea", "top_school_name",
        "transit_accessibility", "safety_score", "parks_count",
        "cbd_distance_mins", "news_sentiment",
    ], ["median_price"]),

    "investment_search": _pack("investment_search", [
        "median_price", "median_rent", "gross_yield",
        "vacancy_rate", "population_cagr", "investor_rate",
        "estimated_mortgage_repayment", "price_to_rent_ratio",
        "median_price_12m_change_pct", "days_on_market",
        "rental_stock", "news_sentiment",
    ], ["median_price", "median_rent"]),

    "investment_cashflow": _pack("investment_cashflow", [
        "median_price", "median_rent", "gross_yield",
        "vacancy_rate", "estimated_mortgage_repayment",
        "investor_rate", "population_cagr",
        "median_price_12m_change_pct", "yield_trend",
    ], ["median_price", "median_rent"]),

    "cashflow_projection": _pack("cashflow_projection", [
        "median_price", "median_rent", "gross_yield",
        "vacancy_rate", "estimated_mortgage_repayment",
        "investor_rate", "yield_trend",
    ], ["median_price", "median_rent"]),

    "growth_analysis": _pack("growth_analysis", [
        "median_price_12m_change_pct", "population_cagr",
        "history_10yr", "building_approvals_12m",
        "infrastructure_investment", "supply_demand_ratio",
        "news_sentiment", "nearby_suburbs",
        "median_price", "days_on_market",
    ], ["history_10yr", "population_cagr"]),

    "risks_analysis": _pack("risks_analysis", [
        "vacancy_rate", "investor_rate", "days_on_market",
        "supply_demand_ratio", "median_price_12m_change_pct",
        "crime_rate", "safety_score", "unemployment_rate",
        "social_housing_pct", "news_sentiment",
        "building_approvals_12m",
    ], ["vacancy_rate"]),

    "schools_analysis": _pack("schools_analysis", [
        "school_quality", "avg_icsea", "top_school_name",
        "school_count", "owner_occupier_rate",
        "median_age", "average_household_size",
        "median_price", "population_cagr",
    ], ["school_quality"]),

    "affordability": _pack("affordability", [
        "median_price", "estimated_mortgage_repayment",
        "price_to_income_ratio", "price_to_rent_ratio",
        "median_rent", "owner_occupier_rate",
    ], ["median_price"]),

    "interstate_discovery": _pack("interstate_discovery", [
        "median_price", "median_rent", "gross_yield",
        "population_cagr", "vacancy_rate",
    ], ["median_price"]),

    "supply_analysis": _pack("supply_analysis", [
        "building_approvals_12m", "approved_subdivisions_12m",
        "min_approved_subdivision_sqm", "avg_block_sqm",
        "construction_sqkm", "greenfield_sqkm",
        "infrastructure_investment", "population_cagr",
        "median_price", "supply_demand_ratio",
    ], ["building_approvals_12m"]),

    "general_advice": _pack("general_advice", [], []),
    "suburb_discovery": _pack("suburb_discovery", [
        "median_price", "median_rent", "gross_yield",
        "vacancy_rate", "population_cagr",
        "school_quality", "transit_accessibility",
        "safety_score", "parks_count",
        "cbd_distance_mins", "median_price_12m_change_pct",
    ], []),
}

def get_evidence_pack(goal: str) -> EvidencePack:
    return EVIDENCE_PACKS.get(goal, EVIDENCE_PACKS["single_suburb_research"])

def check_minimum_evidence(pack: EvidencePack, available_key_set: Set[str]) -> bool:
    return all(m in available_key_set for m in pack.minimum)
