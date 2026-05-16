"""Train an XGBoost regressor on the Agmarknet CSV.

Persists the model + encoders + min_date to model.pkl. Called once at
service startup (see app.main), so no separate "training step" is needed
for the hackathon demo.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

from .preprocess import CLEANED_DATA_FILE, build_features, load_raw

MODEL_PATH = Path(__file__).resolve().parent.parent / "model.pkl"

logger = logging.getLogger(__name__)


def train_model(force: bool = False) -> dict:
    """Train and persist a model. Returns metadata about the run.

    If model.pkl already exists and force=False, just loads + returns it.
    """
    if MODEL_PATH.exists() and not force:
        if not CLEANED_DATA_FILE.exists() or MODEL_PATH.stat().st_mtime >= CLEANED_DATA_FILE.stat().st_mtime:
            return joblib.load(MODEL_PATH)

    df = load_raw()
    if df.empty:
        raise RuntimeError("No training rows after preprocessing")

    X, encoders, min_date = build_features(df)
    y = df["modal_price"].astype(float).to_numpy()

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
    model.fit(X, y)

    preds = model.predict(X)
    rmse = float(np.sqrt(np.mean((preds - y) ** 2)))
    mape = float(np.mean(np.abs((preds - y) / np.clip(y, 1, None))) * 100)

    bundle = {
        "model": model,
        "encoders": encoders,
        "min_date": min_date,
        "feature_cols": list(X.columns),
        "metrics": {"train_rmse": round(rmse, 2), "train_mape_pct": round(mape, 2)},
        "n_train_rows": int(len(df)),
    }
    joblib.dump(bundle, MODEL_PATH)
    logger.info("Trained XGBoost model: %s", bundle["metrics"])
    return bundle


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    info = train_model(force=True)
    print({k: v for k, v in info.items() if k != "model"})
