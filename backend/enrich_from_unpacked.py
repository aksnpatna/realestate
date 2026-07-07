"""
enrich_from_unpacked.py — SQL-level enrichment from unpacked table -> suburbs_ui_v3
=================================================================================
Reads from suburbs_unpacked_v3 (columnar), maps + derives metrics, 
DQ checks, and upserts into suburbs_ui_v3.

Uses bulk SQL INSERT ... ON CONFLICT UPDATE for maximum performance.
No Python per-record loops — runs in 1-2 SQL statements total.
"""
import sys
from sqlalchemy import text
from models_v3 import SessionLocal


ENRICH_SQL = """
INSERT INTO suburbs_ui_v3 (
    id, state, name, postcode, is_enriched,
    house_median_price, house_median_price_12m_change_pct,
    house_median_price_12m_change, house_median_rent,
    house_median_rent_12m_change, house_gross_rental_yield,
    house_gross_rental_yield_trend, house_sold_12m,
    house_stock_on_market,
    unit_median_price, unit_median_price_12m_change_pct,
    unit_median_rent, unit_gross_rental_yield,
    unit_gross_rental_yield_trend,
    supply_demand_ratio, price_to_rent_ratio,
    price_to_income_ratio,
    total_properties, vacancy_rate, population_density,
    population_2021, population_2016, population_cagr,
    owner_occupier_rate, investor_rate,
    median_age, predominant_age_group,
    predominant_occupation,
    area_sqkm, parks_count, parks_coverage_pct,
    typical_mortgage_band,
    history_10yr, history_rent_10yr,
    demographics_detail,
    nearby_suburbs, sales_summary,
    dq_issues, dq_score, transform_version, last_updated
)
SELECT
    u.id,
    u.state, u.name, u.postcode,
    TRUE AS is_enriched,

    -- House: prefer actual sale price over AVM value
    COALESCE(u.house_sale_price, u.house_median_value) AS house_median_price,

    u.house_change_12m_pct AS house_median_price_12m_change_pct,
    u.house_change_5yr_pct AS house_median_price_12m_change,
    u.house_median_rent,
    u.house_rent_change_pct AS house_median_rent_12m_change,
    u.house_gross_rental_yield,

    -- Yield trend: difference between current and previous period
    NULL AS house_gross_rental_yield_trend,

    u.house_sold_12m,
    u.current_sale_listing_count AS house_stock_on_market,

    -- Unit
    COALESCE(u.unit_sale_price, u.unit_median_value) AS unit_median_price,
    u.unit_change_12m_pct AS unit_median_price_12m_change_pct,
    u.unit_median_rent,
    u.unit_gross_rental_yield,
    NULL AS unit_gross_rental_yield_trend,

    -- Derived: supply/demand
    CASE WHEN u.current_sale_listing_count IS NOT NULL
              AND u.current_recent_sales_count IS NOT NULL
              AND u.current_recent_sales_count > 0
         THEN ROUND(u.current_sale_listing_count::numeric / u.current_recent_sales_count::numeric, 2)
         ELSE NULL
    END AS supply_demand_ratio,

    -- Derived: price-to-rent ratio (over 52 weeks)
    CASE WHEN COALESCE(u.house_sale_price, u.house_median_value) IS NOT NULL
              AND u.house_median_rent IS NOT NULL
              AND u.house_median_rent > 0
         THEN ROUND(COALESCE(u.house_sale_price, u.house_median_value) / (u.house_median_rent * 52), 2)
         ELSE NULL
    END AS price_to_rent_ratio,

    -- Derived: price-to-income (from predominant income band)
    NULL AS price_to_income_ratio,

    u.current_off_market_count AS total_properties,

    -- Derived: vacancy rate = rental listings / total properties
    CASE WHEN u.current_rental_listing_count IS NOT NULL
              AND u.current_off_market_count IS NOT NULL
              AND u.current_off_market_count > 0
         THEN ROUND(u.current_rental_listing_count::numeric / u.current_off_market_count::numeric * 100, 2)
         ELSE NULL
    END AS vacancy_rate,

    -- Derived: population density
    CASE WHEN u.population_2021 IS NOT NULL AND u.area_sqkm IS NOT NULL AND u.area_sqkm > 0
         THEN ROUND(u.population_2021::numeric / u.area_sqkm, 2)
         ELSE NULL
    END AS population_density,

    u.population_2021,
    u.population_2016,
    u.population_cagr,
    u.owner_occupier_rate,
    u.investor_rate,
    u.median_age,
    u.predominant_age_group,
    u.predominant_occupation,
    u.area_sqkm,
    u.parks_count,
    u.parks_coverage_pct,
    u.typical_mortgage_band,

    u.house_price_history AS history_10yr,
    u.house_rent_history AS history_rent_10yr,

    -- Demographics detail JSONB
    jsonb_build_object(
        'population_2021', u.population_2021,
        'population_2016', u.population_2016,
        'population_cagr', u.population_cagr,
        'owner_occupier_rate', u.owner_occupier_rate,
        'investor_rate', u.investor_rate,
        'median_age', u.median_age,
        'predominant_age_group', u.predominant_age_group,
        'predominant_household', u.predominant_household,
        'predominant_income_band', u.predominant_income_band,
        'predominant_occupation', u.predominant_occupation,
        'area_sqkm', u.area_sqkm,
        'parks_count', u.parks_count,
        'parks_coverage_pct', u.parks_coverage_pct,
        'typical_mortgage_band', u.typical_mortgage_band,
        'age_distribution', u.age_distribution,
        'household_distribution', u.household_distribution,
        'income_distribution', u.income_distribution
    ) AS demographics_detail,

    u.nearby_suburbs,
    u.sales_summary,

    -- DQ issues (computed inline)
    CASE
        WHEN COALESCE(u.house_sale_price, u.house_median_value) IS NULL
        THEN jsonb_build_array(jsonb_build_object('field', 'house_median_price', 'issue', 'missing', 'severity', 'error'))
        ELSE NULL
    END AS dq_issues_tmp,

    -- DQ score
    CASE
        WHEN COALESCE(u.house_sale_price, u.house_median_value) IS NULL THEN 85.0
        WHEN u.population_2021 IS NULL THEN 95.0
        ELSE 100.0
    END AS dq_score,

    3 AS transform_version,
    NOW() AS last_updated

FROM suburbs_unpacked_v3 u
WHERE u.is_unpacked = 'complete'
ON CONFLICT (id) DO UPDATE SET
    state = EXCLUDED.state,
    name = EXCLUDED.name,
    postcode = EXCLUDED.postcode,
    is_enriched = TRUE,
    house_median_price = EXCLUDED.house_median_price,
    house_median_price_12m_change_pct = EXCLUDED.house_median_price_12m_change_pct,
    house_median_price_12m_change = EXCLUDED.house_median_price_12m_change,
    house_median_rent = EXCLUDED.house_median_rent,
    house_median_rent_12m_change = EXCLUDED.house_median_rent_12m_change,
    house_gross_rental_yield = EXCLUDED.house_gross_rental_yield,
    house_sold_12m = EXCLUDED.house_sold_12m,
    house_stock_on_market = EXCLUDED.house_stock_on_market,
    unit_median_price = EXCLUDED.unit_median_price,
    unit_median_price_12m_change_pct = EXCLUDED.unit_median_price_12m_change_pct,
    unit_median_rent = EXCLUDED.unit_median_rent,
    unit_gross_rental_yield = EXCLUDED.unit_gross_rental_yield,
    supply_demand_ratio = EXCLUDED.supply_demand_ratio,
    price_to_rent_ratio = EXCLUDED.price_to_rent_ratio,
    total_properties = EXCLUDED.total_properties,
    vacancy_rate = EXCLUDED.vacancy_rate,
    population_density = EXCLUDED.population_density,
    population_2021 = EXCLUDED.population_2021,
    population_2016 = EXCLUDED.population_2016,
    population_cagr = EXCLUDED.population_cagr,
    owner_occupier_rate = EXCLUDED.owner_occupier_rate,
    investor_rate = EXCLUDED.investor_rate,
    median_age = EXCLUDED.median_age,
    predominant_age_group = EXCLUDED.predominant_age_group,
    predominant_occupation = EXCLUDED.predominant_occupation,
    area_sqkm = EXCLUDED.area_sqkm,
    parks_count = EXCLUDED.parks_count,
    parks_coverage_pct = EXCLUDED.parks_coverage_pct,
    typical_mortgage_band = EXCLUDED.typical_mortgage_band,
    history_10yr = EXCLUDED.history_10yr,
    history_rent_10yr = EXCLUDED.history_rent_10yr,
    demographics_detail = EXCLUDED.demographics_detail,
    nearby_suburbs = EXCLUDED.nearby_suburbs,
    sales_summary = EXCLUDED.sales_summary,
    dq_issues = EXCLUDED.dq_issues,
    dq_score = EXCLUDED.dq_score,
    transform_version = 3,
    last_updated = NOW()
"""


def enrich_all():
    db = SessionLocal()
    try:
        r = db.execute(text(ENRICH_SQL))
        db.commit()
        print(f"Enriched: {r.rowcount} rows upserted")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


def enrich_changed():
    """Only enrich records where unpacked data is newer than UI data."""
    db = SessionLocal()
    changed_sql = ENRICH_SQL.replace(
        "WHERE u.is_unpacked = 'complete'",
        """WHERE u.is_unpacked = 'complete'
        AND (
            NOT EXISTS (
                SELECT 1 FROM suburbs_ui_v3 existing
                WHERE existing.id = u.id
                  AND existing.is_enriched = TRUE
                  AND existing.last_updated >= u.unpacked_at
            )
        )"""
    )
    try:
        r = db.execute(text(changed_sql))
        db.commit()
        print(f"Enriched (changed only): {r.rowcount} rows upserted")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "--changed":
        enrich_changed()
    else:
        enrich_all()
