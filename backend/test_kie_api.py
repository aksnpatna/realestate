#!/usr/bin/env python3
"""
Test script to verify KIE API integration.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from kie_api import KIEAPI, is_kie_available, get_kie_client

def test_kie_initialization():
    """Test KIE API initialization"""
    print("Testing KIE API initialization...")
    
    if not is_kie_available():
        print("❌ KIE API is not available (missing API key)")
        return False
    
    try:
        client = get_kie_client()
        print("✅ KIE API client initialized successfully")
        return True
    except Exception as e:
        print(f"❌ KIE API initialization failed: {e}")
        return False

def test_kie_generation():
    """Test KIE API generation"""
    print("\nTesting KIE API generation...")
    
    try:
        client = get_kie_client()
        
        # Simple test prompt
        result = client.generate(
            model=os.getenv("KIE_MODEL", "gpt-4o"),
            prompt="Hello, how are you? Please respond in 1-2 sentences.",
            temperature=0.7,
            max_tokens=100
        )
        
        print(f"✅ Generation successful")
        print(f"Result: {result.strip()}")
        return True
    except Exception as e:
        print(f"❌ Generation failed: {e}")
        return False

def test_kie_chat_completion():
    """Test KIE API chat completion"""
    print("\nTesting KIE API chat completion...")
    
    try:
        client = get_kie_client()
        
        # Test chat completion with multiple messages
        messages = [
            {"role": "system", "content": "You are a helpful assistant that responds in JSON format."},
            {"role": "user", "content": "What's the capital of France?"}
        ]
        
        result = client.chat_completion(
            model=os.getenv("KIE_MODEL", "gpt-4o"),
            messages=messages
        )
        
        print(f"✅ Chat completion successful")
        print(f"Result: {result.strip()}")
        return True
    except Exception as e:
        print(f"❌ Chat completion failed: {e}")
        return False

def main():
    """Main test function"""
    print("=" * 50)
    print("KIE API Integration Test")
    print("=" * 50)
    
    # Check if KIE_KEY is available
    kie_key = os.getenv("KIE_KEY")
    if not kie_key or kie_key == "none":
        print("❌ KIE_KEY environment variable not set or invalid")
        return False
    
    print(f"Using KIE_KEY: {kie_key[:5]}...")
    
    # Run tests
    tests = [
        test_kie_initialization,
        test_kie_generation,
        test_kie_chat_completion
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
            else:
                failed += 1
        except Exception as e:
            print(f"\n❌ Test failed with exception: {e}")
            failed += 1
    
    print("\n" + "=" * 50)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 50)
    
    if failed == 0:
        print("\n✅ All tests passed! KIE API integration is working correctly.")
    else:
        print(f"\n❌ {failed} test(s) failed. Please check your KIE API configuration.")
    
    return failed == 0

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)