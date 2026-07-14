"""
Evidence registry tests: resolution, validation, downgrade on unknown IDs.
"""
import os
import sys
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


class TestEvidenceResolution:
    def test_valid_prefixes_resolve(self):
        from evidence_registry import resolve_evidence
        for prefix in ["raw:", "derived:", "abs:", "acara:", "osm:", "suburb:"]:
            eid = f"{prefix}test:metric:2026-06-30"
            result = resolve_evidence(eid)
            assert result is not None, f"Valid prefix {prefix} must resolve"
            assert result["resolved"] is True

    def test_unknown_prefix_returns_none(self):
        from evidence_registry import resolve_evidence
        assert resolve_evidence("fake:something") is None
        assert resolve_evidence("") is None
        assert resolve_evidence("unknown_id_without_prefix") is None

    def test_downgrade_on_unknown_ids(self):
        from evidence_registry import downgrade_if_evidence_unknown
        result = downgrade_if_evidence_unknown("BUY", ["raw:test:ok", "fake:bad:id"])
        assert result == "INSUFFICIENT_EVIDENCE"

    def test_no_downgrade_when_all_known(self):
        from evidence_registry import downgrade_if_evidence_unknown
        result = downgrade_if_evidence_unknown("HOLD", ["raw:test:ok", "suburb:VIC_TEST:price:800000"])
        assert result == "HOLD"

    def test_validate_all_mixed(self):
        from evidence_registry import EvidenceResolver
        r = EvidenceResolver()
        result = r.validate_all(["raw:a", "fake:b", "suburb:c"])
        assert result["raw:a"] is True
        assert result["fake:b"] is False
        assert result["suburb:c"] is True

    def test_unknown_ids_list(self):
        from evidence_registry import EvidenceResolver
        r = EvidenceResolver()
        ids = ["raw:a", "bad:one", "suburb:c", "junk"]
        unknown = r.unknown_ids(ids)
        assert "bad:one" in unknown
        assert "junk" in unknown
        assert "raw:a" not in unknown
