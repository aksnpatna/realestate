import json
import math
import numpy as np
import pandas as pd
from typing import List, Dict
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

def find_similar_suburbs(target_suburb: Dict, all_suburbs: List[Dict], limit=5):
    """
    Finds cheaper suburbs that share similar institutional-grade characteristics
    using KMeans clustering on normalized features.
    """
    try:
        if not all_suburbs or not target_suburb:
            return []

        target_id = target_suburb.get('id')
        target_metrics = target_suburb.get("metrics", {})
        target_price = target_metrics.get('medianPrice', 99999999)

        # Extract features for all suburbs
        data_rows = []
        for s in all_suburbs:
            metrics = s.get('metrics', {})
            price = metrics.get('medianPrice', 0)
            if not isinstance(price, (int, float)) or price <= 0:
                continue
                
            icsea = metrics.get('icseaAvg') or metrics.get('schoolQuality') or 1000
            yield_pct = metrics.get('rentalYieldPct') or (metrics.get('rentalYield') if isinstance(metrics.get('rentalYield'), (int, float)) else 4.0)
            density = metrics.get('populationDensity') or 1000
            growth = metrics.get('growthScore') or 50
            
            data_rows.append({
                'id': s.get('id'),
                'name': s.get('name'),
                'state': s.get('state'),
                'postcode': s.get('postcode'),
                'price': float(price),
                'icsea': float(icsea),
                'yield': float(yield_pct),
                'density': float(density),
                'growth': float(growth)
            })
        
        if not data_rows:
            print(f"[cluster] No valid data rows from {len(all_suburbs)} suburbs")
            return []
        
        print(f"[cluster] Built {len(data_rows)} data rows for clustering")

        df = pd.DataFrame(data_rows)
        
        # Institutional-grade features for clustering
        features = ['yield', 'icsea', 'density', 'growth']
        
        # Standardize features
        scaler = StandardScaler()
        X = scaler.fit_transform(df[features])
        
        # Determine optimal clusters (min 2, max 8)
        n_clusters = min(8, max(2, len(df) // 20))
        
        # KMeans for archetypes
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        df['cluster'] = kmeans.fit_predict(X)
        
        # Find target cluster
        target_row = df[df['id'] == target_id]
        if target_row.empty:
            return []
            
        target_cluster = target_row.iloc[0]['cluster']
        target_vec = X[target_row.index[0]]
        
        # Filter for same cluster and at least 5% cheaper (lowered from 15%)
        similar_df = df[
            (df['cluster'] == target_cluster) & 
            (df['id'] != target_id) & 
            (df['price'] < target_price * 0.95)
        ].copy()
        
        if similar_df.empty:
            # Fallback: ignore cluster, just find cheap + similar by growth
            similar_df = df[
                (df['id'] != target_id) & 
                (df['price'] < target_price * 0.95)
            ].copy()
            if similar_df.empty:
                return []
            # Use price proximity as similarity when no cluster match
            similar_df['similarity'] = similar_df['price'].apply(
                lambda p: round(100 - abs(p - target_price) / target_price * 100, 1)
            )
            similar_df = similar_df.sort_values(by='similarity', ascending=False).head(limit)
            results = []
            for _, row in similar_df.iterrows():
                results.append({
                    "suburb": row['name'],
                    "state": row['state'],
                    "postcode": row['postcode'],
                    "price": row['price'],
                    "similarity": row['similarity'],
                    "icsea": row['icsea'],
                    "yield": row['yield']
                })
            return results
            
        # Calculate cosine similarity within cluster to rank them
        def cosine_sim(vec1, vec2):
            denom = (np.linalg.norm(vec1) * np.linalg.norm(vec2))
            return np.dot(vec1, vec2) / denom if denom != 0 else 0
            
        similar_df['similarity'] = similar_df.index.map(
            lambda idx: round(cosine_sim(target_vec, X[idx]) * 100, 1)
        )
        
        # Sort by similarity descending
        similar_df = similar_df.sort_values(by='similarity', ascending=False).head(limit)
        
        results = []
        for _, row in similar_df.iterrows():
            results.append({
                "suburb": row['name'],
                "state": row['state'],
                "postcode": row['postcode'],
                "price": row['price'],
                "similarity": row['similarity'],
                "icsea": row['icsea'],
                "yield": row['yield']
            })
            
        return results
    except Exception as e:
        print(f"Clustering error: {e}")
        return []


def compute_anti_market_score(v3, state_median_12m: float = 0.0) -> Dict:
    """
    Compute the Counter-Cyclical / Anti-Market Resilience Score (0-100) and
    Value Trap diagnostics for a SuburbUIV3 record.

    Distinguishes genuine counter-cyclical resilience (positive price alpha +
    tight <2% vacancy + strong owner-occupier buffer during RBA rate hikes)
    from Affordability/Amenity Value Traps (falling prices + >3.5% vacancy).
    """
    g12 = getattr(v3, "house_median_price_12m_change_pct", None)
    g3 = getattr(v3, "house_median_price_3m_change_pct", None)
    g1 = getattr(v3, "house_median_price_1m_change_pct", None)
    vac = getattr(v3, "vacancy_rate", None)
    yld = getattr(v3, "house_gross_rental_yield", None)
    oo = getattr(v3, "owner_occupier_rate", None)
    icsea = getattr(v3, "avg_icsea", None)
    soc_housing = getattr(v3, "social_housing_pct", None)
    unemp = getattr(v3, "unemployment_rate", None)
    sd = getattr(v3, "supply_demand_ratio", None)
    sold_12m = getattr(v3, "house_sold_12m", None)
    pop_2016 = getattr(v3, "population_2016", None)
    pop_2021 = getattr(v3, "population_2021", None)
    raw_pop_cagr = getattr(v3, "population_cagr", None)

    true_pop_cagr = None
    if pop_2016 and pop_2021 and pop_2016 > 0:
        try:
            true_pop_cagr = round(((pop_2021 / pop_2016) ** (1.0 / 5.0) - 1.0) * 100.0, 2)
        except Exception:
            pass
    if true_pop_cagr is None and raw_pop_cagr is not None:
        true_pop_cagr = round(float(raw_pop_cagr) / 5.0 if float(raw_pop_cagr) > 10 else float(raw_pop_cagr), 2)

    score = 35.0
    drivers = []
    trap_signals = []

    # 1. Price Alpha & Short-Term Velocity (-15 to +30 pts)
    alpha_12m = (float(g12) - state_median_12m) if g12 is not None else 0.0
    if g12 is not None:
        if float(g12) >= 8.0:
            score += 18
            drivers.append(f"Strong counter-cyclical 12m capital growth (+{float(g12):.1f}%)")
        elif float(g12) >= 2.5:
            score += 12
            drivers.append(f"Positive 12m price resilience (+{float(g12):.1f}%)")
        elif float(g12) < 0:
            penalty = min(15.0, abs(float(g12)) * 2.5)
            score -= penalty
            trap_signals.append(f"Realized 12m median price decline ({float(g12):.2f}%)")

    if g3 is not None:
        if float(g3) >= 2.0:
            score += 10
            drivers.append(f"Accelerating 3-month price momentum (+{float(g3):.1f}%)")
        elif float(g3) >= 0.0:
            score += 5
        elif float(g3) < -3.0:
            penalty = min(12.0, abs(float(g3)) * 1.2)
            score -= penalty
            trap_signals.append(f"Sharp 3-month price contraction ({float(g3):.2f}%)")

    # 2. Rental Scarcity Shield (-15 to +25 pts)
    if vac is not None:
        v = float(vac)
        if v < 1.2:
            score += 22
            drivers.append(f"Extreme rental scarcity ({v:.2f}% vacancy < 1.5% tight threshold)")
        elif v < 2.0:
            score += 16
            drivers.append(f"Tight rental market ({v:.2f}% vacancy)")
        elif v < 2.8:
            score += 6
        elif v >= 3.5:
            score -= min(18.0, (v - 2.5) * 6.0)
            trap_signals.append(f"Elevated rental vacancy ({v:.2f}% vs 2-3% healthy benchmark)")

    # 3. Rate-Hike Carry Buffer (0 to +12 pts, only credited when vacancy < 3.2%)
    if yld is not None and (vac is None or float(vac) < 3.2):
        y = float(yld)
        if y >= 4.5:
            score += 10
            drivers.append(f"High gross rental yield ({y:.2f}%) cushions RBA rate hikes")
        elif y >= 3.8:
            score += 6
    elif yld is not None and float(yld) < 4.2 and vac is not None and float(vac) >= 3.5:
        trap_signals.append(
            f"Compressed gross yield ({float(yld):.2f}%) paired with {float(vac):.2f}% vacancy creates negative cashflow risk at current mortgage rates"
        )

    # 4. Socio-Economic & Owner-Occupier Insulation (-10 to +15 pts)
    if oo is not None:
        if float(oo) >= 70.0:
            score += 6
            drivers.append(f"High owner-occupier stability ({float(oo):.1f}%) insulates against investor tax sell-offs")
        elif float(oo) < 55.0:
            score -= 4

    if icsea is not None:
        if float(icsea) >= 990:
            score += 5
            drivers.append(f"Above-average school catchment quality (ICSEA {float(icsea):.0f})")
        elif float(icsea) < 960:
            score -= 4
            trap_signals.append(f"Below-average school ICSEA ({float(icsea):.0f} vs 1,000 national median)")

    if soc_housing is not None and float(soc_housing) >= 6.0:
        score -= 4
        trap_signals.append(f"Elevated social housing concentration ({float(soc_housing):.1f}%)")

    if unemp is not None and float(unemp) >= 6.0:
        score -= 5
        trap_signals.append(f"Elevated local unemployment ({float(unemp):.1f}% vs ~4.1% national average)")

    if true_pop_cagr is not None and true_pop_cagr < 0.8:
        score -= 3
        trap_signals.append(f"Low organic population growth ({true_pop_cagr:.2f}%/yr census CAGR)")

    # 5. Supply Discipline & Market Depth
    if sd is not None and float(sd) < 0.20 and (sold_12m or 0) >= 30:
        score += 5
        drivers.append(f"Strong sales turnover ({sold_12m} houses sold/12m) with tight stock ratio ({float(sd):.2f})")

    final_score = max(5, min(98, round(score)))

    is_value_trap = bool(
        (vac is not None and float(vac) >= 3.5 and ((g12 is not None and float(g12) < 0) or (g3 is not None and float(g3) < -3.0)))
        or (vac is not None and float(vac) >= 4.2)
        or ((g12 is not None and float(g12) < -2.0) and (g3 is not None and float(g3) < -5.0))
    )

    if is_value_trap:
        trend_label = "Value Trap Warning"
    elif final_score >= 72 and (g12 or 0) > 2.0 and (vac or 99) < 2.2:
        trend_label = "Counter-Cyclical Outlier"
    elif final_score >= 58:
        trend_label = "Market Resilient"
    else:
        trend_label = "Rate Sensitive / Pro-Cyclical"

    return {
        "anti_market_score": final_score,
        "trend_label": trend_label,
        "is_value_trap": is_value_trap,
        "alpha_12m_pct": round(alpha_12m, 2),
        "true_population_cagr_pct": true_pop_cagr,
        "resilience_drivers": drivers[:4],
        "trap_signals": trap_signals[:5],
        "metrics_snapshot": {
            "price_12m_change_pct": g12,
            "price_3m_change_pct": g3,
            "price_1m_change_pct": g1,
            "vacancy_rate": vac,
            "gross_yield": yld,
            "owner_occupier_rate": oo,
            "avg_icsea": icsea,
            "unemployment_rate": unemp,
            "social_housing_pct": soc_housing,
        },
    }


def find_anti_market_alternatives(target_v3, candidate_rows: List, state_median_12m: float = 0.0, limit: int = 4) -> List[Dict]:
    """
    Find Counter-Cyclical / Anti-Market Resilient alternative suburbs in the same
    state and comparable price band that are growing against the RBA rate cycle
    with tight (<2.2%) rental vacancy.
    """
    target_price = getattr(target_v3, "house_median_price", None) or 600000
    lo_price = max(250000, target_price * 0.55)
    hi_price = max(target_price * 1.25, target_price + 150000)

    scored_candidates = []
    for row in candidate_rows:
        if row.id == target_v3.id:
            continue
        price = getattr(row, "house_median_price", None)
        if not price or price < lo_price or price > hi_price:
            continue
        sold = getattr(row, "house_sold_12m", None) or 0
        if sold < 25:
            continue
        vac = getattr(row, "vacancy_rate", None)
        g12 = getattr(row, "house_median_price_12m_change_pct", None)
        g3 = getattr(row, "house_median_price_3m_change_pct", None)
        if vac is None or float(vac) > 2.2:
            continue
        if g12 is None or float(g12) < 2.0:
            continue
        if g3 is not None and float(g3) < -2.0:
            continue

        am = compute_anti_market_score(row, state_median_12m=state_median_12m)
        if am["is_value_trap"] or am["anti_market_score"] < 65:
            continue

        raw_yield = getattr(row, "house_gross_rental_yield", None)
        raw_oo = getattr(row, "owner_occupier_rate", None)
        raw_icsea = getattr(row, "avg_icsea", None)
        scored_candidates.append({
            "id": row.id.lower(),
            "name": row.name,
            "state": row.state,
            "postcode": row.postcode,
            "median_price": round(float(price)),
            "house_median_price": round(float(price)),
            "price_12m_change_pct": round(float(g12), 2),
            "price_3m_change_pct": round(float(g3), 2) if g3 is not None else None,
            "vacancy_rate": round(float(vac), 2),
            "gross_yield": round(float(raw_yield), 2) if raw_yield else None,
            "rental_yield": round(float(raw_yield), 2) if raw_yield else None,
            "owner_occupier_rate": round(float(raw_oo), 1) if raw_oo else None,
            "avg_icsea": round(float(raw_icsea)) if raw_icsea else None,
            "anti_market_score": am["anti_market_score"],
            "trend_label": am["trend_label"],
            "why_resilient": am["resilience_drivers"][:2],
        })

    scored_candidates.sort(
        key=lambda x: (x["anti_market_score"], x["price_12m_change_pct"] or 0),
        reverse=True,
    )
    return scored_candidates[:limit]

