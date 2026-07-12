import os
import re
import logging
from typing import TypedDict, Dict, Any, List
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from tavily import TavilyClient

load_dotenv()

logger = logging.getLogger("uvicorn")

def get_llm():
    # 1st: NVIDIA (Llama 3.1 70B)
    if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "none":
        return ChatOpenAI(
            openai_api_key=os.getenv("NVIDIA_API_KEY"),
            openai_api_base="https://integrate.api.nvidia.com/v1",
            model_name="meta/llama-3.1-70b-instruct"
        )
    # 2nd: Groq (fast inference)
    elif os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "none":
        return ChatGroq(
            api_key=os.getenv("GROQ_API_KEY"),
            model_name="llama-3.3-70b-versatile"
        )
    # 3rd: DeepSeek
    elif os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "none":
        return ChatOpenAI(
            openai_api_key=os.getenv("DEEPSEEK_API_KEY"),
            openai_api_base="https://api.deepseek.com/v1",
            model_name="deepseek-chat"
        )
    # 3rd: OpenAI / ChatGPT
    elif os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "none":
        return ChatOpenAI(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            model_name="gpt-4o-mini"
        )
    # 4th: Local Ollama (Mac Air)
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
            return {"news_articles": "No major infrastructure or zoning news found."}
        
        snippets = [f"- {a.get('title')}: {a.get('content')}" for a in articles]
        return {"news_articles": "\n".join(snippets)}
    except Exception as e:
        return {"news_articles": f"Error fetching news: {str(e)}"}


def get_news_sentiment(suburb_name: str, state_code: str) -> dict:
    """On-demand news sentiment for a single suburb.
    Uses HuggingFace transformer for scoring, with keyword fallback.
    Cached externally via cache_utils.cached_ai decorator.
    Returns: {score, label, summary, articles, fetched_at, provider_used}
    """
    try:
        query_suburb = f"{suburb_name} {state_code} Australia real estate market news prices outlook 2026"
        query_macro = "Australia housing market RBA interest rates inflation macro outlook 2026"
        
        articles = robust_search(query_suburb, max_results=5)
        macro_articles = robust_search(query_macro, max_results=3)
        
        if not articles:
            articles = []
        if macro_articles:
            articles.extend(macro_articles)

        # Build combined text for transformer analysis
        combined_text = " ".join(
            f"{(a.get('title') or '').lower()} {(a.get('content') or '').lower()}"
            for a in articles
        )

        # Use transformer sentiment (with keyword fallback)
        from ai_sentiment import analyze_sentiment
        sentiment_result = analyze_sentiment(combined_text)
        score = sentiment_result["score"]
        label = sentiment_result["label"]
        provider = sentiment_result["provider"]

        # Collect article summaries
        summaries = []
        for art in articles:
            title = (art.get("title") or "")
            if title:
                summaries.append(title[:120])

        logger.info(
            f"[news-sentiment] {suburb_name}, {state_code}: "
            f"score={score} label={label} provider={provider} articles={len(articles)}"
        )

        return {
            "score": score,
            "label": label,
            "summary": "; ".join(summaries[:3]) if summaries else "No relevant articles found.",
            "articles": len(articles),
            "fetched_at": __import__("datetime").datetime.utcnow().isoformat(),
            "provider_used": provider,
        }
    except Exception as e:
        logger.error(f"[news-sentiment] Error: {e}")
        return {
            "score": 5.0,
            "label": "Neutral",
            "summary": f"Error: {str(e)[:100]}",
            "articles": 0,
            "fetched_at": None,
            "provider_used": "keyword",
        }

def bull_agent_node(state: CommitteeState):
    llm = get_llm()
    metrics = state['metrics']
    prompt = f"""
    You are 'The Bull', a high-yield real estate investor. Your job is to find reasons to BUY.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    
    Focus on positive indicators: Rental Yield, low Vacancy Rates, high Price-to-Rent ratio, Demographic CAGR, and if available, compare its 12-month growth against the National Vanguard Property ETF (VAP.AX) macro benchmark provided in the metrics.
    Provide a 2-sentence bullish argument.
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"bull_argument": msg.content}

def bear_agent_node(state: CommitteeState):
    llm = get_llm()
    metrics = state['metrics']
    prompt = f"""
    You are 'The Bear', a deeply conservative risk analyst. Your job is to find reasons NOT to buy.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    
    Focus on negative indicators: high Days on Market, low yield, high vacancy rates, poor affordability, or underperformance compared to the National Vanguard Property ETF (VAP.AX) macro benchmark provided in the metrics.
    Provide a 2-sentence bearish argument pointing out the highest risks.
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"bear_argument": msg.content}

def urban_planner_node(state: CommitteeState):
    llm = get_llm()
    metrics = state['metrics']
    prompt = f"""
    You are 'The Urban Planner'. You care about gentrification, lifestyle, and demographics.
    Analyze the following suburb: {state['suburb']}, {state['state']}.
    Metrics: {metrics}
    
    Focus on: ACARA ICSEA School Quality, True Population CAGR, Walk/Liveability score proxies, and Density.
    Provide a 2-sentence argument regarding the long-term desirability and gentrification potential.
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    return {"urban_argument": msg.content}

def supervisor_and_playbook_node(state: CommitteeState):
    llm = get_llm()
    prompt = f"""
    You are the Chief Investment Officer.
    You have received reports from your committee on {state['suburb']}, {state['state']}.
    
    Bull's Argument: {state['bull_argument']}
    Bear's Argument: {state['bear_argument']}
    Urban Planner's Argument: {state['urban_argument']}
    News: {state['news_articles']}
    
    Task 1: Generate a final VERDICT (Buy, Hold, or Pass).
    Task 2: Generate a 3-point Investment STRATEGY PLAYBOOK (e.g. "Cashflow Strategy", "Blue-Chip School Zone Strategy").
    Task 3: REALITY CHECK (Compare the suburb's actual data to the macro ETF baseline and media sentiment. Is the media over-hyping or under-valuing?)
    Task 4: Extract 1-3 CATALYSTS from the News (e.g. new train stations, zoning changes). If none found in News, infer 1 demographic/metric catalyst.
    
    VERDICT: [Buy / Hold / Pass]
    STRATEGY:
    1. [Point 1]
    2. [Point 2]
    3. [Point 3]
    REALITY CHECK: [1-2 sentences comparing news to reality]
    CATALYSTS:
    - [Catalyst 1]
    - [Catalyst 2]
    - [Catalyst 3]
    """
    msg = llm.invoke([SystemMessage(content=prompt)])
    
    content = msg.content
    
    verdict = "Hold"
    strategy = "Awaiting full analysis."
    reality_check = "No news available for check."
    catalysts = []
    
    try:
        verdict_match = re.search(r'VERDICT:\s*(.*?)(?=\nSTRATEGY:)', content, re.IGNORECASE | re.DOTALL)
        if verdict_match: verdict = verdict_match.group(1).strip()
        
        strategy_match = re.search(r'STRATEGY:\s*(.*?)(?=\nREALITY CHECK:)', content, re.IGNORECASE | re.DOTALL)
        if strategy_match: strategy = strategy_match.group(1).strip()
        
        reality_match = re.search(r'REALITY CHECK:\s*(.*?)(?=\nCATALYSTS:|$)', content, re.IGNORECASE | re.DOTALL)
        if reality_match: reality_check = reality_match.group(1).strip()
        
        catalysts_match = re.search(r'CATALYSTS:\s*(.*)', content, re.IGNORECASE | re.DOTALL)
        if catalysts_match:
            cat_lines = catalysts_match.group(1).strip().split('\n')
            catalysts = [line.strip('- ').strip() for line in cat_lines if line.strip()]
    except Exception:
        pass
        
    return {
        "final_verdict": verdict,
        "playbook": strategy,
        "reality_check": reality_check,
        "catalysts": catalysts
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

@cached_ai("ai_committee:{0}:{1}")
def run_investment_committee(suburb: str, state: str, metrics: Dict[str, Any], fetch_news: bool = False):
    initial_state = {
        "suburb": suburb, 
        "state": state, 
        "metrics": metrics,
        "news_articles": "",
        "bull_argument": "",
        "bear_argument": "",
        "urban_argument": "",
        "final_verdict": "",
        "playbook": "",
        "reality_check": ""
    }
    
    # If we don't want to burn Tavily credits on every click, we can bypass the news node manually here
    # But since the graph statically goes to fetch_news, the node itself handles skipping if API key is missing.
    # To restrict usage, we can just clear the API key in .env or pass a flag.
    # For now, it will fetch up to 2 results per run.
    
    result = ai_committee_app.invoke(initial_state)
    
    llm_provider = "unknown"
    if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "none":
        llm_provider = "nvidia/llama-3.1-70b"
    elif os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "none":
        llm_provider = "groq/llama-3.3-70b"
    elif os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "none":
        llm_provider = "deepseek-chat"
    elif os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "none":
        llm_provider = "openai/gpt-4o-mini"
    else:
        llm_provider = "ollama/qwen2.5:7b"
    
    return {
        "bull": result["bull_argument"],
        "bear": result["bear_argument"],
        "urban": result["urban_argument"],
        "verdict": result["final_verdict"],
        "playbook": result["playbook"],
        "reality_check": result["reality_check"],
        "catalysts": result.get("catalysts", []),
        "llm_provider": llm_provider,
    }
