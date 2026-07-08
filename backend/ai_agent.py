import os
import re
from typing import TypedDict, Dict, Any, List
from dotenv import load_dotenv
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from tavily import TavilyClient

load_dotenv()

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
    """On-demand Tavily news search for a single suburb.
    Cached in DB — only fetches if no cached result within 24h.
    Returns: {score, label, summary, articles, fetched_at}
    """
    try:
        query = f"{suburb_name} {state_code} Australia real estate market news prices outlook 2026"
        articles = robust_search(query, max_results=8)
        
        if not articles:
            articles = []

        # Simple sentiment scoring from article titles
        positive_words = ["surge", "boom", "growth", "rising", "up", "strong", "record",
                         "increase", "high demand", "hot", "outperform", "recovery", "bull"]
        negative_words = ["fall", "drop", "decline", "crash", "slump", "weak", "fear",
                         "bust", "crisis", "affordability", "tightening", "rate hike", "bear",
                         "overvalued", "correction", "bubble"]
        
        total_score = 0
        scored_articles = 0
        summaries = []
        
        for art in articles:
            title = (art.get("title") or "").lower()
            content = (art.get("content") or "").lower()
            text = title + " " + content
            
            pos = sum(1 for w in positive_words if w in text)
            neg = sum(1 for w in negative_words if w in text)
            
            if pos + neg > 0:
                article_score = 5 + (pos - neg) * 1.5
                article_score = max(1, min(10, article_score))
                total_score += article_score
                scored_articles += 1
            
            if title:
                summaries.append(title[:120])
        
        if scored_articles > 0:
            avg_score = round(total_score / scored_articles, 1)
        else:
            avg_score = 5.0
        
        if avg_score >= 7:
            label = "Bullish"
        elif avg_score >= 4.5:
            label = "Neutral"
        else:
            label = "Bearish"
        
        return {
            "score": avg_score,
            "label": label,
            "summary": "; ".join(summaries[:3]) if summaries else "No relevant articles found.",
            "articles": len(articles),
            "fetched_at": __import__("datetime").datetime.utcnow().isoformat(),
        }
    except Exception as e:
        return {"score": 5.0, "label": "Neutral", "summary": f"Tavily API error: {str(e)[:100]}", "articles": 0, "fetched_at": None}

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
    return {
        "bull": result["bull_argument"],
        "bear": result["bear_argument"],
        "urban": result["urban_argument"],
        "verdict": result["final_verdict"],
        "playbook": result["playbook"],
        "reality_check": result["reality_check"],
        "catalysts": result.get("catalysts", [])
    }
