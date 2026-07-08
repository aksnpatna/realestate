import os
from tavily import TavilyClient
from ddgs import DDGS

def test_searches(suburb, state):
    query = f"{suburb} {state} Australia new infrastructure projects zoning development council plan"
    print(f"\n{'='*50}\nQuery: {query}\n{'='*50}")

    # 1. Tavily
    print("\n--- TAVILY RESULTS ---")
    try:
        tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))
        res = tavily.search(query=query, search_depth="basic", max_results=3)
        for i, doc in enumerate(res.get("results", [])):
            print(f"{i+1}. {doc.get('title')}")
            print(f"   {doc.get('content')[:150]}...")
    except Exception as e:
        print("Tavily Error:", e)

    # 2. DuckDuckGo
    print("\n--- DUCKDUCKGO RESULTS ---")
    try:
        ddgs = DDGS()
        res = ddgs.text(query, backend="html", max_results=3)
        for i, doc in enumerate(res):
            print(f"{i+1}. {doc.get('title')}")
            print(f"   {doc.get('body')[:150]}...")
    except Exception as e:
        print("DuckDuckGo Error:", e)

if __name__ == "__main__":
    test_searches("Frankston", "VIC")
