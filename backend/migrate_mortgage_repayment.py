"""Migration: Add estimated_mortgage_repayment to suburbs_ui_v3 and backfill DOM + repayment."""
from sqlalchemy import text
from models_v3 import SessionLocal, DEFAULT_MORTGAGE_RATE

ADD_COLUMNS_SQL = """
ALTER TABLE suburbs_ui_v3
ADD COLUMN IF NOT EXISTS estimated_mortgage_repayment DOUBLE PRECISION;
"""

BACKFILL_REPAYMENT_SQL = f"""
UPDATE suburbs_ui_v3
SET estimated_mortgage_repayment = subq.computed,
    last_updated = NOW()
FROM (
    SELECT
        id,
        CASE
            WHEN house_median_price IS NOT NULL AND house_median_price > 0
            THEN ROUND(
                (house_median_price * 0.8) * ({DEFAULT_MORTGAGE_RATE}/12) * POWER(1 + ({DEFAULT_MORTGAGE_RATE}/12), 30*12)
                / (POWER(1 + ({DEFAULT_MORTGAGE_RATE}/12), 30*12) - 1)
            )
            ELSE NULL
        END AS computed
    FROM suburbs_ui_v3
    WHERE house_median_price IS NOT NULL
      AND house_median_price > 0
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND estimated_mortgage_repayment IS NULL;
"""

BACKFILL_DOM_SQL = """
UPDATE suburbs_ui_v3
SET house_days_on_market = subq.computed,
    last_updated = NOW()
FROM (
    SELECT
        id,
        CASE
            WHEN house_stock_on_market IS NOT NULL
                AND house_sold_12m IS NOT NULL
                AND house_sold_12m > 0
            THEN ROUND(365.0 * house_stock_on_market::numeric / house_sold_12m::numeric)
            ELSE NULL
        END AS computed
    FROM suburbs_ui_v3
) subq
WHERE suburbs_ui_v3.id = subq.id
  AND house_days_on_market IS NULL;
"""


def main():
    db = SessionLocal()
    try:
        db.execute(text(ADD_COLUMNS_SQL))
        db.commit()
        print("Column added.")
        db.execute(text(BACKFILL_REPAYMENT_SQL))
        db.commit()
        print("Backfilled estimated_mortgage_repayment.")
        db.execute(text(BACKFILL_DOM_SQL))
        db.commit()
        print("Backfilled house_days_on_market.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
