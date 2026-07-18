"""
v3_scheduler.py — Monthly Full-Refresh Scheduler with Change Detection
=======================================================================
Single monthly cycle covering all 13,150 suburbs.  Metro/national split
has been removed — the UI treats all suburbs equally.

Cycle (runs every 30 days):
  1. Seed    — mark raw rows >25d old as pending
  2. Extract — Playwright scrape OnTheHouse (full national)
  3. Unpack  — JSON → columnar (change-detection: only changed rows)
  4. Enrich  — Columnar → suburbs_ui_v3 (change-detection)
  5. OSM     — Worship, shelter, construction from planet_osm_*
  6. ABS     — Social housing (G37) + Building approvals (8731.0)
  7. Cadastre — data.gov.au catalogue survey
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
CYCLE_INTERVAL = 30 * 24 * 60 * 60  # 30 days
REFRESH_AGE_DAYS = 25               # re-extract if older than 25 days
EXTRACT_BATCH = 2000                 # suburbs per extraction batch

_lock_fd = None


def _acquire_lock() -> bool:
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
    cmd = [sys.executable, os.path.join(BASE_DIR, script)] + list(args)
    print(f"  → {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout:
        for line in result.stdout.strip().split("\n")[-5:]:
            print(f"    {line}")
    return result


def seed_pending_raw(min_age_days):
    """Mark suburbs_raw_v3.status = 'pending' for rows older than threshold."""
    from models_v3 import SessionLocal, SuburbRawV3

    db = SessionLocal()
    cutoff = datetime.utcnow() - timedelta(days=min_age_days)

    try:
        count = db.query(SuburbRawV3).filter(
            SuburbRawV3.status == "complete",
            (SuburbRawV3.last_scraped < cutoff) |
            (SuburbRawV3.last_scraped.is_(None)),
            SuburbRawV3.raw_json_size > 0,
        ).update({"status": "pending"}, synchronize_session=False)
        db.commit()
        total = db.query(SuburbRawV3).filter(
            SuburbRawV3.status == "pending"
        ).count()
        print(f"  Reset {count} → pending. Total pending: {total}")
    finally:
        db.close()


def mark_changed_for_unpack():
    """Set is_unpacked='pending' for rows where raw data changed since last unpack."""
    from sqlalchemy import text
    from models_v3_unpacked import engine as up_engine

    try:
        with up_engine.connect() as conn:
            result = conn.execute(text("""
                UPDATE suburbs_unpacked_v3 u
                SET is_unpacked = 'pending'
                FROM suburbs_raw_v3 r
                WHERE u.id = r.id
                  AND u.is_unpacked = 'complete'
                  AND r.status = 'complete'
                  AND r.raw_json_size IS NOT NULL
                  AND r.raw_json_size > 0
                  AND r.last_scraped > u.unpacked_at
            """))
            conn.commit()
            print(f"  Marked {result.rowcount} for re-unpack (changed since last)")
    except Exception as e:
        print(f"  mark_changed_for_unpack error: {e}")


def mark_changed_for_enrich():
    """Set is_enriched=FALSE for rows where unpacked is newer than enriched."""
    from sqlalchemy import text
    from models_v3 import engine

    with engine.connect() as conn:
        result = conn.execute(text("""
            UPDATE suburbs_ui_v3 ui
            SET is_enriched = FALSE
            FROM suburbs_unpacked_v3 u
            WHERE ui.id = u.id
              AND ui.is_enriched = TRUE
              AND u.is_unpacked = 'complete'
              AND u.unpacked_at > ui.last_updated
        """))
        conn.commit()
        print(f"  Marked {result.rowcount} for re-enrich (unpacked newer than UI)")


class V3Scheduler:

    def __init__(self):
        self.running = True
        self._job_in_progress = False
        self.last_run: datetime | None = None
        self.startup_delay = 120

    def _run_full_cycle(self):
        if self._job_in_progress:
            print(f"[{datetime.now()}] SKIPPED — another job is already running")
            return
        if not _acquire_lock():
            print(f"[{datetime.now()}] SKIPPED — lock already held by another process")
            return
        self._job_in_progress = True
        try:
            print(f"\n{'='*60}")
            print(f"[{datetime.now()}] MONTHLY: Full National Refresh (13,150 suburbs)")
            print(f"{'='*60}")

            # Step 1 — Seed
            print(f"\n  [1/7] Seeding pending raw (> {REFRESH_AGE_DAYS}d old, all suburbs)...")
            seed_pending_raw(REFRESH_AGE_DAYS)

            # Step 2 — Extract
            print(f"\n  [2/7] Extracting (full national, max {EXTRACT_BATCH}/run)...")
            _python("run_v3_extract.py", f"--limit={EXTRACT_BATCH}")

            # Step 3 — Unpack
            print("\n  [3/7] Unpacking changed raw → columnar...")
            mark_changed_for_unpack()
            _python("run_unpack.py")

            # Step 4 — Enrich
            print("\n  [4/7] Enriching changed unpacked → suburbs_ui_v3...")
            mark_changed_for_enrich()
            _python("enrich_from_unpacked.py")

            # Step 5 — OSM
            print("\n  [5/7] OSM enrichment (worship, shelter, construction, greenfield)...")
            _python("etl_osm_enrich.py")

            # Step 6 — ABS
            print("\n  [6/7] ABS social housing (G37) + building approvals (8731.0)...")
            _python("etl_abs_social_housing.py")
            _python("etl_abs_building.py")

            # Step 7 — Cadastre catalogue
            print("\n  [7/7] data.gov.au cadastre catalogue survey...")
            _python("etl_cadastre_discovery.py")

            self.last_run = datetime.now()
            print(f"\n  ✓ Monthly refresh complete")
        finally:
            self._job_in_progress = False
            _release_lock()

    def _loop(self):
        time.sleep(self.startup_delay)
        print(f"[{datetime.now()}] V3 Scheduler: monthly full refresh (13,150 suburbs)")

        while self.running:
            now = datetime.now()

            if self.last_run is None or \
               (now - self.last_run).total_seconds() >= CYCLE_INTERVAL:
                self._run_full_cycle()

            for _ in range(60):
                if not self.running:
                    break
                time.sleep(60)

    def start(self):
        t = threading.Thread(target=self._loop, daemon=True)
        t.start()

    def stop(self):
        self.running = False


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--run", action="store_true", help="Run full monthly cycle now")
    p.add_argument("--daemon", action="store_true", help="Run as background scheduler")
    args = p.parse_args()

    s = V3Scheduler()
    if args.run:
        s._run_full_cycle()
    elif args.daemon:
        s.start()
        try:
            while True:
                time.sleep(60)
        except KeyboardInterrupt:
            s.stop()
    else:
        print("Usage: python v3_scheduler.py --run | --daemon")
