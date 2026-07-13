"""
risk_engine.py — Quantitative risk assessment for AI investment committee.
Runs a Monte Carlo simulation of price trajectories using macro-economic inputs.
No GPU required — lightweight numpy computation.
"""
import numpy as np

# Default macro parameters (can be refreshed from live data)
DEFAULT_MACRO = {
    "cash_rate": 4.10,         # RBA cash rate (%)
    "cpi_annual": 3.2,         # Inflation (%)
    "unemployment": 4.1,       # Unemployment (%)
    "population_growth": 2.4,  # Annual population growth (%)
    "building_approvals": 1.0, # 12-month change (%)
}

DEFAULT_ITERATIONS = 5000
DEFAULT_HORIZON_MONTHS = 12


def compute_risk_rating(
    median_price: float,
    rental_yield: float,
    growth_score: float,
    macro: dict | None = None,
    iterations: int = DEFAULT_ITERATIONS,
    horizon_months: int = DEFAULT_HORIZON_MONTHS,
) -> dict:
    """
    Run a Monte Carlo scenario simulation of property price trajectories.

    IMPORTANT: This is a model scenario, NOT a calibrated empirical probability.
    The mean is derived from the heuristic growth score and is not yet validated
    against historical outcomes. Do not present results as statistical probabilities.

    Parameters:
        median_price: Current median house price
        rental_yield: Gross rental yield (%)
        growth_score: Growth score (0-100) from the suburb metrics
        macro: Dict of macro-economic indicators
        iterations: Number of Monte Carlo runs (default 5000)
        horizon_months: Projection period in months (default 12)

    Returns:
        dict with:
            risk_rating (str) — "Low", "Medium", or "High" scenario estimate
            price_decline_scenario (float) — estimated frequency of >5% decline in simulation
            projected_range (list) — [10th percentile, median, 90th percentile]
            expected_return (float) — mean annualized return (%)
            volatility (float) — annualized volatility (%)
            is_calibrated (bool) — always False; model is not yet validated
    """
    macro = macro or DEFAULT_MACRO

    # Base monthly growth from growth_score (maps 0-100 → -0.5% to +1.0% monthly)
    base_monthly = -0.005 + (growth_score / 100.0) * 0.015

    # Yield adjustment: higher yield → more stable returns, slightly positive
    yield_adj = (rental_yield - 3.0) * 0.02

    # Macro adjustment:
    # - Higher cash rate → downward pressure
    # - Higher CPI → mixed (asset inflation vs affordability pressure)
    # - Lower unemployment → stronger demand
    macro_adj = (
        -0.003 * (macro["cash_rate"] - 3.5)          # Cash rate above 3.5% is restrictive
        + 0.002 * (macro["cpi_annual"] - 2.5)         # CPI above target → asset inflation
        - 0.002 * (macro["unemployment"] - 4.0)       # Higher unemployment → weaker demand
        + 0.001 * macro["population_growth"]           # Population growth is positive
    )

    mu_monthly = base_monthly + yield_adj + macro_adj

    # Volatility: base 2.5%/month, scaled by macro uncertainty
    base_vol = 0.025
    macro_vol_mult = 1.0 + 0.05 * abs(macro["cash_rate"] - 3.5) + 0.03 * abs(macro["cpi_annual"] - 2.5)
    sigma_monthly = base_vol * macro_vol_mult

    # Monte Carlo simulation
    rng = np.random.default_rng()
    returns = rng.normal(mu_monthly, sigma_monthly, (iterations, horizon_months))
    cumulative = (1 + returns).prod(axis=1)
    final_prices = median_price * cumulative
    total_returns_pct = (cumulative - 1) * 100

    # Risk metrics
    price_decline_prob = float((total_returns_pct < -5.0).mean())
    p10 = float(np.percentile(final_prices, 10))
    p50 = float(np.percentile(final_prices, 50))
    p90 = float(np.percentile(final_prices, 90))
    expected_return = float(np.mean(total_returns_pct))
    annualized_vol = float(np.std(total_returns_pct))

    if price_decline_prob < 0.15:
        risk_rating = "Low"
    elif price_decline_prob < 0.30:
        risk_rating = "Medium"
    else:
        risk_rating = "High"

    return {
        "risk_rating": risk_rating,
        "price_decline_scenario": round(price_decline_prob, 3),
        "projected_range": [round(p10), round(p50), round(p90)],
        "expected_return": round(expected_return, 1),
        "volatility": round(annualized_vol, 1),
        "is_calibrated": False,
        "calibration_note": "Model scenario only — not validated against historical outcomes. Results are estimated, not empirical probabilities.",
        "simulation_params": {
            "iterations": iterations,
            "horizon_months": horizon_months,
            "mu_monthly": round(mu_monthly, 4),
            "sigma_monthly": round(sigma_monthly, 4),
        },
    }
