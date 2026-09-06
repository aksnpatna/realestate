from fastapi import APIRouter, HTTPException
import psycopg2
from psycopg2.extras import RealDictCursor
import os

router = APIRouter()

DB_DSN = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")

@router.get("/{suburb_id}/sqm")
def get_suburb_sqm(suburb_id: str):
    """
    Fetch the raw SQM data payload (sold scatterplot, auctions, yields) for a given suburb.
    """
    try:
        conn = psycopg2.connect(DB_DSN)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT demographics_detail->'sqm_data' as sqm_data
            FROM suburbs_ui_v3
            WHERE id = %s
        """, (suburb_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row or not row['sqm_data']:
            # No SQM data extracted yet for this suburb, or not present
            return {"status": "ok", "has_sqm_data": False, "data": None}

        return {"status": "ok", "has_sqm_data": True, "data": row['sqm_data']}
    
    except Exception as e:
        print(f"Error fetching SQM data for {suburb_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching SQM data")
