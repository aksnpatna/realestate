"""
nightly_compute.py — Nightly spatial computation using OSM boundary polygons

Pre-computed boundary_geom (populated once from planet_osm_polygon) enables
accurate building-counts within actual suburb boundaries — covers regional
and rural suburbs that a point-buffer would miss.

Schedule: one state per night, ~3 min per state, well under 1 hour.
Boundary coverage: 70% of suburbs at >=10 buildings, 87% at >=3.
"""

import sys
import os
import time
import logging
from datetime import datetime, timezone
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(__file__))
from models_v3 import SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s [NIGHTLY] %(message)s")
log = logging.getLogger("nightly")

MAX_RUNTIME_S = 2.5 * 3600
BATCH = 25
MIN_BUILDINGS = 3
TIMEOUT_S = 30
ADVISORY_LOCK = 7253942

STATE_SCHEDULE = {
    0: "VIC", 1: "NSW", 2: "QLD", 3: "SA",
    4: "WA", 5: "TAS", 6: None  # all states on Sunday
}


def _batch_update(session, ids, metric="avg"):
    """Run one batch of spatial updates using pre-stored boundary_geom."""
    percentile = "0.5" if metric == "avg" else "0.1"
    target_col = "avg_block_sqm" if metric == "avg" else "min_approved_subdivision_sqm"
    min_area = 20 if metric == "avg" else 50

    placeholders = ','.join(f"'{s}'" for s in ids)
    result = session.execute(text(f"""
        SET LOCAL statement_timeout = '{TIMEOUT_S}s';
        SET LOCAL max_parallel_workers_per_gather = 2;
        WITH blds AS (
            SELECT s.id AS suburb_id, ST_Area(b.way) AS fsqm
            FROM suburbs_ui_v3 s
            INNER JOIN LATERAL (
                SELECT way FROM planet_osm_polygon
                WHERE building IN ('yes','house','residential','detached',
                                   'apartments','terrace','semidetached_house')
                  AND ST_Area(way) > {min_area}
                  AND way && s.boundary_geom
                LIMIT 5000
            ) b ON TRUE
            WHERE s.id IN ({placeholders})
              AND s.boundary_geom IS NOT NULL
        ),
        stats AS (
            SELECT suburb_id,
                   PERCENTILE_CONT({percentile}) WITHIN GROUP (ORDER BY fsqm) AS p
            FROM blds GROUP BY suburb_id HAVING COUNT(*) >= {MIN_BUILDINGS}
        )
        UPDATE suburbs_ui_v3 s
        SET {target_col} = ROUND(stats.p / 0.6)
        FROM stats
        WHERE s.id = stats.suburb_id AND stats.p > 0
    """))
    return result.rowcount or 0


def compute_metric(session, state, metric):
    """Compute one metric for all NULL suburbs in a state."""
    target_col = "avg_block_sqm" if metric == "avg" else "min_approved_subdivision_sqm"
    label = "avg blocks" if metric == "avg" else "min lot sizes"

    ns_filter = "AND s.id NOT LIKE 'NSW_%'" if metric == "lot" else ""
    st_filter = "AND s.id LIKE :pfx" if state else ""
    params = {}
    if state:
        params["pfx"] = f"{state.upper()}_%"

    sql = f"""
        SELECT id FROM suburbs_ui_v3 s
        WHERE s.boundary_geom IS NOT NULL
          AND s.is_enriched = TRUE
          AND s.{target_col} IS NULL
          {ns_filter}
          {st_filter}
        ORDER BY s.id
    """
    rows = session.execute(text(sql), params).fetchall()
    ids = [r[0] for r in rows]

    if not ids:
        log.info(f"  {label}: nothing to do for {state or 'all states'}")
        return 0

    log.info(f"  {label}: {len(ids):,} suburbs needing data")

    updated = 0
    for i in range(0, len(ids), BATCH):
        if time.time() - start_time > MAX_RUNTIME_S:
            log.info(f"  stopping — budget exhausted")
            break
        batch_ids = ids[i:i + BATCH]
        try:
            n = _batch_update(session, batch_ids, metric)
            session.commit()
            updated += n
        except Exception as e:
            session.rollback()
            log.warning(f"  batch {i//BATCH+1} failed: {e!r}")
        if i % (BATCH * 40) == 0 and i > 0:
            log.info(f"  {label}: {updated:,}/{len(ids):,} done")

    log.info(f"  {label}: {updated:,} suburbs updated")
    return updated


def populate_boundaries(session):
    """One-time: populate boundary_geom from planet_osm_polygon."""
    r = session.execute(text("""
        UPDATE suburbs_ui_v3 s
        SET boundary_geom = b.way
        FROM planet_osm_polygon b
        WHERE UPPER(b.name) = UPPER(s.name)
          AND (b.boundary = 'administrative' OR b.place IN ('suburb', 'locality'))
          AND s.geom IS NOT NULL
          AND s.boundary_geom IS NULL
    """))
    session.commit()
    return r.rowcount


def run_nightly():
    global start_time
    start_time = time.time()

    day = datetime.now(timezone.utc).weekday()
    state = STATE_SCHEDULE.get(day, "VIC")
    log.info(f"{'='*60}")
    log.info(f"Nightly compute — day={day} state={state}")
    log.info(f"{'='*60}")

    session = SessionLocal()
    try:
        r = session.execute(text("SELECT pg_try_advisory_lock(:id)"), {"id": ADVISORY_LOCK})
        if not r.scalar():
            log.info("Already running — exit")
            return

        # Ensure boundaries are populated (idempotent, only fills NULLs)
        nb = populate_boundaries(session)
        log.info(f"  boundaries: {nb} new populated")

        # 1. Average block sizes
        avg_n = compute_metric(session, state, "avg")

        # 2. Minimum lot sizes (non-NSW only)
        if time.time() - start_time < MAX_RUNTIME_S:
            lot_n = compute_metric(session, state, "lot")

        session.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": ADVISORY_LOCK})
        session.commit()

    except Exception as e:
        session.rollback()
        log.error(f"Failed: {e}")
        raise
    finally:
        session.close()

    elapsed = time.time() - start_time
    log.info(f"Done — {elapsed:.0f}s ({elapsed/3600:.1f}h)")


if __name__ == "__main__":
    run_nightly()
