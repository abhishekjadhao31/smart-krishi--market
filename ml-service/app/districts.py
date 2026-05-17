"""Canonical district and market helpers for Smart Krishi Market.

The project currently focuses on six Maharashtra districts. Keeping the
normalization logic in one place prevents the mandi CSV, weather CSV, and ML
service from drifting apart on slightly different district names.
"""

from __future__ import annotations

import math
import re
from functools import lru_cache
from typing import Any, Iterable

CANONICAL_DISTRICTS: tuple[str, ...] = (
    "Mumbai",
    "Pune",
    "Sangli",
    "Satara",
    "Kolhapur",
    "Nashik",
)

DISTRICT_CENTERS: dict[str, tuple[float, float]] = {
    "Mumbai": (19.0760, 72.8777),
    "Pune": (18.5204, 73.8567),
    "Nashik": (19.9975, 73.7898),
    "Sangli": (16.8524, 74.5815),
    "Satara": (17.6805, 74.0183),
    "Kolhapur": (16.7050, 74.2433),
}

DISTRICT_ALIASES: dict[str, str] = {
    "bombay": "Mumbai",
    "greater mumbai": "Mumbai",
    "mumbai city": "Mumbai",
    "mumbai suburban": "Mumbai",
    "pune district": "Pune",
    "poona": "Pune",
    "sangli miraj": "Sangli",
    "satara district": "Satara",
    "kolhapur district": "Kolhapur",
    "nashik district": "Nashik",
}

MARKET_ALIASES: dict[str, str] = {
    "apmc mumbai": "Mumbai",
    "market yard mumbai": "Mumbai",
    "mumbai apmc": "Mumbai",
    "pune market yard": "Pune",
    "market yard pune": "Pune",
    "pune apmc": "Pune",
    "sangli apmc": "Sangli",
    "market yard sangli": "Sangli",
    "satara apmc": "Satara",
    "market yard satara": "Satara",
    "kolhapur apmc": "Kolhapur",
    "market yard kolhapur": "Kolhapur",
    "nashik apmc": "Nashik",
    "market yard nashik": "Nashik",
}


def _clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value).strip())


def _key(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", " ", _clean_text(value).lower()).strip()


def canonicalize_district(value: Any) -> str:
    text = _clean_text(value)
    if not text:
        return ""
    key = _key(text)
    if key in DISTRICT_ALIASES:
        return DISTRICT_ALIASES[key]
    for district in CANONICAL_DISTRICTS:
        if key == district.lower() or district.lower() in key:
            return district
    return text.title()


def canonicalize_market(value: Any) -> str:
    text = _clean_text(value)
    if not text:
        return ""
    return re.sub(r"\s+", " ", text)


def infer_district_from_market(value: Any) -> str:
    market = canonicalize_market(value)
    if not market:
        return ""
    key = _key(market)
    if key in MARKET_ALIASES:
        return MARKET_ALIASES[key]
    for district in CANONICAL_DISTRICTS:
        if district.lower() in key:
            return district
    return ""


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def infer_district_from_coords(latitude: Any, longitude: Any) -> str:
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError):
        return ""
    return min(
        DISTRICT_CENTERS.items(),
        key=lambda item: _haversine_km(lat, lon, item[1][0], item[1][1]),
    )[0]


def normalize_district_row(
    row: dict[str, Any],
    district_keys: Iterable[str] = ("district",),
    market_keys: Iterable[str] = ("market",),
    latitude_keys: Iterable[str] = ("latitude",),
    longitude_keys: Iterable[str] = ("longitude",),
) -> tuple[str, str]:
    district = ""
    market = ""
    latitude = None
    longitude = None

    for key in district_keys:
        if key in row and _clean_text(row.get(key)):
            district = canonicalize_district(row.get(key))
            if district in CANONICAL_DISTRICTS:
                break

    for key in market_keys:
        if key in row and _clean_text(row.get(key)):
            market = canonicalize_market(row.get(key))
            if not district:
                district = infer_district_from_market(market)
            break

    for key in latitude_keys:
        if key in row and row.get(key) not in (None, ""):
            latitude = row.get(key)
            break

    for key in longitude_keys:
        if key in row and row.get(key) not in (None, ""):
            longitude = row.get(key)
            break

    if not district and latitude is not None and longitude is not None:
        district = infer_district_from_coords(latitude, longitude)

    return district, market


@lru_cache(maxsize=1)
def supported_district_set() -> set[str]:
    return set(CANONICAL_DISTRICTS)