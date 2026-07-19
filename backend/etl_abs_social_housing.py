"""
etl_abs_social_housing.py — ABS Census 2021 G37 social-housing enrichment
==========================================================================
Downloads the same Census 2021 SAL DataPack as etl_abs_census.py (keyless, ABS
direct, CC BY 4.0), parses the G37 table ("Tenure and Landlord Type by Dwelling
Structure") at SAL/Suburb level, and populates the public_housing_dwellings,
community_housing_dwellings, renter_state_housing_pct, renter_community_housing_pct,
social_housing_pct and abs_g37_sourced / abs_g37_run_date columns on suburbs_ui_v3.

Census 2021 G37 landlord-type codes (verified against the live ABS Data API
codelist CL_C21_TENLLD01 returned by
    https://data.api.abs.gov.au/rest/dataflow/ABS/C21_G37_LGA/latest?references=descendants):
    4 = Rented: State or territory housing authority   (PUBLIC housing)
    5 = Rented: Community housing provider              (COMMUNITY housing)
    3 = Rented: Real estate agent
    6 = Rented: Person not in same household
    7 = Rented: Other landlord type

Social housing ≈ codes 4 + 5. We compute percentages against the total dwellings
column (the G37 "_T" / "Total" column) — NOT against total renting — because the
question for a real-estate analyst is "what fraction of the suburb's housing is
social housing?", which is dwellings_4_plus_5 / total_dwellings.

NON-BREAKING: only writes to the new columns declared in migrate_social_infra.py.
Idempotent — safe to re-run. Reuses the same cache ZIP as etl_abs_census.py so
no duplicate 102 MB download if that pipeline already ran.

Usage:
    python etl_abs_social_housing.py
    python etl_abs_social_housing.py --state VIC
    python etl_abs_social_housing.py --limit 200
"""
import os
import sys
import csv
import io
import json
import re
import zipfile
import logging
import argparse
import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ABS-G37] %(message)s")
log = logging.getLogger(__name__)

# Re-use the same cache directory and concordance URL as the existing ABS census
# pipeline so we don't double-download the 102 MB DataPack.
from etl_abs_census import (   # noqa: E402
    ABS_SAL_DATAPACK_URL,
    ABS_SAL_POSTCODE_URL,
    DATAPACK_CACHE,
    CONCORDANCE_CACHE,
    _download,
    _safe_float,
    _safe_int,
    build_sal_postcode_map,
)
from models_v3 import SessionLocal, SuburbUIV3   # noqa: E402


# ────────────────────────────────────────────────────────────────────────────
# G37 column-name detection
# -------------------------
# The 2021 DataPack "short-header" naming convention is compact (e.g.
# R_4_T_TDs_TT_LLT_4 — Total Dwellings, Rented, Landlord type 4). The names
# change slightly between DataPack editions. Instead of hard-coding exact
# names, we read the header row and pick the columns with helper heuristics.
# ────────────────────────────────────────────────────────────────────────────
def _find_g37_file(zf: zipfile.ZipFile) -> str | None:
    """Find the G37 SAL CSV inside the DataPack ZIP."""
    candidates = [f for f in zf.namelist()
                  if "_G37_" in f and "SAL" in f and f.endswith(".csv")]
    return candidates[0] if candidates else None


def _index_landlord_columns(header: list[str]) -> dict:
    """Inspect the G37 CSV header row and pick the right columns.

    Returns a dict with keys: total, ll4, ll5 used by the parser.

    Verified column names for the 2021 Census GCP SAL DataPack (short header):
      - "Total_Total"               = grand total dwellings
      - "R_ST_h_auth_Total"         = Rented: State/territory housing authority (public housing)
      - "R_Com_Hp_Total"            = Rented: Community housing provider

    Also support a couple of historical / alt namings defensively.
    """
    total = ll4 = ll5 = None
    # Prefer exact matches with widely-seen 2021 SAL DataPack column names.
    exact_total = ("Total_Total", "Tot_TDs_T", "TotD_TDs_T", "Tot_TDs")
    exact_ll4   = ("R_ST_h_auth_Total", "R_ST_h_auth_T", "R_St_h_auth_Total", "R_4_T_TDs_TT_LLT_4")
    exact_ll5   = ("R_Com_Hp_Total",  "R_Com_Hp_T",    "R_Com_hp_Total",  "R_5_T_TDs_TT_LLT_5")
    for col in header:
        c = col.strip()
        if total is None and c in exact_total:
            total = col
        if ll4 is None and c in exact_ll4:
            ll4 = col
        if ll5 is None and c in exact_ll5:
            ll5 = col
    # Fallbacks via partial matching if exact names changed
    if total is None:
        for col in header:
            c = col.strip()
            if c == "Total_Total" or (c.endswith("_Total") and c.startswith("Total")):
                total = col
                break
    if ll4 is None:
        for col in header:
            c = col.strip()
            lc = c.lower()
            if ("R_ST" in c and ("h_auth" in lc or "h_au" in lc) and c.endswith("_Total")) or c.endswith("LLT_4"):
                ll4 = col
                break
    if ll5 is None:
        for col in header:
            c = col.strip()
            lc = c.lower()
            if ("R_Com" in c and "hp" in lc and c.endswith("_Total")) or c.endswith("LLT_5"):
                ll5 = col
                break
    return {"total": total, "ll4": ll4, "ll5": ll5}


# ────────────────────────────────────────────────────────────────────────────
# Parser: read G37 from the cached DataPack ZIP and reduce to per-SAL counts
# ────────────────────────────────────────────────────────────────────────────
def parse_g37(sal_codes_needed: set) -> dict:
    """Parse G37 SAL CSV from the DataPack ZIP; return {sal_code: {...}}.

    Only rows whose SAL_CODE_2021 is in sal_codes_needed are kept (saves RAM
    across ~13k suburbs).
    """
    _download(ABS_SAL_DATAPACK_URL, DATAPACK_CACHE, "Census 2021 SAL DataPack (102 MB)")
    out: dict[str, dict] = {}
    with zipfile.ZipFile(DATAPACK_CACHE, "r") as zf:
        g37_name = _find_g37_file(zf)
        if not g37_name:
            log.error("G37 SAL CSV not found in DataPack zip")
            return out
        log.info(f"  Parsing {g37_name} ...")
        with zf.open(g37_name) as f:
            reader = csv.reader(io.TextIOWrapper(f, encoding="utf-8-sig"))
            header = next(reader)
            cols = _index_landlord_columns(header)
            log.info(f"  Detected G37 columns: total={cols['total']!r} ll4={cols['ll4']!r} ll5={cols['ll5']!r}")
            if not (cols["total"] and cols["ll4"] and cols["ll5"]):
                log.error("  ✗ Could not locate all required G37 columns — aborting parse")
                return out
            ti = header.index(cols["total"])
            l4i = header.index(cols["ll4"])
            l5i = header.index(cols["ll5"])
            si = header.index("SAL_CODE_2021")
            for row in reader:
                if len(row) <= max(ti, l4i, l5i, si):
                    continue
                sal_raw = (row[si] or "").strip()
                if not sal_raw:
                    continue
                # DataPack SAL code is "SAL10001" while the allocation file
                # uses bare "10001" — normalise to bare digits for matching.
                sal = re.sub(r"^[^0-9]+", "", sal_raw)
                if sal not in sal_codes_needed:
                    continue
                total = _safe_float(row[ti]) or 0
                ll4 = _safe_float(row[l4i]) or 0
                ll5 = _safe_float(row[l5i]) or 0
                out[sal] = {
                    "total_dwellings": int(total),
                    "public_housing_dwellings": int(ll4),
                    "community_housing_dwellings": int(ll5),
                }
    log.info(f"  ✓ Parsed {len(out):,} SAL rows from G37")
    return out


# ────────────────────────────────────────────────────────────────────────────
# Main pipeline
# ────────────────────────────────────────────────────────────────────────────
def run_abs_social_housing(state_filter=None, limit=None, batch_size=500):
    log.info("=" * 64)
    log.info("ABS Census 2021 G37 Social Housing Pipeline — starting")
    log.info(f"  state={state_filter or 'ALL'}  limit={limit or 'none'}")
    log.info("=" * 64)

    # 1. Build SAL map and reverse lookups
    sal_map = build_sal_postcode_map()
    if not sal_map:
        log.error("SAL→postcode map empty — aborting")
        return
    name_postcode_to_sal = {}
    postcode_to_sals = {}
    for sal_code, info in sal_map.items():
        name_postcode_to_sal[(info["name"], info["postcode"])] = sal_code
        postcode_to_sals.setdefault(info["postcode"], []).append(sal_code)

    # 2. Load suburbs
    db = SessionLocal()
    try:
        q = db.query(SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.postcode, SuburbUIV3.state)
        if state_filter:
            q = q.filter(SuburbUIV3.state == state_filter.upper())
        if limit:
            q = q.limit(limit)
        suburbs = q.all()
        log.info(f"  Loaded {len(suburbs):,} candidate suburbs from DB")

        # 3. Match suburb -> SAL code (reuse logic from etl_abs_census)
        matched = {}
        unmatched = 0
        for sid, name, postcode, state in suburbs:
            up = (name or "").upper().strip()
            sal = name_postcode_to_sal.get((up, postcode or ""))
            if not sal:
                cands = postcode_to_sals.get(postcode or "", [])
                sal = cands[0] if len(cands) == 1 else None
                if not sal:
                    unmatched += 1
                    continue
            matched[sid] = sal
        log.info(f"  Matched {len(matched):,} suburbs, {unmatched:,} unmatched")

        # 4. Parse only the SALs we need
        g37 = parse_g37(set(matched.values()))

        # 5. Update DB in batches
        now = datetime.datetime.utcnow()
        items = list(matched.items())
        updated = 0
        skipped = 0
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            for sid, sal in batch:
                d = g37.get(sal)
                if not d:
                    skipped += 1
                    continue
                total = d["total_dwellings"]
                ll4 = d["public_housing_dwellings"]
                ll5 = d["community_housing_dwellings"]
                state_pct = min(round(ll4 / total * 100, 2), 100.0) if total else 0.0
                community_pct = min(round(ll5 / total * 100, 2), 100.0) if total else 0.0
                social_pct = min(round((ll4 + ll5) / total * 100, 2), 100.0) if total else 0.0
                db.query(SuburbUIV3).filter(SuburbUIV3.id == sid).update(
                    {
                        "public_housing_dwellings": ll4,
                        "community_housing_dwellings": ll5,
                        "renter_state_housing_pct": state_pct,
                        "renter_community_housing_pct": community_pct,
                        "social_housing_pct": social_pct,
                        "abs_g37_sourced": True,
                        "abs_g37_run_date": now,
                    },
                    synchronize_session=False,
                )
                updated += 1
            db.commit()
            log.info(f"  Batch {i // batch_size + 1}: committed "
                     f"{min(i + batch_size, len(items))}/{len(items)}")
    finally:
        db.close()

    log.info("=" * 64)
    log.info(f"ABS G37 Social Housing Pipeline — complete")
    log.info(f"  Updated:  {updated:,}")
    log.info(f"  Skipped:  {skipped:,} (no G37 row for that SAL)")
    log.info(f"  Unmatched:{unmatched:,} (suburb has no SAL code)")
    log.info("=" * 64)


def main():
    p = argparse.ArgumentParser(description="ABS Census 2021 G37 social housing enrichment")
    p.add_argument("--state", type=str, default=None, help="Filter to one state e.g. VIC")
    p.add_argument("--limit", type=int, default=None, help="Limit suburbs processed (pilot)")
    args = p.parse_args()
    run_abs_social_housing(state_filter=args.state, limit=args.limit)


if __name__ == "__main__":
    main()
