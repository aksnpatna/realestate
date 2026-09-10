#!/usr/bin/env python3
"""
Test script to find available models on KIE API.
"""

import sys
import os

from dotenv import load_dotenv
load_dotenv()

from kie_api import KIEAPI, is_kie_available, get_kie_client

def test_available_models():
    """Test which common models are available on KIE API"""
    print("Testing available KIE API models...")
    
    if not is_kie_available():
        print("❌ KIE API is not available")
        return []
    
    client = get_kie_client()
    
    # List of common LLM models to test
    models_to_test = [
        # OpenAI models
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo",
        # Anthropic models
        "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307",
        # Google models
        "gemini-pro", "gemini-1.5-pro-latest",
        # Mistral models
        "mistral-large-latest", "mixtral-8x7b-instruct",
        # Llama models
        "llama-3.1-70b-instruct", "llama-3.1-8b-instruct",
        # Other models
        "deepseek-chat", "qwen2.5-7b-instruct"
    ]
    
    available_models = []
    
    for model in models_to_test:
        try:
            print(f"  Testing {model}...", end="")
            result = client.generate(
                model=model,
                prompt="Hello, what is 2+2? Please respond with just the number.",
                temperature=0.0,
                max_tokens=10
            )
            
            if "4" in result:
                available_models.append(model)
                print(f" ✅")
            else:
                print(f" ❓ (unexpected response: {repr(result)})")
        except Exception as e:
            error_msg = str(e)
            if "not supported" in error_msg or "Model not found" in error_msg:
                print(f" ❌ (not supported)")
            else:
                print(f" ❌ (error: {str(e)[:30]}...)")
    
    return available_models

def main():
    """Main function"""
    print("=" * 50)
    print("KIE API Available Models Check")
    print("=" * 50)
    
    available_models = test_available_models()
    
    if available_models:
        print(f"\n✅ Found {len(available_models)} available models:")
        for model in available_models:
            print(f"  - {model}")
    else:
        print("\n❌ No common models found to be available.")
        print("Please check the KIE API documentation or contact support.")
    
    return len(available_models) > 0

if __name__ == "__main__":
    main()