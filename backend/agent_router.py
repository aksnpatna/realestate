"""
agent_router.py — Rules-based dynamic agent selection for the investment committee.
Decides which agents to run based on suburb metrics, saving LLM tokens
by skipping agents that have nothing useful to say.
"""
from typing import Dict, List


def route_agents(metrics: Dict) -> List[str]:
    """
    Determine which committee agents to run for a given suburb.

    Rules (evaluated in order):
        - Always run fetch_news and supervisor
        - Skip Bull if vacancy > 8% or gross yield < 1.5%
        - Skip Bear if growth_score > 75 AND yield > 5%
        - Skip Urban Planner if population CAGR < 0.5

    Args:
        metrics: Dict of V3 suburb metrics.

    Returns:
        List of agent names to run, in order: e.g. ["bull", "bear", "urban", "supervisor"]
    """
    agents = []

    vacancy = metrics.get("vacancyRate") or metrics.get("vacancy_rate") or 3.0
    yield_pct = metrics.get("rentalYield") or metrics.get("grossYield") or 4.0
    growth = metrics.get("growthScore") or 50
    pop_growth = metrics.get("populationCAGR") or metrics.get("populationGrowth") or 2.0

    # Bull agent: only worth running if there's a demand story
    skip_bull = (vacancy > 8.0) or (yield_pct < 1.5)
    if not skip_bull:
        agents.append("bull_agent")

    # Bear agent: skip if the case is overwhelmingly positive
    skip_bear = (growth > 75) and (yield_pct > 5.0)
    if not skip_bear:
        agents.append("bear_agent")

    # Urban planner: skip if no population growth story
    skip_urban = pop_growth < 0.5
    if not skip_urban:
        agents.append("urban_planner")

    # Report what was skipped
    skipped = []
    if skip_bull:
        skipped.append("Bull (vacancy={:.1f}%, yield={:.1f}%)".format(vacancy, yield_pct))
    if skip_bear:
        skipped.append("Bear (growth={}, yield={:.1f}%)".format(growth, yield_pct))
    if skip_urban:
        skipped.append("Urban Planner (pop_growth={:.1f}%)".format(pop_growth))

    return agents, skipped
