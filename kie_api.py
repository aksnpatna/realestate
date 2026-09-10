#!/usr/bin/env python3
"""
Generic KIE API client that can be configured with correct model name.
"""

import os
import httpx
import time
from dotenv import load_dotenv

load_dotenv()

class KieAPI:
    """
    Generic KIE API client.
    
    Usage:
        client = KieAPI(api_key="your-api-key")
        response = client.send_message("What is 2+2?", model="your-model-name")
        print(response)
    """
    
    def __init__(self, api_key=None, base_url="https://api.kie.ai"):
        """
        Initialize KIE API client.
        
        Args:
            api_key (str): KIE API key. If not provided, will use KIE_KEY from environment.
            base_url (str): Base URL for KIE API. Default: https://api.kie.ai
        """
        self.api_key = api_key or os.getenv("KIE_KEY")
        if not self.api_key:
            raise ValueError("KIE API key is required. Please set KIE_KEY environment variable.")
            
        self.base_url = base_url
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=60.0
        )
    
    def send_message(self, message, model, endpoint="/v1/chat/completions", **kwargs):
        """
        Send a message to KIE API.
        
        Args:
            message (str): Message to send
            model (str): Model name to use
            endpoint (str): API endpoint to use (default: /v1/chat/completions)
            **kwargs: Additional parameters to include in payload
            
        Returns:
            dict: API response
            
        Raises:
            httpx.HTTPStatusError: If API returns an error status code
            Exception: For other errors
        """
        payload = {
            "model": model,
            "prompt": message,
            "max_tokens": kwargs.get("max_tokens", 4096),
            "temperature": kwargs.get("temperature", 0.7),
            **kwargs
        }
        
        # For chat/completions endpoints that use messages array
        if "messages" in kwargs:
            payload["messages"] = kwargs["messages"]
            del payload["prompt"]
        
        try:
            response = self.client.post(endpoint, json=payload)
            response.raise_for_status()
            
            try:
                return response.json()
            except ValueError:
                return {"text": response.text}
                
        except httpx.HTTPStatusError as e:
            print(f"HTTP error: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}", "details": e.response.text}
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")
            return {"error": str(e)}
    
    def chat_completion(self, messages, model, endpoint="/v1/chat/completions", **kwargs):
        """
        Send chat completion request with message history.
        
        Args:
            messages (list): List of messages in format {"role": "user", "content": "text"}
            model (str): Model name to use
            endpoint (str): API endpoint to use (default: /v1/chat/completions)
            **kwargs: Additional parameters
            
        Returns:
            dict: API response
        """
        return self.send_message(
            "",
            model,
            endpoint,
            messages=messages,
            **kwargs
        )
    
    def query_task(self, task_id):
        """
        Query task status and result.
        
        Args:
            task_id (str): Task ID from initial request
            
        Returns:
            dict: Task status and result
        """
        return self.send_message(
            "",
            "",
            endpoint="/v1/task/query",
            task_id=task_id
        )
    
    def generate_image(self, prompt, model, endpoint="/v1/image/generate", **kwargs):
        """
        Generate an image.
        
        Args:
            prompt (str): Image description
            model (str): Image model to use
            endpoint (str): API endpoint to use (default: /v1/image/generate)
            **kwargs: Additional parameters
            
        Returns:
            dict: API response
        """
        payload = {
            "model": model,
            "prompt": prompt,
            **kwargs
        }
        
        try:
            response = self.client.post(endpoint, json=payload)
            response.raise_for_status()
            
            try:
                return response.json()
            except ValueError:
                return {"text": response.text}
                
        except httpx.HTTPStatusError as e:
            print(f"HTTP error: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}", "details": e.response.text}
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")
            return {"error": str(e)}
    
    def wait_for_task(self, task_id, timeout=600):
        """
        Wait for task to complete.
        
        Args:
            task_id (str): Task ID to wait for
            timeout (int): Maximum time to wait in seconds (default: 600)
            
        Returns:
            dict: Completed task result
        """
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            task_status = self.query_task(task_id)
            
            if task_status.get("code") == 0 and task_status.get("data", {}).get("status") == "completed":
                return task_status
            
            time.sleep(2)
            
        return {"error": "Timeout waiting for task completion"}

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.client.close()

    def close(self):
        """Close the HTTP client connection."""
        self.client.close()


def main():
    """Main function for testing"""
    # Test if KIE_KEY is set
    api_key = os.getenv("KIE_KEY")
    if not api_key:
        print("❌ KIE_KEY environment variable not set.")
        print("Please set it in your .env file or as an environment variable.")
        return 1
    
    print("✅ KIE_KEY is available")
    
    # Try to create a client instance
    try:
        client = KieAPI()
        print("✅ KIE API client created successfully")
    except Exception as e:
        print(f"❌ Failed to create KIE API client: {e}")
        return 1
    
    print("=" * 50)
    print("KIE API Client created.")
    print("=" * 50)
    print(f"Base URL: {client.base_url}")
    print(f"API Key: {client.api_key[:5]}...")
    print("=" * 50)
    
    # List of endpoints to test
    endpoints_to_test = [
        "/v1/chat/completions",
        "/claude/v1/messages",
        "/v1/image/generate"
    ]
    
    print("\nTesting available endpoints:")
    print("=" * 50)
    
    for endpoint in endpoints_to_test:
        try:
            # For chat endpoints
            if "chat" in endpoint or "messages" in endpoint:
                result = client.send_message("What is 2+2?", "dummy-model", endpoint)
            # For image endpoints
            elif "image" in endpoint:
                result = client.generate_image("A cute cat", "dummy-model", endpoint)
            else:
                result = client.send_message("Test", "dummy-model", endpoint)
                
            print(f"✅ {endpoint} - responds")
        except Exception as e:
            print(f"❌ {endpoint} - {type(e).__name__}: {e}")
    
    client.close()
    return 0

if __name__ == "__main__":
    main()