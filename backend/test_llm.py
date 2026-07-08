import os, sys, time
from ai_agent import run_investment_committee, get_llm

metrics = {
    "houseMedianPrice": 1000000,
    "houseMedianRent": 600,
    "houseRentalYield": 3.1,
    "12mGrowthPct": 5.0,
    "populationCagr": 1.2,
    "ownerOccupierRate": 60.0,
    "investorRate": 40.0,
    "vacancyRate": 1.5,
    "supplyDemandRatio": 0.8,
    "typicalMortgageBand": 4000,
    "averageHouseholdSize": 2.5,
    "medianAge": 35,
    "predominantOccupation": "Professional",
    "macro_benchmark_etf": None
}

print("Testing get_llm()...")
try:
    llm = get_llm()
    print("LLM is:", type(llm).__name__)
    t0 = time.time()
    res = llm.invoke("Hello, say OK")
    print(f"LLM Response ({time.time()-t0:.2f}s):", res.content)
except Exception as e:
    print("LLM Error:", e)

print("\nRunning full committee...")
t0 = time.time()
try:
    res = run_investment_committee("Richmond", "VIC", metrics)
    print(f"Committee finished in {time.time()-t0:.2f}s")
    print("Verdict:", res.get("verdict"))
except Exception as e:
    print("Committee Error:", e)
