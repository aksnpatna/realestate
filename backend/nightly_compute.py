"""
nightly_compute.py — Nightly spatial computation scheduler (2-3 hour window)

Runs in small bursts, one state per night:
  - Monday: VIC   (avg_block_sqm + min lot size)
  - Tuesday: NSW  
  - Wednesday: QLD
  - Thursday: SA
  - Friday: WA
  - Weekend: TAS + NT + ACT

Only processes suburbs where data is missing (incremental).
Uses 3000m point buffer with spatial index (34ms per suburb).
Auto-stops after 2.5 hours to protect system resources.

Run via cron: 0 1 * * * python backend/nightly_compute.py
"""

import sys
import os
import time
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(__file__))
from models_v3 import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s [NIGHTLY] %(message)s")
log = logging.getLogger("nightly")

MAX_RUNTIME_SECONDS = 2.5 * 3600  # 2.5 hours
BATCH_SIZE = 50
BUFFER_M = 3000
TIMEOUT_S = 30

STATE_SCHEDULE = {
    0: "VIC", 1: "NSW", 2: "QLD", 3: "SA",
    4: "WA",  5: "TAS", 6: "ACT+NT"
}

# Safety: prevent concurrent runs
ADVISORY_LOCK_ID = 7253942


def compute_avg_blocks(session, state_filter=None):
    """Compute avg_block_sqm for suburbs where it is NULL.
    Uses 3000m point buffer with spatial index. Batched 50 at a time.
    """
    state_clause = "AND s.id LIKE :state_prefix" if state_filter else ""
    params = {}
    if state_filter:
        params["state_prefix"] = f"{state_filter.upper()}_%"

    rows = session.execute(text("""
        SELECT id FROM suburbs_ui_v3 s
        WHERE s.geom IS NOT NULL
          AND s.is_enriched = TRUE
          AND s.avg_block_sqm IS NULL
    """ + state_clause + " ORDER BY s.id"), params).fetchall()
    ids = [r[0] for r in rows]

    if not ids:
        log.info(f"  avg blocks: nothing to do for {state_filter or 'all states'}")
        return 0

    log.info(f"  avg blocks: {len(ids):,} suburbs need computation (buffer={BUFFER_M}m)")

    updated = 0
    for i in range(0, len(ids), BATCH_SIZE):
        if time.time() - start_time > MAX_RUNTIME_SECONDS:
            log.info(f"  stopping — {MAX_RUNTIME_SECONDS}s budget exhausted")
            break

        batch = ids[i:i + BATCH_SIZE]
        placeholders = ','.join(f"'{s}'" for s in batch)
        try:
            result = session.execute(text(f"""
                SET LOCAL statement_timeout = '{TIMEOUT_S}s';
                SET LOCAL max_parallel_workers_per_gather = 2;
                WITH blds AS (
                    SELECT s.id AS suburb_id, ST_Area(b.way) AS footprint_sqm
                    FROM suburbs_ui_v3 s
                    INNER JOIN LATERAL (
                        SELECT way FROM planet_osm_polygon
                        WHERE building IN ('yes','house','residential','detached',
                                           'apartments','terrace','semidetached_house')
                          AND ST_Area(way) > 20
                          AND ST_DWithin(way, ST_Transform(s.geom, 3857), {BUFFER_M})
                        LIMIT 5000
                    ) b ON TRUE
                    WHERE s.id IN ({placeholders})
                ),
                stats AS (
                    SELECT suburb_id,
                           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY footprint_sqm) AS p50
                    FROM blds GROUP BY suburb_id HAVING COUNT(*) >= 10
                )
                UPDATE suburbs_ui_v3 s
                SET avg_block_sqm = ROUND(stats.p50 / 0.6)
                FROM stats
                WHERE s.id = stats.suburb_id AND stats.p50 > 0
            """))
            session.commit()
            batch_updated = result.rowcount or 0
            updated += batch_updated
            if i % (BATCH_SIZE * 10) == 0:
                log.info(f"  avg blocks: {updated:,}/{len(ids):,} done")
        except Exception as e:
            session.rollback()
            log.warning(f"  batch {i//BATCH_SIZE+1} failed: {e}")

    return updated


def compute_min_lot_sizes(session, state_filter=None):
    """Compute min_approved_subdivision_sqm via OSM building P10 footprint proxy.

    P10 building footprint / 0.6 site coverage = minimum observed lot size.
    Only for non-NSW states (NSW has real gov API data via etl_nsw_planning_rules).
    """
    if state_filter == "NSW":
        log.info("  min lot sizes: skipping NSW (real gov API data exists)")
        return 0

    state_clause = "AND s.id LIKE :state_prefix" if state_filter else ""
    params = {}
    if state_filter:
        params["state_prefix"] = f"{state_filter.upper()}_%"

    rows = session.execute(text("""
        SELECT id FROM suburbs_ui_v3 s
        WHERE s.geom IS NOT NULL
          AND s.is_enriched = TRUE
          AND s.min_approved_subdivision_sqm IS NULL
          AND s.avg_block_sqm IS NOT NULL
    """ + state_clause + " ORDER BY s.id"), params).fetchall()
    ids = [r[0] for r in rows]

    if not ids:
        log.info(f"  min lot sizes: nothing to do for {state_filter or 'all states'}")
        return 0

    log.info(f"  min lot sizes: {len(ids):,} suburbs need computation")

    updated = 0
    for i in range(0, len(ids), BATCH_SIZE):
        if time.time() - start_time > MAX_RUNTIME_SECONDS:
            log.info(f"  stopping — {MAX_RUNTIME_SECONDS}s budget exhausted")
            break

        batch = ids[i:i + BATCH_SIZE]
        placeholders = ','.join(f"'{s}'" for s in batch)
        try:
            result = session.execute(text(f"""
                SET LOCAL statement_timeout = '{TIMEOUT_S}s';
                WITH blds AS (
                    SELECT s.id AS suburb_id, ST_Area(b.way) AS footprint_sqm
                    FROM suburbs_ui_v3 s
                    INNER JOIN LATERAL (
                        SELECT way FROM planet_osm_polygon
                        WHERE building IN ('yes','house','residential','detached',
                                           'apartments','terrace','semidetached_house')
                          AND ST_Area(way) > 50
                          AND ST_DWithin(way, ST_Transform(s.geom, 3857), 3000)
                        LIMIT 5000
                    ) b ON TRUE
                    WHERE s.id IN ({placeholders})
                ),
                stats AS (
                    SELECT suburb_id,
                           PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY footprint_sqm) AS p10
                    FROM blds GROUP BY suburb_id HAVING COUNT(*) >= 10
                )
                UPDATE suburbs_ui_v3 s
                SET min_approved_subdivision_sqm = ROUND(stats.p10 / 0.6)
                FROM stats
                WHERE s.id = stats.suburb_id AND stats.p10 > 0
            """))
            session.commit()
            batch_updated = result.rowcount or 0
            updated += batch_updated
        except Exception as e:
            session.rollback()
            log.warning(f"  batch failed: {e}")

    return updated


def run_nightly():
    global start_time
    start_time = time.time()

    # Determine today's state
    day = datetime.now(timezone.utc).weekday()
    state = STATE_SCHEDULE.get(day, "VIC")
    log.info(f"=" * 60)
    log.info(f"Nightly compute starting — {day=} state={state}")
    log.info(f"=" * 60)

    session = SessionLocal()
    try:
        # Advisory lock guard
        r = session.execute(
            text("SELECT pg_try_advisory_lock(:id)"), {"id": ADVISORY_LOCK_ID}
        )
        if not r.scalar():
            log.info("Already running — exiting")
            return

        # 1. Average block sizes
        avg_updated = compute_avg_blocks(session, state if state != "ACT+NT" else None)
        log.info(f"  avg blocks: updated {avg_updated:,} suburbs")

        # 2. Minimum lot sizes (from OSM building P10 proxy)
        if time.time() - start_time < MAX_RUNTIME_SECONDS:
            lot_updated = compute_min_lot_sizes(session, state if state != "ACT+NT" else None)
            log.info(f"  min lot sizes: updated {lot_updated:,} suburbs")

        session.execute(
            text("SELECT pg_advisory_unlock(:id)"), {"id": ADVISORY_LOCK_ID}
        )
        session.commit()

    except Exception as e:
        session.rollback()
        log.error(f"Nightly compute failed: {e}")
        raise
    finally:
        session.close()

    elapsed = time.time() - start_time
    log.info(f"Done — {elapsed:.0f}s ({elapsed/3600:.1f}h)")


if __name__ == "__main__":
    run_nightly()
