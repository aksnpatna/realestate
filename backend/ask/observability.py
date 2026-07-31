"""
observability.py — Prometheus-compatible metrics for Ask YieldSense v2.
Extends the existing process-local counters with v2-specific signals.
"""
import os
import time
from typing import Dict, Any

_metrics: Dict[str, float] = {
    "cache_hits_redis": 0,
    "ask_v2_requests_total": 0,
    "ask_v2_cache_hits": 0,
    "ask_v2_cache_misses": 0,
    "ask_v2_intent_confidence_avg": 0.0,
    "ask_v2_intent_confidence_count": 0,
    "ask_v2_clarification_rate": 0,
    "ask_v2_clarification_abandon_rate": 0,
    "ask_v2_unresolved_entity_total": 0,
    "ask_v2_fallback_total": 0,
    "ask_v2_fallback_rung_avg": 0.0,
    "ask_v2_policy_block_total": 0,
    "ask_v2_evidence_coverage_avg": 0.0,
    "ask_v2_evidence_coverage_count": 0,
    "ask_v2_error_total": 0,
    "ask_v2_latency_p50_ms": 0,
    "ask_v2_latency_p95_ms": 0,
    "ask_v2_latency_samples": [],
}

MAX_LATENCY_SAMPLES = 100

def record(layer: str, delta: float = 1) -> None:
    if layer == "redis":
        _metrics["cache_hits_redis"] += delta

def incr_ask_request() -> None:
    _metrics["ask_v2_requests_total"] += 1

def incr_ask_cache(hit: bool) -> None:
    if hit:
        _metrics["ask_v2_cache_hits"] += 1
    else:
        _metrics["ask_v2_cache_misses"] += 1

def record_intent_confidence(confidence: float) -> None:
    count = _metrics["ask_v2_intent_confidence_count"] + 1
    avg = (_metrics["ask_v2_intent_confidence_avg"] * _metrics["ask_v2_intent_confidence_count"] + confidence) / count
    _metrics["ask_v2_intent_confidence_avg"] = avg
    _metrics["ask_v2_intent_confidence_count"] = count

def incr_clarification() -> None:
    _metrics["ask_v2_clarification_rate"] += 1

def incr_clarification_abandon() -> None:
    _metrics["ask_v2_clarification_abandon_rate"] += 1

def incr_unresolved_entity() -> None:
    _metrics["ask_v2_unresolved_entity_total"] += 1

def incr_fallback(rung: int) -> None:
    _metrics["ask_v2_fallback_total"] += 1
    total = _metrics["ask_v2_fallback_total"]
    prev = _metrics["ask_v2_fallback_rung_avg"] * (total - 1)
    _metrics["ask_v2_fallback_rung_avg"] = (prev + rung) / total

def incr_policy_block() -> None:
    _metrics["ask_v2_policy_block_total"] += 1

def record_evidence_coverage(coverage: float) -> None:
    count = _metrics["ask_v2_evidence_coverage_count"] + 1
    avg = (_metrics["ask_v2_evidence_coverage_avg"] * _metrics["ask_v2_evidence_coverage_count"] + coverage) / count
    _metrics["ask_v2_evidence_coverage_avg"] = avg
    _metrics["ask_v2_evidence_coverage_count"] = count

def incr_error() -> None:
    _metrics["ask_v2_error_total"] += 1

def record_latency(latency_ms: float) -> None:
    samples = _metrics["ask_v2_latency_samples"]
    samples.append(latency_ms)
    if len(samples) > MAX_LATENCY_SAMPLES:
        samples[:] = samples[-MAX_LATENCY_SAMPLES:]
    sorted_samples = sorted(samples)
    n = len(sorted_samples)
    if n > 0:
        _metrics["ask_v2_latency_p50_ms"] = sorted_samples[n // 2]
        _metrics["ask_v2_latency_p95_ms"] = sorted_samples[int(n * 0.95)]

def get_metrics_text() -> str:
    lines = [
        f'# HELP ask_v2_requests_total Total Ask YieldSense v2 requests',
        f'# TYPE ask_v2_requests_total counter',
        f'ask_v2_requests_total {_metrics["ask_v2_requests_total"]:.0f}',
        f'# HELP ask_v2_cache_hits Ask v2 cache hits',
        f'# TYPE ask_v2_cache_hits gauge',
        f'ask_v2_cache_hits {_metrics["ask_v2_cache_hits"]:.0f}',
        f'# HELP ask_v2_cache_misses Ask v2 cache misses',
        f'# TYPE ask_v2_cache_misses gauge',
        f'ask_v2_cache_misses {_metrics["ask_v2_cache_misses"]:.0f}',
        f'# HELP ask_v2_intent_confidence_avg Average intent parse confidence',
        f'# TYPE ask_v2_intent_confidence_avg gauge',
        f'ask_v2_intent_confidence_avg {_metrics["ask_v2_intent_confidence_avg"]:.3f}',
        f'# HELP ask_v2_clarification_total Clarification prompts shown',
        f'# TYPE ask_v2_clarification_total gauge',
        f'ask_v2_clarification_total {_metrics["ask_v2_clarification_rate"]:.0f}',
        f'# HELP ask_v2_unresolved_entity_total Unresolved entity tokens',
        f'# TYPE ask_v2_unresolved_entity_total counter',
        f'ask_v2_unresolved_entity_total {_metrics["ask_v2_unresolved_entity_total"]:.0f}',
        f'# HELP ask_v2_fallback_total Synthesis/parse fallbacks triggered',
        f'# TYPE ask_v2_fallback_total counter',
        f'ask_v2_fallback_total {_metrics["ask_v2_fallback_total"]:.0f}',
        f'# HELP ask_v2_policy_block_total Policy blocks triggered',
        f'# TYPE ask_v2_policy_block_total counter',
        f'ask_v2_policy_block_total {_metrics["ask_v2_policy_block_total"]:.0f}',
        f'# HELP ask_v2_evidence_coverage_avg Average evidence coverage',
        f'# TYPE ask_v2_evidence_coverage_avg gauge',
        f'ask_v2_evidence_coverage_avg {_metrics["ask_v2_evidence_coverage_avg"]:.3f}',
        f'# HELP ask_v2_error_total Errors in v2 pipeline',
        f'# TYPE ask_v2_error_total counter',
        f'ask_v2_error_total {_metrics["ask_v2_error_total"]:.0f}',
        f'# HELP ask_v2_latency_p50_ms P50 latency',
        f'# TYPE ask_v2_latency_p50_ms gauge',
        f'ask_v2_latency_p50_ms {_metrics["ask_v2_latency_p50_ms"]:.1f}',
        f'# HELP ask_v2_latency_p95_ms P95 latency',
        f'# TYPE ask_v2_latency_p95_ms gauge',
        f'ask_v2_latency_p95_ms {_metrics["ask_v2_latency_p95_ms"]:.1f}',
        f'# HELP ask_v2_cache_hit_ratio Cache hit ratio',
        f'# TYPE ask_v2_cache_hit_ratio gauge',
    ]
    total_cache = _metrics["ask_v2_cache_hits"] + _metrics["ask_v2_cache_misses"]
    hit_ratio = _metrics["ask_v2_cache_hits"] / total_cache if total_cache > 0 else 0
    lines.append(f'ask_v2_cache_hit_ratio {hit_ratio:.3f}')
    return "\n".join(lines) + "\n"
