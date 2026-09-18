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
    SupportRiskClaim, AffordabilityBlock, SuburbReference, FeedbackRequest,
    ReasoningHop, MultiHopTrace,
)
from ask.evidence import get_suburb_ui, extract_evidence, calculate_data_quality, check_pack_minimum
from ask.scenarios import compute_affordability, compute_yield
from ask.guardrails import mask_pii, check_off_topic
from ask.synthesis import synthesize_research
from ask.policy import validate_policy
from ask.repository import create_conversation, save_ask_brief, _sanitize
from ask.geo_discovery import discover_suburbs
from ask.metric_explainers import get_explanation
from graph.graph_router import should_route_to_graph
from graph.graph_discovery import discover_suburbs_graph

router = APIRouter(prefix="/api/v3/ask", tags=["ask"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _build_reasoning_chain(hops: list) -> MultiHopTrace:
    total_ms = sum(h.latency_ms for h in hops)
    confidences = [h.confidence for h in hops if h.confidence > 0]
    aggregate = round(sum(confidences) / len(confidences), 3) if confidences else 0.0
    return MultiHopTrace(
        hops=hops,
        aggregate_confidence=aggregate,
        total_latency_ms=round(total_ms, 1),
    )


def _route_reason(query: str, intent: dict, use_graph: bool) -> str:
    if use_graph:
        signals = _detected_spatial_keywords(query)
        return f"Spatial signals detected: {signals} — routing to Neo4j graph traversal"
    goal = intent.get("goal", "")
    suburbs = intent.get("suburbs", [])
    if goal in ("suburb_comparison", "single_suburb_research") and suburbs:
        return f"Named suburbs present ({[s.get('name','') for s in suburbs][:2]}) — routing to Postgres evidence pipeline"
    if goal in ("risks_analysis", "schools_analysis"):
        return f"Goal '{goal}' uses structured evidence packs — routing to Postgres"
    return "No spatial signals detected — defaulting to Postgres evidence pipeline"


def _detected_spatial_keywords(query: str) -> list:
    from graph.graph_router import SPATIAL_KEYWORDS
    ql = query.lower()
    return [kw for kw in SPATIAL_KEYWORDS if kw in ql]


def _detected_poi_types(query: str) -> list:
    from graph.graph_discovery import KEYWORD_TRIGGERS
    ql = query.lower()
    types = []
    for poi_type, triggers in KEYWORD_TRIGGERS.items():
        if any(t in ql for t in triggers):
            types.append(poi_type)
    return types


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

    t0 = time.time()
    hops: list = []

    # Feature flag gate
    enable_ask_v2 = os.getenv("ENABLE_ASK_V2", "true").lower() in ("true", "1", "yes")
    if not enable_ask_v2:
        raise HTTPException(status_code=503, detail="Ask YieldSense v2 is temporarily disabled (ENABLE_ASK_V2=false). Use /api/v3/ask instead.")
        
    # --- PHASE 3: ENTERPRISE GUARDRAILS ---
    # 1. PII Scrubbing
    original_query = req.question
    req.question = mask_pii(req.question)
    
    # 2. Off-Topic & Prompt Injection Defense
    t_g = time.time()
    is_off_topic = check_off_topic(req.question)
    pii_scrubbed = (original_query != req.question)
    hops.append(ReasoningHop(
        step="guardrails",
        input_summary=f"Raw query: \"{original_query[:80]}{'...' if len(original_query) > 80 else ''}\"",
        output_summary="Passed — on-topic" if not is_off_topic else "BLOCKED — off-topic or prompt injection",
        confidence=0.98 if not is_off_topic else 1.0,
        data_sources=["policy_guardrails_v3"],
        decision_rationale="PII scrubbed" if pii_scrubbed else "No PII detected",
        artifacts={"pii_scrubbed": pii_scrubbed, "off_topic": is_off_topic},
        latency_ms=round((time.time() - t_g) * 1000, 1),
    ))
    if is_off_topic:
        return AskResponseV2(
            request_id="gr-" + hashlib.md5(req.question.encode()).hexdigest()[:8],
            status="degraded",
            intent={"goal": "out_of_scope"},
            query_understood={"original_query": original_query, "masked_query": req.question},
            headline="Query Blocked by Policy",
            summary="This assistant is restricted to real estate, property investment, and financial queries. Please rephrase your question.",
            research_priority="insufficient_evidence",
            disclaimer="Enterprise Guardrail Enforced.",
            versions={"pipeline": "ask-v2-guardrail"},
            reasoning_chain=_build_reasoning_chain(hops),
        )
    # --------------------------------------

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
    t_i = time.time()
    parsed = await run_intent_pipeline(db, req.question)
    intent_confidence = parsed.get("confidence", 0.8)
    hops.append(ReasoningHop(
        step="intent_parsing",
        input_summary=f"Masked query: \"{req.question[:80]}{'...' if len(req.question) > 80 else ''}\"",
        output_summary=f"Goal={parsed.get('goal')}, suburbs={[s.get('name','') for s in parsed.get('suburbs',[])][:3]}, budget={parsed.get('budget')}, priorities={parsed.get('priorities',[])}",
        confidence=intent_confidence,
        data_sources=["intent_pipeline_v2", "gazetteer"],
        decision_rationale=f"Deterministic extractors + {'LLM fallback' if parsed.get('llm_used') else 'rule-based'} classification",
        artifacts={"goal": parsed.get("goal"), "suburbs_count": len(parsed.get("suburbs", [])), "priorities": parsed.get("priorities", [])},
        latency_ms=round((time.time() - t_i) * 1000, 1),
    ))

    # 1b. Multi-turn: merge prior intent if conversation_id present
    if req.conversation_id:
        t_m = time.time()
        prior_brief = get_latest_brief(db, req.conversation_id, current_user)
        if prior_brief and prior_brief.intent:
            prior_intent = prior_brief.intent if isinstance(prior_brief.intent, dict) else {}
            parsed = merge_intent(prior_intent, parsed)
            hops.append(ReasoningHop(
                step="multi_turn_merge",
                input_summary=f"Conversation {req.conversation_id[:8]}... — prior suburbs: {[s.get('name','') for s in prior_intent.get('suburbs',[])][:3]}",
                output_summary=f"Merged — suburbs: {[s.get('name','') for s in parsed.get('suburbs',[])][:3]}, budget={parsed.get('budget')}",
                confidence=0.95,
                data_sources=["ask_briefs"],
                decision_rationale="Inherited budget/tenure from prior turn; merged suburb lists",
                artifacts={"conversation_id": req.conversation_id, "prior_goal": prior_intent.get("goal")},
                latency_ms=round((time.time() - t_m) * 1000, 1),
            ))
            
    # 1c. Merge manual UI scenario overrides
    if req.scenario_overrides:
        parsed.update({k: v for k, v in req.scenario_overrides.items() if v is not None})

    # Clear clarification flag if UI provided necessary geographic context (state) for discovery
    if parsed.get("needs_clarification") and parsed.get("goal") in ("suburb_discovery", "investment_search", "interstate_discovery"):
        if parsed.get("state") or parsed.get("suburbs"):
            parsed["needs_clarification"] = False

    if parsed.get("needs_clarification"):
        clarification = parsed.get("clarification", {})
        hops.append(ReasoningHop(
            step="clarification",
            input_summary=f"Intent parsed but incomplete — goal={parsed.get('goal')}",
            output_summary=f"Clarification needed: {clarification.get('questions', ['missing context'])[0]}",
            confidence=0.3,
            data_sources=["intent_pipeline_v2"],
            decision_rationale="Missing geographic context — cannot proceed without state/city/suburb",
            artifacts={"questions": clarification.get("questions", []), "options": clarification.get("options", [])},
        ))
        return AskResponseV2(
            request_id=request_id,
            status="needs_clarification",
            intent=parsed,
            query_understood={**parsed, "original_query": original_query, "masked_query": req.question},
            summary="",
            research_priority="insufficient_evidence",
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
            reasoning_chain=_build_reasoning_chain(hops),
        )

    # 3. Route to Graph Database or Standard Pipeline
    t_r = time.time()
    use_graph = should_route_to_graph(req.question, parsed)
    route_reason = _route_reason(req.question, parsed, use_graph)
    hops.append(ReasoningHop(
        step="routing",
        input_summary=f"Goal={parsed.get('goal')}, priorities={parsed.get('priorities',[])}, query=\"{req.question[:60]}\"",
        output_summary=f"Routed to {'Neo4j Graph Engine' if use_graph else 'Standard Postgres Pipeline'}",
        confidence=0.90 if use_graph else 0.85,
        data_sources=["graph_router_v2", "spatial_keyword_map"],
        decision_rationale=route_reason,
        artifacts={"engine": "neo4j" if use_graph else "postgres", "spatial_signals": _detected_spatial_keywords(req.question)},
        latency_ms=round((time.time() - t_r) * 1000, 1),
    ))
    if use_graph:
        # Actually execute the Graph DB Query
        t_gd = time.time()
        graph_res = discover_suburbs_graph(req.question, parsed)
        result_count = len(graph_res.get("results", []))
        hops.append(ReasoningHop(
            step="discovery",
            input_summary=f"Neo4j graph query with priorities={parsed.get('priorities',[])}",
            output_summary=f"Found {result_count} suburbs matching spatial + metric constraints",
            confidence=round(min(0.95, 0.5 + result_count * 0.1), 2),
            data_sources=["neo4j_5.20", "osm_nodes", "acara_schools"],
            decision_rationale=f"Cypher traversal across {_detected_poi_types(req.question)} POI types",
            artifacts={"result_count": result_count, "engine": "neo4j", "poi_types": _detected_poi_types(req.question)},
            latency_ms=round((time.time() - t_gd) * 1000, 1),
        ))
        
        return AskResponseV2(
            request_id=request_id, status="complete",
            intent=parsed, query_understood={"pipeline": "neo4j_graph", "original_query": original_query, "masked_query": req.question},
            summary=graph_res.get("summary", "Query routed to Neo4j Graph Engine for spatial traversal."),
            research_priority="medium",
            evidence=[], 
            discovery=graph_res,
            data_quality={}, follow_ups=[],
            verdict=VerdictBlock(conclusion="Graph traversal initiated.", confidence_score=100, reasoning=[]),
            versions={"pipeline": "ask-v2-graph"},
            trace_log=graph_res.get("trace_log"),
            reasoning_chain=_build_reasoning_chain(hops),
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
    if goal in ("suburb_discovery", "interstate_discovery", "investment_search"):
        t_d = time.time()
        from ask.geo_discovery import discover_suburbs
        disc = discover_suburbs(db, req.question, budget=budget)
        result_count = len(disc.get("results", []))
        hops.append(ReasoningHop(
            step="discovery",
            input_summary=f"PostGIS geo-search: goal={goal}, budget={budget}",
            output_summary=f"Found {result_count} suburbs via composite scoring",
            confidence=round(min(0.92, 0.4 + result_count * 0.12), 2),
            data_sources=["postgis", "suburbs_ui_v3", "cbd_anchors"],
            decision_rationale=f"Haversine distance + direction bearing + {'budget filter' if budget else 'no budget filter'}",
            artifacts={"result_count": result_count, "engine": "postgis"},
            latency_ms=round((time.time() - t_d) * 1000, 1),
        ))
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
        disc_qu = disc.get("query_understood", {})
        if not isinstance(disc_qu, dict):
            disc_qu = {}
        disc_qu["original_query"] = original_query
        disc_qu["masked_query"] = req.question

        discovery_out = DiscoveryResponse(
            guardrail=disc.get("guardrail", False), message=disc.get("message"),
            summary=disc.get("summary"), query_understood=disc_qu,
            results=disc_results,
            trace_log=disc.get("trace_log"),
        )
        return AskResponseV2(
            request_id=request_id, status="complete",
            intent=parsed, query_understood=disc_qu,
            headline=f"Discovery — {disc.get('summary', '')}",
            summary=disc.get("summary", ""),
            research_priority="medium" if disc_results else "low",
            discovery=discovery_out,
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
            trace_log=disc.get("trace_log"),
            reasoning_chain=_build_reasoning_chain(hops),
        )

    if not intent_suburbs and goal not in ("interstate_discovery", "general_advice", "affordability", "schools_analysis", "growth_analysis", "suburb_discovery", "investment_search", "supply_analysis"):
        return AskResponseV2(
            request_id=request_id, status="needs_clarification",
            intent=parsed, query_understood={**parsed, "original_query": original_query, "masked_query": req.question},
            summary="",
            research_priority="insufficient_evidence",
            disclaimer="General research only; not financial, legal, tax, lending or valuation advice.",
            versions={"pipeline": "ask-v2", "evidence": "v2"},
            reasoning_chain=_build_reasoning_chain(hops),
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

    t_ev = time.time()
    stale_count = dq_summary.get("stale_metric_count", 0)
    hops.append(ReasoningHop(
        step="evidence",
        input_summary=f"Extracting evidence for {len(valid_suburbs)} suburbs, goal={goal}",
        output_summary=f"{len(all_evidence)} metrics extracted — DQ band: {dq_summary.get('band','N/A')} ({dq_summary.get('dq_score',0):.0f}/100)",
        confidence=round(dq_summary.get("dq_score", 50) / 100, 3) if dq_summary.get("dq_score") else 0.5,
        data_sources=["suburbs_ui_v3", "corelogic", "abs", "acara", "sqm"],
        decision_rationale=f"Evidence pack: {goal} — {len(all_evidence)} metrics, {stale_count} stale" if stale_count else f"Evidence pack: {goal} — all {len(all_evidence)} metrics fresh",
        artifacts={"metric_count": len(all_evidence), "stale_count": stale_count, "dq_band": dq_summary.get("band"), "evidence_pack": goal},
        latency_ms=round((time.time() - t_ev) * 1000, 1),
    ))

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

        t_v = time.time()
        clear_leaders = [pm["metric"] for pm in per_metric if pm.get("framing") == "clear_leader"]
        persona_leaders = [p.get("leader") for p in by_persona if p.get("leader")]
        verdict_confidence = 0.9 if len(clear_leaders) >= 2 else (0.7 if clear_leaders else 0.5)
        hops.append(ReasoningHop(
            step="verdict",
            input_summary=f"Comparing {len(comparisons)} suburbs across {len(per_metric)} metrics",
            output_summary=f"Framing={framing}, {len(clear_leaders)} clear leaders, {len(persona_leaders)} persona winners",
            confidence=verdict_confidence,
            data_sources=["verdict_engine_v2", "persona_weights", "metric_registry"],
            decision_rationale=f"{len(clear_leaders)} metrics show clear leaders; {len(tradeoffs)} trade-offs identified",
            artifacts={"clear_leaders": clear_leaders, "persona_leaders": persona_leaders, "tradeoff_count": len(tradeoffs)},
            latency_ms=round((time.time() - t_v) * 1000, 1),
        ))

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
    t_s = time.time()
    syn = synthesize_research(parsed, all_evidence, assumptions, affordability_res if affordability else {})
    hops.append(ReasoningHop(
        step="synthesis",
        input_summary=f"Evidence bundle: {len(all_evidence)} metrics across {len(valid_suburbs)} suburbs",
        output_summary=f"Synthesized — priority={syn.get('research_priority','low')}, {len(syn.get('supports',[]))} supports, {len(syn.get('risks',[]))} risks",
        confidence=0.82,
        data_sources=["llm_synthesis_v2", "evidence_bundle"],
        decision_rationale=f"LLM synthesis with {len(syn.get('supports',[]))} support claims and {len(syn.get('risks',[]))} risk factors",
        artifacts={"supports_count": len(syn.get("supports", [])), "risks_count": len(syn.get("risks", [])), "provider": syn.get("provider", "unknown")},
        latency_ms=round((time.time() - t_s) * 1000, 1),
    ))

    # 9. Policy check
    t_p = time.time()
    policy_check = validate_policy(syn, all_evidence)
    status = "complete"
    if policy_check["status"] != "valid":
        status = "degraded"
        syn["summary"] = "[Degraded] Evidence-only summary: " + policy_check.get("reason", ""
                         ) + "\n\n" + syn.get("summary", "")
    hops.append(ReasoningHop(
        step="policy",
        input_summary=f"Synthesis status check",
        output_summary=f"Policy: {'PASSED' if policy_check.get('status') == 'valid' else 'BLOCKED — ' + policy_check.get('reason', 'unknown')}",
        confidence=1.0 if policy_check.get("status") == "valid" else 0.3,
        data_sources=["policy_validator_v2"],
        decision_rationale=policy_check.get("reason", "All claims within policy bounds"),
        artifacts={"violations": policy_check.get("violations", []), "status": policy_check.get("status")},
        latency_ms=round((time.time() - t_p) * 1000, 1),
    ))

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
        "original_query": original_query,
        "masked_query": req.question,
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
        reasoning_chain=_build_reasoning_chain(hops),
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
        trace_log=raw.get("trace_log")
    )

@router.post("/feedback")
def submit_feedback(
    req: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    from models_v3 import UserFeedback
    fb = UserFeedback(
        request_id=req.request_id,
        user_id=current_user,
        query=req.query,
        feedback_type=req.feedback_type,
        expected_behavior=req.expected_behavior
    )
    db.add(fb)
    db.commit()
    return {"status": "success", "message": "Feedback recorded for Enterprise RLHF"}
