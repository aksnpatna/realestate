from fastapi import APIRouter, HTTPException
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import os

router = APIRouter()

DB_DSN = os.getenv("DATABASE_URL", "postgresql://realestate_user:realestate_pass@db:5432/realestate")


def _suburb_micro_factor(suburb_id: str) -> float:
    """
    Deterministic suburb-specific micro-shrinkage factor in [-0.006, +0.006]
    derived from the suburb identifier so no two suburbs share a flat multiplier.
    """
    if not suburb_id:
        return 1.0
    h = int(hashlib.sha256(suburb_id.upper().encode("utf-8")).hexdigest()[:8], 16)
    normalized = (h % 1201 - 600) / 100000.0  # [-0.0060, +0.0060]
    return 1.0 + normalized


def sanitize_and_smooth_market_trends(raw_data: dict | None, suburb_id: str = "") -> dict | None:
    """
    Apply 2-period EMA smoothing and natural domain quantization ($1,000 for prices,
    $5/wk for rents, 0.1% for vacancy rates) to historical trend series.
    """
    if not raw_data or not isinstance(raw_data, dict):
        return None

    factor = _suburb_micro_factor(suburb_id)
    out = {}

    # 1. Rents series — EMA smooth + quantize to nearest $5/wk
    if isinstance(raw_data.get("rents"), list):
        rent_keys = ("units_2", "combined", "houses_3", "units_all", "houses_all")
        prev_vals = {}
        smoothed_rents = []
        for item in raw_data["rents"]:
            if not isinstance(item, dict):
                continue
            new_item = dict(item)
            for rk in rent_keys:
                val = item.get(rk)
                if isinstance(val, (int, float)) and val > 0:
                    adj = float(val) * factor
                    prev = prev_vals.get(rk, adj)
                    ema = 0.75 * adj + 0.25 * prev
                    prev_vals[rk] = ema
                    new_item[rk] = int(round(ema / 5.0) * 5)
            smoothed_rents.append(new_item)
        out["rents"] = smoothed_rents

    # 2. Prices series — EMA smooth + quantize to nearest $1,000
    if isinstance(raw_data.get("prices"), list):
        price_keys = ("units_2", "combined", "houses_3", "units_all", "houses_all")
        prev_vals = {}
        smoothed_prices = []
        for item in raw_data["prices"]:
            if not isinstance(item, dict):
                continue
            new_item = dict(item)
            for pk in price_keys:
                val = item.get(pk)
                if isinstance(val, (int, float)) and val > 0:
                    adj = float(val) * factor
                    prev = prev_vals.get(pk, adj)
                    ema = 0.75 * adj + 0.25 * prev
                    prev_vals[pk] = ema
                    new_item[pk] = int(round(ema / 1000.0) * 1000)
            smoothed_prices.append(new_item)
        out["prices"] = smoothed_prices

    # 3. Vacancy series — EMA smooth + quantize to 0.1% (0.001 ratio)
    if isinstance(raw_data.get("vacancy"), list):
        prev_vr = None
        smoothed_vac = []
        for item in raw_data["vacancy"]:
            if not isinstance(item, dict):
                continue
            new_item = dict(item)
            vr_raw = item.get("vr")
            try:
                vr_flt = float(vr_raw)
                ema_vr = 0.75 * vr_flt + 0.25 * (prev_vr if prev_vr is not None else vr_flt)
                prev_vr = ema_vr
                new_item["vr"] = f"{round(ema_vr, 3):.3f}"
            except (TypeError, ValueError):
                pass
            smoothed_vac.append(new_item)
        out["vacancy"] = smoothed_vac

    # 4. Stock & other keys
    for k, v in raw_data.items():
        if k not in out:
            out[k] = v

    return out


@router.get("/{suburb_id}/market-history")
def get_suburb_market_history(suburb_id: str):
    """
    Fetch the smoothed & quantized market trend series for a given suburb.
    """
    try:
        conn = psycopg2.connect(DB_DSN)
        cur = conn.cursor(cursor_factory=RealDictCursor)

        candidates = [suburb_id, suburb_id.upper(), suburb_id.lower()]
        if "-" in suburb_id:
            parts = suburb_id.upper().split("-")
            if len(parts) >= 3:
                state = parts[-2]
                postcode = parts[-1]
                name = "_".join(parts[:-2])
                candidates.append(f"{state}_{name}_{postcode}")
        elif "_" in suburb_id:
            candidates.append(suburb_id.upper())
            candidates.append(suburb_id.lower())

        cur.execute("""
            SELECT id, COALESCE(demographics_detail->'market_trends', demographics_detail->'sqm_data') as trend_data
            FROM suburbs_ui_v3
            WHERE id = ANY(%s)
            LIMIT 1
        """, (candidates,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if not row or not row['trend_data']:
            return {"status": "ok", "has_trend_data": False, "data": None}

        smoothed = sanitize_and_smooth_market_trends(row['trend_data'], row.get('id') or suburb_id)
        return {"status": "ok", "has_trend_data": True, "data": smoothed}

    except Exception as e:
        print(f"Error fetching market trends data for {suburb_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error fetching market trends data")
