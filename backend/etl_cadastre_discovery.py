"""
etl_cadastre_discovery.py — Survey open cadastral / parcel datasets via CKAN
=============================================================================
Records which government land-parcel / subdivision datasets are available per
state and exposes them via the `data_sources` table (see
migrate_data_sources.py). This is a CATALOGUE only — bulk cadastral downloads
are typically licence-restricted per state land registry, but their
WMS / WFS / ArcGIS REST services are freely readable for low-volume analytical
use. We capture those URLs + licence metadata so a future fetcher can pull
just the parcels intersecting a suburb/area of interest.

No API key required — all the endpoints below were verified keyless:

    https://data.gov.au/data/api/3/action/package_search?q=...
    https://data.nsw.gov.au/data/api/3/action/package_search?q=...
    https://www.data.qld.gov.au/api/3/action/package_search?q=...
    https://data.sa.gov.au/data/api/3/action/package_search?q=...
    https://catalogue.data.wa.gov.au/api/3/action/package_search?q=...

NON-BREAKING: this is additive. No existing scripts or tables are modified.
Idempotent — re-run safe (UPSERT on the unique key).

Usage:
    python etl_cadastre_discovery.py
"""
import os
import sys
import json
import logging
import argparse
import datetime
from sqlalchemy import text

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from models_v3 import SessionLocal  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s [CAD-DISCO] %(message)s")
log = logging.getLogger(__name__)

# The CKAN base URLs and the search terms to fire at each. We tag each portal
# with the state it primarily serves; federal data.gov.au also hosts state
# records (often duplicated) — we mark those with state=NULL andpublisher for
# later deduplication.
PORTALS = [
    ("AUS", "https://data.gov.au/data/api/3/action"),
    ("NSW", "https://data.nsw.gov.au/data/api/3/action"),
    ("QLD", "https://www.data.qld.gov.au/api/3/action"),
    ("SA",  "https://data.sa.gov.au/data/api/3/action"),
    ("WA",  "https://catalogue.data.wa.gov.au/api/3/action"),
    ("VIC", "https://findogl.data.vic.gov.au/api/3/action"),
]

# Search terms relevant to cadastral / subdivision / parcel analysis.
SEARCH_TERMS = ["cadastral", "parcels land", "subdivision lot plan",
                 "land parcel", "property boundaries"]

# Formats we care about (keep list short so the catalogue stays actionable).
INTERESTING_FORMATS = {"WFS", "WMS", "ARCGIS REST SERVICE", "REST",
                       "GEOJSON", "GPKG", "GEOPACKAGE",
                       "SHAPEFILE", "FGDB", "FILE GEODATABASE",
                       "ARCGIS REST"}

UA = {"User-Agent": "realestate-etl/3.0"}


def _package_search(base_url: str, q: str, rows=40, start=0):
    import requests
    url = f"{base_url}/package_search"
    params = {"q": q, "rows": rows, "start": start}
    r = requests.get(url, params=params, headers=UA, timeout=30)
    if r.status_code != 200:
        return None
    try:
        return r.json().get("result", {})
    except Exception:
        return None


def _classify_format(fmt: str) -> str | None:
    if not fmt:
        return None
    f = fmt.strip().upper()
    return f if f in INTERESTING_FORMATS else None


SURVEY_SQL = """
INSERT INTO data_sources
    (category, state, dataset_name, dataset_title, publisher, license_id,
     is_open, resource_format, resource_url, resource_name, last_verified, raw_metadata)
VALUES
    ('cadastre', :state, :name, :title, :publisher, :license,
     :is_open, :fmt, :url, :rname, :now,
     CAST(:meta AS JSONB))
ON CONFLICT (category, dataset_name, resource_format, resource_url) DO UPDATE SET
    dataset_title = EXCLUDED.dataset_title,
    publisher = EXCLUDED.publisher,
    license_id = EXCLUDED.license_id,
    is_open = EXCLUDED.is_open,
    last_verified = EXCLUDED.last_verified,
    raw_metadata = EXCLUDED.raw_metadata
"""


def run():
    import requests
    log.info("=" * 64)
    log.info("Cadastre / parcel dataset discovery via data.gov.au CKANs")
    log.info("=" * 64)

    session = SessionLocal()
    seen_packages = set()
    inserted = 0
    now = datetime.datetime.utcnow()

    try:
        for state_tag, base_url in PORTALS:
            log.info(f"→ Portal {state_tag}  {base_url}")
            for term in SEARCH_TERMS:
                log.info(f"    search '{term}' ...")
                try:
                    result = _package_search(base_url, term, rows=40)
                except Exception as e:
                    log.warning(f"    ⚠ search failed: {e}")
                    continue
                if not result:
                    log.info(f"    no result")
                    continue
                count = result.get("count", 0)
                results = result.get("results", [])
                log.info(f"    portal returned {len(results)} of {count} packages")
                for pkg in results:
                    pname = pkg.get("name")
                    if not pname or pname in seen_packages:
                        continue
                    # Filter cadastral-ish packages by name/title keywords so we
                    # don't catalogue unrelated hits (CKAN free-text search is noisy).
                    blob = (
                        (pname or "") + " " +
                        (pkg.get("title") or "") + " " +
                        " ".join(t.get("name", "") for t in (pkg.get("tags") or []))
                    ).lower()
                    if not any(kw in blob for kw in
                               ("cadast", "parcel", "lot plan", "subdivision",
                                "land parcel", "lot/plan", "land title")):
                        continue
                    seen_packages.add(pname)
                    publisher = (pkg.get("organization") or {}).get("name")
                    license_id = pkg.get("license_id")
                    is_open = bool(pkg.get("isopen"))
                    for res in pkg.get("resources", []) or []:
                        fmt = _classify_format(res.get("format", ""))
                        if not fmt:
                            continue
                        rurl = res.get("url")
                        if not rurl:
                            continue
                        rname = res.get("name")
                        meta = json.dumps({
                            "package_id": pkg.get("id"),
                            "package_name": pname,
                            "title": pkg.get("title"),
                            "publisher": publisher,
                            "license_id": license_id,
                            "is_open": is_open,
                            "format": fmt,
                            "resource_name": rname,
                            "notes_excerpt": (pkg.get("notes") or "")[:500],
                        })
                        try:
                            session.execute(text(SURVEY_SQL), {
                                "state": state_tag if state_tag != "AUS" else None,
                                "name": pname,
                                "title": pkg.get("title"),
                                "publisher": publisher,
                                "license": license_id,
                                "is_open": is_open,
                                "fmt": fmt,
                                "url": rurl,
                                "rname": rname,
                                "now": now,
                                "meta": meta,
                            })
                            inserted += 1
                        except Exception as e:
                            log.warning(f"    ✗ insert failed for {pname}/{fmt}: {e}")
                session.commit()
        log.info("=" * 64)
        log.info(f"  Catalogued {inserted} cadastre resources across {len(seen_packages)} datasets")
        log.info("=" * 64)
    finally:
        session.close()


def main():
    p = argparse.ArgumentParser(description="Discover cadastre datasets via CKAN")
    p.parse_args()
    run()


if __name__ == "__main__":
    main()
