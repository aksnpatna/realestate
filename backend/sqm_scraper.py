import requests
import re
import json
import time
import argparse
import sys

def fetch_sqm_data(postcode, category="rents"):
    """
    category can be: 'rents', 'vacancy'
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    # SQM URL mapping
    url_map = {
        "rents": f"https://sqmresearch.com.au/weekly-rents.php?postcode={postcode}&t=1",
        "vacancy": f"https://sqmresearch.com.au/graph_vacancy.php?postcode={postcode}&t=1",
        "stock": f"https://sqmresearch.com.au/total-property-listings.php?postcode={postcode}&t=1"
    }
    
    url = url_map.get(category)
    if not url:
        print(f"Unknown category: {category}")
        return None

    print(f"Fetching {category} for postcode {postcode}...")
    try:
        res = requests.get(url, headers=headers, timeout=15)
        if res.status_code != 200:
            print(f"Failed to fetch {url}. Status: {res.status_code}")
            return None
        
        # The data is usually stored inside a Highcharts initialization block or a JSON payload embedded in JS.
        # It looks like: [{"date":"2024-09-15","houses_all":760.5...}]
        
        # We will extract the JSON array that looks like [{"date":...}]
        json_pattern = re.compile(r"\[\s*\{\s*\"date\"\s*:\s*\".*?\}\s*\]", re.DOTALL)
        match = json_pattern.search(res.text)
        
        if match:
            print(f"Successfully extracted JSON data series for {postcode}!")
            json_str = match.group(0)
            data = json.loads(json_str)
            print(f"Total historical data points: {len(data)}")
            
            # Print the most recent 3 data points as proof
            print("Most recent data points:")
            for item in data[-3:]:
                print(item)
            return True
        else:
            print(f"Could not find JSON data in the HTML for {postcode}. It might be empty.")
            return False

    except Exception as e:
        print(f"Request failed: {e}")
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape SQM Research Data")
    parser.add_argument("--postcode", type=str, default="3000", help="Postcode to scrape")
    parser.add_argument("--category", type=str, default="rents", choices=["rents", "vacancy", "stock"], help="Data category")
    
    args = parser.parse_args()
    fetch_sqm_data(args.postcode, args.category)
