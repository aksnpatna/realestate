"""
ai_alerts.py — Detects sentiment and verdict changes for monitored suburbs.
Run as a cron job: */30 * * * * python /app/ai_alerts.py
Checks news_sentiment and ai_insights columns for changes since last alert.
"""
import os
import sys
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [alerts] %(message)s")
logger = logging.getLogger("alerts")

STATE_FILE = Path(os.environ.get("ALERTS_STATE_FILE", "alert_state.json"))
CHECK_WINDOW_HOURS = int(os.environ.get("ALERTS_CHECK_HOURS", "24"))
SENTIMENT_THRESHOLD = float(os.environ.get("ALERTS_SENTIMENT_THRESHOLD", "2.0"))


def load_last_state():
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except Exception:
            pass
    return {"last_checked": None, "alerts_sent": {}}


def save_last_state(state):
    try:
        STATE_FILE.write_text(json.dumps(state, indent=2, default=str))
    except Exception:
        pass


def check_alerts():
    from models_v3 import SessionLocal, SuburbUIV3

    state = load_last_state()
    last_checked_str = state.get("last_checked")
    db = SessionLocal()

    try:
        since = datetime.utcnow() - timedelta(hours=CHECK_WINDOW_HOURS)
        suburbs = db.query(SuburbUIV3).filter(
            SuburbUIV3.is_enriched == True,
            SuburbUIV3.news_sentiment.isnot(None),
        ).all()

        alerts = []
        for v3 in suburbs:
            sent = v3.news_sentiment or {}
            if not isinstance(sent, dict):
                continue

            fetched = sent.get("fetched_at")
            score = sent.get("score")
            label = sent.get("label", "")
            if not fetched or score is None:
                continue

            try:
                fetched_dt = datetime.fromisoformat(fetched)
                if fetched_dt < since:
                    continue
            except (ValueError, TypeError):
                continue

            key = f"{v3.name}-{v3.state}"
            prev = state.get("alerts_sent", {}).get(key, {})
            prev_score = prev.get("score", score)

            if abs(score - prev_score) >= SENTIMENT_THRESHOLD:
                direction = "↑" if score > prev_score else "↓"
                alerts.append({
                    "suburb": v3.name,
                    "state": v3.state,
                    "id": v3.id,
                    "old_score": prev_score,
                    "new_score": score,
                    "label": label,
                    "direction": direction,
                })

            state["alerts_sent"][key] = {"score": score, "label": label}

        if alerts:
            logger.info(f"ALERT: {len(alerts)} suburbs with significant sentiment change:")
            for a in alerts:
                logger.info(
                    f"  {a['direction']} {a['suburb']}, {a['state']}: "
                    f"{a['old_score']}/10 → {a['new_score']}/10 ({a['label']})"
                )
        else:
            logger.info(f"No significant sentiment changes in the last {CHECK_WINDOW_HOURS}h")

        state["last_checked"] = datetime.utcnow().isoformat()
        save_last_state(state)

    except Exception as e:
        logger.error(f"Alert check failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    check_alerts()
