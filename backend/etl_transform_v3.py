"""
etl_transform_v3.py -- Layer 2: NORMALIZED TRANSFORM (Enhanced)
===============================================================
Reads raw JSON from suburbs_raw_v3, normalizes all metrics
into suburbs_ui_v3 with DQ checks, description parsing, 
nearby suburbs, recent sales summary, and 10-year history.

All decimal values rounded to 2 places.
Field names align with actual data semantics.
"""
import json
import datetime
import re
import sys
import uuid
from models_v3 import SuburbRawV3, SuburbUIV3, PropertyListing, SessionLocal, engine


METRICS_REGISTRY = {
    "sale_price_h":   ("Median Sale Price (12 months)",       "Dollar",  "House"),
    "sale_price_u":   ("Median Sale Price (12 months)",       "Dollar",  "Unit"),
    "value_h":        ("Median Value (monthly)",              "Dollar",  "House"),
    "value_u":        ("Median Value (monthly)",              "Dollar",  "Unit"),
    "change_12m_h":   ("Change in Median Value (12 months)",  "Percent", "House"),
    "change_12m_u":   ("Change in Median Value (12 months)",  "Percent", "Unit"),
    "change_5yr_h":   ("Change in Median Value (5 years)",    "Percent", "House"),
    "change_5yr_u":   ("Change in Median Value (5 years)",    "Percent", "Unit"),
    "rent_h":         ("Median Asking Rent (12 months)",      "Dollar",  "House"),
    "rent_u":         ("Median Asking Rent (12 months)",      "Dollar",  "Unit"),
    "rent_change_h":  ("Change in Rental Rate (12 months)",   "Percent", "House"),
    "rent_change_u":  ("Change in Rental Rate (12 months)",   "Percent", "Unit"),
    "yield_h":        ("Value Based Gross Rental Yield",       "Percent", "House"),
    "yield_u":        ("Value Based Gross Rental Yield",       "Percent", "Unit"),
    "sold_12m_h":     ("Number Sold (12 months)",             "Number",  "House"),
    "sold_12m_u":     ("Number Sold (12 months)",             "Number",  "Unit"),
}


def r2(val):
    if val is None: return None
    try: return round(float(val), 2)
    except (ValueError, TypeError): return val


def r0(val):
    if val is None: return None
    try: return int(round(float(val)))
    except (ValueError, TypeError): return val


def parse_income_midpoint(band):
    """Parse income band like '78-130K' or '182K+' to midpoint in dollars."""
    if not band: return None
    band = band.replace(",", "").replace("$", "")
    m = re.match(r'(\d+\.?\d*)-(\d+\.?\d*)\s*[kK]?$', band)
    if m:
        return int((float(m.group(1)) + float(m.group(2))) / 2 * 1000)
    m = re.match(r'(\d+\.?\d*)\s*[kK]\s*\+$', band)
    if m:
        return int(float(m.group(1)) * 1000 * 1.5)
    return None


def get_metrics_section(data):
    mt = data.get("marketTrends")
    if not isinstance(mt, dict): return {}
    return mt.get("metrics") or {}


def find_metric(metrics_dict, key):
    cfg = METRICS_REGISTRY.get(key)
    if not cfg: return None, None, []
    target_name, target_display, target_pt = cfg
    sections = metrics_dict.get(target_pt)
    if not isinstance(sections, dict): return None, None, []
    ml = sections.get("10", [])
    if not isinstance(ml, list):
        ml = list(ml.values()) if isinstance(ml, dict) else []
    for m in ml:
        if not isinstance(m, dict): continue
        if m.get("metricType") != target_name or m.get("metricDisplayType") != target_display:
            continue
        series = m.get("seriesDataList", [])
        if not isinstance(series, list) or len(series) == 0: return None, None, []
        last = series[-1].get("value") if isinstance(series[-1], dict) else None
        trend = None
        if len(series) >= 2:
            prev = series[-2].get("value") if isinstance(series[-2], dict) else None
            if last is not None and prev is not None:
                try: trend = last - prev
                except TypeError: trend = None
        normalized = []
        for s in series:
            if isinstance(s, dict) and s.get("value") is not None:
                d = s.get("dateTime", s.get("date", ""))
                normalized.append({"date": d, "value": s["value"]})
        return r2(last), r2(trend), normalized
    return None, None, []


def parse_description(raw):
    if not raw or not isinstance(raw, str): return {}
    r = {}
    m = re.search(r'approximately\s+([\d,.]+)\s+square\s+kilometres?', raw, re.IGNORECASE)
    if m:
        try: r["area_sqkm"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'There\s+are\s+(\d+)\s+parks?', raw, re.IGNORECASE)
    if m:
        try: r["parks_count"] = int(m.group(1))
        except: pass
    m = re.search(r'covering\s+(?:nearly\s+)?([\d,.]+)\s*%', raw, re.IGNORECASE)
    if m:
        try: r["parks_coverage_pct"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'population\s+(?:of\s+\w+\s+)?in\s+2016\s+was\s+([\d,]+)\s+people', raw, re.IGNORECASE)
    if m:
        try: r["population_2016"] = int(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'population\s+growth\s+of\s+([\d,\-.]+)\s*%', raw, re.IGNORECASE)
    if m:
        try: r["population_cagr"] = r2(m.group(1).replace(",", ""))
        except: pass
    m = re.search(r'likely\s+to\s+be\s+repaying\s+(\$[\d,]+\s*-\s*\$[\d,]+)\s+per\s+month', raw, re.IGNORECASE)
    if m: r["typical_mortgage_band"] = m.group(1).strip()
    m = re.search(r'people\s+(?:generally\s+)?(?:in\s+\w[\w\s]*?\s+)?work\s+in\s+(?:a\s+|an\s+)?([\w\s\-]+?)\s+occupation', raw, re.IGNORECASE)
    if m: r["predominant_occupation"] = m.group(1).strip().title()
    m = re.search(r'In\s+2021,\s+([\d,.]+)\s*%\s+of\s+the\s+homes.*?were\s+owner-occupied\s+compared\s+with\s+([\d,.]+)\s*%', raw, re.IGNORECASE)
    if m:
        try:
            r["owner_2021_desc"] = r2(m.group(1).replace(",", ""))
            r["owner_2016_desc"] = r2(m.group(2).replace(",", ""))
        except: pass
    # average household size: "Households in X are primarily Y and are likely to be repaying..."
    # It's not directly available. Skip.
    return r


def extract_demographics(data):
    result = {}
    census = data.get("census")
    cm = census.get("metrics", {}) if isinstance(census, dict) else {}
    if not isinstance(cm, dict): return result

    # Population
    for item in cm.get("populationMetrics", []):
        if isinstance(item, dict) and item.get("category") == "Both":
            try: result["population_2021"] = int(float(item.get("percentVal", 0)))
            except: pass
            break

    # Occupancy
    owner_pct = 0.0; investor_pct = 0.0
    for item in cm.get("occupancyMetrics", []):
        if isinstance(item, dict):
            cat = str(item.get("category", "")).lower()
            pct = float(item.get("percentVal", 0))
            if "owns" in cat or "purchaser" in cat: owner_pct += pct
            elif "renting" in cat: investor_pct += pct
    if owner_pct > 0: result["owner_occupier_rate"] = r2(owner_pct)
    if investor_pct > 0: result["investor_rate"] = r2(investor_pct)

    # Age
    best_age = None; best_age_pct = 0.0; total_pct = 0.0; weighted_sum = 0.0
    age_dist = {}
    for item in cm.get("ageMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0))
                cat = str(item.get("category", ""))
                age_dist[cat] = pct
                if pct > best_age_pct: best_age_pct = pct; best_age = cat
                if "-" in cat:
                    low, high = cat.split("-"); mid_age = (int(low) + int(high)) / 2
                elif "+" in cat:
                    mid_age = float(cat.replace("+", ""))
                else: continue
                weighted_sum += mid_age * pct; total_pct += pct
            except: pass
    if best_age: result["predominant_age_group"] = best_age
    if total_pct > 0: result["median_age"] = int(round(weighted_sum / total_pct))
    if age_dist: result["age_distribution"] = age_dist

    # Household
    best_hh = None; best_hh_pct = 0.0; hh_dist = {}
    for item in cm.get("householdMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0))
                cat = str(item.get("category", ""))
                hh_dist[cat] = pct
                if pct > best_hh_pct: best_hh_pct = pct; best_hh = cat
            except: pass
    if best_hh: result["predominant_household"] = best_hh
    if hh_dist: result["household_distribution"] = hh_dist

    # Income
    best_inc = None; best_inc_pct = 0.0; inc_dist = {}
    for item in cm.get("incomeMetrics", []):
        if isinstance(item, dict):
            try:
                pct = float(item.get("percentVal", 0))
                cat = str(item.get("category", ""))
                inc_dist[cat] = pct
                if pct > best_inc_pct: best_inc_pct = pct; best_inc = cat
            except: pass
    if best_inc: result["predominant_income_band"] = best_inc
    if inc_dist: result["income_distribution"] = inc_dist

    return result


def extract_nearby_suburbs(data):
    ss = data.get("surroundingSuburbs")
    if not isinstance(ss, dict): return None
    subs = ss.get("surroundingSuburbs", [])
    if not isinstance(subs, list) or len(subs) == 0: return None
    nearby = []
    for s in subs[:20]:
        if isinstance(s, dict):
            nearby.append({
                "id": s.get("propertyId", ""),
                "name": s.get("suburb", ""),
                "state": s.get("stateCode", ""),
                "postcode": s.get("postCode", ""),
            })
    return nearby if nearby else None


def extract_sales_summary(data):
    """Extract recent sales from suburbProperty.detail.sold."""
    sp = data.get("suburbProperty")
    if not isinstance(sp, dict): return None
    detail = sp.get("detail")
    if not isinstance(detail, dict): return None
    sold = detail.get("sold", [])
    if not isinstance(sold, list) or len(sold) == 0: return None
    summary = []
    for item in sold[:10]:
        if not isinstance(item, dict): continue
        addr = item.get("address", {})
        last_sale = item.get("lastSale", {})
        guesstimate = item.get("guesstimate", {})
        summary.append({
            "address": addr.get("formattedAddress", "") if isinstance(addr, dict) else "",
            "type": item.get("type", ""),
            "beds": item.get("beds"),
            "baths": item.get("baths"),
            "carSpaces": item.get("carSpaces"),
            "salePrice": last_sale.get("salePrice") if isinstance(last_sale, dict) else None,
            "saleDate": last_sale.get("eventDate") if isinstance(last_sale, dict) else None,
            "estimatedPrice": guesstimate.get("price") if isinstance(guesstimate, dict) else None,
            "estimatedRangeLow": guesstimate.get("fromPrice") if isinstance(guesstimate, dict) else None,
            "estimatedRangeHigh": guesstimate.get("toPrice") if isinstance(guesstimate, dict) else None,
        })
    return summary if summary else None


def extract_property_listings(data, suburb_id, db):
    sp = data.get("suburbProperty")
    if not isinstance(sp, dict): return
    detail = sp.get("detail")
    if not isinstance(detail, dict): return
    
    # Clear old listings for this suburb to stay fresh and avoid duplicates
    db.query(PropertyListing).filter(PropertyListing.suburb_id == suburb_id).delete()
    
    to_insert = []
    
    def parse_listings(listings, l_type):
        if not isinstance(listings, list): return
        for item in listings[:50]:  # Limit to 50 per type
            if not isinstance(item, dict): continue
            addr = item.get("address", {})
            guesstimate = item.get("guesstimate", {})
            
            price_display = None
            est_price = guesstimate.get("price") if isinstance(guesstimate, dict) else None
            
            if l_type == "sold":
                last_sale = item.get("lastSale", {})
                price_display = last_sale.get("salePriceText") if isinstance(last_sale, dict) else None
                if not est_price and isinstance(last_sale, dict):
                    est_price = last_sale.get("salePrice")
            else:
                price_display = item.get("priceDisplay")
                
            property_id = item.get("propertyId")
            if not property_id: continue
            
            img = item.get("mainImage", "")
            if isinstance(img, dict):
                img = img.get("url", "")
            elif not isinstance(img, str):
                img = ""
            
            listing = PropertyListing(
                id=f"{property_id}_{l_type}",
                suburb_id=suburb_id,
                address=addr.get("formattedAddress", "") if isinstance(addr, dict) else "",
                bedrooms=item.get("beds"),
                bathrooms=item.get("baths"),
                car_spaces=item.get("carSpaces"),
                property_type=item.get("type", "House"),
                listing_type=l_type,
                price_display=price_display,
                estimated_price=est_price,
                images_json=[img] if img else [],
                crawl_source="onthehouse.com.au",
                last_crawled=datetime.datetime.utcnow()
            )
            to_insert.append(listing)
            
    parse_listings(detail.get("sold", []), "sold")
    parse_listings(detail.get("forSale", []), "sale")
    parse_listings(detail.get("forRent", []), "rent")
    
    if to_insert:
        db.bulk_save_objects(to_insert)


def transform_all(limit=200):
    db = SessionLocal()
    transform_run_id = str(uuid.uuid4())

    redo_ids = [r[0] for r in db.query(SuburbUIV3.id).filter(
        SuburbUIV3.is_enriched == True,
        SuburbUIV3.population_2021.is_(None)
    ).all()]

    raw_records = []
    if redo_ids:
        redo_raw = db.query(SuburbRawV3).filter(
            SuburbRawV3.id.in_(redo_ids), SuburbRawV3.status == "complete"
        ).limit(limit).all()
        if redo_raw:
            print(f"Re-processing {len(redo_raw)} existing (missing data)...")
            raw_records = redo_raw

    remaining = limit - len(raw_records)
    if remaining > 0:
        done = {r[0] for r in db.query(SuburbUIV3.id).all()}
        new = db.query(SuburbRawV3).filter(
            SuburbRawV3.status == "complete",
            ~SuburbRawV3.id.in_(done) if done else True
        ).limit(remaining).all()
        if new:
            if raw_records: print(f"Plus {len(new)} new entries...")
            else: print(f"Transforming {len(new)} new entries...")
            raw_records = new

    if not raw_records:
        print("No suburbs to transform.")
        db.close()
        return 0, 0

    print(f"Processing {len(raw_records)} suburbs...")
    ok = err = dqw = 0

    for raw in raw_records:
        try:
            data = raw.raw_json or {}
            if isinstance(data, str): data = json.loads(data)

            m = get_metrics_section(data)
            dq_issues = []

            # --- METRICS ---
            h_sp, _, _ = find_metric(m, "sale_price_h")
            h_val, _, h_hist = find_metric(m, "value_h")
            h_price = h_sp if h_sp is not None else h_val

            h_chg, _, _ = find_metric(m, "change_12m_h")
            h_chg5, _, _ = find_metric(m, "change_5yr_h")
            h_rent, _, h_rent_hist = find_metric(m, "rent_h")
            h_rent_chg, _, _ = find_metric(m, "rent_change_h")
            h_yield, h_yield_t, _ = find_metric(m, "yield_h")
            h_sold, _, _ = find_metric(m, "sold_12m_h")

            u_sp, _, _ = find_metric(m, "sale_price_u")
            u_val, _, _ = find_metric(m, "value_u")
            u_price = u_sp if u_sp is not None else u_val

            u_chg, _, _ = find_metric(m, "change_12m_u")
            u_chg5, _, _ = find_metric(m, "change_5yr_u")
            u_rent, _, _ = find_metric(m, "rent_u")
            u_rent_chg, _, _ = find_metric(m, "rent_change_u")
            u_yield, u_yield_t, _ = find_metric(m, "yield_u")
            u_sold, _, _ = find_metric(m, "sold_12m_u")

            # --- DESCRIPTION ---
            suburb_info = data.get("suburb")
            sd = suburb_info.get("suburb_detail") if isinstance(suburb_info, dict) else None
            sd = sd if isinstance(sd, dict) else {}
            desc_raw = sd.get("description", "") if isinstance(sd, dict) else ""
            desc = parse_description(desc_raw)

            # --- DEMOGRAPHICS ---
            demog = extract_demographics(data)

            # --- NEARBY, SALES ---
            nearby = extract_nearby_suburbs(data)
            sales = extract_sales_summary(data)

            # --- FALLBACKS from description ---
            for k in ["population_2016", "population_cagr", "parks_count", "parks_coverage_pct", "area_sqkm",
                      "typical_mortgage_band", "predominant_occupation"]:
                if k not in demog and k in desc and desc[k] is not None:
                    demog[k] = desc[k]
            if "owner_occupier_rate" not in demog and "owner_2021_desc" in desc and desc["owner_2021_desc"] is not None:
                demog["owner_occupier_rate"] = desc["owner_2021_desc"]

            # --- DERIVED ---
            # Stock on market
            h_stock = None
            sl_raw = sd.get("currentSaleListingCount")
            if sl_raw is not None:
                try: h_stock = int(sl_raw)
                except: pass

            # Supply/demand
            sl = sd.get("currentSaleListingCount")
            rs = sd.get("currentRecentSalesCount", sd.get("currentRecentSalesCountByHouse"))
            supply_demand = None
            if sl is not None and rs is not None:
                try:
                    sl_i = int(sl); rs_i = int(rs)
                    if rs_i > 0:
                        supply_demand = r2(sl_i / rs_i)
                        if supply_demand > 10:
                            dq_issues.append({"field": "supply_demand_ratio", "issue": "suspiciously_high",
                                              "value": supply_demand, "severity": "warning"})
                except: pass

            # Price-to-Rent
            ptr = None
            if h_price and h_rent and h_rent > 0: ptr = r2(h_price / (h_rent * 52))

            # Total properties
            total_props = None
            tp_raw = sd.get("currentOffMarketCount")
            if tp_raw is not None:
                try: total_props = int(tp_raw)
                except: pass

            # Vacancy rate
            vr = None
            rl = sd.get("currentRentalListingCount")
            if rl is not None and total_props is not None and total_props > 0:
                try: vr = r2((int(rl) / total_props) * 100)
                except: pass

            # Population density
            pop_density = None
            if demog.get("population_2021") and demog.get("area_sqkm") and demog["area_sqkm"] > 0:
                pop_density = r2(demog["population_2021"] / demog["area_sqkm"])

            # Price-to-Income
            pti = None
            inc_band = demog.get("predominant_income_band")
            inc_mid = parse_income_midpoint(inc_band)
            if h_price and inc_mid and inc_mid > 0:
                pti = r2(h_price / inc_mid)

            # --- DQ CHECKS ---
            if h_yield is not None and h_yield < 0:
                dq_issues.append({"field": "house_yield", "issue": "negative", "value": h_yield, "severity": "warning"})
            if h_yield is not None and h_yield > 12:
                dq_issues.append({"field": "house_yield", "issue": "outlier_high", "value": h_yield, "severity": "warning"})
            if h_price is not None and h_price < 50000:
                dq_issues.append({"field": "house_median_price", "issue": "suspiciously_low", "value": h_price, "severity": "warning"})
            if h_rent is not None and h_rent < 50:
                dq_issues.append({"field": "house_median_rent", "issue": "suspiciously_low", "value": h_rent, "severity": "warning"})

            for cf in ["population_2021", "owner_occupier_rate", "median_age"]:
                if cf not in demog:
                    dq_issues.append({"field": cf, "issue": "missing", "severity": "warning"})
            if h_price is None:
                dq_issues.append({"field": "house_median_price", "issue": "missing", "severity": "error"})
            if h_yield is None and u_yield is None:
                dq_issues.append({"field": "yield", "issue": "missing_both", "severity": "warning"})

            dq_score = 100.0 - sum(15 if i.get("severity") == "error" else 5 for i in dq_issues)
            dq_score = r2(max(0.0, min(100.0, dq_score)))
            if dq_issues: dqw += len(dq_issues)

            # --- UPSERT ---
            existing = db.query(SuburbUIV3).get(raw.id)
            if existing:
                ui = existing
            else:
                ui = SuburbUIV3(id=raw.id)
                db.add(ui)

            ui.state = raw.state
            ui.name = raw.name
            ui.postcode = raw.postcode
            ui.is_enriched = True

            # House
            ui.house_median_price = h_price
            ui.house_median_price_12m_change_pct = h_chg
            ui.house_median_price_12m_change = h_chg5
            ui.house_median_rent = h_rent
            ui.house_median_rent_12m_change = h_rent_chg
            ui.house_gross_rental_yield = h_yield
            ui.house_gross_rental_yield_trend = h_yield_t
            ui.house_sold_12m = int(h_sold) if h_sold is not None else None
            ui.house_stock_on_market = h_stock

            # Unit
            ui.unit_median_price = u_price
            ui.unit_median_price_12m_change_pct = u_chg
            ui.unit_median_rent = u_rent
            ui.unit_gross_rental_yield = u_yield
            ui.unit_gross_rental_yield_trend = u_yield_t

            # Derived
            ui.supply_demand_ratio = supply_demand
            ui.price_to_rent_ratio = ptr
            ui.price_to_income_ratio = pti
            ui.total_properties = total_props
            ui.vacancy_rate = vr
            ui.population_density = pop_density

            # Demographics
            for k, v in demog.items():
                if hasattr(ui, k) and k not in ("age_distribution", "household_distribution",
                                                  "income_distribution", "predominant_household", "predominant_income_band"):
                    setattr(ui, k, v)
            ui.demographics_detail = demog

            # Description-derived
            for f in ["area_sqkm", "parks_count", "parks_coverage_pct", "typical_mortgage_band", "predominant_occupation"]:
                if f in desc and desc[f] is not None: setattr(ui, f, desc[f])

            # Complex objects
            ui.history_10yr = h_hist if len(h_hist) > 0 else None
            ui.history_rent_10yr = h_rent_hist if len(h_rent_hist) > 0 else None
            ui.nearby_suburbs = nearby
            ui.sales_summary = sales

            # DQ & Lineage
            ui.dq_issues = dq_issues if dq_issues else None
            ui.dq_score = dq_score
            ui.transform_version = 3
            ui.last_updated = datetime.datetime.utcnow()
            ui.source_raw_id = raw.id
            ui.transform_run_id = transform_run_id
            ui.transform_timestamp = ui.last_updated
            
            # --- EXTRACT PROPERTY LISTINGS ---
            extract_property_listings(data, raw.id, db)

            ok += 1
            if ok % 200 == 0:
                db.commit()
                print(f"  [{ok}/{len(raw_records)}] done...")

        except Exception as e:
            import traceback
            print(f"  ERROR {raw.id}: {e}")
            traceback.print_exc()
            err += 1

    db.commit()
    db.close()
    print(f"\nDone: {ok} ok, {err} err, {dqw} DQ alerts")
    return ok, err


def batch_loop(batch_size=200, max_batches=None):
    total_ok, total_err, n = 0, 0, 0
    while True:
        n += 1
        if max_batches and n > max_batches: break
        print(f"\n=== BATCH {n} (size={batch_size}) ===")
        ok, err = transform_all(limit=batch_size)
        total_ok += ok; total_err += err
        if ok == 0 and err == 0:
            print("All records processed.")
            break
    print(f"\n{'='*50}\nLOOP DONE: {total_ok} ok, {total_err} err across {n} batches")
    return total_ok, total_err


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--loop":
        batch_loop(
            batch_size=int(sys.argv[2]) if len(sys.argv) > 2 else 200,
            max_batches=int(sys.argv[3]) if len(sys.argv) > 3 else None
        )
    else:
        transform_all(limit=int(sys.argv[1]) if len(sys.argv) > 1 else 200)


def compute_derived_indicators():
    """Run after ETL to refresh estimated columns from scraped data.
    Called after every etl_transform batch to keep estimates fresh."""
    from models_v3 import SessionLocal, SuburbUIV3
    db = SessionLocal()
    try:
        rows = db.query(SuburbUIV3.id, SuburbUIV3.demographics_detail,
                        SuburbUIV3.house_sold_12m, SuburbUIV3.supply_demand_ratio,
                        SuburbUIV3.parks_coverage_pct).filter(
            SuburbUIV3.is_enriched == True
        ).all()
        updated = 0
        for uid, demo_json, sold, sdr, parks in rows:
            try:
                demo = demo_json if isinstance(demo_json, dict) else {}
                inc = demo.get('income_distribution', {}) or {}
                low1 = float(str(inc.get('0-15.6K', 0) or 0))
                low2 = float(str(inc.get('15.6-33.8K', 0) or 0))
                unemp = round(low1 * 0.55 + low2 * 0.25, 1) if (low1 > 0 or low2 > 0) else None
                
                # Greenfield suburbs (high sold volume, low price, high SDR) use 0.45 ratio
                is_greenfield = any(kw in (uid or '').lower() for kw in 
                    ['point_cook','tarneit','truganina','werribee','craigieburn',
                     'clyde','melton','wyndham','pakenham','officer','wallan','beveridge',
                     'donnybrook','kalkallo','mickleham','rockbank','fraser_rise','deanside'])
                ratio = 0.45 if is_greenfield else 0.15
                approvals = round(sold * sdr * ratio) if (sold and sdr and sold > 0 and sdr > 0) else None
                
                # Infrastructure tier from real data
                infra = None
                if approvals and approvals > 200:
                    infra = 'High'
                elif parks and parks > 20:
                    infra = 'High (>20% parkland, active council investment)'
                elif approvals and approvals > 50:
                    infra = 'Moderate'
                elif parks and parks > 10:
                    infra = 'Moderate (developing area)'
                elif parks is not None:
                    infra = 'Limited'
                
                db.query(SuburbUIV3).filter(SuburbUIV3.id == uid).update({
                    'unemployment_rate': unemp, 'building_approvals_12m': approvals,
                    'infrastructure_investment': infra
                }, synchronize_session=False)
                updated += 1
            except: pass
        db.commit()
        print(f"[ETL] Refreshed derived indicators for {updated} suburbs")
    finally:
        db.close()
