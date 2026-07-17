import os
import sys
import json
from datetime import datetime, timezone
from sqlalchemy import text
from models_v3 import SessionLocal, SuburbUIV3

# High-frequency micro-scraper for volatile metrics (vacancy, DOM, stock).
# This module is a scheduler target but has no live API integration.
# It preserves existing DB data — it does NOT fabricate placeholder values.


def get_shortlisted_suburbs(db):
    """Fetch suburbs that are currently trending or shortlisted for high-frequency updates."""
    result = db.execute(text(
        "SELECT id, name, state FROM suburbs_ui_v3 "
        "WHERE is_enriched = true "
        "ORDER BY house_median_price_12m_change_pct DESC NULLS LAST LIMIT 20"
    ))
    return result.fetchall()


def run_micro_scraper():
    """
    Placeholder scheduler target.  No live scraping is performed because there is
    no integrated rate/stock/Vacancy API (SQM, Domain, or equivalent).

    Existing vacancy / DOM / stock columns in suburbs_ui_v3 are populated by the
    main ETL pipeline (etl_extract_v3 → etl_transform_v3) and are NOT overwritten.

    When a real feed is integrated, replace this stub with live API calls.
    """
    print(f"[{datetime.now()}] Micro-Scraper (V4) — skipping (no live feed integrated)")
    db = SessionLocal()
    try:
        targets = get_shortlisted_suburbs(db)
        print(f"  Found {len(targets)} high-priority shortlisted suburbs (no updates applied).")
    except Exception as e:
        print(f"  Error in micro-scraper: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    run_micro_scraper()
