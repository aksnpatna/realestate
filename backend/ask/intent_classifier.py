import json
import os
import openai
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

async def classify_intent_llm(query: str, user_id: str = "unknown") -> Dict[str, Any]:
    system_prompt = """
    You are an intent classifier for a real estate platform.
    Given a user query, extract the goal, suburbs, property_type, budget, etc.
    Return strictly JSON that conforms to the AskIntent schema.
    If you detect specific suburbs, include them in the 'suburbs' array as {"name": "SuburbName", "state": "StateCode"}.
    If the goal is 'interstate_discovery' or 'investment_search' and no specific suburb is named, leave 'suburbs' empty.
    
    Valid goals: interstate_discovery, single_suburb_research, suburb_comparison, investment_search, risks_analysis, cashflow_projection, schools_analysis, growth_analysis
    
    JSON Output Example:
    {
      "question": "The original query",
      "goal": "single_suburb_research",
      "suburbs": [{"name": "Kenmore", "state": "QLD"}],
      "states": [],
      "property_type": "any",
      "tenure": "undecided",
      "budget": 1500000,
      "priorities": []
    }
    """

    providers = [
        {"name": "Grok", "key": os.getenv("XAI_API_KEY"), "base_url": "https://api.x.ai/v1", "model": "grok-2-latest"},
        {"name": "NVIDIA", "key": os.getenv("NVIDIA_API_KEY"), "base_url": "https://integrate.api.nvidia.com/v1", "model": "meta/llama-3.1-70b-instruct"},
        {"name": "DeepSeek", "key": os.getenv("DEEPSEEK_API_KEY"), "base_url": "https://api.deepseek.com/v1", "model": "deepseek-chat"}
    ]

    for provider in providers:
        if not provider["key"]:
            continue
            
        try:
            client = openai.AsyncClient(api_key=provider["key"], base_url=provider["base_url"])
            response = await client.chat.completions.create(
                model=provider["model"],
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query}
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=300,
                timeout=5.0
            )
            raw_output = response.choices[0].message.content
            
            if hasattr(response, 'usage') and response.usage:
                tokens = response.usage.total_tokens
                logger.info(f"LLM_Usage | Feature=intent_classifier | Provider={provider['name']} | Tokens={tokens} | User={user_id}")
                
            return json.loads(raw_output)
        except Exception as e:
            print(f"Intent Classifier: Provider {provider['name']} failed: {str(e)}")
            continue

    raise Exception("All LLM providers failed for intent classification.")
