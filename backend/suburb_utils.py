"""
Suburb ID utilities — no heavy dependencies so tests can import freely.
"""
import re


def normalize_suburb_id(suburb_id: str) -> str:
    """Convert frontend ID format (east-melbourne-vic-3002) to DB format (VIC_EAST_MELBOURNE_3002)."""
    parts = suburb_id.rsplit("-", 1)
    if len(parts) == 2:
        postcode = parts[1]
        rest = parts[0].split("-")
        if len(rest) >= 2:
            state = rest[-1]
            name = "_".join(rest[:-1])
            return f"{state.upper()}_{name.upper()}_{postcode}"
    return suburb_id.upper().replace("-", "_")
