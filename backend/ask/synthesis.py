import json
from typing import Dict, Any, List, Union
import openai
import os
from ask.schemas import AskIntent, EvidenceMetric, ScenarioAssumptions

def _normalize_intent(intent: Union[AskIntent, Dict[str, Any]]) -> Dict[str, Any]:
    """Accept either Pydantic AskIntent or raw dict from intent pipeline."""
    if isinstance(intent, dict):
        return intent
    return intent.model_dump(mode='json')

def synthesize_research(
    intent: Union[AskIntent, Dict[str, Any]],
    evidence: List[EvidenceMetric],
    assumptions: List[ScenarioAssumptions],
    affordability_res: Dict[str, Any]
) -> Dict[str, Any]:
    intent_data = _normalize_intent(intent)

    client = openai.Client(api_key=os.getenv("OPENAI_API_KEY", "sk-mock"))

    system_prompt = """
    You are Ask YieldSense, a strict, deterministic real estate data synthesis engine.
    You MUST output valid JSON conforming strictly to the requested schema.
    DO NOT provide financial, legal, tax, lending, or valuation advice.
    DO NOT use words like "guaranteed", "you should buy", "will definitely increase".
"""

    if intent_data.get("goal") == "general_advice":
        system_prompt += """
    The user is asking a GENERAL EDUCATIONAL question about Australian real estate (e.g., deposits, stamp duty, strategy).
    You ARE permitted to use your internal knowledge of standard Australian real estate practices to provide a helpful, educational answer.
    Explicitly add a disclaimer at the end of your summary that this is general educational information, not specific financial advice.
"""
    else:
        system_prompt += """
    CRITICAL GUARDRAIL: You MUST work strictly within the verified data and evidence provided in this prompt. 
    DO NOT use external knowledge, DO NOT hallucinate statistics, and DO NOT go to the internet to get outside data. 
    The ONLY exception is the 'AI News Sentiment' metric which is already provided to you in the prompt.
    Your entire summary MUST be supported EXCLUSIVELY by the provided Evidence and Assumptions.
"""

    evidence_json = [e.model_dump(mode='json') for e in evidence]
    assumptions_json = [a.model_dump(mode='json') for a in assumptions]

    prompt = f"""
    Intent: {json.dumps(intent_data)}
    Evidence: {json.dumps(evidence_json)}
    Assumptions & Scenarios: {json.dumps(assumptions_json)}
    Affordability Check: {json.dumps(affordability_res)}
    
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

    try:
        nvidia_key = os.getenv("NVIDIA_API_KEY")
        groq_key = os.getenv("GROQ_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY")
        llm_timeout = float(os.getenv("LLM_TIMEOUT_SEC", "15.0"))
        
        # Debug logging
        print(f"[DEBUG] NVIDIA_KEY: {'Set' if nvidia_key and nvidia_key != 'none' else 'Not set'}")
        print(f"[DEBUG] GROQ_KEY: {'Set' if groq_key else 'Not set'}")
        print(f"[DEBUG] OPENAI_KEY: {'Set' if openai_key and openai_key != 'sk-mock' else 'Not set'}")
        print(f"[DEBUG] DEEPSEEK_KEY: {'Set' if deepseek_key and deepseek_key != 'none' else 'Not set'}")

        if nvidia_key and nvidia_key != "none":
            print(f"[DEBUG] Trying NVIDIA API")
            try:
                client = openai.Client(api_key=nvidia_key, base_url="https://integrate.api.nvidia.com/v1")
                response = client.chat.completions.create(
                    model=os.getenv("NVIDIA_MODEL", "nvidia/nemotron-4-340b-instruct"),
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=llm_timeout
                )
                raw = response.choices[0].message.content
                parsed = json.loads(raw)
                print(f"[DEBUG] NVIDIA API successful")
            except Exception as e:
                print(f"[DEBUG] NVIDIA API failed: {str(e)}")
        
        if 'parsed' not in locals() and groq_key:
            print(f"[DEBUG] Trying Groq API")
            try:
                client = openai.Client(api_key=groq_key, base_url="https://api.groq.com/openai/v1")
                response = client.chat.completions.create(
                    model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instruct"),
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=llm_timeout
                )
                raw = response.choices[0].message.content
                parsed = json.loads(raw)
                print(f"[DEBUG] Groq API successful")
            except Exception as e:
                print(f"[DEBUG] Groq API failed: {str(e)}")
                
        if 'parsed' not in locals() and openai_key and openai_key != "sk-mock":
            print(f"[DEBUG] Trying OpenAI API")
            try:
                client = openai.Client(api_key=openai_key)
                response = client.chat.completions.create(
                    model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=llm_timeout
                )
                raw = response.choices[0].message.content
                parsed = json.loads(raw)
                print(f"[DEBUG] OpenAI API successful")
            except Exception as e:
                print(f"[DEBUG] OpenAI API failed: {str(e)}")
                
        if 'parsed' not in locals() and deepseek_key and deepseek_key != "none":
            print(f"[DEBUG] Trying DeepSeek API")
            try:
                client = openai.Client(api_key=deepseek_key, base_url="https://api.deepseek.com/v1")
                response = client.chat.completions.create(
                    model="deepseek-chat",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    timeout=llm_timeout
                )
                raw = response.choices[0].message.content
                parsed = json.loads(raw)
                print(f"[DEBUG] DeepSeek API successful")
            except Exception as e:
                print(f"[DEBUG] DeepSeek API failed: {str(e)}")
        else:
            # ─── Deterministic evidence-only fallback using metric_explainers ──
            from ask.metric_explainers import get_explanation
            from ask.evidence_packs import get_evidence_pack

            goal = intent_data.get("goal", "single_suburb_research")
            property_type = intent_data.get("property_type", "house")
            suburb_names = [s.get("name", s.name if hasattr(s, 'name') else "unknown")
                            for s in intent_data.get("suburbs", [])] or ["the area"]

            per_suburb_parts = []
            suburb_evidence_map: dict = {}
            for e in evidence:
                suburb_evidence_map.setdefault(e.suburb_id, []).append(e)

            for sid, evs in suburb_evidence_map.items():
                name_split = sid.rsplit("_", 1)
                name = name_split[0].replace("_", " ").title() if len(name_split) > 1 else sid

                parts = []
                # Use metric_explainers for rich, single-source NL descriptions
                for e in evs[:8]:
                    import re
                    metric_key = re.sub(r'[^a-z_]', '', e.metric.lower().replace(' ', '_'))
                    exp = get_explanation(metric_key, e.value, property_type)
                    if exp and exp.get("text"):
                        parts.append(exp["text"][:120])

                per_suburb_parts.append(f"{name}: {' | '.join(parts[:3])}" if parts else name)

            budget = intent_data.get("budget")
            income = intent_data.get("annual_income")
            aff_note = ""
            if affordability_res.get('serviceability_passed') is True:
                aff_note = (f" With a ${budget:,.0f} budget and ${income:,.0f} income, "
                            f"serviceability passes — estimated borrowing capacity is ${affordability_res.get('borrowing_capacity', 0):,.0f}.")
            elif affordability_res.get('serviceability_passed') is False:
                aff_note = (f" Serviceability is tight at ${budget:,.0f} budget with ${income:,.0f} income — "
                            f"required loan likely exceeds estimated borrowing capacity of ${affordability_res.get('borrowing_capacity', 0):,.0f}.")

            narrative = " | ".join(per_suburb_parts)
            if len(suburb_names) == 1:
                summary = f"{narrative}.{aff_note} Note: This is a verified data summary — not financial advice."
            else:
                summary = f"{' vs '.join(suburb_names)} — {narrative}.{aff_note} Note: This is a verified data summary — not financial advice."

            all_ev_ids = [e.id for e in evidence]
            supports = [{"claim": f"Verified data available for {', '.join(suburb_names)}", "evidence_ids": all_ev_ids[:6]}]
            if affordability_res.get('serviceability_passed') is True:
                supports.append({"claim": f"Serviceability passes at ${budget:,.0f} budget", "evidence_ids": []})

            risks = []
            for e in evidence:
                mlabel = e.metric.lower()
                if 'vacancy' in mlabel and e.value and isinstance(e.value, (int, float)) and float(e.value) > 3:
                    risks.append({"claim": f"Elevated vacancy ({float(e.value):.1f}%) — oversupply risk", "evidence_ids": [e.id]})
                if 'investor' in mlabel and e.value and isinstance(e.value, (int, float)) and float(e.value) > 50:
                    risks.append({"claim": f"High investor concentration ({float(e.value):.0f}%) — vulnerable to sentiment shifts", "evidence_ids": [e.id]})
                if 'yield' in mlabel and e.value and isinstance(e.value, (int, float)) and float(e.value) < 3:
                    risks.append({"claim": f"Low yield ({float(e.value):.2f}%) — significant ongoing cashflow cost", "evidence_ids": [e.id]})
                if 'news' in mlabel and e.value and str(e.value) == "Bearish":
                    risks.append({"claim": f"Bearish AI News Sentiment — potential negative catalysts in recent media", "evidence_ids": [e.id]})
                if 'news' in mlabel and e.value and str(e.value) == "Bullish":
                    supports.append({"claim": f"Bullish AI News Sentiment — positive momentum or infrastructure news detected", "evidence_ids": [e.id]})
                if 'price' in mlabel and e.value and isinstance(e.value, (int, float)) and budget and budget < float(e.value):
                    risks.append({"claim": f"Budget ${budget:,.0f} is below median price ${float(e.value):,.0f} — consider adjacent suburbs", "evidence_ids": [e.id]})

            if not risks:
                risks.append({"claim": "Market conditions and individual property condition vary — conduct physical inspection", "evidence_ids": []})
            if affordability_res.get('serviceability_passed') is False:
                risks.append({"claim": "Serviceability constraint — required loan exceeds estimated borrowing capacity", "evidence_ids": []})

            next_steps = [
                "Consult a licensed mortgage broker to confirm your exact borrowing capacity",
                "Arrange a building and pest inspection before any offer",
                "Research comparable street-level sales in the past 90 days",
                "Verify school catchment zones via the relevant state education department if applicable",
            ]

            parsed = {
                "summary": summary, "research_priority": "medium",
                "supports": supports, "risks": risks[:5],
                "unknowns": ["Specific street-level flood or fire risk", "Structural condition of individual properties",
                             "Body corporate levies if applicable", "Specific micro-market variations"],
                "next_steps": next_steps,
            }

        return parsed
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "summary": "AI synthesis unavailable. Please review the evidence below.",
            "research_priority": "insufficient_evidence",
            "supports": [], "risks": [],
            "unknowns": ["AI synthesis failed — review raw evidence manually"],
            "next_steps": ["Review evidence table manually", "Retry with a more specific query"],
        }
