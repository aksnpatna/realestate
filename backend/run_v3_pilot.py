"""
run_v3_pilot.py — Full V3 ETL Pipeline Runner
==============================================
1. Creates V3 tables (models_v3)
2. Seeds raw extraction queue from suburbs_all
3. Extracts 100 suburbs via Playwright
4. Transforms raw JSON → normalized UI tables
5. Produces DQ report
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    # Phase 1 & 2: Extract
    print("\n▶ PHASE 1: RAW EXTRACTION (100 suburbs)")
    print("=" * 50)
    from etl_extract_v3 import run_extraction
    asyncio.run(run_extraction(limit=100))

    # Phase 3: Transform
    print("\n▶ PHASE 2: NORMALIZED TRANSFORM")
    print("=" * 50)
    from etl_transform_v3 import transform_all
    transform_all(limit=200)

    # Phase 4: DQ Report
    print("\n▶ PHASE 3: DATA QUALITY REPORT")
    print("=" * 50)
    from etl_dq_report_v3 import dq_summary, detail_report
    dq_summary()
    detail_report(limit=20)

    print("\n✅ V3 Pilot complete. Check the reports above for results.")
