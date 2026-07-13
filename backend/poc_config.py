"""
poc_config.py — Centralized POC configuration for the buyer-fit demonstration.

All gate thresholds and mode flags live here. The backend owns these settings;
the frontend must not define separate thresholds.
"""
import os
from typing import Optional


def _env_bool(name: str, default: bool = False) -> bool:
    val = os.getenv(name, str(default)).lower()
    return val in ("true", "1", "yes")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (ValueError, TypeError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (ValueError, TypeError):
        return default


class POCConfig:
    @property
    def public_poc_mode(self) -> bool:
        return _env_bool("PUBLIC_POC_MODE", True)

    @property
    def public_poc_min_dq_score(self) -> int:
        return _env_int("PUBLIC_POC_MIN_DQ_SCORE", 80)

    @property
    def demo_mode(self) -> bool:
        return _env_bool("DEMO_MODE", False)

    @property
    def allow_mock_suburbs(self) -> bool:
        return _env_bool("ALLOW_MOCK_SUBURBS", False)

    @property
    def poc_model_version(self) -> str:
        return os.getenv("POC_MODEL_VERSION", "buyer-fit-poc-1.0.0")

    @property
    def enable_ai_insights(self) -> bool:
        return _env_bool("ENABLE_AI_INSIGHTS", "true")

    @property
    def poc_geography(self) -> str:
        return os.getenv("POC_GEOGRAPHY", "VIC")

    @property
    def poc_max_suburbs(self) -> int:
        return _env_int("POC_MAX_SUBURBS", 50)

    def is_suburb_eligible(self, dq_score: Optional[float], is_enriched: bool,
                           has_synthetic_inputs: bool = False,
                           identity_verified: bool = True) -> bool:
        if not self.public_poc_mode:
            return True
        if not is_enriched:
            return False
        if dq_score is None or dq_score < self.public_poc_min_dq_score:
            return False
        if has_synthetic_inputs:
            return False
        if not identity_verified:
            return False
        return True

    def to_dict(self) -> dict:
        return {
            "public_poc_mode": self.public_poc_mode,
            "public_poc_min_dq_score": self.public_poc_min_dq_score,
            "demo_mode": self.demo_mode,
            "allow_mock_suburbs": self.allow_mock_suburbs,
            "poc_model_version": self.poc_model_version,
            "enable_ai_insights": self.enable_ai_insights,
            "poc_geography": self.poc_geography,
            "poc_max_suburbs": self.poc_max_suburbs,
        }


poc_config = POCConfig()
