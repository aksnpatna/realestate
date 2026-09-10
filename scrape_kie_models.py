#!/usr/bin/env python3
"""
Script to scrape KIE API models from the market page.
"""

import asyncio
import re
import json
from playwright.async_api import async_playwright

async def scrape_kie_models():
    """Scrape KIE API model information from the market page"""
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        print("Navigating to KIE market page...")
        await page.goto("https://kie.ai/market")
        
        # Wait for the page to load
        await page.wait_for_selector("body")
        
        # Extract all script tags to find model data
        scripts = await page.eval_on_selector_all("script", "scripts => scripts.map(script => script.textContent)")
        
        model_data = []
        
        for script in scripts:
            # Look for model-related data in scripts
            if "model" in script and "chat" in script and "image" in script:
                # Find JSON data containing model information
                try:
                    # Extract possible JSON data structures
                    pattern = re.compile(r'\{.*"model".*"name".*?\}', re.DOTALL)
                    matches = pattern.findall(script)
                    
                    for match in matches:
                        try:
                            cleaned = match.replace("\n", "").replace("\t", "").replace("'", '"')
                            # Find the complete JSON object
                            start = cleaned.find('{')
                            end = cleaned.rfind('}')
                            if start != -1 and end != -1:
                                json_str = cleaned[start:end+1]
                                data = json.loads(json_str)
                                model_data.append(data)
                        except Exception:
                            continue
                except Exception:
                    continue
        
        if model_data:
            print(f"Found {len(model_data)} model entries")
            
            # Print model names
            print("\nModel names:")
            for model in model_data:
                if "name" in model:
                    print(f"  - {model['name']}")
                elif "model" in model:
                    print(f"  - {model['model']}")
                else:
                    print(f"  - {list(model.keys())[0]}")
            
            # Save to file for future reference
            with open("kie_models.json", "w") as f:
                json.dump(model_data, f, indent=2)
            print("\nModel data saved to kie_models.json")
        else:
            print("No model data found in page")
        
        # Take a screenshot for debugging
        await page.screenshot(path="kie_market_page.png", full_page=True)
        print("Screenshot saved as kie_market_page.png")
        
        await browser.close()
        
        return model_data

async def main():
    """Main function"""
    print("Scraping KIE API models...")
    await scrape_kie_models()

if __name__ == "__main__":
    asyncio.run(main())