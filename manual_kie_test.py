#!/usr/bin/env python3
"""
KIE API test script with command line arguments.
"""

import sys
import os
import httpx
from dotenv import load_dotenv
import argparse

load_dotenv()

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Test KIE API with specific model")
    parser.add_argument("-m", "--model", required=True, help="KIE model name from playground")
    parser.add_argument("-p", "--prompt", default="Hello, what is 2+2?", help="Test prompt")
    parser.add_argument("-v", "--verbose", action="store_true", help="Print verbose output")
    args = parser.parse_args()
    
    # Check if KIE_KEY is set
    api_key = os.getenv("KIE_KEY")
    if not api_key or api_key == "none":
        print("❌ KIE_KEY environment variable not set or invalid")
        return 1
    
    client = httpx.Client(
        base_url="https://api.kie.ai",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        },
        timeout=60.0
    )
    
    print(f"Testing KIE API with model '{args.model}' and prompt '{args.prompt}'...")
    
    try:
        payload = {
            "model": args.model,
            "prompt": args.prompt
        }
        
        if args.verbose:
            print(f"Request payload: {payload}")
        
        response = client.post("/v1/chat/completions", json=payload)
        
        print(f"Status code: {response.status_code}")
        
        if args.verbose:
            print(f"Response headers: {dict(response.headers)}")
        
        print(f"Response body: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get("code") == 0:
                print("\n✅ Success!")
                print(f"  Task ID: {data.get('data', {}).get('task_id')}")
                print(f"  Status: {data.get('data', {}).get('status')}")
                
                # If task is pending, try to query it
                task_id = data.get("data", {}).get("task_id")
                if task_id and data.get("data", {}).get("status") == "pending":
                    print("\n⏳ Task is pending. Checking status...")
                    for i in range(3):
                        try:
                            query_response = client.post("/v1/task/query", json={"task_id": task_id})
                            query_data = query_response.json()
                            
                            if query_response.status_code == 200 and query_data.get("code") == 0:
                                print(f"  Status (try {i+1}): {query_data.get('data', {}).get('status')}")
                                
                                if query_data.get("data", {}).get("status") == "completed":
                                    print(f"  Result: {query_data.get('data', {}).get('result')}")
                                    break
                        except Exception as e:
                            print(f"  Error checking status: {e}")
                        
                        import time
                        time.sleep(2)
                        
            else:
                print(f"\n❌ Error: {data.get('msg')}")
        else:
            print(f"\n❌ HTTP Error: {response.text}")
            
    except Exception as e:
        print(f"\n❌ Exception: {type(e).__name__}: {e}")
        if args.verbose:
            import traceback
            print(traceback.format_exc())
    
    return 0

if __name__ == "__main__":
    sys.exit(main())