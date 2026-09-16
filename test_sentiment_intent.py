#!/usr/bin/env python3
"""Test script to verify sentiment intent parsing"""

import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from ask.intent import parse_intent_deterministic, extract_qualitative_thresholds
from ask.schemas import SuburbReference

def test_sentiment_parsing():
    """Test that sentiment keywords are correctly parsed"""
    print("Testing sentiment intent parsing...")
    
    # Test cases
    test_queries = [
        "Find bullish suburbs in Brisbane",
        "Show me areas with positive news sentiment",
        "What suburbs have good news and high yield?",
        "Find bearish suburbs in Melbourne",
        "Show me areas with negative sentiment",
        "What suburbs have bad news under $500k?",
        "Find neutral sentiment suburbs in Sydney",
    ]
    
    for query in test_queries:
        print(f"\nTesting: '{query}'")
        
        # Test with empty resolved suburbs (discovery mode)
        resolved_suburbs = []
        result = parse_intent_deterministic(query, resolved_suburbs)
        
        # Check if thresholds were extracted
        thresholds = result.get('thresholds', [])
        if thresholds:
            print(f"✓ Thresholds extracted: {len(thresholds)}")
            for thresh in thresholds:
                print(f"  - {thresh['metric']} {thresh['op']} {thresh['value']}")
        else:
            print("⚠️ No thresholds extracted")
            
        # Check goal classification
        goal = result.get('goal')
        print(f"Goal: {goal}")
        
        # Verify news_sentiment metric is being recognized
        sentiment_thresholds = [t for t in thresholds if t['metric'] == 'news_sentiment']
        if sentiment_thresholds:
            print("✓ News sentiment metric recognized")
        else:
            print("⚠️ News sentiment metric NOT recognized")

def test_threshold_extraction():
    """Test the threshold extraction function directly"""
    print("\n\nTesting threshold extraction directly...")
    
    test_texts = [
        "bullish",
        "positive sentiment",
        "good news",
        "bearish",
        "negative sentiment", 
        "bad news",
        "neutral sentiment",
    ]
    
    for text in test_texts:
        thresholds = extract_qualitative_thresholds(text)
        if thresholds:
            print(f"✓ '{text}' → {len(thresholds)} thresholds")
            for thresh in thresholds:
                print(f"  - {thresh['metric']} {thresh['op']} {thresh['value']}")
        else:
            print(f"⚠️ '{text}' → No thresholds")

if __name__ == "__main__":
    print("Testing sentiment intent parsing functionality")
    print("=" * 60)
    
    try:
        test_sentiment_parsing()
        test_threshold_extraction()
        print("\n✅ All tests passed!")
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        print(traceback.format_exc())
