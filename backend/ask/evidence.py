"""
evidence.py — Provenance-backed evidence extraction + data-quality scoring.
Phase 0: reads true as_of from metric_provenance JSON on SuburbUIV3.
Phase 2: goal-driven evidence pack selection.
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timezone, timedelta
import math

from models_v3 import SuburbUIV3
from ask.schemas import SuburbReference, EvidenceMetric
from ask.metric_registry import METRIC_REGISTRY, resolve_metric_value, get_column_name
from ask.metric_explainers import get_explanation
from ask.evidence_packs import get_evidence_pack, check_minimum_evidence


def _compute_volatility_and_sharpe(history_data: Any) -> tuple:
    """Derive price_volatility_10yr and price_sharpe_ratio from 10yr price history.
    Returns (volatility_pct, sharpe_ratio) or (None, None) if insufficient data.
    Handles history_data as list, dict, or invalid type.
    """
    if not history_data or not isinstance(history_data, (list, dict)):
        return None, None

    prices = None
    try:
        if isinstance(history_data, list):
            prices = [float(p) for p in history_data if p is not None and isinstance(p, (int, float, str)) and str(p).strip()]
        elif isinstance(history_data, dict):
            sorted_keys = sorted(k for k in history_data.keys() if str(k).isdigit())
            if len(sorted_keys) >= 4:
                prices = []
                for k in sorted_keys:
                    v = history_data[k]
                    if v is not None and isinstance(v, (int, float, str)) and str(v).strip():
                        try:
                            prices.append(float(v))
                        except (TypeError, ValueError):
                            continue
    except Exception:
        return None, None

    if not prices or len(prices) < 4:
        return None, None

    annual_returns = []
    for i in range(1, len(prices)):
        if prices[i - 1] > 0:
            annual_returns.append((prices[i] - prices[i - 1]) / prices[i - 1] * 100.0)

    if len(annual_returns) < 3:
        return None, None

    mean_return = sum(annual_returns) / len(annual_returns)
    variance = sum((r - mean_return) ** 2 for r in annual_returns) / len(annual_returns)
    stdev = math.sqrt(variance)

    volatility = round(stdev, 2) if stdev > 0 else None
    sharpe = round(mean_return / stdev, 2) if stdev > 0 else None

    return volatility, sharpe

def get_suburb_ui(db: Session, ref: SuburbReference) -> Optional[SuburbUIV3]:
    query = db.query(SuburbUIV3).filter(
        SuburbUIV3.name.ilike(ref.name),
        SuburbUIV3.state.ilike(ref.state)
    )
    if ref.postcode:
        query = query.filter(SuburbUIV3.postcode == ref.postcode)
    return query.first()

def extract_evidence(v3: SuburbUIV3, property_type: str = "house",
                     goal: str = "single_suburb_research") -> List[EvidenceMetric]:
    """
    Extract evidence from SuburbUIV3 using goal-driven evidence packs.
    Reads true as_of from metric_provenance JSON; falls back to transform_timestamp.
    """
    evidence = []
    pack = get_evidence_pack(goal)

    # Read provenance map once
    provenance: Dict[str, Any] = {}
    if hasattr(v3, 'metric_provenance') and v3.metric_provenance:
        if isinstance(v3.metric_provenance, dict):
            provenance = v3.metric_provenance

    fallback_date = None
    if hasattr(v3, 'transform_timestamp') and v3.transform_timestamp:
        fallback_date = v3.transform_timestamp.strftime("%Y-%m-%d") if isinstance(v3.transform_timestamp, datetime) else str(v3.transform_timestamp)[:10]
    if not fallback_date and hasattr(v3, 'last_updated') and v3.last_updated:
        fallback_date = v3.last_updated.strftime("%Y-%m-%d") if isinstance(v3.last_updated, datetime) else str(v3.last_updated)[:10]
    if not fallback_date:
        fallback_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    vintage_estimated = not bool(provenance)

    for mkey in pack.metrics:
        entry = METRIC_REGISTRY.get(mkey)
        if not entry:
            continue

        # Resolve column + value
        col = get_column_name(entry, property_type)
        if col is None:
            continue

        val = resolve_metric_value(v3, entry, property_type)

        # Special: news_sentiment is a JSON blob with a label
        if mkey == "news_sentiment" and hasattr(v3, 'news_sentiment') and v3.news_sentiment:
            label = v3.news_sentiment.get("label") if isinstance(v3.news_sentiment, dict) else None
            if label:
                val = label

        if val is None:
            continue

        if isinstance(val, float) and (val != val):
            continue

        # as_of from provenance
        prov_entry = provenance.get(mkey) or provenance.get(col, {}) if isinstance(provenance, dict) else {}
        as_of = prov_entry.get("as_of") if isinstance(prov_entry, dict) else None
        if not as_of and isinstance(prov_entry, str):
            as_of = prov_entry
        if not as_of:
            as_of = fallback_date

        source = entry.source
        quality = "verified"
        if vintage_estimated:
            quality = "estimated"
        if prov_entry.get("quality") if isinstance(prov_entry, dict) else None:
            quality = prov_entry["quality"]

        # Freshness check
        try:
            as_of_dt = datetime.strptime(as_of, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            age_days = (datetime.now(timezone.utc) - as_of_dt).days
            is_stale = age_days > entry.freshness_days and entry.freshness_days > 0
        except Exception:
            is_stale = True

        evidence.append(EvidenceMetric(
            id=f"{v3.id}_{mkey}",
            metric=entry.label,
            value=val,
            unit=entry.unit,
            as_of=as_of,
            source=source,
            quality=quality,
            suburb_id=v3.id,
            calculation=entry.calculation,
            is_stale=is_stale,
        ))

    # ── Derived: price volatility + Sharpe ratio from history_10yr ──
    if "history_10yr" in pack.metrics or "price_volatility_10yr" in pack.metrics or "price_sharpe_ratio" in pack.metrics:
        history_entry = METRIC_REGISTRY.get("history_10yr")
        if history_entry:
            hist_col = get_column_name(history_entry, property_type)
            if hist_col:
                history_data = getattr(v3, hist_col, None)
                vol, sharpe = _compute_volatility_and_sharpe(history_data)
                fallback_date_str = fallback_date

                if vol is not None:
                    vol_entry = METRIC_REGISTRY.get("price_volatility_10yr")
                    if vol_entry:
                        evidence.append(EvidenceMetric(
                            id=f"{v3.id}_price_volatility_10yr",
                            metric=vol_entry.label,
                            value=vol,
                            unit=vol_entry.unit,
                            as_of=fallback_date_str,
                            source=vol_entry.source,
                            quality="verified" if not vintage_estimated else "estimated",
                            suburb_id=v3.id,
                            calculation=vol_entry.calculation,
                            is_stale=False,
                        ))

                if sharpe is not None:
                    sharpe_entry = METRIC_REGISTRY.get("price_sharpe_ratio")
                    if sharpe_entry:
                        evidence.append(EvidenceMetric(
                            id=f"{v3.id}_price_sharpe_ratio",
                            metric=sharpe_entry.label,
                            value=sharpe,
                            unit=sharpe_entry.unit,
                            as_of=fallback_date_str,
                            source=sharpe_entry.source,
                            quality="verified" if not vintage_estimated else "estimated",
                            suburb_id=v3.id,
                            calculation=sharpe_entry.calculation,
                            is_stale=False,
                        ))

    return evidence

def calculate_data_quality(v3: SuburbUIV3, evidence_items: List[EvidenceMetric] = None,
                           goal: str = "single_suburb_research") -> dict:
    """
    DQ formula: 100 × (0.45·coverage + 0.30·freshness + 0.15·sample_confidence + 0.10·source_confidence)

    Replaces the old stub that returned static coverage.
    """
    pack = get_evidence_pack(goal)
    evidence = evidence_items or []

    coverage = 0.0
    if pack.metrics:
        available_keys = {e.suburb_id.rsplit("_", 1)[-1] if "_" in e.suburb_id else e.metric: e.metric for e in evidence}
        # Count how many pack metrics have evidence
        matched = sum(1 for m in pack.metrics if m in available_keys or any(
            e.metric == METRIC_REGISTRY[m].label if m in METRIC_REGISTRY else False
            for e in evidence
        ))
        coverage = matched / len(pack.metrics) if pack.metrics else 0.5

    freshness = 0.0
    if evidence:
        fresh_count = sum(1 for e in evidence if not e.is_stale)
        freshness = fresh_count / len(evidence) if evidence else 0

    sold_12m_val = getattr(v3, 'house_sold_12m', None) or 0
    sample_confidence = min(1.0, (sold_12m_val or 0) / 20.0) if sold_12m_val else 0.5

    has_provenance = bool(getattr(v3, 'metric_provenance', None))
    source_confidence = 1.0 if has_provenance else 0.7

    dq = 100 * (0.45 * coverage + 0.30 * freshness + 0.15 * sample_confidence + 0.10 * source_confidence)

    band = "Unavailable"
    if dq >= 85:
        band = "High"
    elif dq >= 70:
        band = "Medium"
    elif dq >= 50:
        band = "Limited"

    return {
        "coverage": round(coverage, 3),
        "freshness": round(freshness, 3),
        "stale_metric_count": sum(1 for e in evidence if e.is_stale) if evidence else 0,
        "sample_confidence": round(sample_confidence, 3),
        "source_confidence": source_confidence,
        "dq_score": round(dq, 1),
        "band": band,
        "vintage_estimated": not has_provenance,
        "total_evidence": len(evidence),
    }

def check_pack_minimum(pack, evidence: List[EvidenceMetric]) -> bool:
    if not pack.minimum:
        return True
    evidence_keys = set()
    for e in evidence:
        for mk, mentry in METRIC_REGISTRY.items():
            if mentry.label == e.metric:
                evidence_keys.add(mk)
                break
    return check_minimum_evidence(pack, evidence_keys)
