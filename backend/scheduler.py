#!/usr/bin/env python3
"""
Background scheduler for suburb data updates.
V3 Pipeline (tiered):
  - Monthly: Metro/live suburbs only — re-scrape + unpack + enrich changed
  - Quarterly: Full national refresh — re-scrape all + unpack + enrich changed
  - Change detection: only re-process if source data actually changed
Runs inside the same Docker container as the API.
"""

import os
import sys
import time
import threading
import subprocess
from datetime import datetime

BASE_DIR = os.path.dirname(__file__)
sys.path.insert(0, BASE_DIR)


class UpdateScheduler:
    """
    V3 Tiered Update Scheduler.
    Monthly metro (~3,953 suburbs), quarterly full (13,150).
    Only V3 pipeline runs — old update_pipeline/transform_data retired.
    """

    def __init__(self):
        self.running = True
        self.last_monthly: datetime | None = None
        self.last_quarterly: datetime | None = None
        self.startup_delay = 60
        self.monthly_interval = 30 * 24 * 60 * 60      # 30 days
        self.quarterly_interval = 90 * 24 * 60 * 60    # 90 days
        self._thread: threading.Thread | None = None

    def _bust_cache(self):
        """Invalidate the in-memory suburbs cache so next request gets fresh DB data."""
        try:
            import main as _main
            _main.bust_suburbs_cache()
        except Exception as e:
            print(f"[scheduler] Cache bust skipped: {e}")

    def _run_v3_monthly_metro(self):
        print(f"\n{'='*60}")
        print(f"[{datetime.now()}] SCHEDULER: Monthly Metro Update (~3,953 live suburbs)")
        print(f"{'='*60}")
        subprocess.run(
            [sys.executable, os.path.join(BASE_DIR, "v3_scheduler.py"), "--monthly"]
        )
        self.last_monthly = datetime.now()
        self._bust_cache()

    def _run_v3_quarterly_full(self):
        print(f"\n{'='*60}")
        print(f"[{datetime.now()}] SCHEDULER: Quarterly Full National Refresh (13,150 suburbs)")
        print(f"{'='*60}")
        subprocess.run(
            [sys.executable, os.path.join(BASE_DIR, "v3_scheduler.py"), "--quarterly"]
        )
        self.last_quarterly = datetime.now()
        self._bust_cache()

    def _loop(self):
        time.sleep(self.startup_delay)

        # Run quarterly on first startup (if data is stale)
        self._run_v3_quarterly_full()

        while self.running:
            now = datetime.now()

            if self.last_quarterly is None or \
               (now - self.last_quarterly).total_seconds() >= self.quarterly_interval:
                self._run_v3_quarterly_full()

            if self.last_monthly is None or \
               (now - self.last_monthly).total_seconds() >= self.monthly_interval:
                self._run_v3_monthly_metro()

            for _ in range(360):
                if not self.running:
                    break
                time.sleep(10)

    def start(self):
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        print(f"[{datetime.now()}] V3 Scheduler started: monthly metro + quarterly full")

    def stop(self):
        self.running = False
        if self._thread:
            self._thread.join(timeout=5)


scheduler = UpdateScheduler()


def start_scheduler():
    scheduler.start()


def stop_scheduler():
    scheduler.stop()
