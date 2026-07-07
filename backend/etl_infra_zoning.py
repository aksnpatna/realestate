import os
import sys
import time
import urllib.request
import urllib.parse
import json
from datetime import datetime
from sqlalchemy import text
from models_v3 import SessionLocal, SuburbUIV3

# =============================================================================
# ETL Pipeline: Infrastructure & Zoning Data (Auto-Pipeline)
# =============================================================================
# This script automates the extraction of major infrastructure projects 
# and zoning changes from government open data portals (CKAN API).
# It geocodes the projects and updates the suburb's predictive analysis profile.
# =============================================================================

# data.vic.gov.au uses the CKAN API standard
CKAN_BASE_URL = "https://data.vic.gov.au/api/3/action"

def fetch_major_infrastructure_projects():
    """
    Queries data.vic.gov.au CKAN API for major infrastructure projects.
    Returns a list of parsed project dictionaries.
    """
    print(f"  -> Fetching Infrastructure datasets from data.vic.gov.au...")
    
    # In a real environment, you might query specific dataset IDs (e.g., National Infrastructure Construction Schedule)
    # We use a broad package_search for demonstration of the API integration.
    url = f"{CKAN_BASE_URL}/package_search"
    params = {
        "q": "title:\"infrastructure\" OR title:\"transport\"",
        "rows": 10  # Limit for stability, in production use pagination
    }
    
    projects = []
    try:
        req_url = f"{url}?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(req_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode())
        
        if data.get("success"):
            results = data["result"]["results"]
            for pkg in results:
                # Extract relevant metadata
                org = pkg.get("organization", {}).get("title", "Unknown Dept")
                title = pkg.get("title", "")
                
                # We simulate extracting a geospatial bounding box or LGA name from the dataset metadata
                # In production, we would download the CSV/GeoJSON resource and parse row-by-row
                projects.append({
                    "source": "data.vic.gov.au",
                    "department": org,
                    "title": title,
                    "type": "Infrastructure",
                    "impact_year": datetime.now().year + 2, # Estimated completion
                    # Fallback keywords to match against suburb names if geocoding fails
                    "keywords": title.lower().split() 
                })
        print(f"  ✓ Found {len(projects)} relevant infrastructure datasets.")
    except Exception as e:
        print(f"  ✗ Failed to fetch from data.vic.gov.au: {e}")
        
    return projects

def fetch_zoning_changes():
    """
    Mock function representing an integration with State Planning APIs 
    (e.g., NSW ePlanning API or Victoria Spatial Data).
    """
    print(f"  -> Fetching Zoning updates from State Planning Portals...")
    # Real-world endpoints require API keys and return complex GeoJSON/WFS data
    # Example NSW WFS: https://mapprod3.environment.nsw.gov.au/arcgis/services/...
    
    time.sleep(1) # Simulate network call
    
    # Mocked structured response from a Planning Portal
    return [
        {"title": "Transit Oriented Development (TOD) Rezoning", "type": "Zoning", "state": "NSW", "target_suburbs": ["Crows Nest", "Marrickville", "Bankstown"]},
        {"title": "Suburban Rail Loop (SRL) High-Density Zone", "type": "Zoning", "state": "VIC", "target_suburbs": ["Box Hill", "Glen Waverley", "Clayton"]},
    ]

def map_projects_to_suburbs(db, infra_projects, zoning_changes):
    """
    Matches the extracted government data to our suburbs_ui_v3 table.
    """
    # Fetch all enriched suburbs to map against
    suburbs = db.query(SuburbUIV3).filter(SuburbUIV3.is_enriched == True).all()
    print(f"  -> Mapping projects to {len(suburbs)} enriched suburbs...")
    
    updates = 0
    for suburb in suburbs:
        matched_events = []
        
        # 1. Map Zoning Changes (Direct Name Match)
        for zone in zoning_changes:
            if suburb.state == zone["state"] and suburb.name in zone["target_suburbs"]:
                matched_events.append({
                    "type": "Zoning",
                    "desc": zone["title"],
                    "impact_year": datetime.now().year + 1
                })
                
        # 2. Map Infrastructure (Keyword/Geospatial Match)
        for proj in infra_projects:
            # If the suburb name appears in the infrastructure title/keywords
            if suburb.name.lower() in proj["keywords"]:
                matched_events.append({
                    "type": "Infrastructure",
                    "desc": proj["title"],
                    "impact_year": proj["impact_year"]
                })
                
        if matched_events:
            # Inject into the predictive_analysis metadata
            dq = suburb.dq_issues or {}
            if isinstance(dq, list):
                 dq = {"issues": dq}
                 
            predictive = dq.get("predictive_analysis", {})
            existing_events = predictive.get("infrastructure_events", [])
            
            # Append new events, avoiding duplicates based on description
            existing_descs = {e["desc"] for e in existing_events}
            for event in matched_events:
                if event["desc"] not in existing_descs:
                    existing_events.append(event)
                    # Automatically bump predictive score due to real-world government data
                    current_score = predictive.get("score", 50.0)
                    predictive["score"] = min(100.0, current_score + 10.0)
            
            predictive["infrastructure_events"] = existing_events
            predictive["last_government_sync"] = datetime.utcnow().isoformat()
            
            dq["predictive_analysis"] = predictive
            suburb.dq_issues = dq
            updates += 1

    db.commit()
    print(f"  ✓ Successfully mapped government data to {updates} suburbs.")

def run_infra_zoning_pipeline():
    print(f"[{datetime.now()}] Starting Government Infrastructure & Zoning ETL")
    db = SessionLocal()
    try:
        infra_projects = fetch_major_infrastructure_projects()
        zoning_changes = fetch_zoning_changes()
        
        map_projects_to_suburbs(db, infra_projects, zoning_changes)
        
    except Exception as e:
        print(f"  ✗ Pipeline Error: {e}")
        db.rollback()
    finally:
        db.close()
        print(f"[{datetime.now()}] Pipeline execution finished.")

if __name__ == "__main__":
    run_infra_zoning_pipeline()
