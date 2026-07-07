"""
unpack_json_to_table.py — One-time JSON → Columnar Extraction
=============================================================
Reads raw_json from suburbs_raw_v3, extracts all fields into 
suburbs_unpacked_v3 columns. Runs ONCE — enrichment then
becomes pure SQL from this table.

Handles:
- All 16 market metrics (8 House + 8 Unit) with 10yr history
- Census demographics (age, income, household, occupancy)
- Description text parsing (area, parks, mortgage, occupation)
- Property counts (off-market, listings, recent sales)
- Nearby suburbs, sales summary
"""
import json
import datetime
import re
import sys
from models_v3 import SessionLocal, SuburbRawV3
from models_v3_unpacked import SuburbUnpackedV3


REGISTRY = {
    "sale_price_h":  ("Median Sale Price (12 months)",      "Dollar",  "House", "house_sale_price"),
    "sale_price_u":  ("Median Sale Price (12 months)",      "Dollar",  "Unit",  "unit_sale_price"),
    "value_h":       ("Median Value (monthly)",             "Dollar",  "House", "house_median_value"),
    "value_u":       ("Median Value (monthly)",             "Dollar",  "Unit",  "unit_median_value"),
    "change_12m_h":  ("Change in Median Value (12 months)", "Percent", "House", "house_change_12m_pct"),
    "change_12m_u":  ("Change in Median Value (12 months)", "Percent", "Unit",  "unit_change_12m_pct"),
    "change_5yr_h":  ("Change in Median Value (5 years)",   "Percent", "House", "house_change_5yr_pct"),
    "change_5yr_u":  ("Change in Median Value (5 years)",   "Percent", "Unit",  "unit_change_5yr_pct"),
    "rent_h":        ("Median Asking Rent (12 months)",     "Dollar",  "House", "house_median_rent"),
    "rent_u":        ("Median Asking Rent (12 months)",     "Dollar",  "Unit",  "unit_median_rent"),
    "rent_chg_h":    ("Change in Rental Rate (12 months)",  "Percent", "House", "house_rent_change_pct"),
    "rent_chg_u":    ("Change in Rental Rate (12 months)",  "Percent", "Unit",  "unit_rent_change_pct"),
    "yield_h":       ("Value Based Gross Rental Yield",      "Percent", "House", "house_gross_rental_yield"),
    "yield_u":       ("Value Based Gross Rental Yield",      "Percent", "Unit",  "unit_gross_rental_yield"),
    "sold_12m_h":    ("Number Sold (12 months)",            "Number",  "House", "house_sold_12m"),
    "sold_12m_u":    ("Number Sold (12 months)",            "Number",  "Unit",  "unit_sold_12m"),
}


def r2(val):
    if val is None: return None
    try: return round(float(val), 2)
    except: return None


def r0(val):
    if val is None: return None
    try: return int(round(float(val)))
    except: return None


def extract_metrics(data):
    """Extract all market metrics + history from REDUX_DATA."""
    result = {}
    mt = data.get("marketTrends")
    if not isinstance(mt, dict): return result
    m = mt.get("metrics")
    if not isinstance(m, dict): return result

    for key, (metric_name, display, ptype, col_name) in REGISTRY.items():
        pt_data = m.get(ptype)
        if not isinstance(pt_data, dict): continue
        ml = pt_data.get("10", [])
        if not isinstance(ml, list):
            if isinstance(ml, dict): ml = list(ml.values())
            else: continue

        for metric in ml:
            if not isinstance(metric, dict): continue
            if metric.get("metricType") != metric_name: continue
            if metric.get("metricDisplayType") != display: continue

            series = metric.get("seriesDataList", [])
            if not isinstance(series, list) or len(series) == 0:
                break

            latest = series[-1].get("value") if isinstance(series[-1], dict) else None

            if col_name.endswith("_pct") or col_name.endswith("_yield"):
                result[col_name] = r2(latest)
            elif col_name.endswith("_12m") or col_name == "house_sold_12m" or col_name == "unit_sold_12m":
                result[col_name] = r0(latest)
            else:
                result[col_name] = r2(latest)

            # History (normalized {date, value})
            if "_h" in key:
                hist_key = "house_price_history" if "sale_price" in key or "value" in key else (
                    "house_rent_history" if "rent" in key else None
                )
                if hist_key and hist_key not in result:
                    norm = []
                    for s in series:
                        if isinstance(s, dict) and s.get("value") is not None:
                            norm.append({"date": s.get("dateTime", ""), "value": s["value"]})
                    if norm: result[hist_key] = norm
            break

    return result


def extract_census(data):
    result = {}
    census = data.get("census")
    if not isinstance(census, dict): return result
    cm = census.get("metrics", {})
    if not isinstance(cm, dict): return result

    for item in cm.get("populationMetrics", []):
        if isinstance(item, dict) and item.get("category") == "Both":
            try: result["population_2021"] = int(float(item.get("percentVal", 0)))
            except: pass
            break

    op = 0.0; ip = 0.0
    for item in cm.get("occupancyMetrics", []):
        if isinstance(item, dict):
            cat = str(item.get("category", "")).lower()
            pct = float(item.get("percentVal", 0))
            if "owns" in cat or "purchaser" in cat: op += pct
            elif "renting" in cat: ip += pct
    if op > 0: result["owner_occupier_rate"] = r2(op)
    if ip > 0: result["investor_rate"] = r2(ip)

    ba = None; bap = 0.0; tp = 0.0; ws = 0.0; age_dist = {}
    for item in cm.get("ageMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0)); cat = str(item.get("category", ""))
                age_dist[cat] = pct
                if pct > bap: bap = pct; ba = cat
                if "-" in cat:
                    mid = (int(cat.split("-")[0]) + int(cat.split("-")[1])) / 2
                elif "+" in cat: mid = float(cat.replace("+", ""))
                else: continue
                ws += mid * pct; tp += pct
            except: pass
    if ba: result["predominant_age_group"] = ba
    if tp > 0: result["median_age"] = int(round(ws / tp))
    if age_dist: result["age_distribution"] = age_dist

    hh_dist = {}; best_hh = None; best_hhp = 0.0
    for item in cm.get("householdMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0)); cat = str(item.get("category", ""))
                hh_dist[cat] = pct
                if pct > best_hhp: best_hhp = pct; best_hh = cat
            except: pass
    if best_hh: result["predominant_household"] = best_hh
    if hh_dist: result["household_distribution"] = hh_dist

    inc_dist = {}; best_inc = None; best_incp = 0.0
    for item in cm.get("incomeMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0)); cat = str(item.get("category", ""))
                inc_dist[cat] = pct
                if pct > best_incp: best_incp = pct; best_inc = cat
            except: pass
    if best_inc: result["predominant_income_band"] = best_inc
    if inc_dist: result["income_distribution"] = inc_dist

    return result


def parse_description(raw):
    if not raw or not isinstance(raw, str): return {}
    d = {}
    m = re.search(r'approximately\s+([\d,.]+)\s+square\s+kilometres?', raw, re.I)
    if m:
        try: d["area_sqkm"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'There\s+are\s+(\d+)\s+parks?', raw, re.I)
    if m:
        try: d["parks_count"] = int(m.group(1))
        except: pass
    m = re.search(r'covering\s+(?:nearly\s+)?([\d,.]+)\s*%', raw, re.I)
    if m:
        try: d["parks_coverage_pct"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'population\s+(?:of\s+\w+\s+)?in\s+2016\s+was\s+([\d,]+)\s+people', raw, re.I)
    if m:
        try: d["population_2016"] = int(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'population\s+growth\s+of\s+([\d,\-.]+)\s*%', raw, re.I)
    if m:
        try: d["population_cagr"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'likely\s+to\s+be\s+repaying\s+(\$[\d,]+\s*-\s*\$[\d,]+)\s+per\s+month', raw, re.I)
    if m: d["typical_mortgage_band"] = m.group(1).strip()
    m = re.search(r'people\s+(?:generally\s+)?(?:in\s+\w[\w\s]*?\s+)?work\s+in\s+(?:a\s+|an\s+)?([\w\s\-]+?)\s+occupation', raw, re.I)
    if m: d["predominant_occupation"] = m.group(1).strip().title()
    m = re.search(r'In\s+2021,\s+([\d,.]+)\s*%\s+of\s+the\s+homes.*?were\s+owner-occupied', raw, re.I)
    if m:
        try: d["owner_2021_desc"] = r2(m.group(1).replace(",", ""))
        except: pass
    return d


def extract_nearby(data):
    ss = data.get("surroundingSuburbs")
    if not isinstance(ss, dict): return None
    subs = ss.get("surroundingSuburbs", [])
    if not isinstance(subs, list) or len(subs) == 0: return None
    return [{"id": s.get("propertyId", ""), "name": s.get("suburb", ""),
             "state": s.get("stateCode", ""), "postcode": s.get("postCode", "")}
            for s in subs[:20] if isinstance(s, dict)]


def extract_sales(data):
    sp = data.get("suburbProperty")
    if not isinstance(sp, dict): return None
    detail = sp.get("detail")
    if not isinstance(detail, dict): return None
    sold = detail.get("sold", [])
    if not isinstance(sold, list) or len(sold) == 0: return None
    result = []
    for item in sold[:10]:
        if not isinstance(item, dict): continue
        addr = item.get("address", {})
        ls = item.get("lastSale", {})
        result.append({
            "address": addr.get("formattedAddress", "") if isinstance(addr, dict) else "",
            "type": item.get("type"),
            "beds": item.get("beds"),
            "baths": item.get("baths"),
            "salePrice": ls.get("salePrice") if isinstance(ls, dict) else None,
            "saleDate": ls.get("eventDate") if isinstance(ls, dict) else None,
        })
    return result if result else None


def unpack_all(limit=200, max_batches=None):
    db = SessionLocal()

    done = {r[0] for r in db.query(SuburbUnpackedV3.id).filter(
        SuburbUnpackedV3.is_unpacked == "complete"
    ).all()}

    raw_records = db.query(SuburbRawV3).filter(
        SuburbRawV3.status == "complete",
        ~SuburbRawV3.id.in_(done) if done else True
    ).limit(limit).all()

    if not raw_records:
        print("No raw suburbs to unpack.")
        db.close()
        return

    print(f"Unpacking {len(raw_records)} suburbs...")
    ok = err = 0

    for raw in raw_records:
        try:
            data = raw.raw_json
            if not data: continue
            if isinstance(data, str): data = json.loads(data)

            mm = extract_metrics(data)
            demog = extract_census(data)

            sd = None
            si = data.get("suburb")
            if isinstance(si, dict):
                sd_raw = si.get("suburb_detail")
                if isinstance(sd_raw, dict):
                    sd = sd_raw

            desc = {}
            desc_raw = sd.get("description", "") if sd else ""
            if desc_raw: desc = parse_description(desc_raw)

            nearby = extract_nearby(data)
            sales = extract_sales(data)

            up = db.query(SuburbUnpackedV3).get(raw.id)
            if not up:
                up = SuburbUnpackedV3(id=raw.id)
                db.add(up)

            up.state = raw.state
            up.name = raw.name
            up.postcode = raw.postcode
            up.is_unpacked = "complete"

            # Market metrics
            for col in ["house_sale_price", "house_median_value", "house_change_12m_pct",
                       "house_change_5yr_pct", "house_median_rent", "house_rent_change_pct",
                       "house_gross_rental_yield", "house_sold_12m",
                       "unit_sale_price", "unit_median_value", "unit_change_12m_pct",
                       "unit_change_5yr_pct", "unit_median_rent", "unit_rent_change_pct",
                       "unit_gross_rental_yield", "unit_sold_12m"]:
                if col in mm:
                    setattr(up, col, mm[col])

            if "house_price_history" in mm: up.house_price_history = mm["house_price_history"]
            if "house_rent_history" in mm: up.house_rent_history = mm["house_rent_history"]

            # Census
            for col in ["population_2021", "owner_occupier_rate", "investor_rate",
                       "median_age", "predominant_age_group", "predominant_household",
                       "predominant_income_band"]:
                if col in demog:
                    setattr(up, col, demog[col])
            if "age_distribution" in demog: up.age_distribution = demog["age_distribution"]
            if "household_distribution" in demog: up.household_distribution = demog["household_distribution"]
            if "income_distribution" in demog: up.income_distribution = demog["income_distribution"]

            # Description
            if desc_raw: up.description_raw = desc_raw
            for col in ["area_sqkm", "parks_count", "parks_coverage_pct", "population_2016",
                       "population_cagr", "typical_mortgage_band", "predominant_occupation",
                       "owner_2021_desc"]:
                if col in desc:
                    setattr(up, col, desc[col])

            # Property counts
            if sd:
                for sc, col in [
                    ("currentOffMarketCount", "current_off_market_count"),
                    ("currentSaleListingCount", "current_sale_listing_count"),
                    ("currentRentalListingCount", "current_rental_listing_count"),
                    ("currentRecentSalesCount", "current_recent_sales_count"),
                    ("currentRecentSalesCountByHouse", "current_recent_sales_count_house"),
                    ("currentRecentSalesCountByUnit", "current_recent_sales_count_unit"),
                ]:
                    val = sd.get(sc)
                    if val is not None:
                        try: setattr(up, col, int(val))
                        except: pass

            # Complex objects
            up.nearby_suburbs = nearby
            up.sales_summary = sales
            up.unpacked_at = datetime.datetime.utcnow()

            ok += 1
            if ok % 200 == 0:
                db.commit()
                print(f"  [{ok}/{len(raw_records)}] unpacked...")

        except Exception as e:
            import traceback
            print(f"  ERROR {raw.id}: {e}")
            traceback.print_exc()
            err += 1

    db.commit()
    db.close()
    print(f"\nDone: {ok} ok, {err} err")


def unpack_loop(batch_size=200, max_batches=None):
    total, n = 0, 0
    while True:
        n += 1
        if max_batches and n > max_batches: break
        print(f"\n=== UNPACK BATCH {n} (size={batch_size}) ===")
        before = total
        unpack_all(limit=batch_size)
        db = SessionLocal()
        total = db.query(SuburbUnpackedV3).filter(SuburbUnpackedV3.is_unpacked == "complete").count()
        db.close()
        if total == before:
            print("All records unpacked.")
            break
    print(f"\nTotal unpacked: {total}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--loop":
        unpack_loop(
            batch_size=int(sys.argv[2]) if len(sys.argv) > 2 else 200,
            max_batches=int(sys.argv[3]) if len(sys.argv) > 3 else None
        )
    else:
        unpack_all(limit=int(sys.argv[1]) if len(sys.argv) > 1 else 200)
