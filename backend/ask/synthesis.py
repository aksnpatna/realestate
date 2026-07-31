import json
from typing import Dict, Any, List
import openai
import os
from ask.schemas import AskIntent, EvidenceMetric, ScenarioAssumptions, SynthesisResponse

async def synthesize_research(
    intent: AskIntent, 
    evidence: List[EvidenceMetric], 
    assumptions: List[ScenarioAssumptions],
    affordability_res: Dict[str, Any]
) -> Dict[str, Any]:
    
    # We will use OpenAI with structured JSON output to synthesize a single bounded response.
    # Note: If OpenAI fails or circuit breaker opens, we return evidence-only.
    
    system_prompt = """
    You are Ask YieldSense, a strict, deterministic real estate data synthesis engine.
    You MUST output valid JSON conforming strictly to the requested schema.
    DO NOT provide financial, legal, tax, lending, or valuation advice.
    DO NOT use words like "guaranteed", "you should buy", "will definitely increase".
    CRITICAL GUARDRAIL: You MUST work strictly within the verified data and evidence provided in this prompt. 
    DO NOT use external knowledge, DO NOT hallucinate statistics, and DO NOT go to the internet to get outside data. 
    The ONLY exception is the 'AI News Sentiment' metric which is already provided to you in the prompt.
    Your entire summary MUST be supported EXCLUSIVELY by the provided Evidence and Assumptions.
    """
    
    # PII Scrubbing
    sanitized_intent = intent.model_copy()
    sanitized_intent.budget = None
    sanitized_intent.deposit = None
    sanitized_intent.annual_income = None
    sanitized_intent.monthly_debt = None
    
    evidence_json = [e.model_dump(mode='json') for e in evidence]
    assumptions_json = [a.model_dump(mode='json') for a in assumptions]
    
    prompt = f"""
    Intent: {sanitized_intent.model_dump_json()}
    Evidence: {json.dumps(evidence_json)}
    Assumptions & Scenarios: {json.dumps(assumptions_json)}
    Affordability Passed: {affordability_res.get('serviceability_passed', False)}
    
    Build a research summary based ONLY on the above data.
    Return JSON format:
    {{
      "summary": "string",
      "research_priority": "high|medium|low|insufficient_evidence",
      "supports": [{{"claim": "string", "evidence_ids": ["string"]}}],
      "risks": [{{"claim": "string", "evidence_ids": ["string"]}}],
      "unknowns": ["string"],
      "next_steps": ["string"]
    }}
    """
    
    # Provider Waterfall: Grok -> NVIDIA -> DeepSeek
    providers = [
        {"name": "Grok", "key": os.getenv("XAI_API_KEY"), "base_url": "https://api.x.ai/v1", "model": "grok-2-latest"},
        {"name": "NVIDIA", "key": os.getenv("NVIDIA_API_KEY"), "base_url": "https://integrate.api.nvidia.com/v1", "model": "meta/llama-3.1-70b-instruct"},
        {"name": "DeepSeek", "key": os.getenv("DEEPSEEK_API_KEY"), "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"}
    ]
    
    parsed = None
    for provider in providers:
        if not provider["key"]:
            continue
            
        try:
            print(f"Attempting synthesis with {provider['name']} ({provider['model']})...")
            client = openai.AsyncClient(api_key=provider["key"], base_url=provider["base_url"])
            response = await client.chat.completions.create(
                model=provider["model"],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=1500,
                timeout=12.0
            )
            raw_output = response.choices[0].message.content
            # Validate against schema
            validated = SynthesisResponse.model_validate_json(raw_output)
            parsed = validated.model_dump(mode='json')
            break # Success
            
        except Exception as e:
            print(f"Provider {provider['name']} failed: {str(e)}")
            continue
            
    if parsed:
        return parsed
    
    print("All LLM providers failed. Falling back to deterministic synthesis.")
    try:
        # Deterministic fallback — build a rich, human-readable comparison narrative
        suburb_names = [s.name for s in intent.suburbs] if intent.suburbs else ["the area"]

        # Build per-suburb summaries
        per_suburb_parts = []
        suburb_evidence_map: dict = {}
        for e in evidence:
            suburb_evidence_map.setdefault(e.suburb_id, []).append(e)

        for sid, evs in suburb_evidence_map.items():
            name = sid.split('_')[1].title()
            price_ev = next((e for e in evs if 'Price' in e.metric), None)
            rent_ev = next((e for e in evs if 'Rent' in e.metric), None)
            yield_ev = next((e for e in evs if 'Yield' in e.metric), None)
            vac_ev = next((e for e in evs if 'Vacancy' in e.metric), None)
            pop_ev = next((e for e in evs if 'CAGR' in e.metric), None)
            news_ev = next((e for e in evs if 'News' in e.metric), None)

            parts = []
            if price_ev: parts.append(f"median price ${price_ev.value:,.0f}")
            if rent_ev: parts.append(f"rent ${rent_ev.value:.0f}/wk")
            if yield_ev:
                yield_note = "low yield" if yield_ev.value < 4 else "solid yield" if yield_ev.value < 5 else "strong yield"
                parts.append(f"{yield_ev.value:.2f}% gross yield ({yield_note})")
            if vac_ev:
                vac_note = "tight vacancy" if vac_ev.value < 2 else "moderate vacancy" if vac_ev.value < 4 else "elevated vacancy"
                parts.append(f"{vac_ev.value:.2f}% vacancy ({vac_note})")
            if pop_ev:
                pop_note = "strong" if pop_ev.value > 5 else "steady" if pop_ev.value > 2 else "modest"
                parts.append(f"{pop_ev.value:.1f}% population growth ({pop_note})")
            if news_ev:
                parts.append(f"AI News Sentiment is {news_ev.value}")

            per_suburb_parts.append(f"{name}: {'; '.join(parts)}" if parts else name)

        #
        # Affordability note
        aff_note = ""
        if affordability_res.get('serviceability_passed') is True:
            aff_note = (f" With a ${intent.budget:,.0f} budget and ${intent.annual_income:,.0f} income, "
                        f"serviceability passes — estimated borrowing capacity is ${affordability_res.get('borrowing_capacity', 0):,.0f}.")
        elif affordability_res.get('serviceability_passed') is False:
            aff_note = (f" ⚠️ At a ${intent.budget:,.0f} budget with ${intent.annual_income:,.0f} income, "
                        f"serviceability is tight — the required loan likely exceeds your estimated borrowing capacity of "
                        f"${affordability_res.get('borrowing_capacity', 0):,.0f}. Consider increasing your deposit or income.")

        narrative = " | ".join(per_suburb_parts)
        if len(suburb_names) == 1:
            summary = f"{narrative}.{aff_note} Note: This is a verified data summary — not financial advice."
        else:
            summary = f"{' vs '.join(suburb_names)} — {narrative}.{aff_note} Note: This is a verified data summary — not financial advice."

        # Goal-specific Summary Tailoring
        goal = intent.goal
        if goal == "risks_analysis":
            summary = f"RISK ANALYSIS for {', '.join(suburb_names)}: Please review the Risks & Counterarguments carefully. {aff_note} Key data points: {narrative}."
        elif goal == "cashflow_projection":
            summary = f"CASHFLOW PROJECTION for {', '.join(suburb_names)}: Focusing on yields and rents. {narrative}.{aff_note}"
        elif goal == "schools_analysis":
            summary = f"SCHOOLS ANALYSIS for {', '.join(suburb_names)}: While property data is available below, school zoning is state-managed. See 'Your next actions' for mapping resources. {narrative}."
        elif goal == "growth_analysis":
            summary = f"LONG-TERM GROWTH for {', '.join(suburb_names)}: Reviewing historical growth, population trajectories, and infrastructure sentiment. {narrative}."
            
        # Build evidence-cited supports & risks
        all_ev_ids = [e.id for e in evidence]
        supports = [{"claim": f"Verified CoreLogic/ABS data available for {', '.join(suburb_names)}", "evidence_ids": all_ev_ids[:4]}]
        if affordability_res.get('serviceability_passed') is True:
            supports.append({"claim": f"Serviceability passes at ${intent.budget:,.0f} budget", "evidence_ids": []})

        risks = []
        for e in evidence:
            if 'Vacancy' in e.metric and e.value and e.value > 3:
                risks.append({"claim": f"Elevated vacancy ({e.value:.1f}%) in {e.suburb_id.split('_')[1].title()} — oversupply risk", "evidence_ids": [e.id]})
            if 'Investor' in e.metric and e.value and e.value > 50:
                risks.append({"claim": f"High investor concentration ({e.value:.0f}%) in {e.suburb_id.split('_')[1].title()} — vulnerable to sentiment shifts", "evidence_ids": [e.id]})
            if 'Yield' in e.metric and e.value and e.value < 3:
                risks.append({"claim": f"Low yield ({e.value:.2f}%) in {e.suburb_id.split('_')[1].title()} — significant ongoing cashflow cost", "evidence_ids": [e.id]})
            if 'News' in e.metric and e.value == "Bearish":
                risks.append({"claim": f"Bearish AI News Sentiment detected for {e.suburb_id.split('_')[1].title()} — potential negative catalysts in recent media", "evidence_ids": [e.id]})
            if 'News' in e.metric and e.value == "Bullish":
                supports.append({"claim": f"Bullish AI News Sentiment for {e.suburb_id.split('_')[1].title()} — positive momentum or infrastructure news detected", "evidence_ids": [e.id]})
            if 'Price' in e.metric and e.value and intent.budget and intent.budget < e.value:
                risks.append({"claim": f"Budget of ${intent.budget:,.0f} is below {e.suburb_id.split('_')[1].title()} median price of ${e.value:,.0f} — consider adjacent suburbs", "evidence_ids": [e.id]})

        if not risks:
            risks.append({"claim": "Market conditions and individual property condition vary — conduct physical inspection", "evidence_ids": []})
        if affordability_res.get('serviceability_passed') is False:
            risks.append({"claim": "Serviceability constraint — required loan exceeds estimated borrowing capacity based on current income/deposit", "evidence_ids": []})

        # Next Steps Tailoring
        next_steps = [
            "Consult a licensed mortgage broker to confirm your exact borrowing capacity",
            "Arrange a building and pest inspection before any offer",
            "Research comparable street-level sales in the past 90 days",
        ]
        if goal == "schools_analysis":
            next_steps.insert(0, "Search specific property addresses in your state government's official school catchment map")
        else:
            next_steps.append("Verify school catchment zones via the relevant state education department if applicable")
            
        parsed = {
            "summary": summary,
            "research_priority": "low",
            "supports": supports,
            "risks": risks[:4],
            "unknowns": ["Specific street-level flood or fire risk", "Structural condition of individual properties", "Body corporate levies if applicable", "Specific micro-market variations"],
            "next_steps": next_steps
        }
        
        return parsed
    except Exception as e:
        # Fallback to degraded evidence-only
        return {
            "summary": "AI synthesis unavailable. Please review raw evidence.",
            "research_priority": "insufficient_evidence",
            "supports": [],
            "risks": [],
            "unknowns": ["AI Synthesis Failed"],
            "next_steps": ["Review raw data manually"]
        }
