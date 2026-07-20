import os
import re
import json
import time
import argparse
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from sqlalchemy import text
from models_v3 import SessionLocal

# -----------------------------------------------------------------------------
# SQM Research Extractor - 3 Worker Thread Pool 
# -----------------------------------------------------------------------------

def extract_json_data(html, pattern_type="var_data"):
    """Extract embedded JSON array from SQM HTML script tags."""
    if pattern_type == "var_data":
        # Matches: var data = [{"year":2005,"month":1,"listings":593,"properties":20558,"vr":"0.0288"}];
        match = re.search(r"var\s+data\s*=\s*(\[.*?\]);", html, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
    elif pattern_type == "json_array":
        # Matches: [{"date":"2024-09-15","houses_all":760.5}]
        match = re.search(r"\[\s*\{\s*\"date\"\s*:\s*\".*?\}\s*\]", html, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
    return None

def fetch_sqm_postcode(postcode):
    """Fetch and parse Rents, Vacancy, Stock, and Prices for a postcode."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
    
    metrics = {
        "rents": {"url": f"https://sqmresearch.com.au/weekly-rents.php?postcode={postcode}&t=1", "pattern": "json_array", "data": None},
        "vacancy": {"url": f"https://sqmresearch.com.au/graph_vacancy.php?postcode={postcode}&t=1", "pattern": "var_data", "data": None},
        "stock": {"url": f"https://sqmresearch.com.au/total-property-listings.php?postcode={postcode}&t=1", "pattern": "var_data", "data": None},
        "prices": {"url": f"https://sqmresearch.com.au/weekly-asking-prices.php?postcode={postcode}&t=1", "pattern": "json_array", "data": None}
    }
    
    extracted = {}
    
    for metric, info in metrics.items():
        try:
            res = requests.get(info["url"], headers=headers, timeout=15)
            if res.status_code == 200:
                data = extract_json_data(res.text, info["pattern"])
                # Fallback pattern if primary fails
                if not data and info["pattern"] == "json_array":
                    data = extract_json_data(res.text, "var_data")
                elif not data and info["pattern"] == "var_data":
                    data = extract_json_data(res.text, "json_array")
                    
                if data:
                    extracted[metric] = data
            # Polite delay between internal requests
            time.sleep(1)
        except Exception as e:
            pass
            
    return extracted

def process_postcode(postcode):
    """Worker function to process a single postcode and update DB."""
    try:
        # Fetch data
        data = fetch_sqm_postcode(postcode)
        
        # Check if we got anything
        if not data:
            return postcode, False, "No data extracted."

        # Parse out the most recent metrics
        update_vals = {}
        
        # 1. Vacancy Rate
        if "vacancy" in data and len(data["vacancy"]) > 0:
            latest_vacancy = data["vacancy"][-1]
            if "vr" in latest_vacancy:
                # Store as percentage string "2.88%" or decimal
                try:
                    update_vals["vacancy_rate"] = float(latest_vacancy["vr"]) * 100
                except:
                    pass

        # 2. Stock (Total Listings)
        if "stock" in data and len(data["stock"]) > 0:
            latest_stock = data["stock"][-1]
            if "total" in latest_stock:
                try:
                    update_vals["total_properties"] = int(latest_stock["total"])
                except:
                    pass
        
        # 3. Rents
        if "rents" in data and len(data["rents"]) > 0:
            latest_rent = data["rents"][-1]
            if "houses_all" in latest_rent:
                try:
                    update_vals["house_median_rent"] = float(latest_rent["houses_all"])
                except:
                    pass
            if "units_all" in latest_rent:
                try:
                    update_vals["unit_median_rent"] = float(latest_rent["units_all"])
                except:
                    pass

        # 4. Save history as JSON
        update_vals["sqm_history"] = json.dumps(data)

        if len(update_vals) <= 1:
            return postcode, False, "Data extracted but missing required keys."

        # Update DB for all suburbs with this postcode
        db = SessionLocal()
        try:
            set_clauses = []
            params = {"postcode": str(postcode)}
            for k, v in update_vals.items():
                if k == "sqm_history":
                    set_clauses.append("demographics_detail = jsonb_set(COALESCE(demographics_detail, '{}'::jsonb), '{sqm_data}', :sqm_history::jsonb)")
                else:
                    set_clauses.append(f"{k} = :{k}")
                params[k] = v
            
            if set_clauses:
                query = text(f"UPDATE suburbs_ui_v3 SET {', '.join(set_clauses)}, last_updated = NOW() WHERE postcode = :postcode")
                result = db.execute(query, params)
                db.commit()
                return postcode, True, f"Updated {result.rowcount} suburbs."
            return postcode, False, "No valid updates mapped."
        finally:
            db.close()
            
    except Exception as e:
        return postcode, False, str(e)


def main():
    db = SessionLocal()
    try:
        # Get unique postcodes that need enriching
        print("Fetching unique postcodes from suburbs_ui_v3...")
        result = db.execute(text("SELECT DISTINCT postcode FROM suburbs_ui_v3 WHERE postcode IS NOT NULL AND is_enriched = true"))
        postcodes = [row[0] for row in result.fetchall() if row[0] and row[0].strip().isdigit()]
        print(f"Found {len(postcodes)} unique postcodes to process.")
        
        # For POC, let's limit to 10 if we want a quick test, or run all if not
        # postcodes = postcodes[:10]
        
    finally:
        db.close()

    print(f"\nStarting SQM scraper with 3 workers. Processing {len(postcodes)} postcodes...")
    success_count = 0
    fail_count = 0
    
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(process_postcode, pc): pc for pc in postcodes}
        
        for future in as_completed(futures):
            pc = futures[future]
            try:
                postcode, success, msg = future.result()
                if success:
                    success_count += 1
                    print(f"[SUCCESS] Postcode {postcode}: {msg}")
                else:
                    fail_count += 1
                    print(f"[FAILED] Postcode {postcode}: {msg}")
            except Exception as exc:
                fail_count += 1
                print(f"[ERROR] Postcode {pc} generated an exception: {exc}")
                
            # Inter-request delay for the thread pool to stay polite overall
            time.sleep(2)

    print(f"\n--- SCAPING COMPLETE ---")
    print(f"Success: {success_count}")
    print(f"Failed:  {fail_count}")

if __name__ == "__main__":
    main()
