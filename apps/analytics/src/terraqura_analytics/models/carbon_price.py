"""Carbon credit price prediction model."""

from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from numpy.typing import NDArray
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

from terraqura_analytics.schemas import (
    PriceDataPoint,
    PricePrediction,
    TrainingResult,
)


def _extract_features(data: list[PriceDataPoint]) -> NDArray[np.float64]:
    """Convert price data points into a feature matrix.

    Features per row:
        0 - price
        1 - volume
        2 - retirement_rate
        3 - total_supply
        4 - price moving average (3-period)
        5 - volume moving average (3-period)
        6 - price rate of change
    """
    n = len(data)
    features = np.zeros((n, 7), dtype=np.float64)

    for i, dp in enumerate(data):
        features[i, 0] = dp.price
        features[i, 1] = dp.volume
        features[i, 2] = dp.retirement_rate
        features[i, 3] = dp.total_supply

    # Moving averages (window=3, padded at the start)
    for i in range(n):
        window_start = max(0, i - 2)
        features[i, 4] = float(np.mean(features[window_start : i + 1, 0]))
        features[i, 5] = float(np.mean(features[window_start : i + 1, 1]))

    # Rate of change
    for i in range(1, n):
        prev = features[i - 1, 0]
        features[i, 6] = (features[i, 0] - prev) / prev if prev > 0 else 0.0
    features[0, 6] = 0.0

    return features


class CarbonPricePredictor:
    """Predicts future carbon credit prices using ensemble regression.

    Uses a combination of linear regression (for trend) and random forest
    (for non-linear patterns) to produce predictions with confidence intervals.
    """

    def __init__(self) -> None:
        self._lr = LinearRegression()
        self._rf = RandomForestRegressor(n_estimators=100, random_state=42)
        self._is_trained = False
        self._training_std: float = 0.0
        self._last_features: NDArray[np.float64] | None = None

    @property
    def is_trained(self) -> bool:
        """Whether the model has been trained."""
        return self._is_trained

    def train(self, historical_data: list[PriceDataPoint]) -> TrainingResult:
        """Train the price prediction models on historical data.

        Args:
            historical_data: At least 5 chronologically-sorted price observations.

        Returns:
            Training metrics including R-squared and RMSE.

        Raises:
            ValueError: If fewer than 5 data points are provided.
        """
        if len(historical_data) < 5:
            raise ValueError("At least 5 data points are required for training")

        sorted_data = sorted(historical_data, key=lambda d: d.timestamp)
        features = _extract_features(sorted_data)

        # Use all features except the current price to predict next price
        x = features[:-1]
        y = np.array([dp.price for dp in sorted_data[1:]], dtype=np.float64)

        self._lr.fit(x, y)
        self._rf.fit(x, y)

        # Ensemble prediction for scoring
        preds_lr = self._lr.predict(x)
        preds_rf = self._rf.predict(x)
        preds = 0.4 * preds_lr + 0.6 * preds_rf

        r2 = float(r2_score(y, preds))
        rmse = float(math.sqrt(mean_squared_error(y, preds)))
        self._training_std = float(np.std(y - preds))
        self._last_features = features[-1:]
        self._is_trained = True

        return TrainingResult(
            r2_score=r2,
            rmse=rmse,
            samples_used=len(x),
            model_name="ensemble_lr_rf",
            trained_at=datetime.now(timezone.utc),
        )

    def predict_price(self, horizon_days: int = 30) -> PricePrediction:
        """Predict the carbon credit price for a future horizon.

        Args:
            horizon_days: Number of days into the future (1-365).

        Returns:
            A prediction with point estimate and confidence interval.

        Raises:
            ValueError: If horizon_days is out of range.
            RuntimeError: If the model has not been trained.
        """
        if not self._is_trained or self._last_features is None:
            raise RuntimeError("Model must be trained before predicting")
        if horizon_days < 1 or horizon_days > 365:
            raise ValueError("horizon_days must be between 1 and 365")

        current_features = self._last_features.copy()

        # Iterative multi-step forecast
        for _ in range(horizon_days):
            pred_lr = float(self._lr.predict(current_features)[0])
            pred_rf = float(self._rf.predict(current_features)[0])
            pred = 0.4 * pred_lr + 0.6 * pred_rf
            pred = max(pred, 0.0)

            # Shift features forward
            new_row = current_features[0].copy()
            new_row[6] = (pred - new_row[0]) / new_row[0] if new_row[0] > 0 else 0.0
            new_row[4] = (new_row[4] * 2 + pred) / 3  # update moving avg
            new_row[0] = pred
            current_features[0] = new_row

        predicted_price = float(current_features[0, 0])
        # Widen confidence interval with horizon
        uncertainty = self._training_std * math.sqrt(horizon_days)
        confidence = max(0.5, 1.0 - (horizon_days / 365) * 0.4)

        return PricePrediction(
            predicted_price=round(predicted_price, 6),
            lower_bound=round(max(0.0, predicted_price - 1.96 * uncertainty), 6),
            upper_bound=round(predicted_price + 1.96 * uncertainty, 6),
            confidence=round(confidence, 4),
            horizon_days=horizon_days,
            model_used="ensemble_lr_rf",
            generated_at=datetime.now(timezone.utc),
        )

    def save(self, path: str | Path) -> None:
        """Persist model state to a directory.

        Args:
            path: Directory to save model artifacts in.
        """
        import pickle

        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)

        with open(path / "lr.pkl", "wb") as f:
            pickle.dump(self._lr, f)
        with open(path / "rf.pkl", "wb") as f:
            pickle.dump(self._rf, f)

        meta: dict[str, Any] = {
            "is_trained": self._is_trained,
            "training_std": self._training_std,
            "last_features": self._last_features.tolist() if self._last_features is not None else None,
        }
        with open(path / "meta.json", "w") as f:
            json.dump(meta, f)

    def load(self, path: str | Path) -> None:
        """Load model state from a directory.

        Args:
            path: Directory containing saved model artifacts.
        """
        import pickle

        path = Path(path)

        with open(path / "lr.pkl", "rb") as f:
            self._lr = pickle.load(f)  # noqa: S301
        with open(path / "rf.pkl", "rb") as f:
            self._rf = pickle.load(f)  # noqa: S301
        with open(path / "meta.json") as f:
            meta = json.load(f)

        self._is_trained = meta["is_trained"]
        self._training_std = meta["training_std"]
        self._last_features = (
            np.array(meta["last_features"], dtype=np.float64)
            if meta["last_features"] is not None
            else None
        )
