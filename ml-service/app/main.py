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
    FactorPoint,
    ForecastPoint,
    PredictRequest,
    PredictResponse,
    SeriesPoint,
    SeriesResponse,
    TrendPoint,
)
from .train import load_training_report, train_model

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
    """Map best-day/gain into a user-friendly recommendation.

    Returns one of: 'Sell now', 'Wait', 'Stable market', 'Hold'.
    """
    if current is None or best_gain_pct is None:
        return "Hold"
    # If the best day is today, advise selling now.
    if best_day == 0:
        return "Sell now"
    if best_gain_pct >= 2.0:
        return "Wait"
    if best_gain_pct <= -2.0:
        return "Sell now"
    return "Stable market"


def _predict_xgb_for_date(
    req: PredictRequest,
    history: pd.DataFrame,
    target_date: pd.Timestamp,
) -> Optional[float]:
    """Predict modal price for one specific target_date using historical
    statistics to provide realistic lag/rolling features (non-recursive).
    """
    bundle = STATE.get("bundle")
    if not bundle:
        return None
    model = bundle["model"]
    encoders = bundle["encoders"]
    min_date = bundle["min_date"]

    # Normalize target date tz similarly to training.
    target_date = pd.Timestamp(target_date)
    if target_date.tzinfo is not None:
        target_date = target_date.tz_convert("UTC").tz_localize(None)

    # Use recent history (up to 60 rows) to compute realistic lag/rolling
    # features. Do NOT feed prior *predictions* into these features; always
    # derive from observed historical modal_price values.
    hist = history.sort_values("arrival_date").reset_index(drop=True)
    if hist.empty:
        return None
    window7 = hist["modal_price"].dropna().tail(7)
    window30 = hist["modal_price"].dropna().tail(30)

    lag_1 = float(hist["modal_price"].dropna().iloc[-1]) if not hist["modal_price"].dropna().empty else np.nan
    lag_7 = float(window7.mean()) if not window7.empty else lag_1
    rolling_7 = float(window7.mean()) if not window7.empty else lag_1
    rolling_30 = float(window30.mean()) if not window30.empty else lag_7

    # Simple trend: slope over last N points (linear fit), scaled to per-week
    prices_for_trend = hist["modal_price"].dropna().tail(14).to_numpy()
    if len(prices_for_trend) >= 3:
        x = np.arange(len(prices_for_trend), dtype=float)
        slope = float(np.polyfit(x, prices_for_trend, 1)[0])
    else:
        slope = 0.0

    # Arrival quantity estimate: median of recent arrivals or last observed.
    arrivals_series = hist.get("arrival_qty", pd.Series(dtype=float)).dropna()
    if not arrivals_series.empty:
        arrival_est = float(arrivals_series.tail(7).median())
    else:
        arrival_est = float(hist.get("arrival_qty", pd.Series([0])).dropna().iloc[-1]) if not hist.get("arrival_qty", pd.Series()).dropna().empty else 0.0

    pseudo_row = {
        "arrival_date": target_date,
        "arrival_qty": arrival_est,
        "commodity": req.cropName,
        "district": req.district or (hist.iloc[-1].get("district") if not hist.empty else ""),
        "market": req.market or (hist.iloc[-1].get("market") if not hist.empty else ""),
        # Provide precomputed engineered columns so build_features picks them up
        "lag_1_price": lag_1,
        "lag_7_price": lag_7,
        "rolling_avg_7": rolling_7,
        "rolling_avg_30": rolling_30,
        "price_trend": slope,
        "arrivals_trend": 0.0,
    }

    pseudo = pd.DataFrame([pseudo_row])

    # Build feature matrix — encoders/min_date come from training bundle.
    X, _, _ = build_features(pseudo, encoders=encoders, min_date=min_date)
    X = X.reindex(columns=bundle["feature_cols"], fill_value=0.0)
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


def _num(value) -> Optional[float]:
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _weather_label(rainfall: Optional[float], humidity: Optional[float], temp: Optional[float]) -> str:
    if rainfall is not None and rainfall >= 10:
        return "heavy rain"
    if rainfall is not None and rainfall >= 1:
        return "rain"
    if humidity is not None and humidity >= 80:
        return "humid"
    if temp is not None and temp >= 34:
        return "hot sunny"
    return "clear"


def _weather_defaults_for(district: Optional[str]) -> dict:
    encoders = (STATE.get("bundle") or {}).get("encoders", {})
    defaults = encoders.get("_weather_defaults", {})
    by_district = encoders.get("_weather_by_district", {})
    district_weather = by_district.get(district or "", {})
    return {
        key: district_weather.get(key, defaults.get(key))
        for key in ("temp_avg_c", "temp_min_c", "temp_max_c", "rainfall_mm", "humidity_pct", "wind_kmph")
    }


def _history_factor(row: pd.Series) -> FactorPoint:
    rain = _num(row.get("rainfall_mm"))
    humidity = _num(row.get("humidity_pct"))
    temp = _num(row.get("temp_avg_c"))
    return FactorPoint(
        date=str(row["arrival_date"].date()),
        kind="history",
        price=_num(row.get("modal_price")),
        arrivals=_num(row.get("arrival_qty")),
        tempAvgC=temp,
        tempMinC=_num(row.get("temp_min_c")),
        tempMaxC=_num(row.get("temp_max_c")),
        rainfallMm=rain,
        humidityPct=humidity,
        windKmph=_num(row.get("wind_kmph")),
        weatherLabel=_weather_label(rain, humidity, temp),
    )


def _forecast_factor(point: ForecastPoint, district: Optional[str], arrivals: Optional[float]) -> FactorPoint:
    weather = _weather_defaults_for(district)
    rain = _num(weather.get("rainfall_mm"))
    humidity = _num(weather.get("humidity_pct"))
    temp = _num(weather.get("temp_avg_c"))
    return FactorPoint(
        date=point.date,
        kind="forecast",
        price=point.price,
        arrivals=arrivals,
        tempAvgC=temp,
        tempMinC=_num(weather.get("temp_min_c")),
        tempMaxC=_num(weather.get("temp_max_c")),
        rainfallMm=rain,
        humidityPct=humidity,
        windKmph=_num(weather.get("wind_kmph")),
        weatherLabel=_weather_label(rain, humidity, temp),
    )


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


@app.get("/report")
def report() -> dict:
    bundle = STATE.get("bundle") or {}
    report_data = bundle.get("report") or load_training_report()
    if not report_data:
        raise HTTPException(status_code=404, detail="Training report not available")
    return report_data


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
    diagnostics: list[dict] = []

    # Smoothing / sanity parameters (tunable)
    MAX_DAILY_PCT_CHANGE = 0.12  # Cap day-to-day moves to ±12%
    MIN_MEDIAN_FRACTION = 0.8    # Don't allow predictions below 80% of historical median
    MAX_MEDIAN_MULTIPLIER = 1.5  # Don't allow predictions above 1.5x median

    prev_price = current_price if current_price is not None else (history["modal_price"].dropna().iloc[-1] if not history.empty else None)

    for day in range(1, req.horizonDays + 1):
        target = today + pd.Timedelta(days=day)
        raw_price: Optional[float] = None

        # Try XGBoost first (non-recursive feature generation using history)
        if bundle is not None and not history.empty:
            try:
                raw_price = _predict_xgb_for_date(req, history, target)
                method = "xgboost"
            except Exception as exc:  # noqa: BLE001
                logger.warning("XGBoost predict (day=%d) failed: %s", day, exc)
                raw_price = None

        # Fall back to statistical per-day forecast on failure.
        if raw_price is None:
            fb = stat_forecast(history, horizon_days=day)
            raw_price = fb.get("predicted_price")
            if method != "xgboost":
                method = "stat"

        if raw_price is None:
            continue

        # Sanity clamps based on history median
        median = float(history["modal_price"].median()) if not history.empty else raw_price
        min_allowed = median * MIN_MEDIAN_FRACTION
        max_allowed = median * MAX_MEDIAN_MULTIPLIER
        clamped = float(max(min_allowed, min(max_allowed, raw_price)))

        # Smooth day-to-day moves to avoid cascading collapse/spike
        if prev_price is not None:
            cap_up = prev_price * (1.0 + MAX_DAILY_PCT_CHANGE)
            cap_down = prev_price * (1.0 - MAX_DAILY_PCT_CHANGE)
            smoothed = float(max(cap_down, min(cap_up, clamped)))
        else:
            smoothed = clamped

        conf = _day_confidence(base_conf, day, len(history))
        # Derive a loose confidence band around the point estimate
        uncertainty = max(0.01, 1.0 - conf)
        lower = round(smoothed * (1.0 - uncertainty * 1.2), 2)
        upper = round(smoothed * (1.0 + uncertainty * 1.2), 2)

        forecast.append(
            ForecastPoint(
                day=day,
                date=str(target.date()),
                price=round(smoothed, 2),
                confidence=conf,
                lowerPrice=lower,
                upperPrice=upper,
            )
        )

        diagnostics.append(
            {
                "day": day,
                "date": str(target.date()),
                "raw_price": raw_price,
                "clamped": round(clamped, 2),
                "smoothed": round(smoothed, 2),
                "lower": lower,
                "upper": upper,
                "method": method,
            }
        )

        prev_price = smoothed

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

    # Compute simple outlook label from the average daily percent change
    outlook = None
    try:
        if len(forecast) >= 2:
            pct_changes = []
            prev = forecast[0].price
            for p in forecast[1:]:
                if prev and prev != 0:
                    pct_changes.append((p.price - prev) / prev)
                prev = p.price
            mean_pct = float(np.mean(pct_changes)) if pct_changes else 0.0
            if mean_pct > 0.01:
                outlook = "Rising"
            elif mean_pct < -0.01:
                outlook = "Falling"
            else:
                outlook = "Stable"
        elif len(forecast) == 1:
            # Single-day outlook vs current price
            if current_price and forecast[0].price and current_price > 0:
                delta = (forecast[0].price - current_price) / current_price
                outlook = "Rising" if delta > 0.01 else "Falling" if delta < -0.01 else "Stable"
    except Exception:
        outlook = None

    # Attach the day-1 prediction to the last historical trend node so the
    # chart's dotted "predicted" line still anchors visually.
    if trend and forecast:
        trend[-1] = TrendPoint(
            date=trend[-1].date,
            price=trend[-1].price,
            predicted=forecast[0].price,
        )

    factors = [_history_factor(r) for _, r in history.tail(7).iterrows()]
    arrivals = _num(history_row.get("arrival_qty")) if history_row is not None else None
    factors.extend(_forecast_factor(f, req.district or (history_row.get("district") if history_row is not None else None), arrivals) for f in forecast)

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
        factors=factors,
        trend=trend,
        outlook=outlook,
        diagnostics={"perDay": diagnostics},
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
