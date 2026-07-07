"""
run_v3_extract.py — CLI entry for V3 raw extraction
====================================================
python run_v3_extract.py --limit=100         # Pilot
python run_v3_extract.py --live-only --limit=500   # Metro monthly
python run_v3_extract.py --limit=2000              # Full quarterly
"""
import asyncio
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--limit", type=int, default=200, help="Max suburbs to scrape")
    p.add_argument("--live-only", action="store_true", help="Only scrape is_live (metro) suburbs")
    args = p.parse_args()

    from etl_extract_v3 import run_extraction

    # If live-only, first seed ONLY live suburbs into the raw queue
    if args.live_only:
        print("[live-only mode] Seeding only metro suburbs into extraction queue...")
        from models_v3 import SessionLocal, SuburbRawV3
        from models_v3 import engine
        from sqlalchemy import text

        db = SessionLocal()
        try:
            # Reset only non-metro pending records back to 'skipped' so they won't be picked up
            from parallel_scraper import SuburbAllModel
            non_live_ids = {r[0] for r in db.query(SuburbAllModel.id).filter(
                SuburbAllModel.is_live == False
            ).all()}

            # Don't scrape non-live suburbs — mark them if they are pending
            skipped = db.query(SuburbRawV3).filter(
                SuburbRawV3.id.in_(non_live_ids),
                SuburbRawV3.status == "pending"
            ).update({"status": "skipped_live_only"}, synchronize_session=False)
            db.commit()
            print(f"  Skipped {skipped} non-metro suburbs (live-only mode)")

            pending_live = db.query(SuburbRawV3).filter(
                SuburbRawV3.status == "pending"
            ).count()
            print(f"  Metro pending: {pending_live}")
        finally:
            db.close()

    asyncio.run(run_extraction(limit=args.limit))
