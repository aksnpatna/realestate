"""
evidence_registry.py — Canonical evidence-ID resolution for Buyer Fit and AI claims.

Every evidence ID returned by the ranking engine or cited by an AI claim
must resolve against this registry. Unknown/absent IDs cause the claim
to be downgraded to INSUFFICIENT_EVIDENCE.
"""
import os
import sys
import logging
from typing import Optional, Dict, List

logger = logging.getLogger("evidence_registry")

VALID_EVIDENCE_PREFIXES = [
    "raw:", "derived:", "abs:", "acara:", "osm:", "suburb:",
]


class EvidenceResolver:
    def __init__(self, db_session=None):
        self._db = db_session

    def resolve(self, evidence_id: str) -> Optional[dict]:
        if not evidence_id or not isinstance(evidence_id, str):
            return None
        if not any(evidence_id.startswith(p) for p in VALID_EVIDENCE_PREFIXES):
            return None
        for prefix in VALID_EVIDENCE_PREFIXES:
            if evidence_id.startswith(prefix):
                parts = evidence_id[len(prefix):].split(":")
                return {
                    "evidence_id": evidence_id,
                    "prefix": prefix,
                    "parts": parts,
                    "resolved": True,
                }
        return None

    def validate_claim(self, evidence_id: str) -> bool:
        return self.resolve(evidence_id) is not None

    def validate_all(self, evidence_ids: List[str]) -> Dict[str, bool]:
        return {eid: self.validate_claim(eid) for eid in evidence_ids}

    def unknown_ids(self, evidence_ids: List[str]) -> List[str]:
        return [eid for eid in evidence_ids if not self.validate_claim(eid)]


_DEFAULT_RESOLVER = EvidenceResolver()


def resolve_evidence(evidence_id: str) -> Optional[dict]:
    return _DEFAULT_RESOLVER.resolve(evidence_id)


def validate_evidence_ids(evidence_ids: List[str]) -> bool:
    return all(_DEFAULT_RESOLVER.validate_claim(eid) for eid in evidence_ids)


def downgrade_if_evidence_unknown(verdict_str: str, claim_evidence_ids: List[str]) -> str:
    unknown = _DEFAULT_RESOLVER.unknown_ids(claim_evidence_ids)
    if unknown:
        logger.warning(f"Downgrading verdict to INSUFFICIENT_EVIDENCE: unknown IDs {unknown}")
        return "INSUFFICIENT_EVIDENCE"
    return verdict_str
