#!/usr/bin/env python3
"""
Flexible KIE API integration with configuration.
"""

import os
import httpx
import json
import time
from dotenv import load_dotenv

load_dotenv()

class FlexibleKieAPI:
    """
    Flexible KIE API integration that supports different API formats.
    """
    
    def __init__(self, endpoint="/v1/chat/completions", model=None, format="chat"):
        """
        Initialize KIE API integration.
        
        Args:
            endpoint (str): API endpoint to use
            model (str): Model name to use
            format (str): API format ("chat", "completions", "messages")
        """
        self.api_key = os.getenv("KIE_KEY")
        if not self.api_key:
            raise ValueError("KIE_KEY environment variable not set.")
            
        self.base_url = "https://api.kie.ai"
        self.endpoint = endpoint
        self.model = model or os.getenv("KIE_MODEL")
        
        if not self.model:
            raise ValueError("Model name not provided. Set KIE_MODEL environment variable or pass as argument.")
            
        self.format = format
        self.client = httpx.Client(timeout=60.0)
        
    def send_request(self, prompt):
        """
        Send a request to KIE API.
        
        Args:
            prompt (str): The prompt to send
            
        Returns:
            str: Generated response
        """
        url = f"{self.base_url}{self.endpoint}"
        
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Prepare payload based on format
        if self.format == "chat":
            payload = {
                "model": self.model,
                "prompt": prompt,
                "max_tokens": 4096
            }
        elif self.format == "completions":
            payload = {
                "model": self.model,
                "prompt": prompt,
                "max_tokens": 4096
            }
        elif self.format == "messages":
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "max_tokens": 4096
            }
        else:
            raise ValueError(f"Unknown format: {self.format}")
            
        try:
            response = self.client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get("code") == 0:
                # If it's an async response, query the task
                if data.get("data", {}).get("status") == "pending":
                    return self._query_task(data.get("data", {}).get("task_id"))
                # If it's a direct response
                elif data.get("data", {}).get("result"):
                    return data.get("data", {}).get("result")
                else:
                    return json.dumps(data)
            elif "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0].get("text", "")
            elif "text" in data:
                return data["text"]
            else:
                raise Exception(data.get("msg", "Unknown error"))
                
        except httpx.HTTPStatusError as e:
            raise Exception(f"HTTP error: {e.response.status_code} - {e.response.text}")
        except Exception as e:
            raise Exception(f"Error: {str(e)}")
    
    def _query_task(self, task_id, max_attempts=60, delay=2):
        """
        Query task status.
        
        Args:
            task_id (str): Task ID to query
            max_attempts (int): Maximum number of attempts
            delay (int): Delay between attempts in seconds
            
        Returns:
            str: Task result
        """
        for attempt in range(max_attempts):
            try:
                url = f"{self.base_url}/v1/task/query"
                response = self.client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={"task_id": task_id}
                )
                response.raise_for_status()
                
                data = response.json()
                
                if data.get("code") == 0:
                    if data.get("data", {}).get("status") == "completed":
                        return data.get("data", {}).get("result")
                    elif data.get("data", {}).get("status") == "failed":
                        raise Exception(f"Task failed: {data.get('msg', 'Unknown error')}")
                        
                time.sleep(delay)
                
            except Exception as e:
                raise Exception(f"Task query error: {str(e)}")
                
        raise Exception("Task timed out")


# Helper function to test different configurations
def test_kie_configurations():
    """Test different KIE API configurations"""
    api_key = os.getenv("KIE_KEY")
    if not api_key:
        print("❌ KIE_KEY environment variable not set.")
        return
    
    # Test different configurations
    configurations = [
        # Common endpoints and formats
        {"endpoint": "/v1/chat/completions", "format": "chat"},
        {"endpoint": "/claude/v1/messages", "format": "messages"},
        {"endpoint": "/v1/completions", "format": "completions"},
    ]
    
    # Try to use standard Claude model if KIE_MODEL not set
    model = os.getenv("KIE_MODEL") or "claude-haiku-4-5"
    
    print(f"Testing with model: {model}")
    print("=" * 50)
    
    for config in configurations:
        print(f"\nTesting endpoint: {config['endpoint']} (format: {config['format']})")
        print("-" * 50)
        
        try:
            api = FlexibleKieAPI(
                endpoint=config["endpoint"],
                model=model,
                format=config["format"]
            )
            
            result = api.send_request("What is 2+2? Please respond with just the number.")
            
            print("✅ Success!")
            print(f"Result: {result}")
            
        except Exception as e:
            print(f"❌ Error: {e}")


# Example usage
if __name__ == "__main__":
    test_kie_configurations()