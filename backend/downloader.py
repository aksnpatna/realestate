import os
import requests
import asyncio
from datetime import datetime
from playwright.async_api import async_playwright

# Define the local data directory
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
os.makedirs(DATA_DIR, exist_ok=True)

# List of Victorian Government Datasets using their official CKAN API IDs
DATASETS = [
    {
        "name": "vic_sales_yearly_summary",
        "package_id": "victorian-property-sales-report-yearly-summary"
    },
    {
        "name": "vic_sales_time_series_20yr",
        "package_id": "victorian-property-sales-report-time-series"
    },
    {
        "name": "vic_sales_median_unit_quarterly",
        "package_id": "victorian-property-sales-report-median-unit-by-suburb"
    }
]

async def download_file_playwright(url, save_path):
    print(f"  -> Downloading from {url} via Headless Chrome...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a standard user agent to avoid suspicion
        context = await browser.new_context(
            accept_downloads=True, 
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        try:
            # Tell playwright to expect a file download when visiting the URL
            async with page.expect_download(timeout=30000) as download_info:
                try:
                    await page.goto(url)
                except Exception as ex:
                    if "Download is starting" not in str(ex):
                        raise ex
            
            download = await download_info.value
            await download.save_as(save_path)
            
            if os.path.exists(save_path):
                file_size_mb = os.path.getsize(save_path) / (1024 * 1024)
                print(f"  -> Successfully saved to backend/data/ ({file_size_mb:.2f} MB)")
        except Exception as e:
            print(f"  -> ERROR downloading via browser: {e}")
            
        finally:
            await browser.close()

def fetch_latest_from_ckan(dataset):
    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Querying DataVic API for {dataset['name']}...")
    
    # Hit the official JSON API rather than scraping the HTML page
    api_url = f"https://discover.data.vic.gov.au/api/3/action/package_show?id={dataset['package_id']}"
    
    try:
        response = requests.get(api_url)
        response.raise_for_status()
        data = response.json()
        
        if data.get("success"):
            resources = data["result"]["resources"]
            if not resources:
                print("  -> ERROR: No resources found in dataset.")
                return
                
            # Sort resources by their creation date to guarantee we get the absolute latest one
            resources.sort(key=lambda x: x.get('created', ''), reverse=True)
            latest_resource = resources[0]
            
            download_url = latest_resource['url']
            
            # Preserve original extension (usually .xls or .xlsx)
            ext = os.path.splitext(download_url)[1]
            if not ext: ext = '.xls'
            
            filename = f"{dataset['name']}_latest{ext}"
            save_path = os.path.join(DATA_DIR, filename)
            
            print(f"  -> Found latest dataset version: '{latest_resource.get('name', 'Unknown')}'")
            # Execute the headless browser download synchronously
            asyncio.run(download_file_playwright(download_url, save_path))
        else:
            print(f"  -> ERROR: API returned failure for {dataset['package_id']}")
            
    except Exception as e:
        print(f"  -> ERROR: Failed to fetch {dataset['name']}: {e}")

def run_downloader():
    print("\n--- Starting VicGov Auto-Downloader (API Mode) ---")
    for dataset in DATASETS:
        fetch_latest_from_ckan(dataset)
    print("\n--- All latest datasets downloaded. Pipeline is ready to ingest! ---")

if __name__ == "__main__":
    run_downloader()
