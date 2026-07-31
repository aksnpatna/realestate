from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, field_validator
from datetime import date

class SuburbReference(BaseModel):
    name: str = Field(..., description="Suburb name")
    state: str = Field(..., description="State code, e.g., QLD, VIC")
    postcode: Optional[str] = None

class AskIntent(BaseModel):
    question: str = Field(min_length=5, max_length=1000)
    goal: Literal["interstate_discovery", "single_suburb_research", "suburb_comparison", "investment_search", "risks_analysis", "cashflow_projection", "schools_analysis", "growth_analysis"]
    suburbs: List[SuburbReference] = Field(default_factory=list, max_length=5)
    states: List[str] = Field(default_factory=list, max_length=5)
    property_type: Literal["house", "unit", "any"] = "any"
    tenure: Literal["owner_occupier", "investor", "undecided"] = "undecided"
    budget: Optional[float] = Field(default=None, ge=100_000, le=20_000_000)
    deposit: Optional[float] = Field(default=None, ge=0, le=20_000_000)
    annual_income: Optional[float] = Field(default=None, ge=0, le=5_000_000)
    monthly_debt: Optional[float] = Field(default=None, ge=0, le=200_000)
    holding_horizon_years: Optional[int] = Field(default=None, ge=1, le=30)
    priorities: List[Literal["affordability", "cashflow", "growth", "schools", "commute", "safety", "amenities", "risk"]] = []

    @field_validator('deposit')
    def validate_deposit(cls, v, info):
        budget = info.data.get('budget')
        if v is not None and budget is not None and v > budget:
            raise ValueError("Deposit cannot be greater than budget")
        return v

class EvidenceMetric(BaseModel):
    id: str
    metric: str
    value: Any
    unit: str
    as_of: str
    source: str
    quality: str
    suburb_id: str
    calculation: Optional[str] = None

class ScenarioAssumptions(BaseModel):
    label: str
    value: str
    source: str

class SuburbComparisonMetric(BaseModel):
    label: str
    value: Any
    unit: str
    is_stale: bool = False

class SuburbComparison(BaseModel):
    suburb_id: str
    name: str
    metrics: List[SuburbComparisonMetric]

class SupportRiskClaim(BaseModel):
    claim: str
    evidence_ids: List[str]

class AskResponse(BaseModel):
    request_id: str
    status: Literal["complete", "needs_clarification", "insufficient_evidence", "degraded"]
    intent: dict
    assumptions: List[ScenarioAssumptions]
    summary: str
    research_priority: Literal["high", "medium", "low", "insufficient_evidence"]
    comparison: List[SuburbComparison]
    supports: List[SupportRiskClaim]
    risks: List[SupportRiskClaim]
    unknowns: List[str]
    next_steps: List[str]
    evidence: List[EvidenceMetric]
    data_quality: dict
    disclaimer: str = "General research only; not financial, legal, tax, lending or valuation advice."
    versions: dict

# ─── Discovery Schemas ──────────────────────────────────────────────────────
class DiscoveryRequest(BaseModel):
    question: str = Field(min_length=5, max_length=1000)
    budget: Optional[float] = Field(default=None, ge=10_000, le=20_000_000)
    deposit: Optional[float] = Field(default=None, ge=0)
    annual_income: Optional[float] = Field(default=None, ge=0)

class DiscoveryMetrics(BaseModel):
    median_price: Optional[float] = None
    yield_pct: Optional[float] = None
    vacancy_rate: Optional[float] = None
    population_cagr: Optional[float] = None
    school_quality: Optional[float] = None
    transit_accessibility: Optional[float] = None
    parks_count: Optional[int] = None
    safety_score: Optional[float] = None
    top_school_name: Optional[str] = None
    price_12m_change_pct: Optional[float] = None

class DiscoveryResult(BaseModel):
    suburb_id: Optional[str] = None
    name: str
    state: str
    postcode: Optional[str] = None
    match_score: float
    dist_km: Optional[float] = None
    why_selected: List[str]
    metrics: DiscoveryMetrics

class DiscoveryResponse(BaseModel):
    guardrail: bool = False
    message: Optional[str] = None
    summary: Optional[str] = None
    query_understood: dict = {}
    results: List[DiscoveryResult] = []
    disclaimer: str = "General research only; not financial, legal, tax, lending or valuation advice."

class SupportRiskClaim(BaseModel):
    claim: str
    evidence_ids: List[str]

class SynthesisResponse(BaseModel):
    summary: str
    research_priority: Literal["high", "medium", "low", "insufficient_evidence"]
    supports: List[SupportRiskClaim]
    risks: List[SupportRiskClaim]
    unknowns: List[str]
    next_steps: List[str]
