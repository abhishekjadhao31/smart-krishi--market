"""Pydantic request/response models for the ML service."""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    # Field names mirror what the backend's predictionController forwards.
    cropName: str = Field(..., min_length=1, max_length=100)
    state: Optional[str] = None
    district: Optional[str] = None
    market: Optional[str] = None
    quantityKg: Optional[float] = None
    harvestDate: Optional[str] = None
    horizonDays: int = Field(7, ge=1, le=60)


class TrendPoint(BaseModel):
    date: str
    price: float
    predicted: Optional[float] = None


class ForecastPoint(BaseModel):
    """One day in the future-looking forecast."""

    day: int                # 1, 2, ..., horizonDays (days from today)
    date: str               # ISO date for that day
    price: float            # predicted modal price (₹/qtl)
    confidence: float       # 0..1, decays as `day` grows


class PredictResponse(BaseModel):
    cropName: str
    district: Optional[str] = None
    market: Optional[str] = None
    currentPrice: Optional[float] = None
    predictedPrice: Optional[float] = None      # price at horizon (back-compat)
    confidence: float
    recommendation: str
    # New: best sell-day pick.
    bestDay: Optional[int] = None               # 0 = today, 1..N = days ahead
    bestDate: Optional[str] = None              # ISO date of best day
    bestPrice: Optional[float] = None           # price on best day
    bestGainPct: Optional[float] = None         # vs current_price, as %
    method: str
    horizonDays: int
    forecast: List[ForecastPoint] = []          # full per-day curve
    trend: List[TrendPoint] = []
    metrics: dict = {}


class CommoditiesResponse(BaseModel):
    commodities: List[str]
    districts: List[str]


class SeriesPoint(BaseModel):
    date: str
    price: float


class SeriesResponse(BaseModel):
    commodity: str
    district: Optional[str] = None
    points: List[SeriesPoint]
