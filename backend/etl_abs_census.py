"""
etl_abs_census.py — ABS Census 2021 Demographics Pipeline
==========================================================
Downloads the ABS Census 2021 SAL (Suburb/Locality) DataPack,
parses G01 (population/age), G33 (income), G32 (tenure/ownership),
and merges into suburbs_ui_v3, overriding the OnTheHouse-sourced
demographic fields with authoritative government data.

Data source: Australian Bureau of Statistics
Licence:     Creative Commons Attribution 4.0 (CC BY 4.0)
URL:         https://www.abs.gov.au/census/find-census-data/datapacks

Legal note:  ABS data is Crown copyright, licensed for free use with
             attribution. Using this data to replace scraped demographics
             is a critical legal defensibility measure.
"""
import os
import io
import csv
import json
import zipfile
import datetime
import logging
import requests
from pathlib import Path
from sqlalchemy import text
from models_v3 import SessionLocal, SuburbUIV3

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ABS] %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# ABS DataPack URLs — Census 2021, SAL (Suburb/Locality) level, Short Header
# CC BY 4.0 — free, no API key required
# ---------------------------------------------------------------------------
ABS_SAL_DATAPACK_URL = (
    "https://www.abs.gov.au/census/find-census-data/datapacks/download/"
    "2021_GCP_SAL_for_AUS_short-header.zip"
)
# SAL → Postcode concordance from ABS ASGS 2021
ABS_SAL_POSTCODE_URL = (
    "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/"
    "jul2021-jun2026/access-and-downloads/allocation-files/SAL_2021_AUST.csv"
)

CACHE_DIR = Path(__file__).parent / "data" / "abs_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DATAPACK_CACHE = CACHE_DIR / "2021_GCP_SAL_AUS.zip"
CONCORDANCE_CACHE = CACHE_DIR / "SAL_2021_AUST.csv"


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------
def _download(url: str, dest: Path, label: str):
    """Download a file with progress logging. Skips if already cached."""
    if dest.exists() and dest.stat().st_size > 100_000:
        log.info(f"  Cache hit: {dest.name} ({dest.stat().st_size // 1_000_000} MB)")
        return
    log.info(f"  Downloading {label} from ABS...")
    headers = {"Accept-Encoding": "gzip, deflate", "User-Agent": "realestate-etl/3.0"}
    with requests.get(url, headers=headers, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length", 0))
        downloaded = 0
        with open(dest, "wb") as f:
            for chunk in r.iter_content(chunk_size=1_048_576):
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    if pct % 10 == 0:
                        log.info(f"    {pct}% ({downloaded // 1_000_000} MB / {total // 1_000_000} MB)")
    log.info(f"  ✓ Downloaded {dest.name}")


# ---------------------------------------------------------------------------
# Step 1: Build SAL code → Postcode mapping
# ---------------------------------------------------------------------------
def build_sal_postcode_map() -> dict:
    """
    Reads ABS SAL→POA concordance.
    Returns dict: sal_code (str) → postcode (str)
    The SAL file also has suburb name and state for cross-referencing.
    """
    _download(ABS_SAL_POSTCODE_URL, CONCORDANCE_CACHE, "SAL→Postcode concordance")
    mapping = {}
    try:
        with open(CONCORDANCE_CACHE, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                sal_code = row.get("SAL_CODE_2021", "").strip()
                postcode = row.get("POA_CODE_2021", row.get("POSTCODE_2021", "")).strip()
                sal_name = row.get("SAL_NAME_2021", "").strip().upper()
                state = row.get("STATE_NAME_2021", "").strip()
                if sal_code and postcode:
                    # Store both code→postcode and (name+postcode)→code for lookup
                    mapping[sal_code] = {
                        "postcode": postcode,
                        "name": sal_name,
                        "state": state,
                    }
    except Exception as e:
        log.error(f"  Failed to parse concordance: {e}")
    log.info(f"  Built SAL→Postcode map: {len(mapping):,} entries")
    return mapping


# ---------------------------------------------------------------------------
# Step 2: Parse Census tables from ZIP
# ---------------------------------------------------------------------------
def parse_census_tables(sal_codes: set) -> dict:
    """
    Opens the ABS DataPack ZIP in-memory and parses:
      - G01: Total persons, age summary
      - G33: Income bands (weekly personal income)
      - G32: Tenure type (owner, renter, etc.)
    Returns dict: sal_code → parsed demographics dict
    """
    _download(ABS_SAL_DATAPACK_URL, DATAPACK_CACHE, "Census 2021 SAL DataPack (102 MB)")

    results = {}

    log.info("  Parsing Census tables from DataPack ZIP...")
    with zipfile.ZipFile(DATAPACK_CACHE, "r") as zf:
        all_files = zf.namelist()

        # Identify table files — short header format names like:
        # 2021Census_G01_AUS_SAL.csv, 2021Census_G33_AUS_SAL.csv, etc.
        def find_table(table_id):
            matches = [f for f in all_files if f"_{table_id}_" in f and "SAL" in f and f.endswith(".csv")]
            return matches[0] if matches else None

        # ── G01: Selected Person Characteristics ──────────────────────────
        g01_file = find_table("G01")
        if g01_file:
            log.info(f"  Parsing {g01_file}...")
            with zf.open(g01_file) as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    sal = row.get("SAL_CODE_2021", "").strip()
                    if sal not in sal_codes:
                        continue
                    if sal not in results:
                        results[sal] = {}
                    try:
                        results[sal]["population_2021"] = int(float(row.get("Tot_P_P", 0) or 0))
                        results[sal]["median_age_persons"] = _safe_int(row.get("Median_age_persons"))
                    except Exception:
                        pass

        # ── G04: Age by Sex (for age distribution) ────────────────────────
        g04_file = find_table("G04")
        if g04_file:
            log.info(f"  Parsing {g04_file}...")
            age_bands = [
                ("0_4", "0-4"), ("5_14", "5-14"), ("15_24", "15-24"),
                ("25_34", "25-34"), ("35_44", "35-44"), ("45_54", "45-54"),
                ("55_64", "55-64"), ("65_74", "65-74"), ("75_84", "75-84"),
                ("85ov", "85+"),
            ]
            with zf.open(g04_file) as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    sal = row.get("SAL_CODE_2021", "").strip()
                    if sal not in sal_codes:
                        continue
                    if sal not in results:
                        results[sal] = {}
                    dist = {}
                    for col_key, label in age_bands:
                        val = _safe_float(row.get(f"Age_{col_key}_yr_P") or row.get(f"P_{col_key}_yr_P"))
                        if val is not None:
                            dist[label] = val
                    if dist:
                        results[sal]["age_distribution"] = dist
                        # Predominant age band
                        dominant = max(dist, key=dist.get)
                        results[sal]["predominant_age_group"] = dominant

        # ── G33: Income (Weekly Personal Income) ──────────────────────────
        g33_file = find_table("G33")
        if g33_file:
            log.info(f"  Parsing {g33_file}...")
            # Column name patterns for weekly income bands (persons total)
            income_map = {
                "Neg_Nil_income_P": "Nil/Negative",
                "1_149_P": "$1-$149",
                "150_299_P": "$150-$299",
                "300_399_P": "$300-$399",
                "400_499_P": "$400-$499",
                "500_649_P": "$500-$649",
                "650_799_P": "$650-$799",
                "800_999_P": "$800-$999",
                "1000_1249_P": "$1,000-$1,249",
                "1250_1499_P": "$1,250-$1,499",
                "1500_1749_P": "$1,500-$1,749",
                "1750_1999_P": "$1,750-$1,999",
                "2000_2999_P": "$2,000-$2,999",
                "3000_more_P": "$3,000+",
            }
            with zf.open(g33_file) as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    sal = row.get("SAL_CODE_2021", "").strip()
                    if sal not in sal_codes:
                        continue
                    if sal not in results:
                        results[sal] = {}
                    dist = {}
                    for col, label in income_map.items():
                        val = _safe_float(row.get(col))
                        if val is not None:
                            dist[label] = val
                    if dist:
                        total = sum(dist.values()) or 1
                        # Convert to percentages
                        dist_pct = {k: round(v / total * 100, 1) for k, v in dist.items()}
                        results[sal]["income_distribution"] = dist_pct
                        dominant = max(dist_pct, key=dist_pct.get)
                        results[sal]["predominant_income_band"] = dominant
                    # ABS G33 also has median — column name varies by edition
                    med = _safe_float(row.get("Median_tot_prsnl_inc_weekly") or row.get("Med_tot_prsnl_inc_weekly_P"))
                    if med:
                        results[sal]["median_weekly_income"] = med
                        results[sal]["median_annual_income"] = round(med * 52)

        # ── G32: Tenure Type ──────────────────────────────────────────────
        g32_file = find_table("G32")
        if g32_file:
            log.info(f"  Parsing {g32_file}...")
            with zf.open(g32_file) as f:
                reader = csv.DictReader(io.TextIOWrapper(f, encoding="utf-8-sig"))
                for row in reader:
                    sal = row.get("SAL_CODE_2021", "").strip()
                    if sal not in sal_codes:
                        continue
                    if sal not in results:
                        results[sal] = {}
                    # Owner with mortgage + Owner outright = owner occupiers
                    own_mortgage = _safe_float(row.get("O_OR_MTG_P") or row.get("Owned_outright_P") or 0)
                    own_outright = _safe_float(row.get("Owned_outright_P") or 0)
                    renting = _safe_float(row.get("Rented_P") or 0)
                    total_hh = _safe_float(row.get("Total_P") or 0)
                    if total_hh and total_hh > 0:
                        owner_pct = round(((own_mortgage or 0) + (own_outright or 0)) / total_hh * 100, 1)
                        investor_pct = round((renting or 0) / total_hh * 100, 1)
                        results[sal]["owner_occupier_rate"] = owner_pct
                        results[sal]["investor_rate"] = investor_pct

    log.info(f"  ✓ Parsed {len(results):,} SAL records from Census")
    return results


def _safe_float(val):
    try:
        return float(val) if val not in (None, "", "...", "-") else None
    except (ValueError, TypeError):
        return None


def _safe_int(val):
    try:
        return int(float(val)) if val not in (None, "", "...", "-") else None
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Step 3: Match census data to our suburbs and update DB
# ---------------------------------------------------------------------------
def run_abs_integration(batch_size: int = 500):
    """
    Main entry point.
    Downloads ABS data, matches to suburbs_ui_v3 by postcode+name,
    and overwrites demographic fields with authoritative ABS data.
    Sets abs_demographics_sourced = True on every updated row.
    """
    log.info("=" * 60)
    log.info("ABS Census 2021 Demographics Pipeline — Starting")
    log.info("=" * 60)

    # 1. Build postcode concordance
    sal_map = build_sal_postcode_map()
    if not sal_map:
        log.error("Could not build SAL map — aborting.")
        return

    # 2. Build reverse lookup: (UPPER_NAME, POSTCODE) → SAL_CODE
    name_postcode_to_sal: dict[tuple, str] = {}
    postcode_to_sals: dict[str, list] = {}
    for sal_code, info in sal_map.items():
        key = (info["name"], info["postcode"])
        name_postcode_to_sal[key] = sal_code
        postcode_to_sals.setdefault(info["postcode"], []).append(sal_code)

    # 3. Load suburb list from DB
    db = SessionLocal()
    try:
        suburbs = db.query(
            SuburbUIV3.id, SuburbUIV3.name, SuburbUIV3.postcode
        ).filter(SuburbUIV3.is_enriched == True).all()
    finally:
        db.close()

    log.info(f"  Found {len(suburbs):,} enriched suburbs to match against ABS")

    # 4. Match each suburb to a SAL code
    matched_sal_codes: dict[str, str] = {}  # suburb_id → SAL code
    unmatched = 0
    for sid, name, postcode in suburbs:
        upper_name = name.upper().strip() if name else ""
        # Try exact name+postcode match first
        sal = name_postcode_to_sal.get((upper_name, postcode or ""))
        if not sal:
            # Fall back to postcode-only match (take first SAL in that postcode)
            candidates = postcode_to_sals.get(postcode or "", [])
            sal = candidates[0] if len(candidates) == 1 else None
            if not sal:
                unmatched += 1
                continue
        matched_sal_codes[sid] = sal

    log.info(f"  Matched {len(matched_sal_codes):,} suburbs, {unmatched} unmatched")

    # 5. Parse only the SAL codes we actually need (saves memory)
    needed_sals = set(matched_sal_codes.values())
    census_data = parse_census_tables(needed_sals)

    # 6. Update DB in batches
    db = SessionLocal()
    updated = 0
    skipped = 0
    now = datetime.datetime.utcnow()

    try:
        suburb_iter = list(matched_sal_codes.items())
        for i in range(0, len(suburb_iter), batch_size):
            batch = suburb_iter[i:i + batch_size]
            for sid, sal in batch:
                c = census_data.get(sal)
                if not c:
                    skipped += 1
                    continue

                sourced_fields = []
                update_vals = {
                    "abs_demographics_sourced": True,
                    "abs_etl_run_date": now,
                }

                def _set(field, census_key):
                    val = c.get(census_key)
                    if val is not None:
                        update_vals[field] = val
                        sourced_fields.append(field)

                _set("population_2021", "population_2021")
                _set("median_age", "median_age_persons")
                _set("owner_occupier_rate", "owner_occupier_rate")
                _set("investor_rate", "investor_rate")
                _set("predominant_age_group", "predominant_age_group")
                _set("predominant_income_band", "predominant_income_band")

                # Update demographics_detail JSON with ABS data merged in
                demo_detail = {}
                if c.get("age_distribution"):
                    demo_detail["age_distribution"] = c["age_distribution"]
                    sourced_fields.append("age_distribution")
                if c.get("income_distribution"):
                    demo_detail["income_distribution"] = c["income_distribution"]
                    sourced_fields.append("income_distribution")
                if c.get("median_weekly_income"):
                    demo_detail["median_weekly_income_abs"] = c["median_weekly_income"]
                    demo_detail["median_annual_income_abs"] = c["median_annual_income"]
                    sourced_fields.append("median_annual_income")

                if demo_detail:
                    update_vals["demographics_detail"] = demo_detail

                # Compute price_to_income_ratio if we have both
                if c.get("median_annual_income") and "house_median_price" not in update_vals:
                    # We will let etl_transform_v3 recompute this on next run
                    pass

                update_vals["abs_sourced_fields"] = sourced_fields

                db.query(SuburbUIV3).filter(SuburbUIV3.id == sid).update(
                    update_vals, synchronize_session=False
                )
                updated += 1

            db.commit()
            log.info(f"  Batch {i // batch_size + 1}: committed {min(i + batch_size, len(suburb_iter))} / {len(suburb_iter)}")

    except Exception as e:
        log.error(f"Pipeline error: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    log.info("=" * 60)
    log.info(f"ABS Census Pipeline Complete")
    log.info(f"  Updated:  {updated:,} suburbs with real ABS 2021 data")
    log.info(f"  Skipped:  {skipped:,} (no census data for SAL code)")
    log.info(f"  Unmatched:{unmatched:,} (no SAL code found for suburb)")
    log.info(f"  Source:   ABS Census 2021 — CC BY 4.0")
    log.info("=" * 60)


if __name__ == "__main__":
    run_abs_integration()
