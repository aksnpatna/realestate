"""
metric_registry.py — Single source of truth for every citable metric.
Appendix C of the delivery plan.

Two contract tests enforce this structurally:
  1. Any evidence pack referencing a non-existent key → build failure.
  2. Any live, non-null SuburbUIV3 column without a registry entry → build failure.
"""

from typing import Optional, Dict, Literal

Direction = Literal["higher_better", "lower_better", "contextual"]

class MetricEntry:
    __slots__ = (
        "key", "house_column", "unit_column", "label", "unit",
        "source", "freshness_days", "direction", "explainer_key", "calculation",
    )
    def __init__(
        self, key: str, label: str, unit: str, source: str,
        freshness_days: int, direction: Direction,
        house_column: Optional[str] = None,
        unit_column: Optional[str] = None,
        column: Optional[str] = None,
        explainer_key: Optional[str] = None,
        calculation: Optional[str] = None,
    ):
        self.key = key
        self.label = label
        self.unit = unit
        self.source = source
        self.freshness_days = freshness_days
        self.direction = direction
        self.calculation = calculation
        self.explainer_key = explainer_key or key
        # Canonical column(s) — prefer explicit house/unit; fall back to shared
        if house_column:
            self.house_column = house_column
            self.unit_column = unit_column or house_column
        else:
            self.house_column = self.unit_column = column  # type: ignore[assignment]


def _build() -> Dict[str, MetricEntry]:
    def e(
        key: str, label: str, unit_: str, source: str, freshness: int,
        direction: Direction,
        h_col: Optional[str] = None, u_col: Optional[str] = None,
        col: Optional[str] = None, explainer: Optional[str] = None,
        calc: Optional[str] = None,
    ) -> MetricEntry:
        return MetricEntry(
            key=key, label=label, unit=unit_, source=source,
            freshness_days=freshness, direction=direction,
            house_column=h_col, unit_column=u_col, column=col,
            explainer_key=explainer, calculation=calc,
        )

    return {
        # ── Price & Rent ──
        "median_price":         e("median_price",          "Median Price",            "$",      "CoreLogic/NPG", 45, "contextual",
                                   h_col="house_median_price", u_col="unit_median_price"),
        "median_rent":          e("median_rent",           "Median Rent",             "$/week",  "CoreLogic/NPG", 45, "higher_better",
                                   h_col="house_median_rent", u_col="unit_median_rent"),
        "median_price_12m_change_pct": e("median_price_12m_change_pct", "Price 12-Month Change", "%", "CoreLogic/NPG", 45, "higher_better",
                                   h_col="house_median_price_12m_change_pct", u_col="unit_median_price_12m_change_pct"),
        "rent_12m_change":      e("rent_12m_change",       "Rent 12-Month Change",    "$",      "CoreLogic/NPG", 45, "contextual",
                                   h_col="house_median_rent_12m_change", u_col="house_median_rent_12m_change"),
        "gross_yield":          e("gross_yield",           "Gross Yield",             "%",      "CoreLogic/NPG", 45, "higher_better",
                                   h_col="house_gross_rental_yield", u_col="unit_gross_rental_yield",
                                   calc="rent×52 ÷ price"),
        "yield_trend":          e("yield_trend",           "Yield Trend (12m)",       "% pts",   "CoreLogic/NPG", 45, "higher_better",
                                   h_col="house_gross_rental_yield_trend", u_col="unit_gross_rental_yield_trend"),

        # ── Market Activity ──
        "days_on_market":       e("days_on_market",        "Days on Market",          "days",   "CoreLogic/NPG", 45, "lower_better",
                                   h_col="house_days_on_market", u_col="unit_days_on_market"),
        "auction_clearance":    e("auction_clearance",     "Auction Clearance Rate",  "%",      "CoreLogic/NPG", 45, "higher_better",
                                   col="house_auction_clearance_rate"),
        "stock_on_market":      e("stock_on_market",       "Stock on Market",         "count",  "CoreLogic/NPG", 45, "contextual",
                                   col="house_stock_on_market"),
        "sold_12m":             e("sold_12m",              "Sold (12 Months)",        "count",  "CoreLogic/NPG", 90, "contextual",
                                   col="house_sold_12m"),
        "vacancy_rate":         e("vacancy_rate",          "Vacancy Rate",            "%",      "SQM Research",  45, "lower_better",
                                   col="vacancy_rate"),
        "supply_demand_ratio":  e("supply_demand_ratio",   "Supply-Demand Ratio",     "ratio",  "Derived",      45, "contextual",
                                   col="supply_demand_ratio"),

        # ── Demographics ──
        "population_cagr":      e("population_cagr",       "Population Growth (5yr CAGR)", "% pa", "ABS Census 2021", 0, "higher_better",
                                   col="population_cagr"),
        "owner_occupier_rate":  e("owner_occupier_rate",   "Owner-Occupier Rate",     "%",      "ABS Census 2021", 0, "higher_better",
                                   col="owner_occupier_rate"),
        "investor_rate":        e("investor_rate",         "Investor Concentration",  "%",      "ABS Census 2021", 0, "lower_better",
                                   col="investor_rate"),
        "median_age":           e("median_age",            "Median Age",              "yrs",    "ABS Census 2021", 0, "contextual",
                                   col="median_age"),
        "predominant_occupation": e("predominant_occupation", "Predominant Occupation", "label", "ABS Census 2021", 0, "contextual",
                                   col="predominant_occupation"),
        "average_household_size": e("average_household_size", "Average Household Size", "persons", "ABS Census 2021", 0, "contextual",
                                   col="average_household_size"),
        "population_density":   e("population_density",    "Population Density",      "/km²",   "ABS Census 2021", 0, "contextual",
                                   col="population_density"),

        # ── Financial ──
        "estimated_mortgage_repayment": e("estimated_mortgage_repayment", "Est. Mortgage Repayment", "$/mo", "Derived (80% LVR, 6.2%, 30yr)", 45, "contextual",
                                   col="estimated_mortgage_repayment", calc="80% LVR, 6.20% rate, 30yr P&I"),
        "price_to_income_ratio": e("price_to_income_ratio", "Price-to-Income Ratio", "×", "Derived", 90, "lower_better",
                                   col="price_to_income_ratio"),
        "price_to_rent_ratio":  e("price_to_rent_ratio",   "Price-to-Rent Ratio",     "×",      "Derived",      90, "lower_better",
                                   col="price_to_rent_ratio"),

        # ── Schools ──
        "school_quality":       e("school_quality",        "School Quality",          "/10",    "ACARA 2025",   18*30, "higher_better",
                                   col="school_quality"),
        "avg_icsea":            e("avg_icsea",             "Average ICSEA",           "index",  "ACARA 2025",   18*30, "higher_better",
                                   col="avg_icsea", explainer="school_quality"),
        "top_school_name":      e("top_school_name",       "Top School",              "name",   "ACARA 2025",   18*30, "contextual",
                                   col="top_school_name"),
        "school_count":         e("school_count",          "School Count",            "count",  "ACARA 2025",   18*30, "contextual",
                                   col="school_count"),

        # ── Livability ──
        "transit_accessibility": e("transit_accessibility", "Transit Accessibility", "/10", "OSM/GTFS", 12*30, "higher_better",
                                   col="transit_accessibility"),
        "safety_score":         e("safety_score",          "Safety Score",            "/10",    "Derived (crime)", 12*30, "higher_better",
                                   col="safety_score"),
        "crime_rate":           e("crime_rate",            "Crime Rate",              "per 100k", "State Crime Stats", 12*30, "lower_better",
                                   col="crime_rate"),
        "parks_count":          e("parks_count",           "Parks & Amenities",       "count",  "OSM",          12*30, "higher_better",
                                   col="parks_count"),
        "parks_coverage_pct":   e("parks_coverage_pct",    "Parks Coverage",          "%",      "OSM",          12*30, "higher_better",
                                   col="parks_coverage_pct"),
        "cbd_distance_mins":    e("cbd_distance_mins",     "CBD Distance",            "mins",   "Derived",      12*30, "lower_better",
                                   col="cbd_distance_mins"),

        # ── Supply / Developer ──
        "building_approvals_12m": e("building_approvals_12m", "Building Approvals (12m)", "count", "ABS 8731.0", 90, "contextual",
                                   col="building_approvals_12m"),
        "approved_subdivisions_12m": e("approved_subdivisions_12m", "Approved Subdivisions (12m)", "count", "Council/OSM", 12*30, "contextual",
                                   col="approved_subdivisions_12m"),
        "min_approved_subdivision_sqm": e("min_approved_subdivision_sqm", "Min Approved Subdivision", "sqm", "Council/OSM", 12*30, "contextual",
                                   col="min_approved_subdivision_sqm"),
        "avg_block_sqm":        e("avg_block_sqm",         "Average Block Size",      "sqm",    "OSM Buildings", 12*30, "contextual",
                                   col="avg_block_sqm"),
        "construction_sqkm":    e("construction_sqkm",     "Construction Area",       "km²",    "OSM Landuse", 12*30, "contextual",
                                   col="construction_sqkm"),
        "greenfield_sqkm":      e("greenfield_sqkm",       "Greenfield Area",         "km²",    "OSM Landuse", 12*30, "contextual",
                                   col="greenfield_sqkm"),
        "infrastructure_investment": e("infrastructure_investment", "Infrastructure Investment", "label", "Curated", 12*30, "contextual",
                                   col="infrastructure_investment"),

        # ── Social ──
        "unemployment_rate":    e("unemployment_rate",     "Unemployment Rate",       "%",      "ABS",          180, "lower_better",
                                   col="unemployment_rate"),
        "social_housing_pct":   e("social_housing_pct",    "Social Housing",          "%",      "ABS Census 2021", 0, "contextual",
                                   col="social_housing_pct"),

        # ── History & Projection ──
        "history_10yr":         e("history_10yr",          "10-Year Price History",   "series", "CoreLogic/NPG", 45, "contextual",
                                   col="history_10yr"),
        "history_rent_10yr":    e("history_rent_10yr",     "10-Year Rent History",    "series", "CoreLogic/NPG", 45, "contextual",
                                   col="history_rent_10yr"),
        "news_sentiment":       e("news_sentiment",        "AI News Sentiment",       "label",  "YieldSense AI", 14, "contextual",
                                   col="news_sentiment", explainer="news_sentiment"),
        "nearby_suburbs":       e("nearby_suburbs",        "Nearby Suburbs",          "JSON",   "Derived",      90, "contextual",
                                   col="nearby_suburbs"),
    }


METRIC_REGISTRY: Dict[str, MetricEntry] = _build()

def get_column_name(entry: MetricEntry, property_type: str = "house") -> Optional[str]:
    if property_type == "house":
        return entry.house_column
    elif property_type == "unit":
        return entry.unit_column
    return entry.house_column

def resolve_metric_value(row, entry: MetricEntry, property_type: str = "house"):
    col = get_column_name(entry, property_type)
    if col is None:
        return None
    val = getattr(row, col, None)
    if val is not None and isinstance(val, float) and (val != val):
        return None
    return val
