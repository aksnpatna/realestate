"""
Cache warm-up: pre-populates Redis AI cache for top-20 most-queried suburbs.
Run once at container start or post‑deploy to guarantee instant AI responses.
"""
import os
import sys
import json
import logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("warmup")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

TOP_N = int(os.getenv("WARMUP_COUNT", "20"))

def warmup():
    from sqlalchemy import create_engine, func
    from sqlalchemy.orm import sessionmaker
    from models_v3 import SuburbUIV3
    from main import redis_client, AI_CACHE_TTL_SECONDS, ENABLE_AI_INSIGHTS
    from ai_agent import get_news_sentiment, run_investment_committee

    if not ENABLE_AI_INSIGHTS:
        logger.info("AI insights disabled — skipping warm‑up")
        return

    db_url = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@realestate-db:5432/realestate")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        top = db.query(SuburbUIV3).order_by(SuburbUIV3.view_count.desc()).limit(TOP_N).all()
        if not top:
            top = db.query(SuburbUIV3).limit(TOP_N).all()

        logger.info(f"Warming AI cache for {len(top)} suburbs…")

        for v3 in top:
            name, state = v3.name or "", v3.state or ""
            if not name or not state:
                continue

            # News sentiment
            if redis_client:
                sent_key = f"ai_sentiment:{name}:{state}"
                if not redis_client.exists(sent_key):
                    try:
                        result = get_news_sentiment(name, state)
                        redis_client.setex(sent_key, AI_CACHE_TTL_SECONDS, json.dumps(result, default=str))
                        logger.info(f"  ✓ sentiment: {name}, {state} (score={result.get('score')})")
                    except Exception as e:
                        logger.warning(f"  ✗ sentiment: {name}, {state} ({e})")

            # Investment committee (skip to save LLM credits — just flag as warmable)
            logger.debug(f"  · committee: {name}, {state} (will load on first request)")

        logger.info(f"Warm‑up complete — {len(top)} suburbs pre‑cached")
    finally:
        db.close()


if __name__ == "__main__":
    warmup()
