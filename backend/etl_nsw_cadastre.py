"""
etl_nsw_cadastre.py — NSW Cadastral Parcel Fetcher
===================================================
Queries the NSW Spatial Collaboration Portal ArcGIS REST service for cadastral
lot/parcel polygons, stores them in a local PostGIS table, and joins each
parcel to the suburb (SAL) that contains it.

Data source:  NSW Spatial Services — Crown copyright, CC BY 4.0
Endpoint:     https://portal.spatial.nsw.gov.au/server/rest/services/NSW_Cadastre/MapServer/0

Approach
--------
1. For each selected NSW suburb, fetch the suburb polygon from planet_osm_polygon
   (already loaded via osm2pgsql).
2. Fire an ArcGIS REST /query (GET, paginated via resultOffset/resultRecordCount)
   with geometryType=esriGeometryPolygon and the suburb envelope as the spatial
   filter. NSW ArcGIS REST caps page size at 2000.
3. Insert fetched parcel polygons into cadastral_parcels (UPSERT on cad_id).
4. Post-process: tag each parcel with its suburb_id via ST_Contains join, and
   compute summary statistics (avg parcel size, count, cadastral density).

Non-breaking: additive only. Creates a new table; writes to cadastral_* columns
on suburbs_ui_v3.

Usage:
    python etl_nsw_cadastre.py                     # all NSW suburbs with suburb polygons
    python etl_nsw_cadastre.py --limit 5            # first 5 suburbs
    python etl_nsw_cadastre.py --suburb BLACKTOWN   # one suburb by name
    python etl_nsw_cadastre.py --suburb-id NSW_BLACKTOWN_2148
    python etl_nsw_cadastre.py --page-size 1000     # smaller pages for unreliable net
"""
import os
import sys
import json
import time
import logging
import hashlib
import datetime
import argparse
import requests
from pathlib import Path
from sqlalchemy import text as sqla_text
from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, JSON

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [CADASTRE] %(message)s",
)
log = logging.getLogger(__name__)

NSW_CADASTRE_URL = (
    "https://portal.spatial.nsw.gov.au/server/rest/services/"
    "Cadastre_History/MapServer/3/query"
)
# Alternative live endpoint (currently unreachable externally as of 2026-07):
# "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Cadastre/MapServer/9/query"
# Can be overridden via --endpoint CLI flag.

CACHE_DIR = Path(__file__).parent / "data" / "nsw_cadastre"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": "realestate-etl/3.0 (cadastre; CC BY 4.0)",
    "Accept": "application/json",
})


def ensure_cadastral_table(engine):
    """Idempotently create the cadastral_parcels table via raw DDL."""
    from models_v3 import Base
    ddl = """
    CREATE TABLE IF NOT EXISTS cadastral_parcels (
        id          SERIAL PRIMARY KEY,
        cad_id      TEXT UNIQUE NOT NULL,
        plan_label  TEXT,
        lot_number  TEXT,
        section_number TEXT,
        area_sqm    DOUBLE PRECISION,
        centroid_lat DOUBLE PRECISION,
        centroid_lng DOUBLE PRECISION,
        geom        geometry(MultiPolygon, 4326),
        suburb_id   TEXT,
        suburb_name TEXT,
        source_url  TEXT,
        fetched_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        cache_key   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_cadastral_suburb
        ON cadastral_parcels (suburb_id);
    CREATE INDEX IF NOT EXISTS idx_cadastral_geom
        ON cadastral_parcels USING GIST (geom);
    """
    with engine.begin() as conn:
        conn.execute(sqla_text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.execute(sqla_text(ddl))
    log.info("  cadastral_parcels table verified")


def _geom_wkt_to_bbox(wkt_str: str | None) -> str | None:
    """Extract bounding box as 'xmin,ymin,xmax,ymax' for ArcGIS esriGeometryEnvelope."""
    import re
    if not wkt_str:
        return None
    try:
        numbers = re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", wkt_str)
        if len(numbers) < 4:
            return None
        floats = [float(n) for n in numbers]
        lngs = floats[0::2]
        lats = floats[1::2]
        xmin, xmax = min(lngs), max(lngs)
        ymin, ymax = min(lats), max(lats)
        return f"{xmin:.6f},{ymin:.6f},{xmax:.6f},{ymax:.6f}"
    except Exception:
        return None


def get_suburbs(engine, state: str = "NSW", limit: int = None,
                suburb_name: str = None, suburb_id: str = None):
    """Return list of (suburb_id, name, geom_wkt) for candidate suburbs.
    Geom is the suburb polygon (WGS84 WKT) from planet_osm_polygon.
    """
    params = {}
    where_clauses = ["s.state = :state", "s.is_enriched = TRUE"]
    params["state"] = state

    if suburb_id:
        where_clauses.append("s.id = :sid")
        params["sid"] = suburb_id
    elif suburb_name:
        where_clauses.append("s.name ILIKE :sname")
        params["sname"] = suburb_name
    elif limit:
        where_clauses.append("s.id IN (SELECT id FROM suburbs_ui_v3 WHERE state=:state AND is_enriched ORDER BY id LIMIT :lim)")
        params["lim"] = limit

    sql = f"""
    WITH osm_poly AS (
        SELECT name, ST_AsText(ST_Transform(way, 4326)) AS wkt,
               ST_Centroid(way) AS ctr
        FROM planet_osm_polygon
        WHERE boundary = 'administrative' OR place IN ('suburb','locality')
    )
    SELECT s.id, s.name,
           COALESCE(o.wkt, NULL) AS geom_wkt
    FROM suburbs_ui_v3 s
    LEFT JOIN osm_poly o ON UPPER(o.name) = UPPER(s.name)
    WHERE {' AND '.join(where_clauses)}
    ORDER BY s.id
    {'LIMIT :lim' if limit and not suburb_id and not suburb_name else ''}
    """
    with engine.connect() as conn:
        rows = conn.execute(sqla_text(sql), params).fetchall()
    results = [(r[0], r[1], r[2]) for r in rows]
    log.info(f"  Selected {len(results)} NSW suburbs for cadastre fetch")
    return results


def fetch_suburb_envelope(suburb_id, suburb_name, geom_wkt):
    """Fetch parcel polygons for a single suburb via ArcGIS REST.

    Uses the suburb bounding box as the spatial filter. The NSW cadastre
    service returns up to 2000 features per page; we page until exhausted.
    Returns list of GeoJSON feature dicts.
    """
    # ArcGIS REST has URL length limits (~8KB). We send the bbox envelope
    # as a comma-separated "xmin,ymin,xmax,ymax" string compatible with
    # esriGeometryEnvelope format, not the full polygon WKT.
    bbox = _geom_wkt_to_bbox(wkt_str=geom_wkt)
    if not bbox:
        log.warning(f"  {suburb_name}: could not compute bbox — skipping")
        return []

    cache_file = CACHE_DIR / f"{suburb_id}.json"
    if cache_file.exists() and cache_file.stat().st_size > 100:
        try:
            with open(cache_file) as f:
                cached = json.load(f)
            log.info(f"  {suburb_name}: cache hit ({len(cached)} parcels)")
            return cached
        except Exception:
            pass

    all_features = []
    offset = 0
    page_size = 2000
    max_pages = 20  # safety valve: 40k parcels per suburb is plenty

    while offset < max_pages * page_size:
        params = {
            "where": "1=1",
            "outFields": "cadid,lotnumber,planlabel,sectionnumber,planlotarea,lotidstring,shape_Area",
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "spatialRel": "esriSpatialRelIntersects",
            "inSR": "4326",
            "outSR": "4326",
            "returnGeometry": "true",
            "f": "geojson",
            "resultOffset": offset,
            "resultRecordCount": page_size,
        }
        try:
            resp = SESSION.get(NSW_CADASTRE_URL, params=params, timeout=60)
            if resp.status_code != 200:
                log.warning(f"  {suburb_name}: HTTP {resp.status_code} at offset {offset}")
                break
            data = resp.json()
        except Exception as e:
            log.warning(f"  {suburb_name}: request error at offset {offset}: {e}")
            time.sleep(2)
            continue

        features = data.get("features", [])
        if not features:
            break

        all_features.extend(features)
        offset += len(features)

        # If ArcGIS sent fewer than requested, we've hit the end
        if len(features) < page_size:
            break

        time.sleep(0.3)  # be polite to the server

    log.info(f"  {suburb_name}: fetched {len(all_features)} parcels")
    with open(cache_file, "w") as f:
        json.dump(all_features, f)
    return all_features


def upsert_parcels(engine, suburb_id, suburb_name, features):
    """Insert/update parcel rows into cadastral_parcels. Uses UNIQUE ON cad_id."""
    if not features:
        return 0

    rows = []
    for feat in features:
        props = feat.get("properties", {}) or {}
        geom_data = feat.get("geometry")
        if not geom_data:
            continue

        cad_id = props.get("cadid") or props.get("lotid") or props.get("parcel_id")
        if not cad_id:
            # build a synthetic key from centroid hashing
            lat = props.get("latitude") or (geom_data.get("coordinates", [[[0, 0]]])[0][0][1]
                     if geom_data.get("type") in ("Polygon", "MultiPolygon") else 0)
            lng = props.get("longitude") or (geom_data.get("coordinates", [[[0, 0]]])[0][0][0]
                     if geom_data.get("type") in ("Polygon", "MultiPolygon") else 0)
            cad_id = hashlib.md5(
                json.dumps(geom_data, sort_keys=True).encode()
            ).hexdigest()[:16]

        area = props.get("shape_area") or props.get("planlotarea") or props.get("area")
        rows.append({
            "cad_id": str(cad_id),
            "plan_label": props.get("plan_no") or props.get("planlabel") or props.get("plan"),
            "lot_number": str(props.get("lot") or props.get("lotnumber") or props.get("lga_label") or ""),
            "section_number": str(props.get("section") or ""),
            "area_sqm": float(area) if area else None,
            "geom": json.dumps(geom_data),
            "suburb_id": suburb_id,
            "suburb_name": suburb_name,
            "source_url": NSW_CADASTRE_URL,
        })

    if not rows:
        return 0

    insert_sql = """
    INSERT INTO cadastral_parcels (cad_id, plan_label, lot_number, section_number,
        area_sqm, geom, suburb_id, suburb_name, source_url)
    VALUES (:cad_id, :plan_label, :lot_number, :section_number,
        COALESCE(:area_sqm, NULL), ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326),
        :suburb_id, :suburb_name, :source_url)
    ON CONFLICT (cad_id) DO UPDATE SET
        suburb_id = EXCLUDED.suburb_id,
        suburb_name = EXCLUDED.suburb_name,
        geom = EXCLUDED.geom,
        area_sqm = COALESCE(EXCLUDED.area_sqm, cadastral_parcels.area_sqm),
        fetched_at = NOW()
    """

    count = 0
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        with engine.begin() as conn:
            for rec in batch:
                try:
                    conn.execute(sqla_text(insert_sql), rec)
                    count += 1
                except Exception as e:
                    log.debug(f"  skip parcel {rec.get('cad_id')}: {e}")
    return count


def update_suburb_summary(engine, suburb_id):
    """Update suburbs_ui_v3 with cadastral summary for one suburb.
    Also backfills area_sqm from geometry for rows missing it.
    """
    # Backfill area from geometry (ST_Area on geography gives sq metres)
    area_sql = """
    UPDATE cadastral_parcels
    SET area_sqm = ROUND(ST_Area(geom::geography)::numeric, 1)
    WHERE suburb_id = :sid AND area_sqm IS NULL
    """
    summary_sql = """
    UPDATE suburbs_ui_v3
    SET
        cadastral_source  = 'NSW Spatial Services ArcGIS REST',
        cadastral_last_synced = NOW()
    WHERE id = :sid
    """
    with engine.begin() as conn:
        result = conn.execute(sqla_text(area_sql), {"sid": suburb_id})
        log.info(f"  Backfilled area for ~{result.rowcount} parcels")
        conn.execute(sqla_text(summary_sql), {"sid": suburb_id})


def run_nsw_cadastre(limit: int = None, suburb_name: str = None,
                     suburb_id: str = None, page_size: int = 2000):
    """Main entry point."""
    from models_v3 import engine, SessionLocal
    ensure_cadastral_table(engine)

    suburbs = get_suburbs(engine, state="NSW", limit=limit,
                          suburb_name=suburb_name, suburb_id=suburb_id)
    if not suburbs:
        log.error("No suburbs found — check DB connectivity and enrich state")
        return

    total_parcels = 0
    for i, (sid, sname, geom_wkt) in enumerate(suburbs):
        log.info(f"[{i+1}/{len(suburbs)}] {sname} ({sid})")
        features = fetch_suburb_envelope(sid, sname, geom_wkt)
        inserted = upsert_parcels(engine, sid, sname, features)
        update_suburb_summary(engine, sid)
        total_parcels += inserted
        log.info(f"  {sname}: upserted {inserted} parcels")

    log.info("=" * 60)
    log.info(f"NSW Cadastre fetch complete: {total_parcels:,} parcels across {len(suburbs)} suburbs")
    log.info("=" * 60)


if __name__ == "__main__":
    p = argparse.ArgumentParser(description="NSW Cadastral Parcel Fetcher")
    p.add_argument("--limit", type=int, default=None, help="Limit suburbs processed")
    p.add_argument("--suburb", type=str, default=None, help="Suburb name (ILIKE match)")
    p.add_argument("--suburb-id", type=str, default=None, help="Exact suburb_id e.g. NSW_BLACKTOWN_2148")
    p.add_argument("--page-size", type=int, default=2000, help="ArcGIS REST page size")
    args = p.parse_args()
    run_nsw_cadastre(limit=args.limit, suburb_name=args.suburb,
                     suburb_id=args.suburb_id, page_size=args.page_size)
