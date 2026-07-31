import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from models_v3 import SessionLocal
from routers.decision_brief import get_current_user
from ask.schemas import (
    AskIntent, AskResponse, ScenarioAssumptions, SuburbComparison, SuburbComparisonMetric,
    DiscoveryRequest, DiscoveryResponse, DiscoveryResult, DiscoveryMetrics,
    AskQueryRequest, IntentRequest, IntentResponse, AskResponseV2, VerdictBlock,
    AffordabilityBlock, SuburbReference,
)
from ask.evidence import get_suburb_ui, extract_evidence, calculate_data_quality, check_pack_minimum
from ask.scenarios import compute_affordability, compute_yield
from ask.synthesis import synthesize_research
from ask.policy import validate_policy
from ask.repository import create_conversation, save_ask_brief, _sanitize
from ask.geo_discovery import discover_suburbs
from ask.metric_explainers import get_explanation

router = APIRouter(prefix="/api/v3/ask", tags=["ask"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════════
# V2 — Unified NL query endpoint
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/query", response_model=AskResponseV2)
async def ask_query(
    req: AskQueryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """
    Unified natural-language entry point. Accepts raw text, parses intent
    server-side via the intent pipeline, resolves entities against the DB
    gazetteer, selects evidence packs, computes verdicts, and synthesises.
    """
    import time
    import hashlib
    import os
    from ask.observability import incr_ask_request, incr_ask_cache, record_intent_confidence, record_latency, record_evidence_coverage

    # Feature flag gate
    enable_ask_v2 = os.getenv("ENABLE_ASK_V2", "true").lower() in ("true", "1", "yes")
    if not enable_ask_v2:
        raise HTTPException(status_code=503, detail="Ask YieldSense v2 is temporarily disabled (ENABLE_ASK_V2=false). Use /api/v3/ask instead.")

    t0 = time.time()
    incr_ask_request()
    request_id = f"ask_{uuid.uuid4()}"

    # Rate limit: simple per-user daily counter via Redis
    try:
        from main import redis_client
        if redis_client:
            daily_key = f"ask2_rate:{current_user}:{datetime.now().strftime('%Y%m%d')}"
            daily_count = redis_client.incr(daily_key)
            if daily_count == 1:
                redis_client.expire(daily_key, 86400)
            if daily_count > 200:
                return AskResponseV2(
                    request_id=request_id, status="degraded",
                    intent={"goal": "general_advice"}, query_understood={},
                    summary="Daily research limit reached. Please try again tomorrow.",
                    research_priority="insufficient_evidence",
                    evidence=[], data_quality={}, follow_ups=[],
                    disclaimer="Rate limited — free tier allows 200 briefs/day.",
                    versions={"pipeline": "ask-v2"},
                )
    except Exception:
        pass

    # Cache: normalize question hash for idempotency
    cache_key = None
    try:
        from main import redis_client
        if redis_client and not req.conversation_id:
            cache_key = f"ask2:{hashlib.sha256(req.question.lower().strip().encode()).hexdigest()[:16]}"
            cached = redis_client.get(cache_key)
            if cached:
                incr_ask_cache(True)
                record_latency((time.time() - t0) * 1000)
                return AskResponseV2(**json.loads(cached))
    except Exception:
        cache_key = None

    from ask.intent import run_intent_pipeline
    from ask.conversation import get_latest_brief, merge_intent

    # 1. Parse intent (deterministic + LLM normalisation)
    parsed = await run_intent_pipeline(db, req.question)

    # 1b. Multi-turn: merge prior intent if conversation_id present
    if req.conversation_id:
        prior_brief = get_latest_brief(db, req.conversation_id, current_user)
        if prior_brief and prior_brief.intent:
            prior_intent = prior_brief.intent if isinstance(prior_brief.intent, dict) else {}
            parsed = merge_intent(prior_intent, parsed)

    if parsed.get("needs_clarification"):
        clarification = parsed.get("clarification", {})
        return AskResponseV2(
            request_id=request_id,
            status="needs_clarification",
            intent=parsed,
            query_understood=parsed,
            summary="",
            research_priority="insufficient_evidence",
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
        )

    goal = parsed.get("goal", "single_suburb_research")
    property_type = parsed.get("property_type", "house")
    budget = parsed.get("budget")
    income = parsed.get("annual_income")
    priorities = parsed.get("priorities", [])

    suburbs_raw = parsed.get("suburbs", [])

    # 2. Build SuburbReference list + resolve
    intent_suburbs = []
    for s in suburbs_raw:
        if isinstance(s, dict):
            intent_suburbs.append(SuburbReference(
                name=s.get("name", ""), state=s.get("state", ""),
                postcode=s.get("postcode"),
            ))

    # 3. Route
    if goal == "suburb_discovery" or goal == "interstate_discovery":
        from ask.geo_discovery import discover_suburbs
        disc = discover_suburbs(db, req.question, budget=budget)
        disc_results = []
        for r in disc.get("results", []):
            m = r.get("metrics", {})
            disc_results.append(DiscoveryResult(
                suburb_id=r.get("suburb_id"), name=r.get("name", ""), state=r.get("state", ""),
                postcode=r.get("postcode"), match_score=r.get("match_score", 0),
                dist_km=r.get("dist_km"), why_selected=r.get("why_selected", []),
                metrics=DiscoveryMetrics(
                    median_price=m.get("median_price"), yield_pct=m.get("yield_pct"),
                    vacancy_rate=m.get("vacancy_rate"), population_cagr=m.get("population_cagr"),
                    school_quality=m.get("school_quality"), transit_accessibility=m.get("transit_accessibility"),
                    parks_count=m.get("parks_count"), safety_score=m.get("safety_score"),
                    top_school_name=m.get("top_school_name"), price_12m_change_pct=m.get("price_12m_change_pct"),
                )
            ))
        discovery_out = DiscoveryResponse(
            guardrail=disc.get("guardrail", False), message=disc.get("message"),
            summary=disc.get("summary"), query_understood=disc.get("query_understood", {}),
            results=disc_results,
        )
        return AskResponseV2(
            request_id=request_id, status="complete",
            intent=parsed, query_understood=disc.get("query_understood", {}),
            headline=f"Discovery — {disc.get('summary', '')}",
            summary=disc.get("summary", ""),
            research_priority="medium" if disc_results else "low",
            discovery=discovery_out,
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
        )

    if not intent_suburbs and goal not in ("interstate_discovery", "general_advice"):
        return AskResponseV2(
            request_id=request_id, status="needs_clarification",
            intent=parsed, query_understood=parsed,
            summary="",
            research_priority="insufficient_evidence",
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
        )

    # 4. Evidence extraction per suburb
    all_evidence = []
    comparisons = []
    dq_summary = {"coverage": 0.0, "stale_metric_count": 0, "suburbs": {}}

    valid_suburbs = []
    for ref in intent_suburbs:
        v3 = get_suburb_ui(db, ref)
        if not v3:
            continue
        valid_suburbs.append(v3)
        ev = extract_evidence(v3, property_type, goal)
        all_evidence.extend(ev)
        dq = calculate_data_quality(v3, ev, goal)
        dq_summary["suburbs"][v3.id] = dq

        metrics = []
        # Build comparison metrics with natural-language explanations
        for e in ev:
            exp = get_explanation(
                next((mk for mk, ent in __import__('ask.metric_registry', fromlist=['METRIC_REGISTRY'])
                      .METRIC_REGISTRY.items() if ent.label == e.metric), e.metric.split("_")[-1]),
                e.value, property_type
            )
            metrics.append(SuburbComparisonMetric(
                label=e.metric, value=e.value, unit=e.unit,
                is_stale=e.is_stale, as_of=e.as_of, source=e.source,
                quality=e.quality, explanation=exp.get("text"),
            ))
        comparisons.append(SuburbComparison(
            suburb_id=v3.id, name=v3.name, metrics=metrics,
        ))

    # Compute aggregate DQ
    if dq_summary["suburbs"]:
        scores = [s.get("dq_score", 0) for s in dq_summary["suburbs"].values()]
        if scores:
            dq_summary["coverage"] = round(sum(s["coverage"] for s in dq_summary["suburbs"].values()) / len(scores), 3)
            dq_summary["stale_metric_count"] = sum(s.get("stale_metric_count", 0) for s in dq_summary["suburbs"].values())
            dq_summary["dq_score"] = round(sum(scores) / len(scores), 1)
            dq_summary["band"] = "High" if dq_summary["dq_score"] >= 85 else ("Medium" if dq_summary["dq_score"] >= 70 else ("Limited" if dq_summary["dq_score"] >= 50 else "Unavailable"))

    # 5. Verdict engine (for comparisons)
    verdict = None
    if len(comparisons) >= 2:
        from ask.verdict import compute_per_metric_winners, compute_persona_verdicts, generate_tradeoffs
        from ask.metric_registry import METRIC_REGISTRY

        # Build metrics_data dict for verdict engine
        metrics_data = {}
        for comp in comparisons:
            for m in comp.metrics:
                mkey = next((mk for mk, ent in METRIC_REGISTRY.items()
                             if ent.label == m.label), m.label)
                if mkey not in metrics_data:
                    metrics_data[mkey] = {}
                metrics_data[mkey][comp.name] = m.value

        per_metric = compute_per_metric_winners(metrics_data)
        by_persona = compute_persona_verdicts(per_metric, [c.name for c in comparisons])
        tradeoffs = generate_tradeoffs(per_metric, [c.name for c in comparisons])

        # Attach winner/edge info to comparison metrics
        for pm in per_metric:
            leader = pm.get("leader")
            direction = pm.get("direction", "higher_better")
            for comp in comparisons:
                for m in comp.metrics:
                    if m.label == pm.get("metric") or next((ent.label for mk, ent in METRIC_REGISTRY.items() if mk == pm.get("metric")), None) == m.label:
                        if pm.get("framing") != "statistically_even" and leader:
                            m.winner = (comp.name == leader)
                            if m.winner and pm.get("edge_pct", 0) >= 3:
                                other_names = [c.name for c in comparisons if c.name != leader]
                                direction_word = "advantage" if direction not in ("lower_better",) else "lower"
                                m.edge_note = f"{pm['edge_pct']:.0f}% {direction_word}" if direction != "contextual" else f"${float(m.value or 0)/1e3:.0f}k entry cost"

        non_comparable = [pm["metric"] for pm in per_metric if pm.get("framing") == "insufficient_data"]
        framing = "clear_leader" if any(pm.get("framing") == "clear_leader" for pm in per_metric) else "balanced"

        verdict = VerdictBlock(
            framing=framing,
            per_metric=per_metric,
            by_persona=by_persona,
            tradeoffs=tradeoffs,
            non_comparable_metrics=non_comparable,
        )

    # 6. Assumptions
    assumptions = []
    if budget:
        assumptions.append(ScenarioAssumptions(label="Budget", value=f"${budget:,.0f}", source="question"))
    if income:
        assumptions.append(ScenarioAssumptions(label="Annual Income", value=f"${income:,.0f}", source="question"))

    # 7. Affordability
    affordability = None
    if valid_suburbs and budget and income:
        price = valid_suburbs[0].house_median_price if property_type == "house" else valid_suburbs[0].unit_median_price
        if price:
            affordability_res = compute_affordability(
                float(budget), float(budget * 0.2), float(income),
                None, valid_suburbs[0].state or "NSW", property_type, float(price or budget)
            )
            affordability = AffordabilityBlock(
                serviceability_passed=affordability_res.get("serviceability_passed"),
                borrowing_capacity=affordability_res.get("borrowing_capacity"),
                monthly_repayment=affordability_res.get("monthly_repayment"),
                stamp_duty=affordability_res.get("stamp_duty"),
            )

    # 8. Synthesis
    syn = synthesize_research(parsed, all_evidence, assumptions, affordability_res if affordability else {})

    # 9. Policy check
    policy_check = validate_policy(syn, all_evidence)
    status = "complete"
    if policy_check["status"] != "valid":
        status = "degraded"
        syn["summary"] = "[Degraded] Evidence-only summary: " + policy_check.get("reason", ""
                         ) + "\n\n" + syn.get("summary", "")

    # 10. Headline
    suburb_names = [c.name for c in comparisons] if comparisons else ["your area"]
    if not suburb_names:
        suburb_names = ["your area"]
    headline = f"Research brief for {', '.join(suburb_names)}"
    if goal == "suburb_comparison":
        headline = f"Comparison: {' vs '.join(suburb_names)}"
    elif goal in ("investment_search", "investment_cashflow"):
        headline = f"Investment research: {', '.join(suburb_names)}"
    elif goal == "risks_analysis":
        headline = f"Risk analysis: {', '.join(suburb_names)}"

    # 11. Follow-up suggestions
    follow_ups = []
    if len(comparisons) >= 2:
        follow_ups.append({"label": "Schools nearby?", "question": f"What are the schools like near {', '.join(suburb_names)}?"})
    if comparisons and goal not in ("cashflow_projection",):
        follow_ups.append({"label": "Cashflow projection?", "question": f"Cashflow projection for a median property in {suburb_names[0]}"})
    if comparisons and goal not in ("risks_analysis",):
        follow_ups.append({"label": "Biggest risks?", "question": f"What are the biggest risks of buying in {suburb_names[0]}?"})
    if len(comparisons) >= 2:
        follow_ups.append({"label": "Long-term growth?", "question": f"Which of {' or '.join(suburb_names)} has better long-term growth potential?"})

    # 12. Query understood
    query_understood = {
        "suburbs": [{"name": c.name, "state": valid_suburbs[i].state if i < len(valid_suburbs) else ""}
                     for i, c in enumerate(comparisons)],
        "budget": budget, "property_type": property_type,
        "data_as_of": min((e.as_of for e in all_evidence), default="N/A") if all_evidence else "N/A",
        "source": "NPG / CoreLogic / ABS / ACARA" if not dq_summary.get("vintage_estimated") else "Scraped (estimated vintage)",
    }

    # 13. Persist
    brief_data = _sanitize({
        "intent": parsed, "assumptions": [a.model_dump(mode='json') for a in assumptions],
        "summary": syn["summary"], "research_priority": syn["research_priority"],
        "comparison": [c.model_dump(mode='json') for c in comparisons],
        "verdict": verdict.model_dump(mode='json') if verdict else None,
        "supports": syn["supports"], "risks": syn["risks"],
        "unknowns": syn["unknowns"], "next_steps": syn["next_steps"],
        "evidence": [e.model_dump(mode='json') for e in all_evidence],
        "data_quality": _sanitize(dq_summary),
        "versions": {"evidence": "v2", "scorer": "v2", "prompt": "ask-v2", "model": "deepseek-v3", "pipeline": "ask-v2", "qualitative_map": "v1", "policy": "v2"},
    })
    conv = create_conversation(db, current_user, title=req.question[:50])
    save_ask_brief(db, current_user, brief_data, conv.id)

    # Attach conversation_id to follow-ups for multi-turn
    for fu in follow_ups:
        fu["conversation_id"] = str(conv.id)

    result = AskResponseV2(
        request_id=request_id, status=status, intent=parsed, query_understood=query_understood,
        assumptions=assumptions, headline=headline, summary=syn["summary"],
        research_priority=syn["research_priority"],
        comparison=comparisons, verdict=verdict, affordability=affordability,
        supports=syn["supports"], risks=syn["risks"],
        unknowns=syn["unknowns"], next_steps=syn["next_steps"],
        evidence=all_evidence, data_quality=_sanitize(dq_summary),
        follow_ups=follow_ups,
        versions={"evidence": "v2", "scorer": "v2", "prompt": "ask-v2", "model": "deepseek-v3", "pipeline": "ask-v2", "qualitative_map": "v1", "policy": "v2"},
    )

    # Cache write
    if cache_key:
        try:
            from main import redis_client
            if redis_client:
                redis_client.setex(cache_key, 1800, json.dumps(result.model_dump(mode='json')))
        except Exception:
            pass

    record_latency((time.time() - t0) * 1000)
    record_evidence_coverage(dq_summary.get("coverage", 0))

    return result


# ═══════════════════════════════════════════════════════════════════════════
# INTENT CLASSIFIER — registers the missing /intent endpoint
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/intent", response_model=IntentResponse)
async def classify_intent(
    req: IntentRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    """Parse-only endpoint: returns structured intent from raw text for UX preview or ML fallback."""
    from ask.intent import run_intent_pipeline
    parsed = await run_intent_pipeline(db, req.query)
    return IntentResponse(
        goal=parsed.get("goal", "single_suburb_research"),
        suburbs=[{"name": s.get("name", ""), "state": s.get("state", "")}
                 for s in parsed.get("suburbs", [])],
        property_type=parsed.get("property_type", "any"),
        tenure=parsed.get("tenure", "undecided"),
        budget=parsed.get("budget"),
        deposit=parsed.get("deposit"),
        annual_income=parsed.get("annual_income"),
        priorities=parsed.get("priorities", []),
        confidence=parsed.get("confidence", 0.7),
        needs_clarification=parsed.get("needs_clarification", False),
        clarification=parsed.get("clarification", {}),
        geo=parsed.get("geo"),
    )


# ═══════════════════════════════════════════════════════════════════════════
# V1 — Legacy endpoints (unchanged contract, re-routed through new pipeline)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("", response_model=AskResponse)
def ask_yieldsense(
    intent: AskIntent,
    request: Request,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    request_id = f"ask_{uuid.uuid4()}"

    all_evidence = []
    comparisons = []
    dq_summary = {"coverage": 0, "stale_metric_count": 0, "suburbs": {}}

    if not intent.suburbs:
        if intent.goal not in ["interstate_discovery", "general_advice"]:
            raise HTTPException(status_code=400, detail="Missing target suburbs for research.")

    valid_suburbs = []
    for ref in intent.suburbs:
        v3 = get_suburb_ui(db, ref)
        if not v3:
            continue
        valid_suburbs.append(v3)
        ev = extract_evidence(v3, intent.property_type, intent.goal)
        all_evidence.extend(ev)

        dq = calculate_data_quality(v3, ev, intent.goal)
        dq_summary["suburbs"][v3.id] = dq

        metrics = []
        for e in ev:
            try:
                parsed_val = float(e.value) if e.value is not None else None
            except ValueError:
                parsed_val = e.value
            metrics.append(SuburbComparisonMetric(
                label=e.metric, value=parsed_val, unit=e.unit,
                is_stale=e.is_stale,
            ))
        comparisons.append(SuburbComparison(
            suburb_id=v3.id, name=v3.name, metrics=metrics,
        ))

    assumptions = []
    if intent.budget:
        assumptions.append(ScenarioAssumptions(label="Budget", value=f"${intent.budget:,.0f}", source="user"))
    if intent.deposit:
        assumptions.append(ScenarioAssumptions(label="Deposit", value=f"${intent.deposit:,.0f}", source="user"))
    if intent.annual_income:
        assumptions.append(ScenarioAssumptions(label="Annual Income", value=f"${intent.annual_income:,.0f}", source="user"))

    affordability_res = {}
    if valid_suburbs and intent.budget and intent.deposit and intent.annual_income:
        price = valid_suburbs[0].house_median_price if intent.property_type == "house" else valid_suburbs[0].unit_median_price
        if price:
            affordability_res = compute_affordability(
                float(intent.budget), float(intent.deposit), float(intent.annual_income),
                float(intent.monthly_debt) if intent.monthly_debt else None,
                valid_suburbs[0].state, intent.property_type, float(price)
            )

    syn = synthesize_research(
        {"question": intent.question, "goal": intent.goal, "suburbs": intent.suburbs,
         "property_type": intent.property_type, "budget": intent.budget,
         "annual_income": intent.annual_income},
        all_evidence, assumptions, affordability_res
    )

    policy_check = validate_policy(syn, all_evidence)
    status = "complete"
    if policy_check["status"] != "valid":
        status = "degraded"
        syn["summary"] = "Evidence-only fallback. " + policy_check["reason"]
        syn["research_priority"] = "insufficient_evidence"

    brief_data = _sanitize({
        "intent": intent.model_dump(mode='json'),
        "assumptions": [a.model_dump(mode='json') for a in assumptions],
        "summary": syn["summary"], "research_priority": syn["research_priority"],
        "comparison": [c.model_dump(mode='json') for c in comparisons],
        "supports": syn["supports"], "risks": syn["risks"],
        "unknowns": syn["unknowns"], "next_steps": syn["next_steps"],
        "evidence": [e.model_dump(mode='json') for e in all_evidence],
        "data_quality": _sanitize(dq_summary),
        "versions": {"evidence": "v2", "scorer": "v2", "prompt": "ask-v2", "model": "gpt-4o"},
    })
    conv = create_conversation(db, current_user, title=intent.question[:50])
    save_ask_brief(db, current_user, brief_data, conv.id)

    return AskResponse(
        request_id=request_id, status=status, **brief_data,
    )


@router.post("/discover", response_model=DiscoveryResponse)
def discover_yieldsense(
    req: DiscoveryRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    raw = discover_suburbs(db, req.question, budget=req.budget)
    results = []
    for r in raw.get("results", []):
        m = r.get("metrics", {})
        results.append(DiscoveryResult(
            suburb_id=r.get("suburb_id"), name=r.get("name", ""), state=r.get("state", ""),
            postcode=r.get("postcode"), match_score=r.get("match_score", 0.0),
            dist_km=r.get("dist_km"), why_selected=r.get("why_selected", []),
            metrics=DiscoveryMetrics(
                median_price=m.get("median_price"), yield_pct=m.get("yield_pct"),
                vacancy_rate=m.get("vacancy_rate"), population_cagr=m.get("population_cagr"),
                school_quality=m.get("school_quality"), transit_accessibility=m.get("transit_accessibility"),
                parks_count=m.get("parks_count"), safety_score=m.get("safety_score"),
                top_school_name=m.get("top_school_name"), price_12m_change_pct=m.get("price_12m_change_pct"),
            )
        ))
    return DiscoveryResponse(
        guardrail=raw.get("guardrail", False), message=raw.get("message"),
        summary=raw.get("summary"), query_understood=raw.get("query_understood", {}), results=results,
    )
