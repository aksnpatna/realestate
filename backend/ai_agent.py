import os
from dotenv import load_dotenv
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from tavily import TavilyClient

load_dotenv()

def get_llm():
    if os.getenv("NVIDIA_API_KEY"):
        return ChatOpenAI(
            openai_api_key=os.getenv("NVIDIA_API_KEY"),
            openai_api_base="https://integrate.api.nvidia.com/v1",
            model_name="meta/llama-3.1-70b-instruct"
        )
    elif os.getenv("GROQ_API_KEY"):
        return ChatGroq(
            api_key=os.getenv("GROQ_API_KEY"),
            model_name="llama3-70b-8192"
        )
    else:
        return ChatOpenAI(
            openai_api_key="none",
            openai_api_base="http://host.docker.internal:11434/v1",
            model_name="qwen2.5:7b"
        )

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY", ""))

class AgentState(TypedDict):
    suburb: str
    state: str
    news_articles: str
    sentiment_score: str
    summary: str

def fetch_news(state: AgentState):
    query = f"real estate property market news {state['suburb']} {state['state']} Australia"
    try:
        response = tavily.search(query=query, search_depth="basic", max_results=3)
        articles = "\n".join([f"- {r['title']}: {r['content']}" for r in response.get("results", [])])
    except Exception as e:
        articles = "No news found or error fetching news."
    return {"news_articles": articles}

def analyze_sentiment(state: AgentState):
    llm = get_llm()
    prompt = f"""
    You are an expert Australian real estate AI analyst.
    Analyze the following recent news snippets for the suburb of {state['suburb']}, {state['state']}.
    
    News Snippets:
    {state['news_articles']}
    
    Determine the overall market sentiment for real estate investment in this suburb.
    Your output MUST strictly be in this format:
    SENTIMENT: [Bullish/Bearish/Neutral] (Score out of 10.0)
    SUMMARY: [One sentence summarizing the market mood]
    
    Example:
    SENTIMENT: Bullish (8.5)
    SUMMARY: Strong infrastructure growth and rising demand point to positive capital growth.
    """
    
    msg = llm.invoke([SystemMessage(content=prompt)])
    content = msg.content
    
    sentiment = "Neutral (5.0)"
    summary = "No strong sentiment detected."
    
    import re
    sentiment = "Neutral (5.0)"
    summary = "No strong sentiment detected."
    
    # Try more robust parsing
    sentiment_match = re.search(r'SENTIMENT:\s*(.*?(?=\s*SUMMARY:|$))', content, re.IGNORECASE | re.DOTALL)
    if sentiment_match:
        sentiment = sentiment_match.group(1).strip()
        
    summary_match = re.search(r'SUMMARY:\s*(.*)', content, re.IGNORECASE | re.DOTALL)
    if summary_match:
        summary = summary_match.group(1).strip()
    
    # Fallback if both matched but sentiment contains SUMMARY
    if "SUMMARY:" in sentiment:
        parts = sentiment.split("SUMMARY:")
        sentiment = parts[0].strip()
        summary = parts[1].strip()
        
    return {"sentiment_score": sentiment, "summary": summary}

# Build LangGraph
graph_builder = StateGraph(AgentState)
graph_builder.add_node("fetch_news", fetch_news)
graph_builder.add_node("analyze_sentiment", analyze_sentiment)

graph_builder.set_entry_point("fetch_news")
graph_builder.add_edge("fetch_news", "analyze_sentiment")
graph_builder.add_edge("analyze_sentiment", END)

ai_app = graph_builder.compile()

def get_suburb_sentiment(suburb: str, state: str):
    initial_state = {"suburb": suburb, "state": state}
    result = ai_app.invoke(initial_state)
    return {
        "sentiment": result.get("sentiment_score"),
        "summary": result.get("summary")
    }
