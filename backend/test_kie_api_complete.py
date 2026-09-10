#!/usr/bin/env python3
"""
Comprehensive KIE API test script based on documentation.
"""

import sys
import os
import httpx
import time

class KIEAPITester:
    """KIE API tester based on documentation"""
    
    BASE_URL = "https://api.kie.ai"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.Client(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=60.0
        )
    
    def create_text_task(self, prompt: str, model: str = "gpt-4o"):
        """Create a text generation task"""
        print(f"Creating text generation task with prompt: {prompt[:50]}...")
        
        try:
            payload = {
                "model": model,
                "prompt": prompt,
                "max_tokens": 200,
                "temperature": 0.7
            }
            
            response = self.client.post("/v1/chat/completions", json=payload)
            
            print(f"  Status code: {response.status_code}")
            print(f"  Response: {response.text}")
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
        except Exception as e:
            print(f"  Error: {e}")
            return None
    
    def create_image_task(self, prompt: str, model: str = "dall-e-3"):
        """Create an image generation task"""
        print(f"Creating image generation task with prompt: {prompt[:50]}...")
        
        try:
            payload = {
                "model": model,
                "prompt": prompt,
                "size": "1024x1024",
                "n": 1
            }
            
            response = self.client.post("/v1/images/generations", json=payload)
            
            print(f"  Status code: {response.status_code}")
            print(f"  Response: {response.text}")
            
            if response.status_code == 200:
                return response.json()
            else:
                return None
        except Exception as e:
            print(f"  Error: {e}")
            return None
    
    def query_task(self, task_id: str):
        """Query task status"""
        try:
            response = self.client.post("/v1/task/query", json={"task_id": task_id})
            
            if response.status_code == 200:
                return response.json()
            else:
                print(f"Query failed: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"Query error: {e}")
            return None


def main():
    """Main test function"""
    api_key = "d4cff097f873bf763ef7d6c08402eb80"
    
    print("=" * 50)
    print("KIE API Comprehensive Test")
    print("=" * 50)
    
    tester = KIEAPITester(api_key)
    
    # Test 1: Text generation with various model names
    print("\n--- Test 1: Text Generation ---")
    
    text_models = [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
        "claude-3-opus", "claude-3-sonnet", "claude-3-haiku",
        "gemini-pro", "gemini-1.5-pro",
        "mistral-large", "mixtral-8x7b",
        "llama-3.1-70b", "llama-3.1-8b",
        "deepseek-chat", "qwen2.5-7b"
    ]
    
    for model in text_models:
        result = tester.create_text_task("Hello, what is 2+2?", model)
        if result and result.get("code") == 0:
            print(f"  ✅ Model {model} is available!")
            task_id = result.get("data", {}).get("task_id")
            if task_id:
                print(f"  Task ID: {task_id}")
                
                # Wait a bit and query status
                time.sleep(2)
                status = tester.query_task(task_id)
                if status:
                    print(f"  Task status: {status.get('data', {}).get('status')}")
            break  # Stop at first working model
        elif result and result.get("msg") == "The model is not supported":
            print(f"  ❌ Model {model} not supported")
        else:
            print(f"  ❌ Error with model {model}: {result.get('msg') if result else 'Unknown error'}")
        time.sleep(1)  # Avoid rate limiting
    
    # Test 2: Image generation
    print("\n--- Test 2: Image Generation ---")
    
    image_models = [
        "dall-e-3", "dall-e-2",
        "midjourney",
        "stable-diffusion-xl", "stable-diffusion-3"
    ]
    
    for model in image_models:
        result = tester.create_image_task("A cute cat playing with a ball", model)
        if result and result.get("code") == 0:
            print(f"  ✅ Model {model} is available!")
            task_id = result.get("data", {}).get("task_id")
            if task_id:
                print(f"  Task ID: {task_id}")
            break  # Stop at first working model
        elif result and result.get("msg") == "The model is not supported":
            print(f"  ❌ Model {model} not supported")
        else:
            print(f"  ❌ Error with model {model}: {result.get('msg') if result else 'Unknown error'}")
        time.sleep(1)
    
    return 0

if __name__ == "__main__":
    main()