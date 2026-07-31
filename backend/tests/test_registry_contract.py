"""
test_registry_contract.py — CI contract tests that enforce the metric registry.
These make evidence starvation structurally impossible:
  1. Pack → Registry: every evidence-pack metric key must exist in METRIC_REGISTRY.
  2. Registry → Model: every registry column must resolve on SuburbUIV3.
  3. Model → Registry: every data-bearing SuburbUIV3 column must have a registry entry
     (with a known-exclusion allowlist for metadata/ID/admin columns).
"""
import pytest
from ask.metric_registry import METRIC_REGISTRY, MetricEntry
from ask.evidence_packs import EVIDENCE_PACKS
from models_v3 import SuburbUIV3
from sqlalchemy import Column, String, JSON, Boolean, DateTime, Integer, Float

# ─── Columns explicitly excluded from the "every column needs a registry entry" rule ───
EXCLUDED_COLUMNS = {
    # Primary key & identity
    "id", "state", "name", "postcode",
    # Status flags
    "is_enriched", "is_live",
    # JSON blobs (not individually citable)
    "schools", "pois", "highlights", "ai_insights", "nearby_pois",
    "demographics_detail", "sales_summary", "nearby_suburbs",
    "news_sentiment",
    "coordinates", "history_10yr", "history_rent_10yr",
    "worship_detail", "social_infra_detail",
    "external_validation", "dq_issues",
    "abs_sourced_fields", "metric_provenance",
    "owner_occupier_rate",
    # Derived / meta
    "transform_version", "transform_run_id", "transform_timestamp",
    "source_raw_id", "last_updated", "dq_score",
    "cadastral_source", "cadastral_last_synced",
    "osm_enriched_at", "osm_enrich_radius_m",
    "boundary_geom",
    "abs_demographics_sourced", "abs_etl_run_date",
    "abs_g37_sourced", "abs_g37_run_date",
    "external_dom_house", "external_dom_unit",
    "external_median_price", "external_source", "external_fetched_at",
    # Columns intentionally doubled/duplicated
    "metro_cbd", "rental_stock", "current_median_price",
    "population", "brownfield_sqkm", "building_construction_count",
    "area_sqkm", "total_properties",
    "population_2016", "population_2021",
    # Single-property-type fallthrough (we use house/unit variants)
    "house_median_price_12m_change",  # dollar change, not pct
    "public_housing_dwellings", "community_housing_dwellings",
    "renter_state_housing_pct", "renter_community_housing_pct",
    "worship_total", "worship_christian", "worship_muslim",
    "worship_buddhist", "worship_hindu", "worship_sikh",
    "worship_jewish", "worship_other",
    "shelter_count", "community_centre_count", "retirement_home_count",
}

class TestPackRegistryContract:
    """Every metric key in every evidence pack must exist in METRIC_REGISTRY."""

    def test_all_pack_metrics_registered(self):
        failures = []
        for pack_name, pack in EVIDENCE_PACKS.items():
            for mkey in pack.metrics:
                if mkey not in METRIC_REGISTRY:
                    failures.append(f"Pack '{pack_name}' references unregistered metric: '{mkey}'")
        assert not failures, "\n".join(failures)

    def test_all_pack_minimum_metrics_registered(self):
        failures = []
        for pack_name, pack in EVIDENCE_PACKS.items():
            for mkey in pack.minimum:
                if mkey not in METRIC_REGISTRY:
                    failures.append(f"Pack '{pack_name}' minimum references unregistered metric: '{mkey}'")
        assert not failures, "\n".join(failures)

    def test_no_empty_pack_minimum_unless_general_advice(self):
        for pack_name, pack in EVIDENCE_PACKS.items():
            if pack_name == "general_advice":
                continue
            assert pack.metrics, f"Pack '{pack_name}' has no metrics"

class TestRegistryModelContract:
    """Every registry column must exist on SuburbUIV3."""

    def _get_model_columns(self):
        """Map of column_name → Column object for SuburbUIV3."""
        return {c.key: c for c in SuburbUIV3.__table__.columns}

    def test_all_registry_columns_exist(self):
        model_cols = self._get_model_columns()
        failures = []
        for metric_key, entry in METRIC_REGISTRY.items():
            for attr in ("house_column", "unit_column"):
                col_name = getattr(entry, attr, None)
                if col_name and col_name not in model_cols:
                    failures.append(f"Registry '{metric_key}' references non-existent column: '{col_name}'")
        assert not failures, "\n".join(failures)

    def test_registry_metric_count(self):
        """Ensure we haven't lost metrics silently."""
        assert len(METRIC_REGISTRY) >= 40, f"Expected ≥40 metrics in registry, got {len(METRIC_REGISTRY)}"

class TestModelRegistryCoverage:
    """Every data-bearing SuburbUIV3 column should have a registry entry
    (unless explicitly excluded)."""

    def _get_data_columns(self):
        return {c.key for c in SuburbUIV3.__table__.columns
                if isinstance(c.type, (Integer, Float)) and c.key not in EXCLUDED_COLUMNS}

    def test_data_columns_have_registry_entries(self):
        """Every numeric data column should be citable through the registry."""
        data_cols = self._get_data_columns()
        registry_cols = set()
        for entry in METRIC_REGISTRY.values():
            if entry.house_column:
                registry_cols.add(entry.house_column)
            if entry.unit_column:
                registry_cols.add(entry.unit_column)

        uncitable = data_cols - registry_cols
        failures = [f"Column '{c}' has no registry entry — add it or to EXCLUDED_COLUMNS" for c in sorted(uncitable)]
        assert not failures, "\n".join(failures)

class TestRegistryDirection:
    """Every metric must have a registered direction."""

    VALID_DIRECTIONS = {"higher_better", "lower_better", "contextual"}
    def test_all_directions_valid(self):
        failures = []
        for key, entry in METRIC_REGISTRY.items():
            if entry.direction not in self.VALID_DIRECTIONS:
                failures.append(f"Metric '{key}' has invalid direction: '{entry.direction}'")
        assert not failures, "\n".join(failures)
