import sys
sys.path.insert(0, '/app')

from ask.synthesis import synthesize_research
from pydantic import BaseModel
from typing import List

# Create simple mock models
class EvidenceMetric(BaseModel):
    id: str
    metric: str
    value: float
    suburb_id: str

class ScenarioAssumptions(BaseModel):
    pass

# Mock data - simplified version of what the API would provide
intent = {
    "question": "Compare Kenmore and Indooroopilly for a .5M family home",
    "goal": "suburb_comparison",
    "suburbs": [{"name": "Indooroopilly", "state": "QLD"}, {"name": "Kenmore", "state": "QLD"}]
}

evidence = [
    EvidenceMetric(id="1", metric="Median Price", value=1756639.39, suburb_id="QLD_INDOOROOPILLY_4068"),
    EvidenceMetric(id="2", metric="Median Price", value=1818231.56, suburb_id="QLD_KENMORE_4069"),
    EvidenceMetric(id="3", metric="Population Growth", value=11.3, suburb_id="QLD_INDOOROOPILLY_4068"),
    EvidenceMetric(id="4", metric="Population Growth", value=8.0, suburb_id="QLD_KENMORE_4069")
]

assumptions = []

affordability_res = {}

print("Calling synthesize_research...")
try:
    result = synthesize_research(intent, evidence, assumptions, affordability_res)
    print("\nResult summary:", result.get('summary', 'No summary'))
    if 'metrics' in result:
        print("Metrics:", list(result['metrics'].keys()))
    if 'unknowns' in result:
        print("Unknowns:", result['unknowns'])
    if 'next_steps' in result:
        print("Next steps:", result['next_steps'])
except Exception as e:
    print(f"\nError: {type(e).__name__}: {e}")
    import traceback
    print("\nStack trace:", traceback.format_exc())
