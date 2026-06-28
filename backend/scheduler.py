#!/usr/bin/env python3
"""
Background scheduler for suburb data updates.
- Daily: refresh metrics (population growth, prices, infrastructure)
- Monthly: enrich POIs/schools via Overpass API + metrics refresh
Runs inside the same Docker container as the API.
"""

import os
import sys
import time
import threading
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)


class UpdateScheduler:
    """
    Daily metrics refresh (fast, no external API calls for most suburbs).
    Monthly full enrichment including Overpass POI/school data (slow).
    """

    def __init__(self):
        self.running = True
        self.last_metrics: datetime | None = None
        self.last_enrichment: datetime | None = None
        self.startup_delay = 30
        self.metrics_interval = 24 * 60 * 60       # daily
        self.enrichment_interval = 30 * 24 * 60 * 60  # monthly
        self._thread: threading.Thread | None = None

    def _run_with_lock(self, label: str, fn):
        lock_path = os.path.join(BASE_DIR, ".pipeline_lock")
        if os.path.exists(lock_path):
            age = time.time() - os.path.getmtime(lock_path)
            if age < 3600:
                print(f"  [{label}] Pipeline lock active (<1hr), skipping")
                return
        open(lock_path, "w").close()
        try:
            fn()
        except Exception as e:
            print(f"  [{label}] ERROR: {e}")
        finally:
            if os.path.exists(lock_path):
                os.remove(lock_path)

    def run_metrics_update(self):
        print(f"\n{'='*60}")
        print(f"[{datetime.now()}] SCHEDULER: Daily metrics update")
        from update_pipeline import run_update
        self._run_with_lock("metrics", lambda: run_update(trigger_reload=True))
        self.last_metrics = datetime.now()

    def run_full_enrichment(self):
        print(f"\n{'='*60}")
        print(f"[{datetime.now()}] SCHEDULER: Monthly full enrichment")
        import subprocess

        # Step 1: Enrich POIs/schools from Overpass (skip suburbs that already have data)
        print("  Step 1/2: POI/School enrichment (Overpass API)")
        result = subprocess.run(
            [sys.executable, os.path.join(BASE_DIR, "enrich_pipeline.py"), "--skip-existing"],
            capture_output=True, text=True, timeout=600
        )
        print(result.stdout[-500:])
        if result.stderr:
            print("  stderr:", result.stderr[-200:])

        # Step 2: Refresh metrics
        print("  Step 2/2: Metrics refresh")
        from update_pipeline import run_update
        run_update(trigger_reload=True)

        self.last_enrichment = datetime.now()

    def _loop(self):
        time.sleep(self.startup_delay)

        # Run metrics update immediately on startup
        self.run_metrics_update()

        # Also run enrichment if never run before
        self.run_full_enrichment()

        while self.running:
            now = datetime.now()

            # Check if enrichment is due (monthly)
            if self.last_enrichment is None or \
               (now - self.last_enrichment).total_seconds() >= self.enrichment_interval:
                self.run_full_enrichment()

            # Check if metrics are due (daily)
            if self.last_metrics is None or \
               (now - self.last_metrics).total_seconds() >= self.metrics_interval:
                self.run_metrics_update()

            # Sleep in 10-minute chunks
            for _ in range(600):
                if not self.running:
                    break
                time.sleep(6)

    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        print(f"[{datetime.now()}] Scheduler started: daily metrics + monthly enrichment")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=5)


scheduler = UpdateScheduler()


def start_scheduler():
    scheduler.start()


def stop_scheduler():
    scheduler.stop()
