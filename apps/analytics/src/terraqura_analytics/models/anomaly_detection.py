"""Sensor anomaly detection for DAC units using Isolation Forest."""

from __future__ import annotations

from datetime import datetime

import numpy as np
from numpy.typing import NDArray
from sklearn.ensemble import IsolationForest

from terraqura_analytics.schemas import AnomalyResult, SensorReading


_FEATURE_NAMES = [
    "co2_capture_rate",
    "energy_consumption",
    "flow_rate",
    "temperature",
    "pressure",
]


def _readings_to_matrix(readings: list[SensorReading]) -> NDArray[np.float64]:
    """Convert sensor readings into a numeric feature matrix."""
    return np.array(
        [
            [
                r.co2_capture_rate,
                r.energy_consumption,
                r.flow_rate,
                r.temperature,
                r.pressure,
            ]
            for r in readings
        ],
        dtype=np.float64,
    )


class SensorAnomalyDetector:
    """Detects anomalous DAC unit sensor readings via Isolation Forest.

    The model learns the normal operating envelope from historical sensor
    data and flags readings that deviate significantly.
    """

    def __init__(self, contamination: float = 0.05, random_state: int = 42) -> None:
        """Initialise the detector.

        Args:
            contamination: Expected proportion of anomalies in training data.
            random_state: Random seed for reproducibility.
        """
        self._model = IsolationForest(
            contamination=contamination,
            random_state=random_state,
            n_estimators=100,
        )
        self._is_trained = False
        self._feature_means: NDArray[np.float64] | None = None
        self._feature_stds: NDArray[np.float64] | None = None

    @property
    def is_trained(self) -> bool:
        """Whether the model has been fitted."""
        return self._is_trained

    def train(self, historical_readings: list[SensorReading]) -> None:
        """Fit the isolation forest on historical (predominantly normal) data.

        Args:
            historical_readings: At least 10 readings representative of normal operation.

        Raises:
            ValueError: If fewer than 10 readings are provided.
        """
        if len(historical_readings) < 10:
            raise ValueError("At least 10 readings are required for training")

        x = _readings_to_matrix(historical_readings)
        self._feature_means = x.mean(axis=0)
        self._feature_stds = x.std(axis=0)
        # Avoid division by zero
        self._feature_stds[self._feature_stds == 0] = 1.0

        x_scaled = (x - self._feature_means) / self._feature_stds
        self._model.fit(x_scaled)
        self._is_trained = True

    def detect_anomalies(self, readings: list[SensorReading]) -> list[AnomalyResult]:
        """Score a batch of readings and flag anomalies.

        Args:
            readings: One or more sensor readings to evaluate.

        Returns:
            A list of AnomalyResult, one per input reading.

        Raises:
            RuntimeError: If the model has not been trained.
        """
        if not self._is_trained or self._feature_means is None or self._feature_stds is None:
            raise RuntimeError("Model must be trained before detecting anomalies")

        if len(readings) == 0:
            return []

        x = _readings_to_matrix(readings)
        x_scaled = (x - self._feature_means) / self._feature_stds

        predictions = self._model.predict(x_scaled)  # 1 = normal, -1 = anomaly
        scores = self._model.decision_function(x_scaled)

        results: list[AnomalyResult] = []
        for i, reading in enumerate(readings):
            is_anomaly = int(predictions[i]) == -1
            contributing: list[str] = []

            if is_anomaly:
                # Identify which features contribute most to the anomaly
                deviations = np.abs(x_scaled[i])
                top_indices = np.argsort(deviations)[::-1]
                for idx in top_indices:
                    if deviations[idx] > 1.5:
                        contributing.append(_FEATURE_NAMES[idx])

            results.append(
                AnomalyResult(
                    reading=reading,
                    is_anomaly=is_anomaly,
                    anomaly_score=float(scores[i]),
                    contributing_features=contributing,
                )
            )

        return results
