"""
verdict.py — Deterministic comparison reasoning engine.
Code decides leaders, edges, and trade-offs; LLM only wordsmiths.
"""
from typing import List, Dict, Any, Optional, Literal
from ask.metric_registry import METRIC_REGISTRY, Direction

METRIC_DIRECTION: Dict[str, Direction] = {}
for k, e in METRIC_REGISTRY.items():
    METRIC_DIRECTION[k] = e.direction

def _percent_diff(best: float, worst: float) -> float:
    if not isinstance(best, (int, float)) or not isinstance(worst, (int, float)):
        return 0.0
    if worst == 0 and best == 0:
        return 0.0
    if worst == 0:
        return 100.0
    return abs((best - worst) / abs(worst)) * 100

def _is_lower_better(metric_key: str) -> bool:
    return METRIC_DIRECTION.get(metric_key, "higher_better") == "lower_better"

def compute_per_metric_winners(
    metrics_data: Dict[str, Dict[str, Optional[float]]]
) -> List[Dict[str, Any]]:
    """
    Input: {metric_key: {suburb_name: value_or_None, ...}, ...}
    Returns per-metric leader, edge, framing.
    """
    results = []
    for mkey, suburb_vals in metrics_data.items():
        # Filter to numeric values only for verdict computation
        valid = {}
        for k, v in suburb_vals.items():
            if v is not None and isinstance(v, (int, float)):
                valid[k] = v
        n_valid = len(valid)
        if n_valid < 2:
            results.append({
                "metric": mkey,
                "leader": None,
                "edge_pct": 0,
                "direction": METRIC_DIRECTION.get(mkey, "higher_better"),
                "framing": "insufficient_data",
                "values": suburb_vals,
            })
            continue
        lower_better = _is_lower_better(mkey)
        sorted_items = sorted(valid.items(), key=lambda x: x[1], reverse=not lower_better)
        leader, leader_val = sorted_items[0]
        _, last_val = sorted_items[-1]
        edge = _percent_diff(sorted_items[0][1], sorted_items[-1][1])

        framing: Literal["clear_leader", "statistically_even", "insufficient_data"] = "clear_leader"
        if edge < 3:
            framing = "statistically_even"

        direction = METRIC_DIRECTION.get(mkey, "higher_better")
        if direction == "contextual":
            entry: Dict[str, Any] = {
                "metric": mkey,
                "leader": leader,
                "edge_pct": round(edge, 1),
                "direction": "contextual",
                "framing": "contextual",
                "context_note": (
                    f"{leader} {sorted_items[-1][0]}"
                ),
                "values": suburb_vals,
            }
        else:
            entry = {
                "metric": mkey,
                "leader": leader,
                "edge_pct": round(edge, 1),
                "direction": direction,
                "framing": framing,
                "values": suburb_vals,
            }
        results.append(entry)
    return results


PERSONA_WEIGHTS: Dict[str, Dict[str, float]] = {
    "investor": {
        "gross_yield": 0.35, "vacancy_rate": 0.25, "population_cagr": 0.20,
        "price_to_rent_ratio": 0.10, "median_price_12m_change_pct": 0.10,
    },
    "family": {
        "school_quality": 0.25, "safety_score": 0.25, "parks_count": 0.15,
        "cbd_distance_mins": 0.15, "owner_occupier_rate": 0.10,
        "transit_accessibility": 0.10,
    },
    "first_home_buyer": {
        "median_price": 0.30, "school_quality": 0.20, "transit_accessibility": 0.15,
        "safety_score": 0.15, "median_price_12m_change_pct": 0.10,
        "cbd_distance_mins": 0.10,
    },
    "developer": {
        "building_approvals_12m": 0.30, "approved_subdivisions_12m": 0.25,
        "construction_sqkm": 0.15, "greenfield_sqkm": 0.10,
        "avg_block_sqm": 0.10, "population_cagr": 0.10,
    },
    "agent": {
        "median_price": 0.20, "school_quality": 0.20, "safety_score": 0.15,
        "transit_accessibility": 0.15, "gross_yield": 0.10,
        "population_cagr": 0.10, "days_on_market": 0.10,
    },
}

def compute_persona_verdicts(
    per_metric_results: List[Dict[str, Any]],
    suburb_names: List[str],
) -> List[Dict[str, Any]]:
    """
    Score suburbs per persona and declare a leader if sufficient comparability.
    """
    persona_results = []
    for persona, weights in PERSONA_WEIGHTS.items():
        scores = {name: 0.0 for name in suburb_names}
        total_weight = 0.0
        comparable_metrics = 0
        for mr in per_metric_results:
            mkey = mr["metric"]
            if mkey not in weights:
                continue
            w = weights[mkey]
            direction = mr.get("direction", "higher_better")
            values = mr.get("values", {})
            valid_vals = {k: v for k, v in values.items() if v is not None}
            if len(valid_vals) < 2:
                continue
            comparable_metrics += 1
            total_weight += w
            # Normalize within this metric
            vals_list = list(valid_vals.values())
            min_v, max_v = min(vals_list), max(vals_list)
            span = max_v - min_v
            if span == 0:
                continue
            for name in suburb_names:
                if name in valid_vals:
                    norm = (valid_vals[name] - min_v) / span
                    if direction == "lower_better":
                        norm = 1 - norm
                    # contextual metrics are neutral — give 0.5 to all
                    if direction == "contextual":
                        continue
                    scores[name] += norm * w

        if total_weight > 0 and comparable_metrics >= 3:
            for name in scores:
                scores[name] = round(scores[name] / total_weight * 100, 1)

        leader = None
        if total_weight > 0 and comparable_metrics >= 3:
            sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
            leader = sorted_scores[0][0]

        persona_results.append({
            "persona": persona,
            "leader": leader,
            "scores": scores,
            "weights_used": {k: v for k, v in weights.items()
                             if any(pm["metric"] == k for pm in per_metric_results)},
        })

    return persona_results


def generate_tradeoffs(
    per_metric_results: List[Dict[str, Any]],
    suburb_names: List[str],
) -> List[str]:
    """Generate human-readable trade-off statements from the metrics data."""
    tradeoffs = []
    for mr in per_metric_results:
        mkey = mr["metric"]
        leader = mr.get("leader")
        values = mr.get("values", {})
        if not leader or len(values) < 2:
            continue
        sorted_vals = sorted(
            [(k, v) for k, v in values.items() if v is not None],
            key=lambda x: x[1],
            reverse=not _is_lower_better(mkey),
        )
        if len(sorted_vals) < 2:
            continue
        leader_name, leader_val = sorted_vals[0]
        laggard_name, laggard_val = sorted_vals[-1]
        edge = mr.get("edge_pct", 0)
        if edge < 3:
            continue

        entry = METRIC_REGISTRY.get(mkey)
        label = entry.label if entry else mkey
        unit = entry.unit if entry else ""

        # Make trade-off directions meaningful
        direction = mr.get("direction", "higher_better")
        if direction == "contextual":
            if mkey == "median_price":
                tradeoffs.append(
                    f"{leader_name} has a {edge:.0f}% lower entry price ({label}: {_fmt(leader_val, unit)} vs {_fmt(laggard_val, unit)}) — more affordable, but may reflect lower demand or smaller lots."
                )
            else:
                tradeoffs.append(
                    f"{leader_name} differs from {laggard_name} on {label} ({edge:.0f}% difference)."
                )
        elif direction == "higher_better":
            tradeoffs.append(
                f"{leader_name} leads on {label} ({_fmt(leader_val, unit)} vs {_fmt(laggard_val, unit)} — {edge:.0f}% advantage)."
            )
        else:
            tradeoffs.append(
                f"{leader_name} has a better {label} ({_fmt(leader_val, unit)} vs {_fmt(laggard_val, unit)} — {edge:.0f}% lower, which is preferable)."
            )

    return tradeoffs[:5]


def _fmt(val: Any, unit: str) -> str:
    if isinstance(val, float):
        if unit in ("$", "$/week"):
            if val >= 1000000:
                return f"${val/1e6:.2f}M"
            if val >= 1000:
                return f"${val/1e3:.0f}k"
            return f"${val:,.0f}"
        if "%" in unit:
            return f"{val:.2f}%"
        return f"{val:,.1f}"
    return str(val)
