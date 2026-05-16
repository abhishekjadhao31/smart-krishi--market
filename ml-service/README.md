# Smart Krishi Market — ML Service

FastAPI service that powers crop price predictions for the platform.

- Trains an **XGBoost** regressor on the bundled Maharashtra Agmarknet CSV
  (`data/maharashtra_prices.csv`) at startup.
- Falls back to a **weighted-moving-average + linear-trend** estimator when
  the model is unavailable or the commodity is unseen.
- Surfaces a `/predict` endpoint consumed by the Express backend
  (`POST /api/predict` proxies here via `ML_SERVICE_URL`).

## Endpoints

| Method | Path                              | Description                                     |
|--------|-----------------------------------|-------------------------------------------------|
| GET    | `/health`                         | Liveness + training metrics                     |
| POST   | `/predict`                        | Predict future modal price + recommendation     |
| GET    | `/market-prices/commodities`      | List of commodities & districts in the CSV      |
| GET    | `/market-prices/series`           | Historical modal-price series                   |

### `POST /predict` request

```json
{
  "cropName": "Tomato",
  "district": "Pune",
  "market": "Pune-Market Yard",
  "quantityKg": 1000,
  "harvestDate": "2026-05-20",
  "horizonDays": 7
}
```

### Response

```json
{
  "cropName": "Tomato",
  "currentPrice": 1820.0,
  "predictedPrice": 2030.0,
  "confidence": 0.74,
  "recommendation": "HOLD",
  "method": "xgboost",
  "horizonDays": 7,
  "trend": [{"date": "2026-04-30", "price": 1700}, ...],
  "metrics": {"train_rmse": 412.5, "train_mape_pct": 18.2}
}
```

## Local run (Windows / PowerShell)

```powershell
cd ml-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --port 8000 --reload
```

Then verify:

```powershell
curl http://localhost:8000/health
```

The backend's `.env` should have `ML_SERVICE_URL=http://localhost:8000`
(the default in `backend/.env.example`).

## Retraining

The model trains on first boot and persists to `model.pkl`. To force a retrain:

```powershell
python -m app.train
```
