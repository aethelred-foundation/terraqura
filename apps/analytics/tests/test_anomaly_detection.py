"""Tests for the SensorAnomalyDetector model."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from terraqura_analytics.models.anomaly_detection import SensorAnomalyDetector
from terraqura_analytics.schemas import SensorReading

from .conftest import make_sensor_readings


def _make_reading(**overrides) -> SensorReading:
    """Create a single sensor reading with optional field overrides."""
    defaults = {
        "timestamp": datetime.now(timezone.utc),
        "unit_id": "DAC-001",
        "co2_capture_rate": 50.0,
        "energy_consumption": 100.0,
        "flow_rate": 20.0,
        "temperature": 25.0,
        "pressure": 1.0,
    }
    defaults.update(overrides)
    return SensorReading(**defaults)


def _trained_detector(contamination: float = 0.05) -> SensorAnomalyDetector:
    """Return a detector trained on 500 normal readings for reliable results."""
    det = SensorAnomalyDetector(contamination=contamination)
    readings = make_sensor_readings(n=500, seed=42)
    det.train(readings)
    return det


class TestSensorAnomalyDetector:
    """Tests for the SensorAnomalyDetector class."""

    def test_not_trained_initially(self):
        det = SensorAnomalyDetector()
        assert det.is_trained is False

    def test_detect_before_training_raises(self):
        det = SensorAnomalyDetector()
        readings = [_make_reading()]
        with pytest.raises(RuntimeError, match="trained"):
            det.detect_anomalies(readings)

    def test_train_requires_minimum_data(self):
        det = SensorAnomalyDetector()
        readings = make_sensor_readings(n=5)
        with pytest.raises(ValueError, match="At least 10"):
            det.train(readings)

    def test_train_with_sufficient_data(self, sensor_readings):
        det = SensorAnomalyDetector()
        det.train(sensor_readings)
        assert det.is_trained is True

    def test_normal_readings_pass(self):
        det = _trained_detector()
        normal = make_sensor_readings(n=20, seed=99)
        results = det.detect_anomalies(normal)
        anomaly_count = sum(1 for r in results if r.is_anomaly)
        assert anomaly_count < len(results)  # not everything is anomalous

    def test_extreme_co2_detected(self):
        det = _trained_detector()
        # All features extremely out of range
        extreme = [_make_reading(
            co2_capture_rate=5000.0,
            energy_consumption=5000.0,
            flow_rate=-500.0,
            temperature=500.0,
            pressure=50.0,
        )]
        results = det.detect_anomalies(extreme)
        assert results[0].is_anomaly is True

    def test_negative_flow_rate_anomaly_score_lower(self):
        det = _trained_detector()
        normal_result = det.detect_anomalies([_make_reading()])[0]
        extreme_result = det.detect_anomalies([_make_reading(
            flow_rate=-500.0,
            co2_capture_rate=5000.0,
        )])[0]
        # Anomalous readings should have lower (more negative) scores
        assert extreme_result.anomaly_score < normal_result.anomaly_score

    def test_extreme_energy_anomaly_score_lower(self):
        det = _trained_detector()
        normal_result = det.detect_anomalies([_make_reading()])[0]
        extreme_result = det.detect_anomalies([_make_reading(
            energy_consumption=10000.0,
            co2_capture_rate=5000.0,
        )])[0]
        assert extreme_result.anomaly_score < normal_result.anomaly_score

    def test_extreme_temperature_anomaly_score_lower(self):
        det = _trained_detector()
        normal_result = det.detect_anomalies([_make_reading()])[0]
        extreme_result = det.detect_anomalies([_make_reading(
            temperature=1000.0,
            pressure=100.0,
        )])[0]
        assert extreme_result.anomaly_score < normal_result.anomaly_score

    def test_extreme_pressure_anomaly_score_lower(self):
        det = _trained_detector()
        normal_result = det.detect_anomalies([_make_reading()])[0]
        extreme_result = det.detect_anomalies([_make_reading(
            pressure=100.0,
            co2_capture_rate=5000.0,
        )])[0]
        assert extreme_result.anomaly_score < normal_result.anomaly_score

    def test_empty_list_returns_empty(self):
        det = _trained_detector()
        results = det.detect_anomalies([])
        assert results == []

    def test_single_normal_reading(self):
        det = _trained_detector()
        results = det.detect_anomalies([_make_reading()])
        assert len(results) == 1
        assert isinstance(results[0].anomaly_score, float)

    def test_anomaly_score_is_float(self):
        det = _trained_detector()
        results = det.detect_anomalies([_make_reading()])
        assert isinstance(results[0].anomaly_score, float)

    def test_contributing_features_populated_for_anomaly(self):
        det = _trained_detector()
        extreme = [_make_reading(
            co2_capture_rate=9999.0,
            energy_consumption=9999.0,
            flow_rate=-999.0,
            temperature=999.0,
            pressure=99.0,
        )]
        results = det.detect_anomalies(extreme)
        assert results[0].is_anomaly is True
        assert len(results[0].contributing_features) > 0

    def test_batch_detection(self):
        det = _trained_detector()
        readings = make_sensor_readings(n=50, include_anomalies=True)
        results = det.detect_anomalies(readings)
        assert len(results) == 50

    def test_contamination_parameter(self, sensor_readings):
        det = SensorAnomalyDetector(contamination=0.3)
        det.train(sensor_readings)
        results = det.detect_anomalies(sensor_readings)
        anomaly_count = sum(1 for r in results if r.is_anomaly)
        # With high contamination, more readings should be flagged
        assert anomaly_count > 0

    def test_result_preserves_reading(self):
        det = _trained_detector()
        reading = _make_reading(unit_id="DAC-TEST")
        results = det.detect_anomalies([reading])
        assert results[0].reading.unit_id == "DAC-TEST"
