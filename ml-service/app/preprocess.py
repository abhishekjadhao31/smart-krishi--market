"""CSV loading + feature engineering for the Maharashtra Agmarknet dataset.

The dataset is small (~130 rows for 6 months), so we keep features simple:

  Numeric: arrival_qty_mt, day_of_year, month, days_since_min_date,
           market_modal_avg, district_modal_avg, commodity_modal_avg

  Categorical (target-encoded as the mean modal_price per category — robust on
  small data, avoids the explosion of one-hot columns for 30+ markets):
           commodity_te, district_te, market_te

Target: modal_price (Rs./Quintal).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

ML_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = ML_ROOT.parent
LEGACY_DATA_FILE = ML_ROOT / "data" / "maharashtra_prices.csv"
CLEANED_DATA_FILE = REPO_ROOT / "database" / "cleaned" / "maharashtra_mandi_cleaned.csv"
DATA_FILE = CLEANED_DATA_FILE if CLEANED_DATA_FILE.exists() else LEGACY_DATA_FILE


def _to_number(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)) and not pd.isna(v):
        return float(v)
    s = str(v).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _to_date(v) -> Optional[pd.Timestamp]:
    if v is None:
        return None
    s = str(v).strip()
    m = re.match(r"^(\d{2})-(\d{2})-(\d{4})$", s)
    if m:
        dd, mm, yyyy = m.groups()
        return pd.Timestamp(f"{yyyy}-{mm}-{dd}")
    try:
        return pd.Timestamp(s)
    except Exception:  # noqa: BLE001
        return None


def load_raw(csv_path: Optional[Path] = None) -> pd.DataFrame:
    """Read the Agmarknet CSV and return a clean DataFrame.

    Prefers the new cleaned pipeline CSV. Falls back to the legacy potato-only
    CSV so existing demos still boot before the first ingestion run.
    """
    csv_path = csv_path or (CLEANED_DATA_FILE if CLEANED_DATA_FILE.exists() else LEGACY_DATA_FILE)
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    text = csv_path.read_text(encoding="utf-8", errors="ignore").splitlines()
    header_idx = next(
        (i for i, line in enumerate(text) if line.lower().startswith("state,district,market")),
        0,
    )
    df = pd.read_csv(csv_path, skiprows=header_idx)
    df.columns = [c.strip() for c in df.columns]
    rename = {
        "State": "state",
        "District": "district",
        "Market": "market",
        "Commodity Group": "commodity_group",
        "Commodity": "commodity",
        "Variety": "variety",
        "Grade": "grade",
        "Min Price": "min_price",
        "Max Price": "max_price",
        "Modal Price": "modal_price",
        "Price Unit": "price_unit",
        "Arrival Quantity": "arrival_qty",
        "Arrival Unit": "arrival_unit",
        "Arrival Date": "arrival_date",
        "price_date": "arrival_date",
        "arrivals": "arrival_qty",
        "unit": "arrival_unit",
    }
    df = df.rename(columns=rename)

    if "arrival_qty" not in df.columns:
        df["arrival_qty"] = np.nan
    if "arrival_unit" not in df.columns:
        df["arrival_unit"] = ""

    for col in ("min_price", "max_price", "modal_price", "arrival_qty"):
        if col in df.columns:
            df[col] = df[col].map(_to_number)

    df["arrival_date"] = df["arrival_date"].map(_to_date)
    df = df.dropna(subset=["modal_price", "arrival_date", "commodity"])
    for text_col in ("state", "district", "market", "commodity", "variety"):
        if text_col in df.columns:
            df[text_col] = df[text_col].fillna("").astype(str).str.strip()
    if df.empty and csv_path == CLEANED_DATA_FILE and LEGACY_DATA_FILE.exists():
        return load_raw(LEGACY_DATA_FILE)
    df = df.reset_index(drop=True)
    return df


def build_target_encoders(df: pd.DataFrame) -> dict:
    """Return mean(modal_price) per category for commodity/district/market.

    Used to convert categorical text to a single numeric feature each.
    Falls back to the global mean for unseen categories at inference time.
    """
    enc = {
        "commodity": df.groupby("commodity")["modal_price"].mean().to_dict(),
        "district": df.groupby("district")["modal_price"].mean().to_dict(),
        "market": df.groupby("market")["modal_price"].mean().to_dict(),
        "_global_mean": float(df["modal_price"].mean()),
    }
    return enc


def _strip_tz(ts):
    """Return a tz-naive Timestamp regardless of input tz-awareness.

    Training rows are parsed as tz-naive (CSV has no zone info); any tz-aware
    value passed in for inference would otherwise raise when subtracted.
    """
    if ts is None:
        return None
    ts = pd.Timestamp(ts)
    if ts.tzinfo is not None:
        ts = ts.tz_convert("UTC").tz_localize(None)
    return ts


def build_features(
    df: pd.DataFrame,
    encoders: Optional[dict] = None,
    min_date: Optional[pd.Timestamp] = None,
) -> tuple[pd.DataFrame, dict, pd.Timestamp]:
    """Construct the feature matrix used for training and inference."""
    if encoders is None:
        encoders = build_target_encoders(df)
    if min_date is None:
        min_date = df["arrival_date"].min()
    min_date = _strip_tz(min_date)

    # Make arrival_date tz-naive too, in case a tz-aware value sneaks in via the
    # inference pseudo-row (e.g. pd.Timestamp.utcnow()).
    arrival = pd.to_datetime(df["arrival_date"], errors="coerce")
    if getattr(arrival.dt, "tz", None) is not None:
        arrival = arrival.dt.tz_convert("UTC").dt.tz_localize(None)

    out = pd.DataFrame()
    out["day_of_year"] = arrival.dt.dayofyear
    out["month"] = arrival.dt.month
    out["days_since_min"] = (arrival - min_date).dt.days
    out["arrival_qty"] = df["arrival_qty"].fillna(df["arrival_qty"].median() if "arrival_qty" in df else 0)
    out["commodity_te"] = df["commodity"].map(encoders["commodity"]).fillna(encoders["_global_mean"])
    out["district_te"] = df["district"].map(encoders["district"]).fillna(encoders["_global_mean"])
    out["market_te"] = df["market"].map(encoders["market"]).fillna(encoders["_global_mean"])
    engineered_defaults = {
        "day_of_week": arrival.dt.dayofweek,
        "lag_1_price": df.get("modal_price", pd.Series(0, index=df.index)),
        "lag_7_price": df.get("modal_price", pd.Series(0, index=df.index)),
        "rolling_avg_7": df.get("modal_price", pd.Series(0, index=df.index)),
        "rolling_avg_30": df.get("modal_price", pd.Series(0, index=df.index)),
        "price_trend": pd.Series(0, index=df.index),
        "arrivals_trend": pd.Series(0, index=df.index),
    }
    for col, default in engineered_defaults.items():
        if col in df.columns:
            out[col] = pd.to_numeric(df[col], errors="coerce").fillna(default)
        else:
            out[col] = default
    return out, encoders, min_date


def filter_history(
    df: pd.DataFrame,
    commodity: Optional[str] = None,
    district: Optional[str] = None,
    market: Optional[str] = None,
) -> pd.DataFrame:
    """Return a slice of the dataset filtered by the requested keys.

    Matching is case-insensitive; if a filter has zero hits we relax it
    (drop market first, then district) so we always return *some* history.
    """
    cur = df.copy()
    if commodity:
        m = cur["commodity"].str.lower() == commodity.strip().lower()
        if not m.any():
            return cur.iloc[0:0].copy()
        cur = cur[m]
    if market:
        m = cur["market"].str.lower().str.contains(market.strip().lower(), na=False)
        if m.any():
            cur = cur[m]
    if district:
        m = cur["district"].str.lower() == district.strip().lower()
        if m.any():
            cur = cur[m]
    return cur.sort_values("arrival_date").reset_index(drop=True)


def stat_forecast(history: pd.DataFrame, horizon_days: int = 7) -> dict:
    """Simple statistical fallback: weighted moving average + linear trend.

    Used when XGBoost is unavailable or the commodity is unseen.
    """
    if history.empty:
        return {"predicted_price": None, "confidence": 0.0, "method": "stat-empty"}

    prices = history["modal_price"].to_numpy(dtype=float)
    n = len(prices)
    # Weighted moving average (more recent weighted higher)
    weights = np.linspace(1, 2, n)
    wma = float((prices * weights).sum() / weights.sum())

    # Linear trend slope
    if n >= 3:
        x = np.arange(n, dtype=float)
        slope = float(np.polyfit(x, prices, 1)[0])
    else:
        slope = 0.0

    predicted = wma + slope * (horizon_days / 7.0)
    # Confidence: inverse of recent volatility, capped to [0.3, 0.85]
    if n >= 4:
        vol = float(np.std(prices[-min(n, 14):]) / max(np.mean(prices), 1))
        conf = max(0.3, min(0.85, 1.0 - vol))
    else:
        conf = 0.5
    return {
        "predicted_price": round(float(predicted), 2),
        "confidence": round(conf, 2),
        "method": "stat",
    }
