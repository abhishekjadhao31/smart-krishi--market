"""Train an XGBoost regressor on the Agmarknet CSV.

Persists the model + encoders + min_date to model.pkl. Called once at
service startup (see app.main), so no separate "training step" is needed
for the hackathon demo.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import pandas as pd

from .preprocess import CLEANED_DATA_FILE, WEATHER_DATA_FILE, build_features, load_raw

MODEL_PATH = Path(__file__).resolve().parent.parent / "model.pkl"
REPORT_PATH = Path(__file__).resolve().parent.parent / "model_report.json"

logger = logging.getLogger(__name__)


def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    baseline = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if baseline == 0:
        return 0.0
    residual = float(np.sum((y_true - y_pred) ** 2))
    return float(1.0 - (residual / baseline))


def _directional_accuracy(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    previous_actual: float,
    previous_pred: float,
) -> float:
    if len(y_true) == 0:
        return 0.0
    matches = 0
    total = 0
    last_actual = previous_actual
    last_pred = previous_pred
    for actual, pred in zip(y_true, y_pred, strict=False):
        actual_delta = np.sign(actual - last_actual)
        pred_delta = np.sign(pred - last_pred)
        if actual_delta == pred_delta:
            matches += 1
        total += 1
        last_actual = actual
        last_pred = pred
    return float(matches / total * 100.0) if total else 0.0


def _holdout_split(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    ordered = df.sort_values("arrival_date").reset_index(drop=True)
    if len(ordered) < 2:
        raise RuntimeError("Need at least two rows to create a time-based holdout")
    split_idx = int(round(len(ordered) * 0.8))
    split_idx = max(1, min(len(ordered) - 1, split_idx))
    return ordered.iloc[:split_idx].copy(), ordered.iloc[split_idx:].copy()


def load_training_report() -> dict:
    if REPORT_PATH.exists():
        return json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    return {}


def train_model(force: bool = False) -> dict:
    """Train and persist a model. Returns metadata about the run.

    If model.pkl already exists and force=False, just loads + returns it.
    """
    if MODEL_PATH.exists() and not force:
        data_files = [p for p in (CLEANED_DATA_FILE, WEATHER_DATA_FILE) if p.exists()]
        newest_data_mtime = max((p.stat().st_mtime for p in data_files), default=0)
        if not data_files or MODEL_PATH.stat().st_mtime >= newest_data_mtime:
            bundle = joblib.load(MODEL_PATH)
            if "report" not in bundle:
                bundle["report"] = load_training_report()
            return bundle

    df = load_raw()
    if df.empty:
        raise RuntimeError("No training rows after preprocessing")
    df = df.sort_values("arrival_date").reset_index(drop=True)

    train_df, test_df = _holdout_split(df)
    X_train, encoders, min_date = build_features(train_df)
    y_train = train_df["modal_price"].astype(float).to_numpy()
    X_test, _, _ = build_features(test_df, encoders=encoders, min_date=min_date)
    y_test = test_df["modal_price"].astype(float).to_numpy()

    # Lazy import so the module loads even if xgboost is missing during dev.
    from xgboost import XGBRegressor

    model = XGBRegressor(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.07,
        subsample=0.9,
        colsample_bytree=0.9,
        random_state=42,
        tree_method="hist",
    )
    model.fit(X_train, y_train)

    train_preds = model.predict(X_train)
    test_preds = model.predict(X_test)

    metrics = {
        "train_rows": int(len(train_df)),
        "holdout_rows": int(len(test_df)),
        "train_mae": round(_mae(y_train, train_preds), 2),
        "train_rmse": round(_rmse(y_train, train_preds), 2),
        "holdout_mae": round(_mae(y_test, test_preds), 2),
        "holdout_rmse": round(_rmse(y_test, test_preds), 2),
        "holdout_r2": round(_r2(y_test, test_preds), 4),
        "holdout_directional_accuracy_pct": round(
            _directional_accuracy(y_test, test_preds, float(y_train[-1]), float(train_preds[-1])),
            2,
        ),
    }

    report = {
        "trained_at": pd.Timestamp.utcnow().tz_localize(None).isoformat(),
        "train_start": str(train_df["arrival_date"].min().date()),
        "train_end": str(train_df["arrival_date"].max().date()),
        "holdout_start": str(test_df["arrival_date"].min().date()),
        "holdout_end": str(test_df["arrival_date"].max().date()),
        "metrics": metrics,
        "uses_weather": WEATHER_DATA_FILE.exists(),
    }

    bundle = {
        "model": model,
        "encoders": encoders,
        "min_date": min_date,
        "feature_cols": list(X_train.columns),
        "metrics": metrics,
        "report": report,
        "n_train_rows": int(len(train_df)),
        "uses_weather": WEATHER_DATA_FILE.exists(),
    }
    joblib.dump(bundle, MODEL_PATH)
    REPORT_PATH.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    logger.info("Trained XGBoost model: %s", metrics)
    return bundle


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    info = train_model(force=True)
    print({k: v for k, v in info.items() if k != "model"})
