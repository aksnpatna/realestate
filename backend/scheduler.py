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
        self.last_run: datetime | None = None
        self.startup_delay = 60
        self._thread: threading.Thread | None = None

    def _bust_cache(self):
        """Invalidate the in-memory suburbs cache so next request gets fresh DB data."""
        try:
            import main as _main
            _main.bust_suburbs_cache()
        except Exception as e:
            print(f"[scheduler] Cache bust skipped: {e}")

    def _run_v3_full_refresh(self):
        print(f"\n{'='*60}")
        print(f"[{datetime.now()}] SCHEDULER: Full Refresh")
        print(f"{'='*60}")
        subprocess.run(
            [sys.executable, os.path.join(BASE_DIR, "v3_scheduler.py"), "--run"]
        )
        self.last_run = datetime.now()
        self._bust_cache()

    def _loop(self):
        time.sleep(self.startup_delay)

        # Run on first startup
        self._run_v3_full_refresh()

        while self.running:
            now = datetime.now()

            if self.last_run is None or \
               (now - self.last_run).total_seconds() >= 30 * 24 * 60 * 60:  # 30 days
                self._run_v3_full_refresh()

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
