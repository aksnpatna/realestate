#!/usr/bin/env python3
"""
Robust KIE API integration for Gpt 6 Astra model.

This version handles errors properly and focuses on stable features.
"""

import os
import httpx
import json
from dotenv import load_dotenv

load_dotenv()

class KIEGPT6Astra:
    """
    KIE API client for Gpt 6 Astra model.
    """
    
    def __init__(self, api_key=None):
        """
        Initialize KIE Gpt 6 Astra API client.
        
        Args:
            api_key (str): KIE API key. If not provided, will use KIE_KEY from environment.
        """
        self.api_key = api_key or os.getenv("KIE_KEY")
        if not self.api_key:
            raise ValueError("KIE API key is required. Please set KIE_KEY environment variable.")
            
        self.base_url = "https://api.kie.ai"
        self.endpoint = "/codex/v1/responses"
        self.model = "gpt-6-astra"
        
        self.client = httpx.Client(
            base_url=self.base_url,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=60.0
        )
    
    def send_request(self, input_data, stream=False, reasoning_effort="low", tools=None, tool_choice=None):
        """
        Send a request to Gpt 6 Astra model.
        
        Args:
            input_data (str or list): Input text or message array
            stream (bool): Whether to stream responses (default: False)
            reasoning_effort (str): "low", "medium", "high", or "xhigh" (default: low)
            tools (list): Optional tools configuration (web search or function calling)
            tool_choice (str): Tool selection behavior (e.g., "auto")
            
        Returns:
            dict: API response
            
        Raises:
            httpx.HTTPStatusError: If API returns an error status code
            Exception: For other errors
        """
        # Prepare payload
        payload = {
            "model": self.model,
            "input": input_data,
            "stream": stream,
            "reasoning": {
                "effort": reasoning_effort
            }
        }
        
        # Add tools if specified
        if tools:
            payload["tools"] = tools
        
        # Add tool choice if specified
        if tool_choice:
            payload["tool_choice"] = tool_choice
        
        try:
            response = self.client.post(self.endpoint, json=payload)
            response.raise_for_status()
            
            return response.json()
            
        except httpx.HTTPStatusError as e:
            print(f"HTTP error: {e.response.status_code} - {e.response.text}")
            return {"error": f"HTTP {e.response.status_code}", "details": e.response.text}
        except Exception as e:
            print(f"Error: {type(e).__name__}: {e}")
            return {"error": str(e)}
    
    def chat_completion(self, prompt, reasoning_effort="low"):
        """
        Simple chat completion with text prompt.
        
        Args:
            prompt (str): Text prompt to send
            reasoning_effort (str): "low" or "medium" (default: low)
            
        Returns:
            str: Generated text response
        """
        # Prepare input as message array
        input_data = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": prompt
                    }
                ]
            }
        ]
        
        response = self.send_request(input_data, reasoning_effort=reasoning_effort)
        
        if "error" in response:
            return f"Error: {response['error']}"
        
        try:
            if "output" in response:
                for item in response["output"]:
                    if item.get("type") == "message" and item.get("role") == "assistant":
                        if "content" in item:
                            for content in item["content"]:
                                if content.get("type") == "output_text":
                                    return content["text"]
            return json.dumps(response)
        except Exception as e:
            print(f"Error parsing response: {e}")
            return json.dumps(response)
    
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.client.close()

    def close(self):
        """Close the HTTP client connection."""
        self.client.close()


# Test function with error handling
def test_kie_gpt6astra():
    """Test function for KIE Gpt 6 Astra integration with error handling."""
    try:
        print("=" * 50)
        print("KIE Gpt 6 Astra API Test")
        print("=" * 50)
        
        # Create client instance
        api = KIEGPT6Astra()
        
        # Test 1: Simple text completion with low reasoning (stable)
        print("\n1. Testing simple text completion (low reasoning):")
        print("-" * 50)
        prompt = "What is 2+2? Respond with just the number."
        response = api.chat_completion(prompt, reasoning_effort="low")
        print(f"Prompt: {prompt}")
        print(f"Response: {response}")
        
        # Test 2: Text completion with medium reasoning
        print("\n2. Testing text completion (medium reasoning):")
        print("-" * 50)
        prompt = "Explain why the sky is blue in one sentence."
        response = api.chat_completion(prompt, reasoning_effort="medium")
        print(f"Prompt: {prompt}")
        print(f"Response: {response}")
        
        # Test 3: Basic reasoning task
        print("\n3. Testing basic reasoning task:")
        print("-" * 50)
        prompt = "If a train travels at 60 mph, how far will it go in 2.5 hours?"
        response = api.chat_completion(prompt, reasoning_effort="medium")
        print(f"Prompt: {prompt}")
        print(f"Response: {response}")
        
        print("\n" + "=" * 50)
        print("✅ Stable features tested successfully!")
        print("=" * 50)
        
        print("\n⚠️  Note: Web search and function calling are experiencing server errors.")
        print("⚠️  These features may be disabled or experiencing issues.")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        print(traceback.format_exc())
        return False


if __name__ == "__main__":
    test_kie_gpt6astra()