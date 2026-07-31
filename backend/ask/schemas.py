from typing import List, Optional, Literal, Any, Dict
from pydantic import BaseModel, Field, field_validator

# ══════════════════════════════════════════════════════════════════════════════
# V1 TYPE ALIASES — preserved for backward compat
# ══════════════════════════════════════════════════════════════════════════════

class SuburbReference(BaseModel):
    name: str = Field(..., description="Suburb name")
    state: str = Field(..., description="State code, e.g., QLD, VIC")
    postcode: Optional[str] = None

class AskIntent(BaseModel):
    question: str = Field(min_length=5, max_length=1000)
    goal: Literal["interstate_discovery", "single_suburb_research", "suburb_comparison", "investment_search", "risks_analysis", "cashflow_projection", "schools_analysis", "growth_analysis", "general_advice"]
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
    is_stale: bool = False
    dq_score: float = 100.0

class ScenarioAssumptions(BaseModel):
    label: str
    value: str
    source: str

class SuburbComparisonMetric(BaseModel):
    label: str
    value: Any
    unit: str
    is_stale: bool = False
    as_of: Optional[str] = None
    source: Optional[str] = None
    quality: Optional[str] = None
    explanation: Optional[str] = None
    winner: bool = False
    edge_note: Optional[str] = None

class SuburbComparison(BaseModel):
    suburb_id: str
    name: str
    metrics: List[SuburbComparisonMetric]

class SupportRiskClaim(BaseModel):
    claim: str
    evidence_ids: List[str]

# ══════════════════════════════════════════════════════════════════════════════
# V2 — WORLD-CLASS NL SEARCH CONTRACTS
# ══════════════════════════════════════════════════════════════════════════════

class GeoVector(BaseModel):
    anchor_type: Literal["city", "suburb", "postcode", "state", "region"] = "city"
    anchor_value: str = ""
    direction: Optional[Literal["north","north-east","east","south-east","south","south-west","west","north-west"]] = None
    radius_km: Optional[float] = Field(default=None, gt=0, le=500)
    regional_only: bool = False

class ThresholdFilter(BaseModel):
    metric: str
    op: Literal[">=", "<=", ">", "<", "between", "approx"]
    value: float
    value_max: Optional[float] = None

class Clarification(BaseModel):
    needed: bool = False
    questions: List[str] = []
    options: List[Dict[str, str]] = []

class AskIntentV2(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    goal: Literal["single_suburb_research", "suburb_comparison", "suburb_discovery",
                  "investment_search", "investment_cashflow", "cashflow_projection",
                  "risks_analysis", "schools_analysis", "growth_analysis",
                  "supply_analysis", "affordability", "interstate_discovery",
                  "general_advice", "out_of_scope"]
    suburbs: List[SuburbReference] = Field(default_factory=list, max_length=5)
    geo: Optional[GeoVector] = None
    thresholds: List[ThresholdFilter] = Field(default_factory=list, max_length=8)
    property_type: Literal["house", "unit", "any"] = "any"
    tenure: Literal["owner_occupier", "investor", "developer", "undecided"] = "undecided"
    budget: Optional[float] = Field(default=None, ge=50_000, le=30_000_000)
    deposit: Optional[float] = Field(default=None, ge=0, le=30_000_000)
    annual_income: Optional[float] = Field(default=None, ge=0, le=5_000_000)
    monthly_debt: Optional[float] = Field(default=None, ge=0, le=200_000)
    holding_horizon_years: Optional[int] = Field(default=None, ge=1, le=30)
    priorities: List[str] = []
    confidence: float = Field(ge=0, le=1, default=0.8)
    clarification: Clarification = Clarification()
    conversation_id: Optional[str] = None

# ─── Query / Intent endpoints ─────────────────────────────────────────────────

class AskQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    conversation_id: Optional[str] = None
    scenario_overrides: Optional[Dict[str, Any]] = None
    idempotency_key: Optional[str] = None

class IntentRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)

class IntentResponse(BaseModel):
    goal: str
    suburbs: List[Dict[str, str]]
    property_type: str
    tenure: str
    budget: Optional[float] = None
    deposit: Optional[float] = None
    annual_income: Optional[float] = None
    priorities: List[str] = []
    confidence: float
    needs_clarification: bool = False
    clarification: Clarification = Clarification()
    geo: Optional[Dict[str, Any]] = None

# ─── Verdict / Response v2 ───────────────────────────────────────────────────

class VerdictEntry(BaseModel):
    metric: str
    leader: Optional[str] = None
    edge_pct: float = 0.0
    direction: str = "higher_better"
    framing: str = "clear_leader"
    values: Dict[str, Any] = {}
    context_note: Optional[str] = None

class PersonaVerdict(BaseModel):
    persona: str
    leader: Optional[str] = None
    scores: Dict[str, float] = {}
    weights_used: Dict[str, float] = {}

class VerdictBlock(BaseModel):
    framing: str = "balanced"
    per_metric: List[VerdictEntry] = []
    by_persona: List[PersonaVerdict] = []
    tradeoffs: List[str] = []
    non_comparable_metrics: List[str] = []

class AffordabilityBlock(BaseModel):
    serviceability_passed: Optional[bool] = None
    borrowing_capacity: Optional[float] = None
    monthly_repayment: Optional[float] = None
    stamp_duty: Optional[float] = None
    rate_used: str = "6.20% + 3% buffer"
    term: str = "30yr P&I"
    disclaimer: str = "Not lender approval."

class AskResponseV2(BaseModel):
    request_id: str
    status: Literal["complete", "needs_clarification", "insufficient_evidence", "degraded", "degraded_intent"]
    intent: dict
    query_understood: dict
    assumptions: List[ScenarioAssumptions] = []
    headline: str = ""
    summary: str
    research_priority: Literal["high", "medium", "low", "insufficient_evidence"]
    comparison: List[SuburbComparison] = []
    verdict: Optional[VerdictBlock] = None
    affordability: Optional[AffordabilityBlock] = None
    supports: List[SupportRiskClaim] = []
    risks: List[SupportRiskClaim] = []
    unknowns: List[str] = []
    next_steps: List[str] = []
    evidence: List[EvidenceMetric] = []
    data_quality: dict = {}
    follow_ups: List[Dict[str, str]] = []
    disclaimer: str = "General research only; not financial, legal, tax, lending or valuation advice."
    versions: dict = {}

# ══════════════════════════════════════════════════════════════════════════════
# DISCOVERY SCHEMAS (backward compatible, enhanced)
# ══════════════════════════════════════════════════════════════════════════════

class DiscoveryRequest(BaseModel):
    question: str = Field(min_length=5, max_length=1000)
    budget: Optional[float] = Field(default=None, ge=10_000, le=20_000_000)
    deposit: Optional[float] = Field(default=None, ge=0)
    annual_income: Optional[float] = Field(default=None, ge=0)
    thresholds: List[ThresholdFilter] = Field(default_factory=list, max_length=8)

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

# ─── Re-export V1 ask response for backward compat ─────────────────────────────

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
