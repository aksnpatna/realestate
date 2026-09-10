#!/usr/bin/env python3
"""
KIE API endpoint discovery and model listing script.
"""

import sys
import os
import httpx

from dotenv import load_dotenv
load_dotenv()

class KIEAPIDiscovery:
    """KIE API endpoint discovery tool"""
    
    BASE_URL = "https://api.kie.ai"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )
    
    def discover_endpoints(self):
        """Attempt to discover available API endpoints"""
        print("Attempting to discover KIE API endpoints...")
        
        # Common API endpoints to check
        endpoints_to_check = [
            # Text generation
            "/v1/chat/completions",
            "/v1/completions",
            # Image generation
            "/v1/images/generations",
            "/v1/image/generate",
            # Video generation
            "/v1/videos/generations",
            "/v1/video/generate",
            # Music generation
            "/v1/music/generations",
            "/v1/music/generate",
            # Model listing
            "/v1/models",
            "/v1/models/list",
            "/api/models",
            # Task management
            "/v1/task/query",
            "/v1/task/create",
        ]
        
        working_endpoints = []
        
        for endpoint in endpoints_to_check:
            try:
                # Try HEAD or GET request
                try:
                    response = self.client.head(endpoint)
                except:
                    response = self.client.get(endpoint)
                
                if response.status_code == 200:
                    working_endpoints.append(f"{endpoint} (status: 200)")
                elif response.status_code == 405:  # Method not allowed
                    working_endpoints.append(f"{endpoint} (method not allowed)")
                elif response.status_code == 400:  # Bad request (endpoint exists but needs parameters)
                    working_endpoints.append(f"{endpoint} (needs parameters)")
                else:
                    print(f"  {endpoint}: {response.status_code}")
            except Exception as e:
                print(f"  {endpoint}: {type(e).__name__}")
        
        if working_endpoints:
            print(f"\n✅ Found {len(working_endpoints)} working endpoints:")
            for ep in working_endpoints:
                print(f"  - {ep}")
        
        return working_endpoints
    
    def check_models_endpoint(self):
        """Check if there's a models listing endpoint"""
        print("\nChecking for models listing endpoint...")
        
        # Try different ways to get model list
        for endpoint in ["/v1/models", "/v1/models/list", "/api/models"]:
            try:
                response = self.client.get(endpoint)
                if response.status_code == 200:
                    data = response.json()
                    print(f"\n✅ Model list endpoint found at {endpoint}:")
                    print(f"   Response format: {list(data.keys())}")
                    
                    # Check if it has model information
                    if "data" in data and isinstance(data["data"], list):
                        print(f"   Found {len(data['data'])} models")
                        for model in data["data"][:10]:
                            print(f"     - {model.get('name', model.get('id', str(model)))}")
                        if len(data["data"]) > 10:
                            print(f"     ... and {len(data['data']) - 10} more")
                    return data
                
                print(f"  {endpoint}: {response.status_code} - {response.text[:50]}")
            except Exception as e:
                print(f"  {endpoint}: {type(e).__name__}")
        
        print("\n❌ No models listing endpoint found")
        return None


def main():
    """Main function"""
    api_key = os.getenv("KIE_KEY")
    
    if not api_key or api_key == "none":
        print("❌ KIE_KEY environment variable not set or invalid")
        return 1
    
    print(f"Using API key: {api_key[:5]}...")
    
    # Create discovery client
    discovery = KIEAPIDiscovery(api_key)
    
    # Discover endpoints
    working_endpoints = discovery.discover_endpoints()
    
    # Check for models endpoint
    model_data = discovery.check_models_endpoint()
    
    return 0

if __name__ == "__main__":
    sys.exit(main())