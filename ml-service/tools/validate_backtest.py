"""Rolling-origin backtest validator for ML forecasts.

Produces RMSE and directional accuracy per (commodity, district) for a
set of commodities and districts. Saves results to `validation_report.json`.

Run with the repo venv python from the repo root.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd

import sys
from pathlib import Path as _P

# Ensure the ml-service package root is on sys.path when run as a script.
ROOT_DIR = str(_P(__file__).resolve().parent.parent)
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from app.train import train_model
from app.preprocess import load_raw


ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "validation_report.json"


def directional_accuracy(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    if len(y_true) == 0:
        return 0.0
    matches = 0
    total = 0
    last_actual = y_true[0]
    last_pred = y_pred[0]
    for a, p in zip(y_true[1:], y_pred[1:]):
        if np.sign(a - last_actual) == np.sign(p - last_pred):
            matches += 1
        total += 1
        last_actual = a
        last_pred = p
    return float(matches / total * 100.0) if total else 0.0


def evaluate_series(df: pd.DataFrame, bundle: dict, horizon: int = 1) -> dict:
    """Backtest: for each time t where t+horizon exists, predict using data<=t
    and compare to actual at t+horizon. Returns RMSE and directional accuracy.
    """
    df = df.sort_values("arrival_date").reset_index(drop=True)
    n = len(df)
    if n < 10:
        return {"n": n, "rmse": None, "directional_accuracy_pct": None}

    model = bundle["model"]
    encoders = bundle["encoders"]
    min_date = bundle["min_date"]
    feature_cols = bundle["feature_cols"]

    def predict_from_history(history: pd.DataFrame, req_crop: str, req_district: str, req_market: str, target_date) -> float | None:
        # Derive lag/rolling features from observed history (non-recursive)
        hist = history.sort_values("arrival_date").reset_index(drop=True)
        if hist.empty:
            return None
        window7 = hist["modal_price"].dropna().tail(7)
        window30 = hist["modal_price"].dropna().tail(30)

        lag_1 = float(hist["modal_price"].dropna().iloc[-1]) if not hist["modal_price"].dropna().empty else np.nan
        lag_7 = float(window7.mean()) if not window7.empty else lag_1
        rolling_7 = float(window7.mean()) if not window7.empty else lag_1
        rolling_30 = float(window30.mean()) if not window30.empty else lag_7

        prices_for_trend = hist["modal_price"].dropna().tail(14).to_numpy()
        if len(prices_for_trend) >= 3:
            x = np.arange(len(prices_for_trend), dtype=float)
            slope = float(np.polyfit(x, prices_for_trend, 1)[0])
        else:
            slope = 0.0

        arrivals_series = hist.get("arrival_qty", pd.Series(dtype=float)).dropna()
        if not arrivals_series.empty:
            arrival_est = float(arrivals_series.tail(7).median())
        else:
            arrival_est = float(hist.get("arrival_qty", pd.Series([0])).dropna().iloc[-1]) if not hist.get("arrival_qty", pd.Series()).dropna().empty else 0.0

        pseudo_row = {
            "arrival_date": target_date,
            "arrival_qty": arrival_est,
            "commodity": req_crop,
            "district": req_district or (hist.iloc[-1].get("district") if not hist.empty else ""),
            "market": req_market or (hist.iloc[-1].get("market") if not hist.empty else ""),
            "lag_1_price": lag_1,
            "lag_7_price": lag_7,
            "rolling_avg_7": rolling_7,
            "rolling_avg_30": rolling_30,
            "price_trend": slope,
            "arrivals_trend": 0.0,
        }
        pseudo = pd.DataFrame([pseudo_row])
        X, _, _ = __import__("app.preprocess", fromlist=["build_features"]).build_features(pseudo, encoders=encoders, min_date=min_date)
        X = X.reindex(columns=feature_cols, fill_value=0.0)
        try:
            raw_p = float(model.predict(X)[0])
        except Exception:
            return None

        # Apply same post-processing as the live service: clamp to median-based
        # bounds and cap daily moves relative to the last observed price.
        median = float(history["modal_price"].median()) if not history.empty else raw_p
        MIN_MEDIAN_FRACTION = 0.8
        MAX_MEDIAN_MULTIPLIER = 1.5
        MAX_DAILY_PCT_CHANGE = 0.12
        min_allowed = median * MIN_MEDIAN_FRACTION
        max_allowed = median * MAX_MEDIAN_MULTIPLIER
        clamped = float(max(min_allowed, min(max_allowed, raw_p)))
        prev_price = float(history["modal_price"].dropna().iloc[-1]) if not history["modal_price"].dropna().empty else None
        if prev_price is not None:
            cap_up = prev_price * (1.0 + MAX_DAILY_PCT_CHANGE)
            cap_down = prev_price * (1.0 - MAX_DAILY_PCT_CHANGE)
            smoothed = float(max(cap_down, min(cap_up, clamped)))
        else:
            smoothed = clamped
        return smoothed

    preds = []
    trues = []
    start = max(7, n - 60)
    for i in range(start, n - horizon):
        hist = df.iloc[: i + 1].copy()
        target_row = df.iloc[i + horizon]
        pred = predict_from_history(hist, target_row["commodity"], target_row.get("district"), target_row.get("market"), target_row["arrival_date"])
        if pred is None:
            continue
        preds.append(pred)
        trues.append(float(target_row["modal_price"]))

    if not preds:
        return {"n": n, "rmse": None, "directional_accuracy_pct": None}

    y_true = np.array(trues, dtype=float)
    y_pred = np.array(preds, dtype=float)
    rmse = float(np.sqrt(np.mean((y_true - y_pred) ** 2)))
    da = directional_accuracy(y_true, y_pred)
    return {"n": n, "rmse": round(rmse, 2), "directional_accuracy_pct": round(da, 2)}


def run_backtest(
    commodities: List[str],
    districts: List[str],
    horizon: int = 1,
):
    bundle = train_model(force=False)
    df = load_raw()
    report = {"horizon": horizon, "results": {}, "meta": {"rows": len(df)}}

    for commodity in commodities:
        report[commodity] = {}
        for district in districts:
            mask = (df["commodity"].str.lower() == commodity.lower()) & (
                df["district"].str.lower() == district.lower()
            )
            sub = df[mask].copy()
            if sub.empty:
                continue
            stats = evaluate_series(sub, bundle, horizon=horizon)
            report[commodity][district] = stats

    OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote validation report to {OUT}")


if __name__ == "__main__":
    # User-requested commodities and common districts
    commodities = ["Onion", "Wheat", "Soyabean", "Tomato", "Maize"]
    # Use canonical districts present in dataset (fallback to these)
    districts = ["Pune", "Nashik", "Mumbai", "Satara", "Sangli"]
    run_backtest(commodities, districts, horizon=1)
