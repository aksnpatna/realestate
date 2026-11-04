import os
import re
import json
import logging
from typing import TypedDict, Dict, Any, List, Literal
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from tavily import TavilyClient
from pydantic import BaseModel

load_dotenv()

logger = logging.getLogger("uvicorn")


class EvidenceClaim(BaseModel):
    claim: str
    evidence_ids: list[str] = []
    confidence: float
    status: Literal["supported", "contradicted", "unknown"]


class CommitteeVerdict(BaseModel):
    verdict: Literal["BUY", "HOLD", "PASS", "INSUFFICIENT_EVIDENCE"]
    confidence: float
    drivers: list[EvidenceClaim] = []
    risks: list[EvidenceClaim] = []
    strategy: str = ""
    reality_check: str = ""
    assumptions: list[str] = []
    unknowns: list[str] = []
    insufficient_evidence: bool = False


INSUFFICIENT_EVIDENCE_FALLBACK = CommitteeVerdict(
    verdict="INSUFFICIENT_EVIDENCE",
    confidence=0.0,
    drivers=[],
    risks=[],
    strategy="",
    reality_check="",
    assumptions=[],
    unknowns=["The AI response did not satisfy the evidence schema."],
    insufficient_evidence=True,
)

def get_llm(task: str = "general"):
    """
    Model selector routing to the local vLLM infrastructure first, falling back to cloud APIs.
    DeepSeek R1 14B AWQ is currently the unified model for all tasks on the 3060 12GB.
    """
    # If the user has started the local vLLM server on port 8000, we use it.
    # Currently pointing to the single R1 14B model for all tasks.
    local_api_base = os.getenv("LOCAL_LLM_URL", "http://localhost:8002/v1")
    
    # 1st Priority: The Local vLLM Server (DeepSeek R1 14B)
    # We use this as our unified model for realestate and asx-prediction.
    # We pass a dummy key since vLLM OpenAI API doesn't strictly need one by default.
    try:
        import requests
        # Quick check if local server is alive (optional but safe)
        requests.get(f"{local_api_base}/models", timeout=1)
        # Hybrid llama-swap aliases: "reasoner" = DeepSeek R1 14B (GGUF),
        # "fast" = Qwen2.5 7B Instruct. Only one is in VRAM at a time.
        alias = "reasoner" if task in ("asx-prediction", "reasoning") else "fast"
        alias = os.getenv("LOCAL_LLM_MODEL", alias)
        return ChatOpenAI(
            openai_api_key="sk-local",
            openai_api_base=local_api_base,
            model_name=alias,
            temperature=0.3 if task != "general" else 0.7,
            timeout=300,  # allows for model swap/load time
            max_retries=4  # gateway returns 503 + Retry-After when queue is full
        )
    except Exception:
        # Fallbacks if local vLLM is down
        pass
        
    # 2nd: KIE (Cost-effective, wide model selection)
    if os.getenv("KIE_KEY") and os.getenv("KIE_KEY") != "none":
        try:
            from kie_api import is_kie_available, get_kie_client
            if is_kie_available():
                from langchain_core.language_models.chat_models import BaseChatModel
                from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
                from langchain_core.outputs import ChatResult, ChatGeneration
                from typing import List, Any, Optional

                class KIELanguageModel(BaseChatModel):
                    model_name: str = "gpt-4o"
                    
                    @property
                    def _llm_type(self) -> str:
                        return "kie-chat"
                        
                    def _generate(self, messages: List[BaseMessage], stop: Optional[List[str]] = None, **kwargs: Any) -> ChatResult:
                        client = get_kie_client()
                        kie_messages = []
                        for msg in messages:
                            if isinstance(msg, SystemMessage):
                                kie_messages.append({"role": "system", "content": msg.content})
                            elif isinstance(msg, HumanMessage):
                                kie_messages.append({"role": "user", "content": msg.content})
                            elif isinstance(msg, AIMessage):
                                kie_messages.append({"role": "assistant", "content": msg.content})
                        
                        try:
                            result = client.chat_completion(self.model_name, kie_messages, **kwargs)
                            message = AIMessage(content=result)
                            return ChatResult(generations=[ChatGeneration(message=message)])
                        except Exception as e:
                            logger.error(f"KIE API invocation failed: {str(e)}")
                            raise e
                
                return KIELanguageModel(os.getenv("KIE_MODEL", "gpt-4o"))
        except Exception as e:
            logger.warning(f"KIE API initialization failed: {str(e)}")
    
    # 3rd: OpenAI (GPT-4o) - reliable and widely available
    elif os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "none":
        return ChatOpenAI(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model_name=os.getenv("OPENAI_MODEL", "gpt-4o")
        )
    # 4th: DeepSeek Cloud API - alternative fallback
    elif os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "none":
        return ChatOpenAI(
            openai_api_key=os.getenv("DEEPSEEK_API_KEY"),
            openai_api_base="https://api.deepseek.com/v1",
            model_name="deepseek-chat"
        )
    # 5th: Old Local Ollama Fallback (Mac Air)
    else:
        return ChatOpenAI(
            openai_api_key="none",
            openai_api_base="http://192.168.1.150:11434/v1",
            model_name="qwen2.5:7b",
            timeout=120
        )

# Limit Tavily fetch to only 1-2 suburbs (or when explicitly requested) to save API calls
tavily_key = os.getenv("TAVILY_API_KEY", "")
tavily = TavilyClient(api_key=tavily_key) if tavily_key else None

class CommitteeState(TypedDict):
    suburb: str
    state: str
    metrics: Dict[str, Any]
    news_articles: str
    source_snippets: list
    bull_argument: str
    bear_argument: str
    urban_argument: str
    final_verdict: str
    playbook: str
    reality_check: str
    catalysts: list

def robust_search(query: str, max_results: int = 5) -> list:
    """Tries DuckDuckGo (Free) first, falls back to Tavily if it fails or returns 0 results."""
    articles = []
    
    # Try DuckDuckGo first
    try:
        from ddgs import DDGS
        ddgs = DDGS()
        res = list(ddgs.text(query, backend="html", max_results=max_results))
        for item in res:
            articles.append({
                "title": item.get("title", ""),
                "content": item.get("body", "")
            })
    except Exception as e:
        print(f"DuckDuckGo search failed: {e}")
        
    if articles:
        return articles
        
    # Fallback to Tavily
    if tavily:
        try:
            res = tavily.search(query=query, search_depth="basic", max_results=max_results)
            tavily_articles = res.get("results", []) or res.get("news", [])
            for a in tavily_articles:
                articles.append({
                    "title": a.get("title", ""),
                    "content": a.get("content", "") or a.get("snippet", "")
                })
        except Exception as e:
            print(f"Tavily fallback failed: {e}")
            
    return articles

def fetch_news_node(state: CommitteeState):
    try:
        query = f"{state['suburb']} {state['state']} Australia new infrastructure projects zoning development council plan"
        articles = robust_search(query, max_results=5)
        
        if not articles:
            return {"news_articles": "No major infrastructure or zoning news found.", "source_snippets": []}
        
        snippets = [f"- {a.get('title')}: {a.get('content')}" for a in articles]
        source_snippets = [{"title": a.get("title", ""), "snippet": (a.get("content", "") or "")[:200]} for a in articles]
        return {"news_articles": "\n".join(snippets), "source_snippets": source_snippets}
    except Exception as e:
        return {"news_articles": f"Error fetching news: {str(e)}"}


def _build_macro_intelligence(
    suburb_name: str,
    state_code: str,
    combined_text: str = "",
    articles: list | None = None,
    raw_keyword_score: float = 5.0,
    metrics: Dict[str, Any] | None = None,
    raw_news_score: float | None = None,
) -> dict:
    """
    Synthesize 5-axis Macro & Catalyst Intelligence combining news text with
    suburb fundamentals (RBA rate sensitivity, state tax risk, supply dilution,
    buyer's agent pitch fact-check, and hype-vs-data divergence).
    """
    if raw_news_score is not None:
        raw_keyword_score = raw_news_score
    m = metrics or {}
    vac = m.get("vacancyRate") if m.get("vacancyRate") is not None else m.get("vacancy_rate")
    yld = m.get("houseRentalYield") or m.get("rentalYield") or m.get("rental_yield")
    g12 = (
        m.get("12mGrowthPct")
        if m.get("12mGrowthPct") is not None
        else (
            m.get("priceChange12mPct")
            if m.get("priceChange12mPct") is not None
            else m.get("house_median_price_12m_change_pct")
        )
    )
    g3 = (
        m.get("3mGrowthPct")
        if m.get("3mGrowthPct") is not None
        else (
            m.get("priceChange3mPct")
            if m.get("priceChange3mPct") is not None
            else m.get("house_median_price_3m_change_pct")
        )
    )
    pop_cagr = m.get("populationCagr") if m.get("populationCagr") is not None else m.get("population_cagr")
    unemp = m.get("unemploymentRate") if m.get("unemploymentRate") is not None else m.get("unemployment_rate")
    icsea = m.get("avgIcsea") if m.get("avgIcsea") is not None else m.get("avg_icsea")
    inv_rate = m.get("investorRate") if m.get("investorRate") is not None else m.get("investor_rate")
    hospitals_in_suburb = m.get("hospitalsCount") if m.get("hospitalsCount") is not None else m.get("hospitalCount")
    cbd_mins = m.get("cbdDistanceMins") if m.get("cbdDistanceMins") is not None else m.get("cbd_distance_mins")

    # 1. RBA Rate Sensitivity & Carry Spread
    effective_mortgage_rate = 6.2
    net_yield_est = (float(yld) * 0.72) if yld else 2.8
    carry_spread = round(net_yield_est - effective_mortgage_rate, 2)
    if (yld and float(yld) < 4.2 and (unemp or 4.0) > 5.5) or carry_spread < -3.0:
        rba_level = "High"
        rba_msg = (
            f"High vulnerability to RBA rate tightening: estimated net yield ({net_yield_est:.1f}%) "
            f"trails mortgage rates (~{effective_mortgage_rate:.1f}%) by {abs(carry_spread):.1f}%, "
            f"creating negative cashflow pressure for leveraged buyers."
        )
    elif carry_spread < -1.8:
        rba_level = "Moderate"
        rba_msg = (
            f"Moderate rate sensitivity: net rental carry spread is {carry_spread:.1f}% against "
            f"current mortgage servicing rates."
        )
    else:
        rba_level = "Low"
        rba_msg = (
            f"Resilient cashflow buffer: gross yield ({float(yld or 4.5):.1f}%) helps cushion "
            f"against RBA interest rate hikes."
        )

    # 2. State Tax & Regulatory Headwinds
    state_up = (state_code or "").upper()
    if state_up == "VIC" and (inv_rate or 25) >= 25 and (yld or 4.0) < 4.5:
        reg_level = "High"
        reg_msg = (
            "VIC Land Tax threshold ($50k) & expanded VRLT squeeze investor net yields in this bracket, "
            "increasing risk of investor stock sell-offs."
        )
    elif state_up == "VIC":
        reg_level = "Moderate"
        reg_msg = "Factor in progressive VIC land tax ($50k threshold) and minimum rental compliance standards."
    else:
        reg_level = "Low"
        reg_msg = f"Standard {state_up or 'state'} property holding and stamp duty regime applies."

    # 3. Supply Pipeline vs. Organic Demand Dilution
    has_supply_news = any(
        kw in combined_text
        for kw in ("rezone", "rezoning", "precinct structure plan", "development application", "subdivision", "land release", "new estate")
    )
    if (vac and float(vac) >= 3.5) and (has_supply_news or (pop_cagr is not None and float(pop_cagr) < 1.0)):
        supply_level = "High"
        supply_msg = (
            f"Supply dilution warning: planning/development activity detected while vacancy is already elevated "
            f"({float(vac):.1f}%) and organic population growth is slow ({float(pop_cagr or 0):.2f}%/yr)."
        )
    elif vac and float(vac) >= 3.0:
        supply_level = "Moderate"
        supply_msg = f"Loosening rental supply ({float(vac):.1f}% vacancy); new dwelling completions may take longer to absorb."
    else:
        supply_level = "Low"
        supply_msg = (
            f"Tight rental absorption ({float(vac):.1f}% vacancy) supports existing dwelling values."
            if vac is not None else "No major oversupply catalysts detected in current news."
        )

    # 4. Buyer's Agent Pitch / Amenity Reality Check
    warnings = []
    if hospitals_in_suburb == 0:
        warnings.append(
            f"Hospital Halo Check: 0 tertiary hospitals inside {suburb_name} boundary (local clinics/pharmacies only; verify distance to regional base hospital)."
        )
    if icsea is not None and float(icsea) < 970:
        warnings.append(
            f"School Quality Check: Suburb average ACARA ICSEA is {float(icsea):.0f} (below national median of 1,000) — unlikely to command school-zone price premiums."
        )
    if vac is not None and float(vac) >= 3.5:
        warnings.append(
            f"Rental Demand Check: Vacancy rate is {float(vac):.2f}% (above 2-3% healthy band), contradicting 'high tenant demand' claims."
        )
    if pop_cagr is not None and float(pop_cagr) < 1.0:
        warnings.append(
            f"Demographic Growth Check: Annualized population growth is only {float(pop_cagr):.2f}%/yr."
        )
    if unemp is not None and float(unemp) >= 6.0:
        warnings.append(
            f"Local Employment Check: Unemployment is {float(unemp):.1f}% (above ~4.1% national benchmark), limiting local owner-occupier bidding power."
        )

    # 5. Media Hype vs. Market Data Divergence
    is_falling_or_distressed = (
        (g12 is not None and float(g12) < 0)
        or (g3 is not None and float(g3) < -3.0)
        or (vac is not None and float(vac) >= 3.5)
    )
    hype_divergence = bool(raw_keyword_score >= 6.0 and is_falling_or_distressed)
    if hype_divergence:
        divergence_msg = (
            f"⚠️ Hype vs. Data Divergence: Online articles use bullish language, but realized market data shows "
            f"12m price change of {float(g12 or 0):.2f}%, 3m change of {float(g3 or 0):.2f}%, and {float(vac or 0):.2f}% vacancy."
        )
    elif is_falling_or_distressed:
        divergence_msg = (
            f"Market fundamentals show headwinds (12m: {float(g12 or 0):.2f}%, 3m: {float(g3 or 0):.2f}%, vacancy: {float(vac or 0):.2f}%)."
        )
    else:
        divergence_msg = "Media sentiment is broadly aligned with observed price and vacancy fundamentals."

    return {
        "rba_rate_sensitivity": {
            "level": rba_level,
            "net_carry_spread_pct": carry_spread,
            "analysis": rba_msg,
            "summary": rba_msg,
        },
        "regulatory_tax_risk": {
            "level": reg_level,
            "analysis": reg_msg,
            "summary": reg_msg,
        },
        "supply_dilution_risk": {
            "level": supply_level,
            "analysis": supply_msg,
            "summary": supply_msg,
        },
        "amenity_claim_check": {
            "status": "High Risk" if len(warnings) >= 3 else ("Caution" if warnings else "Verified"),
            "risk_level": "HIGH_PITCH_RISK" if len(warnings) >= 3 else ("MODERATE_PITCH_RISK" if warnings else "VERIFIED"),
            "warnings": warnings,
        },
        "hype_vs_data_divergence": {
            "detected": hype_divergence,
            "level": "SEVERE" if hype_divergence else ("ELEVATED" if is_falling_or_distressed else "ALIGNED"),
            "analysis": divergence_msg,
            "summary": divergence_msg,
        },
    }


def get_news_sentiment(suburb_name: str, state_code: str, metrics: Dict[str, Any] | None = None) -> dict:
    """On-demand news & macro intelligence for a single suburb.
    Combines suburb-level news with RBA/macro headwinds and cross-checks
    media sentiment against quantitative suburb fundamentals.
    Returns: {score, label, summary, articles, fetched_at, provider_used, explanation, macro_intelligence, article_snippets}
    """
    try:
        query_suburb = f"{suburb_name} {state_code} Australia real estate market news prices vacancy outlook 2026"
        articles = robust_search(query_suburb, max_results=3)

        # Also fetch macro/state property policy & RBA rate context when few suburb articles exist
        macro_query = f"RBA interest rate {state_code} Australia property market land tax investor vacancy 2026"
        macro_articles = robust_search(macro_query, max_results=2)
        all_articles = articles + [a for a in macro_articles if a not in articles]

        # Build combined text for sentiment + keyword analysis
        combined_text = " ".join(
            f"{(a.get('title') or '').lower()} {(a.get('content') or '').lower()}"
            for a in all_articles
        )

        from ai_sentiment import _keyword_sentiment, _extract_keywords
        raw_score = _keyword_sentiment(combined_text)
        explanation = _extract_keywords(combined_text)

        macro_intel = _build_macro_intelligence(
            suburb_name, state_code, combined_text, all_articles, raw_score, metrics
        )

        # Reality-adjusted score: prevent spruiker blog keywords from producing a
        # "Bullish" score when the suburb is actively falling with high vacancy.
        score = raw_score
        if metrics:
            vac = metrics.get("vacancyRate") if metrics.get("vacancyRate") is not None else metrics.get("vacancy_rate")
            g12 = metrics.get("12mGrowthPct") if metrics.get("12mGrowthPct") is not None else metrics.get("house_median_price_12m_change_pct")
            g3 = metrics.get("3mGrowthPct") if metrics.get("3mGrowthPct") is not None else metrics.get("house_median_price_3m_change_pct")
            if vac is not None and float(vac) >= 3.5:
                score -= 1.5
            if g12 is not None and float(g12) < 0:
                score -= 1.0
            if g3 is not None and float(g3) < -5.0:
                score -= 1.0
            score = max(1.0, min(10.0, round(score, 1)))

        if score >= 7:
            label = "Bullish"
        elif score >= 4.5:
            label = "Neutral"
        else:
            label = "Bearish"

        # Collect article summaries
        summaries = []
        article_snippets = []
        for art in all_articles[:4]:
            title = (art.get("title") or "")
            snippet = (art.get("content") or "")[:180]
            if title:
                summaries.append(title[:120])
                article_snippets.append({"title": title[:120], "snippet": snippet})

        logger.info(
            f"[news-sentiment] {suburb_name}, {state_code}: "
            f"score={score} (raw={raw_score}) label={label} provider=keyword+macro articles={len(all_articles)}"
        )

        return {
            "score": score,
            "raw_media_score": raw_score,
            "label": label,
            "summary": "; ".join(summaries[:3]) if summaries else "No relevant articles found.",
            "articles": len(all_articles),
            "article_snippets": article_snippets,
            "explanation": explanation,
            "macro_intelligence": macro_intel,
            "fetched_at": __import__("datetime").datetime.utcnow().isoformat(),
            "provider_used": "keyword",
        }
    except Exception as e:
        logger.error(f"[news-sentiment] Error: {e}")
        return {
            "score": 5.0,
            "label": "Neutral",
            "summary": f"Error: {str(e)[:100]}",
            "articles": 0,
            "explanation": [],
            "macro_intelligence": _build_macro_intelligence(suburb_name, state_code, "", [], 5.0, metrics),
            "fetched_at": None,
            "provider_used": "keyword",
        }

AUSTRALIAN_MARKET_BENCHMARKS = """
MANDATORY AUSTRALIAN REAL ESTATE BENCHMARKS (DO NOT VIOLATE):
- Vacancy Rate: <1.5% is tight/undersupplied (Bullish); 1.5%-2.9% is balanced; 3.0%-3.9% is elevated oversupply (Bearish); >=4.0% is severe rental distress/oversupply (Strongly Bearish — NEVER describe >=3.5% vacancy as "low" or "tight").
- Price Momentum: 12mGrowthPct < 0% or 3mGrowthPct < -3.0% indicates an active price correction/downturn.
- School Quality (avgIcsea): 1000 is the Australian national median. <970 is below-average socio-economic advantage.
- Population Growth (populationCagr): <1.0%/yr is slow/stagnant; 1.0%-2.0%/yr is moderate; >2.0%/yr is strong.
- Unemployment Rate: >5.5% indicates local economic fragility compared to the ~4.1% national benchmark.
"""

def bull_agent_node(state: CommitteeState):
    llm = get_llm(task="realestate")
    metrics = state['metrics']
    prompt = f"""
    You are 'The Bull'. Your job is to find the most compelling reasons to BUY this property market.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    {AUSTRALIAN_MARKET_BENCHMARKS}
    If the metrics contain insufficient evidence to make an argument, state exactly "INSUFFICIENT_EVIDENCE". Do not invent reasons or catalysts not present in the data.
    Otherwise, provide a 2-sentence argument focused on Yield, Population Growth, and Days on Market.
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"bull_argument": msg.content}

def bear_agent_node(state: CommitteeState):
    llm = get_llm(task="realestate")
    metrics = state['metrics']
    prompt = f"""
    You are 'The Bear'. Your job is to find the most compelling reasons to AVOID this property market.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    {AUSTRALIAN_MARKET_BENCHMARKS}
    If the metrics contain insufficient evidence to make an argument, state exactly "INSUFFICIENT_EVIDENCE". Do not invent risks not present in the data.
    Otherwise, provide a 2-sentence argument focused on Supply, Vacancy (flagging >=3.0% as oversupplied), negative 3m/12m price momentum, and Affordability/Rate constraints.
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"bear_argument": msg.content}

def urban_planner_node(state: CommitteeState):
    llm = get_llm(task="realestate")
    metrics = state['metrics']
    prompt = f"""
    You are 'The Urban Planner'. You care about gentrification, lifestyle, and demographics.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    {AUSTRALIAN_MARKET_BENCHMARKS}
    Focus on: ACARA ICSEA School Quality (avgIcsea vs 1000 national average), True Annual Population CAGR, Walk/Liveability score proxies, Social Housing %, and Density.
    Synthesize the available metrics to provide a 2-sentence argument regarding long-term desirability and gentrification potential.
    Do not hallucinate amenities (e.g. do not claim a hospital exists if hospitalsCount is 0), and never call a vacancy rate >=3.5% "low".
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"urban_argument": msg.content}

def supervisor_and_playbook_node(state: CommitteeState):
    llm = get_llm(task="realestate")
    
    past_context = ""
    try:
        from committee_memory import retrieve_similar
        past_context = retrieve_similar(state["suburb"], state["state"], state["metrics"])
    except Exception:
        pass
    
    prompt = f"""
    You are the Chief Investment Officer.
    You have received reports from your committee on {state['suburb']}, {state['state']}.
    Metrics: {state['metrics']}
    {AUSTRALIAN_MARKET_BENCHMARKS}
    {past_context}
    
    Bull's Argument: {state['bull_argument']}
    Bear's Argument: {state['bear_argument']}
    Urban Planner's Argument: {state['urban_argument']}
    News: {state['news_articles']}
    
    CRITICAL RULE: If vacancyRate >= 3.5% AND 12mGrowthPct < 0%, the suburb is experiencing both price decline and rental oversupply — your verdict MUST be "HOLD" or "PASS", NEVER "BUY".
    
    Return a single JSON object with no additional text. The JSON must have exactly these fields:
    {{
      "verdict": "BUY" | "HOLD" | "PASS" | "INSUFFICIENT_EVIDENCE",
      "confidence": 0.0 to 1.0,
      "drivers": [
        {{"claim": "...", "evidence_ids": ["..."], "confidence": 0.0 to 1.0, "status": "supported" | "contradicted" | "unknown"}}
      ],
      "risks": [
        {{"claim": "...", "evidence_ids": ["..."], "confidence": 0.0 to 1.0, "status": "supported" | "contradicted" | "unknown"}}
      ],
      "strategy": "3-point investment strategy text",
      "reality_check": "1-2 sentence comparison of news vs data",
      "assumptions": ["assumption 1", "assumption 2"],
      "unknowns": ["unknown 1", "unknown 2"],
      "insufficient_evidence": true | false
    }}

    Each claim in drivers and risks MUST reference specific metrics or data from the input.
    If you cannot support a claim with input data, set insufficient_evidence to true and use verdict INSUFFICIENT_EVIDENCE.
    Do not invent claims not present in the supplied data.
    evidence_ids should reference fields from the metrics (e.g. "vacancy_rate:2026", "median_price:2026").
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    
    content = msg.content.strip()
    
    try:
        # Handle DeepSeek R1 reasoning tags
        content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

        if content.startswith("```json"):
            content = content.split("```json")[1].split("```")[0].strip()
        elif content.startswith("```"):
            content = content.split("```")[1].split("```")[0].strip()
        
        data = json.loads(content)
        validated = CommitteeVerdict(**data)
        
        # Deterministic guardrail against "Value Trap BUY" hallucinations
        m = state.get("metrics") or {}
        vac = m.get("vacancyRate") if m.get("vacancyRate") is not None else m.get("vacancy_rate")
        g12 = m.get("12mGrowthPct") if m.get("12mGrowthPct") is not None else m.get("house_median_price_12m_change_pct")
        g3 = m.get("3mGrowthPct") if m.get("3mGrowthPct") is not None else m.get("house_median_price_3m_change_pct")
        if validated.verdict == "BUY" and vac is not None and float(vac) >= 3.5 and (
            (g12 is not None and float(g12) < 0) or (g3 is not None and float(g3) < -4.0)
        ):
            validated.verdict = "PASS" if float(vac) >= 4.2 else "HOLD"
            validated.reality_check = (
                f"Guardrail Override ({validated.verdict}): Elevated vacancy ({float(vac):.2f}%) combined with "
                f"falling prices (12m: {float(g12 or 0):.2f}%, 3m: {float(g3 or 0):.2f}%) signals a Value Trap. "
                + (validated.reality_check or "")
            ).strip()

        catalysts = [d.claim for d in validated.drivers]
        
        return {
            "final_verdict": validated.verdict,
            "playbook": validated.strategy,
            "reality_check": validated.reality_check,
            "catalysts": catalysts,
            "_structured_verdict": validated.model_dump(),
        }
    except Exception as e:
        logger.warning(f"[supervisor] Schema validation failed for {state['suburb']}: {e}")
        return {
            "final_verdict": "INSUFFICIENT_EVIDENCE",
            "playbook": "The AI response did not satisfy the evidence schema.",
            "reality_check": "Response validation failed; cannot produce a reliable verdict.",
            "catalysts": [],
            "_structured_verdict": INSUFFICIENT_EVIDENCE_FALLBACK.model_dump(),
        }

# Build LangGraph for the Committee
committee_graph = StateGraph(CommitteeState)
committee_graph.add_node("fetch_news", fetch_news_node)
committee_graph.add_node("bull_agent", bull_agent_node)
committee_graph.add_node("bear_agent", bear_agent_node)
committee_graph.add_node("urban_planner", urban_planner_node)
committee_graph.add_node("supervisor", supervisor_and_playbook_node)

committee_graph.set_entry_point("fetch_news")
committee_graph.add_edge("fetch_news", "bull_agent")
committee_graph.add_edge("bull_agent", "bear_agent")
committee_graph.add_edge("bear_agent", "urban_planner")
committee_graph.add_edge("urban_planner", "supervisor")
committee_graph.add_edge("supervisor", END)

ai_committee_app = committee_graph.compile()

from cache_utils import cached_ai

# Load policy rules for playbook generation
import json as _json
from pathlib import Path as _Path

_policy_path = _Path(__file__).parent / "policy_rules.json"
POLICY_RULES = []
if _policy_path.exists():
    try:
        POLICY_RULES = _json.loads(_policy_path.read_text()).get("rules", [])
    except Exception:
        pass


FIELD_ALIASES = {
    "vacancy_rate": ["vacancy_rate", "vacancyRate"],
    "rental_yield": ["rental_yield", "houseRentalYield", "rentalYield", "grossYield", "gross_rental_yield"],
    "population_cagr": ["population_cagr", "populationCagr", "populationCAGR"],
    "12m_growth_pct": ["12m_growth_pct", "12mGrowthPct", "priceChange12mPct", "houseMedianPrice12mChangePct", "house_median_price_12m_change_pct"],
    "flood_risk": ["flood_risk", "floodRisk"],
    "bushfire_zone": ["bushfire_zone", "bushfireZone"],
    "heritage_listed": ["heritage_listed", "heritageListed"],
}


def _evaluate_policy_rules(metrics: Dict[str, Any], state_code: str) -> list:
    """Evaluate policy rules against a suburb's metrics. Returns list of applicable messages."""
    applicable = []
    for rule in POLICY_RULES:
        cond = rule.get("condition", {})
        field = cond.get("field", "")
        value = cond.get("value")
        op = cond.get("operator", "equals")

        actual = None
        if field == "state":
            actual = state_code
        else:
            for candidate_key in FIELD_ALIASES.get(field, [field]):
                if metrics.get(candidate_key) is not None:
                    actual = metrics.get(candidate_key)
                    break

        if actual is None:
            continue

        match = False
        if op == "equals":
            match = actual == value
        elif op == "gte":
            match = float(actual) >= float(value)
        elif op == "lt":
            match = float(actual) < float(value)

        if match:
            applicable.append({
                "rule_id": rule["id"],
                "action": rule.get("action", "info"),
                "message": rule["message"],
            })
    return applicable


@cached_ai("ai_committee:{0}:{1}")
def run_investment_committee(suburb: str, state: str, metrics: Dict[str, Any], fetch_news: bool = False):
    """
    Run the multi-agent LangGraph investment committee for a suburb.

    Pipeline (4 sequential agents → Supervisor):
        1. fetch_news      — DuckDuckGo/Tavily search for infrastructure/zoning news
        2. bull_agent      — 🐂 "Anna": finds reasons to BUY (yield, growth, demand)
        3. bear_agent      — 🐻 "Alex": finds reasons to AVOID (risk, affordability)
        4. urban_planner   — 🏙️: evaluates demographics, schools, gentrification
        5. supervisor      — 📋 CIO: final Buy/Hold/Pass verdict + playbook + reality check

    Args:
        suburb: Suburb name (e.g. "Parramatta").
        state: State code (e.g. "NSW").
        metrics: Dict of V3 market metrics (median_price, yield, vacancy, etc.).
        fetch_news: When True, enables live web search (default: False to save credits).

    Returns:
        dict with keys:
            verdict (str)      — "BUY", "HOLD", or "PASS"
            playbook (str)     — 3-point investment strategy
            reality_check (str)— comparison of media vs. actual data
            bull (str)         — bullish argument text
            bear (str)         — bearish argument text
            urban (str)        — urban planner argument text
            catalysts (list)   — extracted infrastructure/policy catalysts
            source_snippets (list) — article titles+snippets backing the analysis
            llm_provider (str) — which LLM generated the result (nvidia/groq/deepseek/openai/ollama)

    Caching: Redis key "ai_committee:{suburb}:{state}" with AI_CACHE_TTL (7 days).
    LLM selection: Priority order → NVIDIA → Groq → DeepSeek → OpenAI → Ollama.
    Env vars: NVIDIA_API_KEY, GROQ_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, AI_CACHE_TTL.
    """
    initial_state = {
        "suburb": suburb, 
        "state": state, 
        "metrics": metrics,
        "news_articles": "",
        "source_snippets": [],
        "bull_argument": "",
        "bear_argument": "",
        "urban_argument": "",
        "final_verdict": "",
        "playbook": "",
        "reality_check": ""
    }

    # Dynamic agent routing: skip agents that have nothing useful to say
    from agent_router import route_agents
    agents, skipped = route_agents(metrics)

    # Build a fresh graph with only the selected agents
    dynamic_graph = StateGraph(CommitteeState)
    dynamic_graph.add_node("fetch_news", fetch_news_node)
    dynamic_graph.add_node("supervisor", supervisor_and_playbook_node)

    for agent_name in agents:
        if agent_name == "bull_agent":
            dynamic_graph.add_node("bull_agent", bull_agent_node)
        elif agent_name == "bear_agent":
            dynamic_graph.add_node("bear_agent", bear_agent_node)
        elif agent_name == "urban_planner":
            dynamic_graph.add_node("urban_planner", urban_planner_node)

    dynamic_graph.set_entry_point("fetch_news")
    prev = "fetch_news"
    for agent_name in agents:
        dynamic_graph.add_edge(prev, agent_name)
        prev = agent_name
    dynamic_graph.add_edge(prev, "supervisor")
    dynamic_graph.add_edge("supervisor", END)

    dynamic_app = dynamic_graph.compile()

    from observability import record_committee_call
    record_committee_call()

    if skipped:
        logger.info(f"[committee] {suburb}: skipped agents → {', '.join(skipped)}")

    result = dynamic_app.invoke(initial_state)
    
    # Risk-adjusted verdict via Monte Carlo simulation
    risk_assessment = {}
    try:
        from risk_engine import compute_risk_rating
        price = metrics.get("houseMedianPrice") or metrics.get("medianPrice") or 800000
        yld = (
            metrics.get("houseRentalYield")
            or metrics.get("rentalYield")
            or (metrics.get("houseMedianRent", 0) * 52 / price * 100 if metrics.get("houseMedianRent") else 4.0)
            or 4.0
        )
        gs = metrics.get("growthScore") or 50
        vac = metrics.get("vacancyRate") if metrics.get("vacancyRate") is not None else metrics.get("vacancy_rate")
        g12 = metrics.get("12mGrowthPct") if metrics.get("12mGrowthPct") is not None else metrics.get("house_median_price_12m_change_pct")
        g3 = metrics.get("3mGrowthPct") if metrics.get("3mGrowthPct") is not None else metrics.get("house_median_price_3m_change_pct")
        risk_assessment = compute_risk_rating(
            price,
            yld,
            gs,
            vacancy_rate=vac,
            price_12m_change_pct=g12,
            price_3m_change_pct=g3,
        )
    except Exception as e:
        risk_assessment = {"risk_rating": "Unavailable", "error": str(e)[:100]}
    
    # Policy-aware playbook: evaluate planning rules
    policy_warnings = _evaluate_policy_rules(metrics, state)

    # Store analysis for future few-shot retrieval
    try:
        from committee_memory import store_analysis
        store_analysis(suburb, state, metrics, {
            "verdict": result.get("final_verdict", ""),
            "bull": result.get("bull_argument", ""),
            "bear": result.get("bear_argument", ""),
            "urban": result.get("urban_argument", ""),
            "playbook": result.get("playbook", ""),
            "risk_assessment": risk_assessment,
        })
    except Exception as e:
        logger.warning(f"[memory] Failed to store: {e}")

    llm_provider = "unknown"
    if os.getenv("KIE_KEY") and os.getenv("KIE_KEY") != "none":
        llm_provider = f"kie/{os.getenv('KIE_MODEL', 'gpt-4o')}"
    elif os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "none":
        llm_provider = "nvidia/llama-3.1-70b"
    elif os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "none":
        llm_provider = "groq/llama-3.3-70b"
    elif os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "none":
        llm_provider = "deepseek-chat"
    elif os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "none":
        llm_provider = "openai/gpt-4o-mini"
    else:
        llm_provider = "ollama/qwen2.5:7b"

    structured_verdict = result.get("_structured_verdict", {})
    
    return {
        "bull": result["bull_argument"],
        "bear": result["bear_argument"],
        "urban": result["urban_argument"],
        "verdict": result["final_verdict"],
        "playbook": result["playbook"],
        "reality_check": result["reality_check"],
        "catalysts": result.get("catalysts", []),
        "source_snippets": result.get("source_snippets", []),
        "risk_assessment": risk_assessment,
        "policy_warnings": policy_warnings,
        "llm_provider": llm_provider,
        "structured_verdict": structured_verdict,
        "prompt_version": "ciov2-json-schema-1.0",
        "agents_run": agents,
        "agents_skipped": skipped,
    }
