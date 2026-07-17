"""
persona_presets.py — Persona-driven default weights and configuration.

Personas drive TWO things:
  1. BuyFinder default weights (server-side fallback when client omits weights)
  2. Which profile sections are visible on the suburb profile (frontend uses this
     contract via /api/personas; backend is the single source of truth).

Three personas are supported out of the box:
  - first_home_buyer  (Priya)   — affordability/fit focus, minimal technical depth
  - investor                    — market indicators + cashflow + risk
  - buyers_agent                — full technical set incl. social housing, subdivision,
                                  cadastre, provenance, DQ issues

Weights here MUST stay consistent across persona_presets (backend), personas.ts
(frontend), and the BuyFinderWeights schema in buyfinder.py.
"""
from typing import Any, Dict, List

PERSONA_PRESETS: Dict[str, Dict[str, Any]] = {
    "first_home_buyer": {
        "label": "First-home buyer",
        "description": "Affordability and serviceability focus. Personalised fit matters more than market indicators.",
        "weights": {
            "affordability": 35,
            "income": 25,
            "livability": 20,
            "access": 15,
            "evidence": 5,
        },
        "visible_profile_sections": [
            "overview",
            "market",
            "people",
            "infrastructure",
            "risk",
            "ai",
        ],
        "show_technical": False,
        "headline_score": "buyer_fit",
    },
    "investor": {
        "label": "Investor",
        "description": "Yield, momentum, demand/supply and cashflow first. Market indicators take priority.",
        "weights": {
            "affordability": 20,
            "income": 20,
            "livability": 15,
            "access": 15,
            "evidence": 30,
        },
        "visible_profile_sections": [
            "overview",
            "market",
            "people",
            "infrastructure",
            "risk",
            "ai",
        ],
        "show_technical": False,
        "headline_score": "growth",
    },
    "buyers_agent": {
        "label": "Buyer's Agent",
        "description": "Full technical depth: social housing, subdivision, cadastre, crime, provenance and DQ issues. No data hidden.",
        "weights": {
            "affordability": 25,
            "income": 20,
            "livability": 20,
            "access": 15,
            "evidence": 20,
        },
        "visible_profile_sections": [
            "overview",
            "market",
            "people",
            "infrastructure",
            "listings",
            "risk",
            "pockets",
            "ai",
            "technical",
        ],
        "show_technical": True,
        "headline_score": "dq",
    },
}

DEFAULT_PERSONA = "first_home_buyer"


def is_persona(id_: str) -> bool:
    return id_ in PERSONA_PRESETS


def get_persona(id_: str) -> Dict[str, Any]:
    return PERSONA_PRESETS.get(id_, PERSONA_PRESETS[DEFAULT_PERSONA])


def persona_ids() -> List[str]:
    return list(PERSONA_PRESETS.keys())


def persona_weights(id_: str) -> Dict[str, float]:
    return dict(get_persona(id_).get("weights", {}))


def public_persona_payload() -> Dict[str, Any]:
    """Frontend-facing payload (weights + section visibility + meta)."""
    out: Dict[str, Any] = {}
    for pid, p in PERSONA_PRESETS.items():
        out[pid] = {
            "id": pid,
            "label": p["label"],
            "description": p["description"],
            "weights": dict(p["weights"]),
            "visible_profile_sections": list(p["visible_profile_sections"]),
            "show_technical": p["show_technical"],
            "headline_score": p["headline_score"],
        }
    return out
