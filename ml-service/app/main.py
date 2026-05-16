"""FastAPI entry point for the Smart Krishi Market ML service.

Endpoints
---------
GET  /health                  – liveness probe + model metrics
POST /predict                 – XGBoost prediction with statistical fallback
GET  /market-prices/commodities – list of commodities/districts in the CSV
GET  /market-prices/series    – historical modal-price series for a commodity
                                (and optionally a district)

The backend's predictionController.js calls POST /predict directly via axios.
The frontend hits /api/market-prices (served by Express against the DB) and
does NOT call this service directly.
"""

from __future__ import annotations

import logging
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .preprocess import build_features, filter_history, load_raw, stat_forecast
from .schemas import (
    CommoditiesResponse,
    ForecastPoint,
    PredictRequest,
    PredictResponse,
    SeriesPoint,
    SeriesResponse,
    TrendPoint,
)
from .train import train_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ml-service")

app = FastAPI(title="Smart Krishi Market ML", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cached state, populated at startup.
STATE: dict = {"df": None, "bundle": None}


@app.on_event("startup")
def _warmup() -> None:
    """Load CSV and train (or load) the XGBoost model once."""
    try:
        STATE["df"] = load_raw()
        STATE["bundle"] = train_model(force=False)
        logger.info(
            "ML service ready: %d rows, metrics=%s",
            len(STATE["df"]),
            STATE["bundle"]["metrics"],
        )
    except Exception as exc:  # noqa: BLE001
        # Don't crash the service if XGBoost setup fails — /predict will fall
        # back to the statistical method, and /health surfaces the error.
        logger.exception("Warmup failed: %s", exc)
        STATE["df"] = STATE.get("df")
        STATE["bundle"] = None


def _pick_recommendation(
    current: Optional[float],
    best_day: int,
    best_gain_pct: Optional[float],
) -> str:
    """Recommend an action based on which future day is best.

    - best_day == 0 (today is the peak)  → SELL_TODAY
    - peak > today by >= 2%              → WAIT_N_DAYS
    - peak ~= today                      → TARGET_BETTER_MARKET (try a different mandi)
    """
    if current is None or best_gain_pct is None:
        return "HOLD"
    if best_day == 0:
        return "SELL_TODAY"
    if best_gain_pct >= 2.0:
        return "WAIT_N_DAYS"
    if best_gain_pct <= -2.0:
        return "SELL_TODAY"
    return "TARGET_BETTER_MARKET"


def _predict_xgb_for_date(
    req: PredictRequest,
    history_row: Optional[pd.Series],
    target_date: pd.Timestamp,
) -> Optional[float]:
    """Predict modal price for one specific target_date."""
    bundle = STATE.get("bundle")
    if not bundle:
        return None
    model = bundle["model"]
    encoders = bundle["encoders"]
    min_date = bundle["min_date"]

    # IMPORTANT: training dates are tz-naive (parsed from dd-mm-yyyy), so the
    # target date must also be tz-naive — otherwise pandas raises
    # "Cannot subtract tz-naive and tz-aware datetime-like objects".
    target_date = pd.Timestamp(target_date)
    if target_date.tzinfo is not None:
        target_date = target_date.tz_convert("UTC").tz_localize(None)

    pseudo = pd.DataFrame(
        [
            {
                "arrival_date": target_date,
                "arrival_qty": history_row.get("arrival_qty", np.nan)
                if history_row is not None
                else np.nan,
                "commodity": req.cropName,
                "district": req.district or (history_row.get("district") if history_row is not None else ""),
                "market": req.market or (history_row.get("market") if history_row is not None else ""),
            }
        ]
    )
    X, _, _ = build_features(pseudo, encoders=encoders, min_date=min_date)
    X = X[bundle["feature_cols"]]
    pred = float(model.predict(X)[0])
    return round(pred, 2)


def _day_confidence(base: float, day: int, history_size: int) -> float:
    """Confidence for a forecast `day` days from today.

    Heuristic: start from a volatility-based base (computed once from recent
    history) and decay linearly with horizon distance. Day 1 keeps the base;
    by day 30 we've shed ~half. Cap to [0.30, 0.95].
    """
    decay = max(0.0, 1.0 - (day - 1) * 0.018)  # ~1.8% per day
    # Slight penalty if we have very little history.
    history_factor = min(1.0, history_size / 60.0)
    c = base * decay * (0.7 + 0.3 * history_factor)
    return round(max(0.30, min(0.95, c)), 2)


@app.get("/health")
def health() -> dict:
    bundle = STATE.get("bundle")
    df = STATE.get("df")
    return {
        "status": "ok",
        "rows_loaded": int(0 if df is None else len(df)),
        "model_loaded": bundle is not None,
        "metrics": bundle["metrics"] if bundle else None,
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    df = STATE.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Dataset not loaded")

    history = filter_history(df, commodity=req.cropName, district=req.district, market=req.market)

    # Build last-N trend points for the chart.
    trend = [
        TrendPoint(date=str(r["arrival_date"].date()), price=float(r["modal_price"]))
        for _, r in history.tail(14).iterrows()
    ]
    current_price = float(history["modal_price"].iloc[-1]) if not history.empty else None
    history_row = history.iloc[-1] if not history.empty else None

    # Base confidence from recent-volatility fallback. Used as a starting point
    # for the day-by-day decay.
    fallback = stat_forecast(history, horizon_days=req.horizonDays)
    base_conf = float(fallback.get("confidence") or 0.5)

    # ── Build per-day forecast ───────────────────────────────────────────
    today = pd.Timestamp.utcnow().tz_localize(None).normalize()
    bundle = STATE.get("bundle")
    method = "stat"
    forecast: list[ForecastPoint] = []

    for day in range(1, req.horizonDays + 1):
        target = today + pd.Timedelta(days=day)
        price: Optional[float] = None

        # Try XGBoost first.
        if bundle is not None and history_row is not None:
            try:
                price = _predict_xgb_for_date(req, history_row, target)
                method = "xgboost"
            except Exception as exc:  # noqa: BLE001
                logger.warning("XGBoost predict (day=%d) failed: %s", day, exc)
                price = None

        # Fall back to statistical per-day forecast on failure.
        if price is None:
            fb = stat_forecast(history, horizon_days=day)
            price = fb.get("predicted_price")
            if method != "xgboost":
                method = "stat"

        if price is None:
            continue

        forecast.append(
            ForecastPoint(
                day=day,
                date=str(target.date()),
                price=float(price),
                confidence=_day_confidence(base_conf, day, len(history)),
            )
        )

    # ── Pick the best day to sell ────────────────────────────────────────
    # Candidates include "today" (day 0 at current_price) so SELL_TODAY can win.
    best_day = 0
    best_date = str(today.date())
    best_price = current_price
    if forecast:
        # Treat "today" as a candidate with current_price (high confidence).
        best = max(forecast, key=lambda p: p.price)
        if current_price is None or best.price > current_price:
            best_day = best.day
            best_date = best.date
            best_price = best.price
        # else best remains "today"

    best_gain_pct: Optional[float] = None
    if current_price and best_price is not None and current_price > 0:
        best_gain_pct = round(((best_price - current_price) / current_price) * 100.0, 2)

    # "predictedPrice" stays as the price at the explicit horizon for backwards
    # compatibility with existing frontend code paths.
    predicted_price = forecast[-1].price if forecast else None
    confidence = forecast[-1].confidence if forecast else 0.0

    # Attach the day-1 prediction to the last historical trend node so the
    # chart's dotted "predicted" line still anchors visually.
    if trend and forecast:
        trend[-1] = TrendPoint(
            date=trend[-1].date,
            price=trend[-1].price,
            predicted=forecast[0].price,
        )

    return PredictResponse(
        cropName=req.cropName,
        district=req.district,
        market=req.market,
        currentPrice=current_price,
        predictedPrice=predicted_price,
        confidence=confidence,
        recommendation=_pick_recommendation(current_price, best_day, best_gain_pct),
        bestDay=best_day,
        bestDate=best_date,
        bestPrice=best_price,
        bestGainPct=best_gain_pct,
        method=method,
        horizonDays=req.horizonDays,
        forecast=forecast,
        trend=trend,
        metrics=(STATE.get("bundle") or {}).get("metrics", {}),
    )


@app.get("/market-prices/commodities", response_model=CommoditiesResponse)
def commodities() -> CommoditiesResponse:
    df = STATE.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Dataset not loaded")
    return CommoditiesResponse(
        commodities=sorted(df["commodity"].dropna().unique().tolist()),
        districts=sorted(df["district"].dropna().unique().tolist()),
    )


@app.get("/market-prices/series", response_model=SeriesResponse)
def series(
    commodity: str = Query(..., min_length=1),
    district: Optional[str] = Query(None),
    market: Optional[str] = Query(None),
) -> SeriesResponse:
    df = STATE.get("df")
    if df is None or df.empty:
        raise HTTPException(status_code=503, detail="Dataset not loaded")
    history = filter_history(df, commodity=commodity, district=district, market=market)
    points = [
        SeriesPoint(date=str(r["arrival_date"].date()), price=float(r["modal_price"]))
        for _, r in history.iterrows()
    ]
    return SeriesResponse(commodity=commodity, district=district, points=points)
