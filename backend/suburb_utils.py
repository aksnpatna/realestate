"""
Suburb ID utilities — no heavy dependencies so tests can import freely.
"""
import re


def normalize_suburb_id(suburb_id: str) -> str:
    """Convert frontend ID format (parramatta-nsw-2150) to DB format (NSW_PARRAMATTA_2150)."""
    parts = suburb_id.rsplit("-", 1)
    if len(parts) == 2:
        postcode = parts[1]
        rest = parts[0].split("-")
        if len(rest) == 2:
            return f"{rest[1].upper()}_{rest[0].upper()}_{postcode}"
    return suburb_id.upper().replace("-", "_")
