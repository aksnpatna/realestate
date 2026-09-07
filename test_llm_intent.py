#!/usr/bin/env python3
"""
Test script to verify LLM intent parser connections with individual providers.
Tests NVIDIA, Groq (xAI), and DeepSeek API keys from .env file.
"""

import os
import sys
import json
import asyncio
import logging
from dotenv import load_dotenv

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Test query
TEST_QUERY = "What are the best suburbs in Melbourne for investment with good rental yield?"

async def test_provider(name: str, api_key: str, base_url: str, model: str) -> bool:
    """Test LLM intent parser with a specific provider."""
    logger.info(f"\n{'='*50}")
    logger.info(f"Testing {name} LLM intent parser...")
    logger.info(f"{'='*50}")
    
    try:
        from ask.intent import parse_intent_llm
        
        # Create deterministic hints for the test query
        deterministic_hints = {
            "question": TEST_QUERY,
            "goal": "investment_search",
            "suburbs": [],
            "geo": {
                "direction": None,
                "radius_km": None,
                "anchor_value": "VIC",
                "anchor_type": "state"
            },
            "thresholds": [{"metric": "gross_yield", "op": ">=", "value": 4.5}],
            "property_type": "house",
            "tenure": "investor",
            "budget": None,
            "priorities": ["cashflow"],
            "confidence": 0.6,
            "is_geo_discovery": True,
            "state": "VIC"
        }
        
        # Override environment variables temporarily for this test
        original_providers = os.environ.copy()
        
        # Only enable the current provider
        os.environ["NVIDIA_API_KEY"] = ""
        os.environ["GROQ_API_KEY"] = ""
        os.environ["DEEPSEEK_API_KEY"] = ""
        os.environ["OPENAI_API_KEY"] = ""
        
        if name == "NVIDIA":
            os.environ["NVIDIA_API_KEY"] = api_key
        elif name == "Groq":
            os.environ["GROQ_API_KEY"] = api_key
        elif name == "DeepSeek":
            os.environ["DEEPSEEK_API_KEY"] = api_key
        
        logger.info(f"Provider: {name}")
        logger.info(f"Model: {model}")
        logger.info(f"Base URL: {base_url}")
        logger.info(f"Query: {TEST_QUERY}")
        
        # Call the LLM intent parser
        import time
        start_time = time.time()
        result = await parse_intent_llm(TEST_QUERY, deterministic_hints)
        duration = time.time() - start_time
        
        # Restore original environment variables
        for key, value in original_providers.items():
            os.environ[key] = value
        
        if result:
            logger.info(f"✅ Success! Response time: {duration:.2f} seconds")
            logger.info(f"Result:")
            logger.info(json.dumps(result, indent=2))
            return True
        else:
            logger.error(f"❌ Failed: No response received from {name}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Error testing {name}: {str(e)}")
        import traceback
        logger.error(f"Stack trace: {traceback.format_exc()}")
        return False

async def test_all_providers():
    """Test all configured LLM providers."""
    # Get API keys from environment
    nvidia_key = os.getenv("NVIDIA_API_KEY")
    xai_key = os.getenv("XAI_API_KEY")
    deepseek_key = os.getenv("DEEPSEEK_API_KEY")
    
    logger.info(f"Found API keys:")
    logger.info(f"NVIDIA: {'✓' if nvidia_key and nvidia_key != 'sk-mock' else '✗'}")
    logger.info(f"xAI (Grok): {'✓' if xai_key and xai_key != 'sk-mock' else '✗'}")
    logger.info(f"DeepSeek: {'✓' if deepseek_key and deepseek_key != 'sk-mock' else '✗'}")
    
    # Define provider configurations
    providers = [
        ("NVIDIA", nvidia_key, "https://integrate.api.nvidia.com/v1", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"),
        ("xAI", xai_key, "https://api.x.ai/v1", "grok-4.6"),
        ("DeepSeek", deepseek_key, "https://api.deepseek.com/v1", "deepseek-chat")
    ]
    
    # Run tests
    results = []
    for name, api_key, base_url, model in providers:
        if api_key and api_key != "sk-mock":
            success = await test_provider(name, api_key, base_url, model)
            results.append((name, success))
        else:
            logger.warning(f"Skipping {name} - API key not found or is mock value")
            results.append((name, False))
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("TEST SUMMARY")
    logger.info("="*50)
    
    all_passed = True
    for name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        logger.info(f"{name}: {status}")
        if not success:
            all_passed = False
    
    return all_passed

async def test_connection_speed():
    """Test connection speed for each provider."""
    logger.info("\n" + "="*50)
    logger.info("TESTING CONNECTION SPEED")
    logger.info("="*50)
    
    # Simple test to measure response time
    from ai_agent import get_llm
    
    # Test NVIDIA
    original_env = os.environ.copy()
    if os.getenv("NVIDIA_API_KEY") and os.getenv("NVIDIA_API_KEY") != "sk-mock":
        os.environ["GROQ_API_KEY"] = ""
        os.environ["DEEPSEEK_API_KEY"] = ""
        os.environ["OPENAI_API_KEY"] = ""
        try:
            llm = get_llm()
            logger.info(f"NVIDIA LLM type: {type(llm).__name__}")
        except Exception as e:
            logger.error(f"NVIDIA connection error: {e}")
        finally:
            for key, value in original_env.items():
                os.environ[key] = value
    
    # Test Groq
    if os.getenv("GROQ_API_KEY") and os.getenv("GROQ_API_KEY") != "sk-mock":
        os.environ["NVIDIA_API_KEY"] = ""
        os.environ["DEEPSEEK_API_KEY"] = ""
        os.environ["OPENAI_API_KEY"] = ""
        try:
            llm = get_llm()
            logger.info(f"Groq LLM type: {type(llm).__name__}")
        except Exception as e:
            logger.error(f"Groq connection error: {e}")
        finally:
            for key, value in original_env.items():
                os.environ[key] = value
    
    # Test DeepSeek
    if os.getenv("DEEPSEEK_API_KEY") and os.getenv("DEEPSEEK_API_KEY") != "sk-mock":
        os.environ["NVIDIA_API_KEY"] = ""
        os.environ["GROQ_API_KEY"] = ""
        os.environ["OPENAI_API_KEY"] = ""
        try:
            llm = get_llm()
            logger.info(f"DeepSeek LLM type: {type(llm).__name__}")
        except Exception as e:
            logger.error(f"DeepSeek connection error: {e}")
        finally:
            for key, value in original_env.items():
                os.environ[key] = value

if __name__ == "__main__":
    logger.info("Starting LLM Intent Parser Connection Tests")
    logger.info("Test Query: \"What are the best suburbs in Melbourne for investment with good rental yield?\"")
    
    try:
        # Run all tests
        all_passed = asyncio.run(test_all_providers())
        
        # Test connection speed
        asyncio.run(test_connection_speed())
        
        if all_passed:
            logger.info("\n🎉 All LLM intent parser tests passed!")
        else:
            logger.error("\n⚠️  Some LLM intent parser tests failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("\nTest interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"\n❌ Critical error: {str(e)}")
        import traceback
        logger.error(f"Stack trace: {traceback.format_exc()}")
        sys.exit(1)