import time
import os
import sys
import logging
from datetime import datetime
from sqlalchemy import text

# Add backend directory to path if running outside
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import SessionLocal
from ai_agent import robust_search, get_llm
from ai_sentiment import analyze_sentiment
from langchain_core.messages import SystemMessage

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("global-news-updater")

# Map of topic keys to search queries
MACRO_TOPICS = {
    "interest_rates": "RBA cash rate decision inflation property market impact Australia news",
    "supply_demand": "Australia housing market demand supply shortage building approvals news",
    "infrastructure": "Australia major infrastructure projects transport property market impact news",
    "clearance_rates": "Australia weekend auction clearance rates property market momentum news",
    "government_policies": "Australia government housing policies grants first home buyers investors news"
}

def generate_summary(topic: str, articles: list) -> str:
    """Uses LLM to synthesize a punchy 2-sentence summary of the news."""
    llm = get_llm()
    if not llm:
        return "; ".join([a.get("title", "") for a in articles[:2]])

    context = "\n".join([f"- {a.get('title')}: {a.get('content')}" for a in articles[:3]])
    prompt = f"""
    You are an expert Australian real estate market analyst. 
    Synthesize the following recent news articles into a concise, punchy 2-sentence summary for a homepage dashboard.
    Topic focus: {topic.replace('_', ' ').title()}
    News Context:
    {context}
    
    Do not use introductory phrases like "Here is a summary". Just write the 2 sentences directly. Keep it highly relevant to property buyers and investors.
    """
    
    try:
        msg = llm.invoke([SystemMessage(content=prompt)])
        return msg.content.strip()
    except Exception as e:
        logger.error(f"LLM Error generating summary for {topic}: {e}")
        return "; ".join([a.get("title", "") for a in articles[:2]])

def update_global_news():
    logger.info("Starting global market news update...")
    
    db = SessionLocal()
    
    for topic_key, query in MACRO_TOPICS.items():
        logger.info(f"Fetching news for {topic_key}...")
        
        articles = robust_search(query, max_results=5)
        if not articles:
            logger.warning(f"No articles found for {topic_key}")
            continue
            
        # Analyze sentiment
        combined_text = " ".join(f"{(a.get('title') or '').lower()} {(a.get('content') or '').lower()}" for a in articles)
        sentiment_result = analyze_sentiment(combined_text)
        score = sentiment_result["score"]
        label = sentiment_result["label"]
        
        # Generate summary
        summary = generate_summary(topic_key, articles)
        
        # Upsert into DB
        try:
            sql = text("""
                INSERT INTO global_market_news (topic, sentiment_label, sentiment_score, summary, articles_analyzed, last_updated)
                VALUES (:topic, :label, :score, :summary, :articles, CURRENT_TIMESTAMP)
                ON CONFLICT (topic) DO UPDATE SET 
                    sentiment_label = EXCLUDED.sentiment_label,
                    sentiment_score = EXCLUDED.sentiment_score,
                    summary = EXCLUDED.summary,
                    articles_analyzed = EXCLUDED.articles_analyzed,
                    last_updated = CURRENT_TIMESTAMP
            """)
            db.execute(sql, {
                "topic": topic_key,
                "label": label,
                "score": score,
                "summary": summary,
                "articles": len(articles)
            })
            db.commit()
            logger.info(f"Successfully updated {topic_key}")
        except Exception as e:
            logger.error(f"DB Error updating {topic_key}: {e}")
            db.rollback()
            
        time.sleep(10) # Throttle search requests
        
    db.close()
    logger.info("Finished global market news update.")

if __name__ == "__main__":
    update_global_news()
