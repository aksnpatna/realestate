import time
import os
import sys
import logging
from datetime import datetime, timedelta

# Add backend directory to path if running outside
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Lightweight DB session — do NOT import main.py here (it pulls in FastAPI + all
# AI models which wastes 2GB+ of RAM in a cron process that only needs a DB conn)
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
_db_url = os.environ.get("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")
_engine = create_engine(_db_url, pool_size=2, max_overflow=0, pool_timeout=10)
SessionLocal = sessionmaker(bind=_engine)

from models_v3 import SuburbUIV3
from ai_agent import get_news_sentiment

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("news-updater")

# Suburbs with CBD distance < 60 mins are considered metro
METRO_CBD_MINS = 60
STALE_DAYS = 7
THROTTLE_SECONDS = 60  # Wait 60s between calls to preserve Mac Air resources

def update_metro_news():
    logger.info("Starting background news sentiment updater loop...")
    while True:
        try:
            db = SessionLocal()
            # Fetch all metro suburbs
            metro_suburbs = db.query(SuburbUIV3).filter(
                SuburbUIV3.cbd_distance_mins != None,
                SuburbUIV3.cbd_distance_mins < METRO_CBD_MINS
            ).all()

            updated_count = 0
            for suburb in metro_suburbs:
                needs_update = False
                cached = suburb.news_sentiment
                
                if not cached or not isinstance(cached, dict):
                    needs_update = True
                else:
                    fetched = cached.get("fetched_at")
                    if not fetched:
                        needs_update = True
                    else:
                        try:
                            fetched_dt = datetime.fromisoformat(fetched)
                            if (datetime.utcnow() - fetched_dt).days >= STALE_DAYS:
                                needs_update = True
                        except (ValueError, TypeError):
                            needs_update = True
                
                if needs_update:
                    logger.info(f"Fetching news sentiment for {suburb.name}, {suburb.state}...")
                    
                    try:
                        result = get_news_sentiment(suburb.name or "", suburb.state or "")
                        suburb.news_sentiment = result
                        db.commit()
                        logger.info(f"Successfully updated {suburb.name}. Sleeping for {THROTTLE_SECONDS}s...")
                        updated_count += 1
                        time.sleep(THROTTLE_SECONDS)
                    except Exception as e:
                        logger.error(f"Error fetching sentiment for {suburb.name}: {e}")
                        db.rollback()
                        time.sleep(10) # Short sleep on error
            
            db.close()
            
            if updated_count == 0:
                logger.info(f"All {len(metro_suburbs)} metro suburbs are up to date. Sleeping for 1 hour...")
                time.sleep(3600)
                
        except Exception as e:
            logger.error(f"Fatal error in background loop: {e}")
            time.sleep(60)

if __name__ == "__main__":
    update_metro_news()
