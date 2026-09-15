import os
from dotenv import load_dotenv

load_dotenv()
os.environ["ENABLE_AI_INSIGHTS"] = "true"

from ai_agent import run_investment_committee

metrics = {
    "growth_score": 80,
    "yield": 5.5,
    "vacancy": 2.0,
    "population_cagr": 2.1,
    "median_price": 850000
}

if __name__ == "__main__":
    print("Running Investment Committee for Test Suburb...")
    result = run_investment_committee(
        suburb="Testville",
        state="NSW",
        metrics=metrics,
        fetch_news=False
    )
    print("\n\n--- SUPERVISOR DECISION ---")
    print(result.get("supervisor_decision"))
    print("--------------------------")
    print("\nDone! Check your LangSmith dashboard to see the trace.")
