"""
etl_dq_report_v3.py — Data Quality Report
==========================================
Produces summary and detail reports on extraction completeness,
DQ scores, and alerts for the pilot batch.
"""
import sys
from sqlalchemy import func, case, text
from models_v3 import SuburbRawV3, SuburbUIV3, SessionLocal


def dq_summary():
    """High-level DQ summary across the entire dataset."""
    db = SessionLocal()
    try:
        total_raw = db.query(SuburbRawV3).count()
        total_ui = db.query(SuburbUIV3).count()

        status_counts = dict(
            db.query(SuburbRawV3.status, func.count(SuburbRawV3.id))
            .group_by(SuburbRawV3.status)
            .all()
        )

        dq_stats = db.query(
            func.avg(SuburbUIV3.dq_score).label("avg_score"),
            func.min(SuburbUIV3.dq_score).label("min_score"),
            func.count(SuburbUIV3.id).filter(SuburbUIV3.dq_score < 80).label("low_quality"),
        ).first()

        print(f"\n{'='*60}")
        print(f"DATA QUALITY SUMMARY")
        print(f"{'='*60}")
        print(f"Total Raw Records:      {total_raw}")
        print(f"Total UI Records:       {total_ui}")
        print(f"")
        print(f"Extraction Status:")
        for status, count in sorted(status_counts.items()):
            print(f"  {status:20s}: {count:6d}")
        print(f"")
        print(f"Transform Quality:")
        print(f"  Avg DQ Score: {dq_stats.avg_score:.1f}/100" if dq_stats.avg_score else "  Avg DQ Score: N/A")
        print(f"  Lowest Score: {dq_stats.min_score:.0f}/100" if dq_stats.min_score else "  Lowest Score: N/A")
        print(f"  Below 80:     {dq_stats.low_quality}")
        print(f"{'='*60}")

    finally:
        db.close()


def detail_report(limit=20):
    """Detailed DQ report showing per-suburb issues."""
    db = SessionLocal()
    try:
        results = (
            db.query(SuburbUIV3)
            .order_by(SuburbUIV3.dq_score.asc())
            .limit(limit)
            .all()
        )

        print(f"\n{'='*80}")
        print(f"DETAIL DQ REPORT (Worst {limit} by DQ Score)")
        print(f"{'='*80}")

        for r in results:
            missing_fields = []
            if r.house_median_price is None:
                missing_fields.append("house_price")
            if r.house_gross_rental_yield is None:
                missing_fields.append("house_yield")
            if r.house_median_rent is None:
                missing_fields.append("house_rent")
            if r.house_days_on_market is None:
                missing_fields.append("days_on_market")

            print(f"\n{r.name}, {r.state} {r.postcode}")
            print(f"  DQ Score: {r.dq_score:.0f}/100")
            if missing_fields:
                print(f"  Missing: {', '.join(missing_fields)}")
            if r.dq_issues:
                for issue in r.dq_issues:
                    print(f"  ⚠ {issue.get('severity', 'info').upper()}: {issue.get('field')} — {issue.get('issue')} = {issue.get('value')}")
            print(f"  House Price: ${r.house_median_price:,.0f}" if r.house_median_price else "  House Price: N/A")
            print(f"  House Yield: {r.house_gross_rental_yield}%" if r.house_gross_rental_yield else "  House Yield: N/A")
            print(f"  Sold 12m: {r.house_sold_12m}" if r.house_sold_12m else "  Sold 12m: N/A")

    finally:
        db.close()


if __name__ == "__main__":
    dq_summary()
    if "--detail" in sys.argv:
        detail_report()
    elif "--all" in sys.argv:
        detail_report(limit=100)
