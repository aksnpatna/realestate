"""
v3_scheduler.py — Tiered Update Scheduler with Change Detection
=================================================================
- Monthly: Metro/live suburbs only (~3,953 of 13,150)
- Quarterly: Full national refresh (all 13,150)
- Change detection: only re-process layers if source data changed

Layer flow:
  Layer 0  (Raw):      suburbs_raw_v3        ← Playwright scrape
  Layer 1a (Unpacked): suburbs_unpacked_v3   ← JSON→columns parse
  Layer 2  (Enriched): suburbs_ui_v3         ← SQL mapping + DQ checks

Change gates:
  Raw→Unpack:  last_scraped > unpacked_at  OR  raw_json_size differs
  Unpack→UI:   unpacked_at > ui.last_updated
"""
import os
import sys
import time
import threading
import subprocess
import fcntl
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

LOCK_FILE = os.path.join(BASE_DIR, ".v3_scheduler.lock")
MONTHLY_INTERVAL = 30 * 24 * 60 * 60
QUARTERLY_INTERVAL = 90 * 24 * 60 * 60
METRO_REFRESH_AGE_DAYS = 25
COUNTRY_REFRESH_AGE_DAYS = 80
METRO_BATCH = 500
COUNTRY_BATCH = 2000


def _acquire_lock() -> bool:
    """Try to acquire exclusive lock to prevent concurrent scheduler runs."""
    global _lock_fd
    _lock_fd = open(LOCK_FILE, 'w')
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        _lock_fd.write(str(os.getpid()))
        _lock_fd.flush()
        return True
    except (IOError, OSError):
        _lock_fd.close()
        return False


def _release_lock():
    """Release the scheduler lock."""
    global _lock_fd
    try:
        fcntl.flock(_lock_fd, fcntl.LOCK_UN)
        _lock_fd.close()
    except Exception:
        pass
    try:
        os.unlink(LOCK_FILE)
    except OSError:
        pass


def _python(script, *args):
    """Run a Python helper script as a subprocess."""
    cmd = [sys.executable, os.path.join(BASE_DIR, script)] + list(args)
    print(f"  → {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().split("\n")[-5:]:
            print(f"    {line}")
    return result


def seed_pending_raw(min_age_days, live_only=False):
    """Set suburbs_raw_v3.status = 'pending' for suburbs older than threshold.
    This triggers re-scraping on the next extraction run.
    Uses raw_json_size_is_null as a safety for fresh-but-empty records.
    """
    from models_v3 import SessionLocal, SuburbRawV3

    db = SessionLocal()
    cutoff = datetime.utcnow() - timedelta(days=min_age_days)

    try:
        filters = [SuburbRawV3.status == "complete",
                   (SuburbRawV3.last_scraped < cutoff) |
                   (SuburbRawV3.last_scraped.is_(None)),
                   SuburbRawV3.raw_json_size > 0]

        if live_only:
            # Join with suburbs_all to filter by is_live
            from parallel_scraper import SuburbAllModel
            live_ids = {r[0] for r in db.query(SuburbAllModel.id).filter(
                SuburbAllModel.is_live == True
            ).all()}
            filters.append(SuburbRawV3.id.in_(live_ids))

        count = db.query(SuburbRawV3).filter(*filters).update(
            {"status": "pending"}, synchronize_session=False
        )
        db.commit()
        label = "metro" if live_only else "all"
        total = db.query(SuburbRawV3).filter(
            SuburbRawV3.status == "pending"
        ).count()
        print(f"  [{label}] Reset {count} → pending. Total pending: {total}")
    finally:
        db.close()


def mark_changed_for_unpack(min_age_days=None, live_only=False):
    """Find raw records where data has changed since last unpack.
    Sets is_unpacked='pending' for those needing re-unpack.
    """
    from sqlalchemy import text
    from models_v3_unpacked import engine as up_engine

    try:
        sql = """
        UPDATE suburbs_unpacked_v3 u
        SET is_unpacked = 'pending'
        FROM suburbs_raw_v3 r
        WHERE u.id = r.id
          AND u.is_unpacked = 'complete'
          AND r.status = 'complete'
          AND r.raw_json_size IS NOT NULL
          AND r.raw_json_size > 0
          AND r.last_scraped > u.unpacked_at
        """
        if live_only:
            sql += """ AND r.id IN (
                SELECT sa.id FROM suburbs_all sa WHERE sa.is_live = TRUE
            )"""
        with up_engine.connect() as conn:
            result = conn.execute(text(sql))
            conn.commit()
            print(f"  Marked {result.rowcount} for re-unpack (changed since last)")
    except Exception as e:
        print(f"  mark_changed_for_unpack error: {e}")


def mark_changed_for_enrich(live_only=False):
    """Find unpacked records newer than their enriched counterparts.
    Sets is_enriched = False for those needing re-enrich.
    """
    from sqlalchemy import text
    from models_v3 import engine

    with engine.connect() as conn:
        sql = """
        UPDATE suburbs_ui_v3 ui
        SET is_enriched = FALSE
        FROM suburbs_unpacked_v3 u
        WHERE ui.id = u.id
          AND ui.is_enriched = TRUE
          AND u.is_unpacked = 'complete'
          AND u.unpacked_at > ui.last_updated
        """
        if live_only:
            sql += """ AND u.id IN (
                SELECT sa.id FROM suburbs_all sa WHERE sa.is_live = TRUE
            )"""
        result = conn.execute(text(sql))
        conn.commit()
        print(f"  Marked {result.rowcount} for re-enrich (unpacked newer than UI)")


class V3Scheduler:
    """Tiered update scheduler for the V3 pipeline."""

    def __init__(self):
        self.running = True
        self._job_in_progress = False
        self.last_monthly: datetime | None = None
        self.last_quarterly: datetime | None = None
        self.startup_delay = 120  # 2 minutes

    def _run_monthly_metro(self):
        if self._job_in_progress:
            print(f"[{datetime.now()}] SKIPPED monthly — another job is already running")
            return
        if not _acquire_lock():
            print(f"[{datetime.now()}] SKIPPED monthly — lock already held by another process")
            return
        self._job_in_progress = True
        try:
            print(f"\n{'='*60}")
            print(f"[{datetime.now()}] MONTHLY: Metro Suburb Update (~3,953 suburbs)")
            print(f"{'='*60}")

            print("\n  [Step 1/4] Seeding pending raw (metro, >{METRO_REFRESH_AGE_DAYS}d old)...")
            seed_pending_raw(METRO_REFRESH_AGE_DAYS, live_only=True)

            print(f"\n  [Step 2/4] Extracting (live-only, max {METRO_BATCH})...")
            _python("run_v3_extract.py", "--live-only", f"--limit={METRO_BATCH}")

            print("\n  [Step 3/4] Unpacking changed raw → columnar...")
            mark_changed_for_unpack(live_only=True)
            _python("run_unpack.py")

            print("\n  [Step 4/4] Enriching changed unpacked → target...")
            mark_changed_for_enrich(live_only=True)
            _python("enrich_from_unpacked.py")

            self.last_monthly = datetime.now()
            print(f"\n  ✓ Monthly metro update complete")
        finally:
            self._job_in_progress = False
            _release_lock()

    def _run_quarterly_full(self):
        if self._job_in_progress:
            print(f"[{datetime.now()}] SKIPPED quarterly — another job is already running")
            return
        if not _acquire_lock():
            print(f"[{datetime.now()}] SKIPPED quarterly — lock already held by another process")
            return
        self._job_in_progress = True
        try:
            print(f"\n{'='*60}")
            print(f"[{datetime.now()}] QUARTERLY: Full National Refresh (13,150 suburbs)")
            print(f"{'='*60}")

            print(f"\n  [Step 1/6] Seeding pending raw (all suburbs, >{COUNTRY_REFRESH_AGE_DAYS}d old)...")
            seed_pending_raw(COUNTRY_REFRESH_AGE_DAYS, live_only=False)

            print(f"\n  [Step 2/6] Extracting (full, max {COUNTRY_BATCH}/run)...")
            _python("run_v3_extract.py", f"--limit={COUNTRY_BATCH}")

            print("\n  [Step 3/6] Unpacking changed raw → columnar...")
            mark_changed_for_unpack(live_only=False)
            _python("run_unpack.py")

            print("\n  [Step 4/6] Enriching changed unpacked → target...")
            mark_changed_for_enrich(live_only=False)
            _python("enrich_from_unpacked.py")

            print("\n  [Step 5/6] OSM social-infra + growth indicators (worship/shelter/"
                   "community_centre/retirement/construction/greenfield/brownfield)...")
            _python("etl_osm_enrich.py")

            print("\n  [Step 6/7] ABS Census 2021 G37 social housing + cadastre catalogue survey...")
            _python("etl_abs_social_housing.py")
            _python("etl_cadastre_discovery.py")

            print("\n  [Step 7/7] ABS Building Approvals (8731.0) for LGA-mapped suburbs...")
            _python("etl_abs_building.py")

            self.last_quarterly = datetime.now()
            print(f"\n  ✓ Quarterly full refresh complete")
        finally:
            self._job_in_progress = False
            _release_lock()

    def _loop(self):
        time.sleep(self.startup_delay)
        print(f"[{datetime.now()}] V3 Scheduler started: monthly metro + quarterly full")

        while self.running:
            now = datetime.now()

            # Monthly metro
            if self.last_monthly is None or \
               (now - self.last_monthly).total_seconds() >= MONTHLY_INTERVAL:
                self._run_monthly_metro()

            # Quarterly full
            if self.last_quarterly is None or \
               (now - self.last_quarterly).total_seconds() >= QUARTERLY_INTERVAL:
                self._run_quarterly_full()

            # Sleep 1 hour at a time
            for _ in range(60):
                if not self.running:
                    break
                time.sleep(60)

    def start(self):
        t = threading.Thread(target=self._loop, daemon=True)
        t.start()

    def stop(self):
        self.running = False


# CLI entry point for manual runs
if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--monthly", action="store_true", help="Run monthly metro update now")
    p.add_argument("--quarterly", action="store_true", help="Run quarterly full update now")
    p.add_argument("--daemon", action="store_true", help="Run as background scheduler")
    args = p.parse_args()

    s = V3Scheduler()
    if args.monthly:
        s._run_monthly_metro()
    elif args.quarterly:
        s._run_quarterly_full()
    elif args.daemon:
        s.start()
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            s.stop()
    else:
        print("Usage: python v3_scheduler.py --monthly | --quarterly | --daemon")
