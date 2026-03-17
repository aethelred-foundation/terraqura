"""Tests for the FastAPI endpoints."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from terraqura_analytics.api.app import create_app
from terraqura_analytics.schemas import Methodology, VerificationStatus

from .conftest import make_price_data, make_sensor_readings


@pytest.fixture()
def client():
    app = create_app()
    return TestClient(app)


PREFIX = "/api/v1"


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get(f"{PREFIX}/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "version" in data
        assert "timestamp" in data


class TestPredictPrice:
    def _payload(self, n: int = 30, horizon: int = 7):
        data = make_price_data(n=n)
        return {
            "horizon_days": horizon,
            "historical_data": [
                {
                    "timestamp": dp.timestamp.isoformat(),
                    "price": dp.price,
                    "volume": dp.volume,
                    "retirement_rate": dp.retirement_rate,
                    "total_supply": dp.total_supply,
                }
                for dp in data
            ],
        }

    def test_predict_success(self, client):
        resp = client.post(f"{PREFIX}/predict/price", json=self._payload())
        assert resp.status_code == 200
        data = resp.json()
        assert "predicted_price" in data
        assert data["predicted_price"] >= 0
        assert data["lower_bound"] <= data["predicted_price"]
        assert data["upper_bound"] >= data["predicted_price"]

    def test_predict_horizon_1(self, client):
        resp = client.post(f"{PREFIX}/predict/price", json=self._payload(horizon=1))
        assert resp.status_code == 200

    def test_predict_horizon_365(self, client):
        resp = client.post(f"{PREFIX}/predict/price", json=self._payload(horizon=365))
        assert resp.status_code == 200

    def test_predict_insufficient_data(self, client):
        resp = client.post(f"{PREFIX}/predict/price", json=self._payload(n=3))
        assert resp.status_code == 422  # Pydantic validation (min_length=5)

    def test_predict_invalid_horizon(self, client):
        payload = self._payload()
        payload["horizon_days"] = 0
        resp = client.post(f"{PREFIX}/predict/price", json=payload)
        assert resp.status_code == 422


class TestDetectAnomalies:
    def _payload(self, n: int = 20, include_anomalies: bool = False):
        readings = make_sensor_readings(n=n, include_anomalies=include_anomalies)
        return {
            "readings": [
                {
                    "timestamp": r.timestamp.isoformat(),
                    "unit_id": r.unit_id,
                    "co2_capture_rate": r.co2_capture_rate,
                    "energy_consumption": r.energy_consumption,
                    "flow_rate": r.flow_rate,
                    "temperature": r.temperature,
                    "pressure": r.pressure,
                }
                for r in readings
            ]
        }

    def test_detect_success(self, client):
        resp = client.post(f"{PREFIX}/detect/anomalies", json=self._payload())
        assert resp.status_code == 200
        data = resp.json()
        assert "results" in data
        assert data["total_readings"] == 20

    def test_detect_with_anomalies(self, client):
        resp = client.post(
            f"{PREFIX}/detect/anomalies",
            json=self._payload(n=50, include_anomalies=True),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["anomaly_count"] >= 0

    def test_detect_too_few_readings(self, client):
        resp = client.post(f"{PREFIX}/detect/anomalies", json=self._payload(n=3))
        assert resp.status_code == 400

    def test_detect_empty_readings(self, client):
        resp = client.post(f"{PREFIX}/detect/anomalies", json={"readings": []})
        assert resp.status_code == 422


class TestImpactEndpoint:
    def test_impact_success(self, client):
        resp = client.post(f"{PREFIX}/impact", json={"tonnes_co2": 100.0})
        assert resp.status_code == 200
        data = resp.json()
        assert data["tonnes_co2"] == 100.0
        assert data["trees_planted"] > 0

    def test_impact_small(self, client):
        resp = client.post(f"{PREFIX}/impact", json={"tonnes_co2": 0.5})
        assert resp.status_code == 200

    def test_impact_zero_rejected(self, client):
        resp = client.post(f"{PREFIX}/impact", json={"tonnes_co2": 0.0})
        assert resp.status_code == 422

    def test_impact_negative_rejected(self, client):
        resp = client.post(f"{PREFIX}/impact", json={"tonnes_co2": -10.0})
        assert resp.status_code == 422


class TestProtocolStats:
    def test_stats_success(self, client):
        resp = client.get(f"{PREFIX}/stats/protocol")
        assert resp.status_code == 200
        data = resp.json()
        assert "total_supply" in data
        assert "total_retired" in data
        assert "average_price" in data


class TestLeaderboard:
    def test_leaderboard_default(self, client):
        resp = client.get(f"{PREFIX}/stats/leaderboard")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) == 10

    def test_leaderboard_limit(self, client):
        resp = client.get(f"{PREFIX}/stats/leaderboard?limit=5")
        assert resp.status_code == 200
        assert len(resp.json()) == 5

    def test_leaderboard_metric_verified(self, client):
        resp = client.get(f"{PREFIX}/stats/leaderboard?metric=verified")
        assert resp.status_code == 200


class TestRiskAssess:
    def test_assess_success(self, client):
        payload = {
            "credit_id": "TQ-001",
            "verification_status": "verified",
            "methodology": "dac",
            "vintage_year": 2025,
            "volume": 100,
        }
        resp = client.post(f"{PREFIX}/risk/assess", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["credit_id"] == "TQ-001"
        assert 0 <= data["quality_score"] <= 100

    def test_assess_invalid_methodology(self, client):
        payload = {
            "credit_id": "TQ-001",
            "verification_status": "verified",
            "methodology": "magic",
            "vintage_year": 2025,
            "volume": 100,
        }
        resp = client.post(f"{PREFIX}/risk/assess", json=payload)
        assert resp.status_code == 422


class TestValueAtRisk:
    def _holding(self, **overrides):
        defaults = {
            "credit_id": "TQ-001",
            "tonnes_co2": 100,
            "vintage_year": 2025,
            "methodology": "dac",
            "verification_status": "verified",
            "purchase_price": 20.0,
            "current_price": 25.0,
        }
        defaults.update(overrides)
        return defaults

    def test_var_success(self, client):
        payload = {
            "portfolio": [self._holding()],
            "confidence": 0.95,
            "holding_period_days": 10,
        }
        resp = client.post(f"{PREFIX}/risk/var", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["var_amount"] >= 0
        assert data["confidence"] == 0.95

    def test_var_empty_portfolio(self, client):
        payload = {"portfolio": [], "confidence": 0.95}
        resp = client.post(f"{PREFIX}/risk/var", json=payload)
        assert resp.status_code == 422

    def test_var_invalid_confidence(self, client):
        payload = {
            "portfolio": [self._holding()],
            "confidence": 0.5,
        }
        resp = client.post(f"{PREFIX}/risk/var", json=payload)
        assert resp.status_code == 422
