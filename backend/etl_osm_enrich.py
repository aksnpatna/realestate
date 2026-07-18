"""
etl_osm_enrich.py — OSM-based social infrastructure & growth indicator enrichment
==================================================================================
Populates the worship_*, shelter_count, community_centre_count,
retirement_home_count, construction_sqkm, greenfield_sqkm, brownfield_sqkm,
building_construction_count columns on suburbs_ui_v3 from the local
planet_osm_* tables (loaded by the realestate-osm-updater container).

Approach
--------
suburbs_ui_v3 stores only a Point geom (no suburb polygon table exists in
this project). We mirror osm_local.py: a radius buffer (%d m) around each
suburb's centroid. Default 2500 m matches the livability API.

PERFORMANCE: a single bulk SQL processes many suburbs per DB round-trip
using LATERAL aggregates against the GiST-indexed planet_osm_* tables. The
detail JSON columns (worship_detail, social_infra_detail) are built DB-side
via jsonb_agg so there is no per-suburb Python/SQL loop. ~13k suburbs finish
in minutes rather than the hours of a per-suburb approach.

For POINT features (worship, shelter, community_centre, retirement_home,
building=construction) we count features whose point is within R metres of
the suburb centroid (ST_DWithin on geography).

For POLYGON features (landuse=construction/greenfield/brownfield) we sum,
clipped to the buffer circle, the polygon area in sqkm.

NON-BREAKING: only writes to the new columns listed in migrate_social_infra.py.
Idempotent — safe to re-run.

Usage:
    python etl_osm_enrich.py                # full run, default 2500m
    python etl_osm_enrich.py --radius 3000
    python etl_osm_enrich.py --limit 200     # pilot run
    python etl_osm_enrich.py --state VIC     # one state only
    python etl_osm_enrich.py --skip-detail   # skip the JSONB detail (faster)
"""
import os
import sys
import logging
import argparse
import time
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models_v3 import SessionLocal, engine  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [OSM-ENRICH] %(message)s",
)
log = logging.getLogger(__name__)

DEFAULT_RADIUS_M = 2500
BATCH_SIZE = 1000          # number of suburbs per INSERT ... SELECT chunk

# Common CTE prefix — used by both the detail and no-detail variants.
# Substitutes :radius (double) and an optional {state_clause} / freshness filter.
_COMMON_CTE = """
WITH batch AS (
    SELECT id, geom
    FROM suburbs_ui_v3
    WHERE geom IS NOT NULL
      {state_clause}
      {fresh_clause}
    ORDER BY id
    LIMIT :limit
),
suburb_geo AS (
    SELECT
        b.id                                                   AS suburb_id,
        b.geom::geography                                     AS geog,
        ST_Buffer(b.geom::geography, CAST(:radius AS double precision)) AS buf_geog,
        ST_Transform(b.geom, 3857)                            AS geom_3857,
        ST_Transform(ST_SetSRID(
            ST_Buffer(b.geom::geography, CAST(:radius AS double precision))::geometry,
        4326), 3857)                                          AS buf_3857
    FROM batch b
),
worship_point AS (
    SELECT s.suburb_id,
           p.name   AS pname,
           p.religion AS prel,
           ROUND(ST_Distance(ST_Transform(p.way,4326)::geography, s.geog)::numeric, 0)::int AS dist_m
    FROM suburb_geo s
    JOIN planet_osm_point p
      ON p.amenity = 'place_of_worship'
     AND p.way && s.buf_3857
     AND ST_DWithin(ST_Transform(p.way,4326)::geography, s.geog, CAST(:radius AS double precision))
),
worship_poly AS (
    SELECT s.suburb_id,
           o.name   AS pname,
           o.religion AS prel,
           ROUND(ST_Distance(ST_Transform(ST_Centroid(o.way),4326)::geography, s.geog)::numeric, 0)::int AS dist_m
    FROM suburb_geo s
    JOIN planet_osm_polygon o
      ON o.amenity = 'place_of_worship'
     AND o.way && s.buf_3857
     AND ST_DWithin(ST_Transform(ST_Centroid(o.way),4326)::geography, s.geog, CAST(:radius AS double precision))
),
worship_all AS (
    SELECT suburb_id, pname, COALESCE(NULLIF(prel,''),'christian') AS prel, dist_m FROM worship_point
    UNION ALL
    SELECT suburb_id, pname, COALESCE(NULLIF(prel,''),'christian') AS prel, dist_m FROM worship_poly
),
worship AS (
    SELECT
        s.suburb_id,
        COUNT(*)                                       AS worship_total,
        COUNT(*) FILTER (WHERE w.prel IN ('christian','catholic','anglican','orthodox','protestant','pentecostal','baptist','uniting','christadelphian','christian_brethren','church_of_england','salvation_army')) AS worship_christian,
        COUNT(*) FILTER (WHERE w.prel IN ('muslim','islam','sunni','shia','ahmadiyya')) AS worship_muslim,
        COUNT(*) FILTER (WHERE w.prel IN ('buddhist','buddhism','mahayana','theravada','vajrayana')) AS worship_buddhist,
        COUNT(*) FILTER (WHERE w.prel IN ('hindu','hinduism'))   AS worship_hindu,
        COUNT(*) FILTER (WHERE w.prel IN ('sikh','sikhism'))     AS worship_sikh,
        COUNT(*) FILTER (WHERE w.prel IN ('jewish','judaism'))  AS worship_jewish,
        COUNT(*) FILTER (WHERE w.prel NOT IN ('christian','catholic','anglican','orthodox','protestant','pentecostal','baptist','uniting','christadelphian','christian_brethren','church_of_england','salvation_army','muslim','islam','sunni','shia','ahmadiyya','buddhist','buddhism','mahayana','theravada','vajrayana','hindu','hinduism','sikh','sikhism','jewish','judaism')) AS worship_other
    FROM suburb_geo s
    LEFT JOIN worship_all w ON w.suburb_id = s.suburb_id
    GROUP BY s.suburb_id
),
{worship_detail_cte}
social_point AS (
    SELECT s.suburb_id,
           p.name AS sname,
           COALESCE(p.amenity, p.building) AS kind,
           ROUND(ST_Distance(ST_Transform(p.way,4326)::geography, s.geog)::numeric, 0)::int AS dist_m
    FROM suburb_geo s
    JOIN planet_osm_point p
      ON (p.amenity IN ('shelter','community_centre','retirement_home')
          OR p.building IN ('retirement_home','construction'))
     AND p.way && s.buf_3857
     AND ST_DWithin(ST_Transform(p.way,4326)::geography, s.geog, CAST(:radius AS double precision))
),
social_poly AS (
    SELECT s.suburb_id,
           o.name AS sname,
           COALESCE(o.amenity, o.building) AS kind,
           ROUND(ST_Distance(ST_Transform(ST_Centroid(o.way),4326)::geography, s.geog)::numeric, 0)::int AS dist_m
    FROM suburb_geo s
    JOIN planet_osm_polygon o
      ON (o.amenity IN ('shelter','community_centre','retirement_home')
          OR o.building IN ('retirement_home','construction'))
     AND o.way && s.buf_3857
     AND ST_DWithin(ST_Transform(ST_Centroid(o.way),4326)::geography, s.geog, CAST(:radius AS double precision))
),
social_all AS (
    SELECT suburb_id, sname, kind, dist_m FROM social_point
    UNION ALL
    SELECT suburb_id, sname, kind, dist_m FROM social_poly
),
social AS (
    SELECT
        s.suburb_id,
        COUNT(*) FILTER (WHERE sa.kind='shelter')           AS shelter_count,
        COUNT(*) FILTER (WHERE sa.kind='community_centre') AS community_centre_count,
        COUNT(*) FILTER (WHERE sa.kind='retirement_home')  AS retirement_home_count,
        COUNT(*) FILTER (WHERE sa.kind='construction')     AS building_construction_count
    FROM suburb_geo s
    LEFT JOIN social_all sa ON sa.suburb_id = s.suburb_id
    GROUP BY s.suburb_id
),
{social_detail_cte}
landuse AS (
    SELECT
        s.suburb_id,
        COALESCE(SUM(CASE WHEN o.landuse='construction'
            THEN ST_Area(ST_Transform(ST_Intersection(o.way, s.buf_3857), 4326)::geography) / 1e6 END), 0) AS construction_sqkm,
        COALESCE(SUM(CASE WHEN o.landuse='greenfield'
            THEN ST_Area(ST_Transform(ST_Intersection(o.way, s.buf_3857), 4326)::geography) / 1e6 END), 0) AS greenfield_sqkm,
        COALESCE(SUM(CASE WHEN o.landuse='brownfield'
            THEN ST_Area(ST_Transform(ST_Intersection(o.way, s.buf_3857), 4326)::geography) / 1e6 END), 0) AS brownfield_sqkm
    FROM suburb_geo s
    LEFT JOIN planet_osm_polygon o
      ON o.landuse IN ('construction','greenfield','brownfield')
     AND o.way && s.buf_3857
     AND ST_Intersects(o.way, s.buf_3857)
    GROUP BY s.suburb_id
)
"""

_WORSHIP_DETAIL_CTE = """worship_detail AS (
    SELECT s.suburb_id,
           COALESCE(jsonb_agg(
               jsonb_build_object(
                   'name', COALESCE(w.pname,'Unnamed place of worship'),
                   'religion', w.prel,
                   'amenity', 'place_of_worship',
                   'dist_m', w.dist_m
               )
               ORDER BY w.dist_m
           ) FILTER (WHERE w.pname IS NOT NULL), '[]'::jsonb) AS detail
    FROM suburb_geo s
    LEFT JOIN LATERAL (
        SELECT * FROM worship_all wa
        WHERE wa.suburb_id = s.suburb_id
        ORDER BY wa.dist_m ASC
        LIMIT 15
    ) w ON TRUE
    GROUP BY s.suburb_id
),
"""

_SOCIAL_DETAIL_CTE = """social_detail AS (
    SELECT s.suburb_id,
           COALESCE(jsonb_agg(
               jsonb_build_object(
                   'name', COALESCE(sa.sname,'Unnamed'),
                   'kind', sa.kind,
                   'dist_m', sa.dist_m
               )
               ORDER BY sa.dist_m
           ) FILTER (WHERE sa.sname IS NOT NULL), '[]'::jsonb) AS detail
    FROM suburb_geo s
    LEFT JOIN LATERAL (
        SELECT * FROM social_all saa
        WHERE saa.suburb_id = s.suburb_id
        ORDER BY saa.dist_m ASC
        LIMIT 15
    ) sa ON TRUE
    GROUP BY s.suburb_id
),
"""

_NO_WORSHIP_DETAIL_CTE = "worship_detail AS (SELECT suburb_id, '[]'::jsonb AS detail FROM suburb_geo),\n"
_NO_SOCIAL_DETAIL_CTE = "social_detail AS (SELECT suburb_id, '[]'::jsonb AS detail FROM suburb_geo),\n"


# INSERT clause shared by both variants
_INSERT = """
INSERT INTO suburbs_ui_v3 (
    id, worship_total, worship_christian, worship_muslim, worship_buddhist,
    worship_hindu, worship_sikh, worship_jewish, worship_other, worship_detail,
    shelter_count, community_centre_count, retirement_home_count,
    building_construction_count, social_infra_detail,
    construction_sqkm, greenfield_sqkm, brownfield_sqkm,
    osm_enriched_at, osm_enrich_radius_m
)
SELECT
    s.suburb_id,
    COALESCE(w.worship_total,0),
    COALESCE(w.worship_christian,0),
    COALESCE(w.worship_muslim,0),
    COALESCE(w.worship_buddhist,0),
    COALESCE(w.worship_hindu,0),
    COALESCE(w.worship_sikh,0),
    COALESCE(w.worship_jewish,0),
    COALESCE(w.worship_other,0),
    wd.detail,
    COALESCE(sc.shelter_count,0),
    COALESCE(sc.community_centre_count,0),
    COALESCE(sc.retirement_home_count,0),
    COALESCE(sc.building_construction_count,0),
    sd.detail,
    ROUND(COALESCE(lu.construction_sqkm,0)::numeric, 3),
    ROUND(COALESCE(lu.greenfield_sqkm,0)::numeric, 3),
    ROUND(COALESCE(lu.brownfield_sqkm,0)::numeric, 3),
    NOW(), CAST(:radius AS integer)
FROM suburb_geo s
JOIN worship w        ON w.suburb_id  = s.suburb_id
JOIN worship_detail wd ON wd.suburb_id = s.suburb_id
JOIN social sc         ON sc.suburb_id = s.suburb_id
JOIN social_detail sd  ON sd.suburb_id = s.suburb_id
JOIN landuse lu        ON lu.suburb_id = s.suburb_id
ON CONFLICT (id) DO UPDATE SET
    worship_total              = EXCLUDED.worship_total,
    worship_christian          = EXCLUDED.worship_christian,
    worship_muslim             = EXCLUDED.worship_muslim,
    worship_buddhist           = EXCLUDED.worship_buddhist,
    worship_hindu              = EXCLUDED.worship_hindu,
    worship_sikh               = EXCLUDED.worship_sikh,
    worship_jewish             = EXCLUDED.worship_jewish,
    worship_other              = EXCLUDED.worship_other,
    worship_detail             = EXCLUDED.worship_detail,
    shelter_count              = EXCLUDED.shelter_count,
    community_centre_count     = EXCLUDED.community_centre_count,
    retirement_home_count      = EXCLUDED.retirement_home_count,
    building_construction_count= EXCLUDED.building_construction_count,
    social_infra_detail        = EXCLUDED.social_infra_detail,
    construction_sqkm          = EXCLUDED.construction_sqkm,
    greenfield_sqkm            = EXCLUDED.greenfield_sqkm,
    brownfield_sqkm            = EXCLUDED.brownfield_sqkm,
    osm_enriched_at            = EXCLUDED.osm_enriched_at,
    osm_enrich_radius_m        = EXCLUDED.osm_enrich_radius_m
;
"""


def build_sql(skip_detail=False):
    """Assemble the bulk enrichment SQL with optional detail CTEs."""
    if skip_detail:
        wd, sd = _NO_WORSHIP_DETAIL_CTE, _NO_SOCIAL_DETAIL_CTE
    else:
        wd, sd = _WORSHIP_DETAIL_CTE, _SOCIAL_DETAIL_CTE
    # Use %()s style placeholders instead of {} to avoid colliding with the
    # literal {batch_select} placeholder handled separately in run().
    body = _COMMON_CTE.replace("{worship_detail_cte}", "%(wd)s") \
                     .replace("{social_detail_cte}", "%(sd)s")
    body = body % {"wd": wd, "sd": sd}
    return body + "%(batch_select)s" + _INSERT


def run(radius_m=DEFAULT_RADIUS_M, state_filter=None, limit=None,
        batch_size=BATCH_SIZE, skip_detail=False):
    log.info("=" * 64)
    log.info("OSM Enrichment Pipeline (bulk) — worship + social infra + growth")
    log.info(f"  radius={radius_m}m  state={state_filter or 'ALL'}  "
             f"batch={batch_size}  skip_detail={skip_detail}")
    log.info("=" * 64)

    sql = build_sql(skip_detail=skip_detail)

    state_clause = "AND UPPER(state) = :state" if state_filter else ""
    fresh_clause = ("AND (osm_enriched_at IS NULL OR "
                   "osm_enriched_at < NOW() - INTERVAL '6 hours')")
    sql = (sql
           .replace("{state_clause}", state_clause)
           .replace("{fresh_clause}", fresh_clause)
           .replace("%(batch_select)s", ""))

    session = SessionLocal()
    try:
        already = session.execute(text(
            "SELECT COUNT(*) FROM suburbs_ui_v3 WHERE osm_enriched_at IS NOT NULL"
        )).scalar() or 0
        log.info(f"  {already:,} suburbs already enriched (will be refreshed)")

        total_elig = session.execute(text(
            "SELECT COUNT(*) FROM suburbs_ui_v3 WHERE geom IS NOT NULL"
            + (" AND UPPER(state) = :state" if state_filter else "")
        ), {"state": state_filter.upper()} if state_filter else {}).scalar() or 0
        log.info(f"  {total_elig:,} suburbs available overall")

        done = 0
        batch_no = 0
        from sqlalchemy.exc import SQLAlchemyError
        while True:
            t0 = time.time()
            try:
                result = session.execute(text(sql), {
                    "radius": float(radius_m),
                    "limit": int(batch_size),
                    **({"state": state_filter.upper()} if state_filter else {}),
                })
                inserted = result.rowcount or 0
                session.commit()
                elapsed = time.time() - t0
                done += inserted
                batch_no += 1
                log.info(f"  batch {batch_no}: enriched {inserted} suburbs in "
                         f"{elapsed:.1f}s (cumulative {done:,})")
                if inserted == 0 or inserted < batch_size:
                    break
            except SQLAlchemyError as e:
                session.rollback()
                log.error(f"  ✗ batch {batch_no} failed: {repr(e.orig)[:200]}")
                break

        log.info("=" * 64)
        log.info(f"OSM Enrichment complete — {done:,} suburbs refreshed")
        log.info("=" * 64)

    finally:
        session.close()


def main():
    p = argparse.ArgumentParser(description="OSM social-infra + growth enrichment (bulk)")
    p.add_argument("--radius", type=int, default=DEFAULT_RADIUS_M, help="Buffer radius in metres")
    p.add_argument("--state", type=str, default=None, help="Filter to one state e.g. VIC")
    p.add_argument("--limit", type=int, default=None, help="Per-batch size (default 1000)")
    p.add_argument("--batch", type=int, default=BATCH_SIZE, help="Alias for --limit")
    p.add_argument("--skip-detail", action="store_true",
                   help="Skip the JSONB nearest-15 detail lists (faster)")
    args = p.parse_args()
    run(
        radius_m=args.radius,
        state_filter=args.state,
        limit=args.limit or args.batch,
        batch_size=args.limit or args.batch,
        skip_detail=args.skip_detail,
    )


if __name__ == "__main__":
    main()
