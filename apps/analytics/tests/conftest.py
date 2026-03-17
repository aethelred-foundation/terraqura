"""Shared fixtures and mock data generators for TerraQura analytics tests."""

from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from terraqura_analytics.api.app import create_app
from terraqura_analytics.schemas import (
    CreditHolding,
    Methodology,
    PriceDataPoint,
    SensorReading,
    VerificationStatus,
)


@pytest.fixture()
def app():
    """Create a fresh FastAPI application for each test."""
    return create_app()


@pytest.fixture()
def client(app):
    """Synchronous test client."""
    return TestClient(app)


def make_price_data(
    n: int = 30,
    base_price: float = 20.0,
    seed: int = 42,
) -> list[PriceDataPoint]:
    """Generate deterministic synthetic price data."""
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    data: list[PriceDataPoint] = []
    price = base_price

    for i in range(n):
        price = max(0.01, price + rng.gauss(0.05, 0.5))
        data.append(
            PriceDataPoint(
                timestamp=now - timedelta(days=n - i),
                price=round(price, 4),
                volume=round(max(0, 500 + rng.gauss(0, 100)), 2),
                retirement_rate=round(rng.uniform(0.01, 0.1), 4),
                total_supply=round(1_000_000 + rng.gauss(0, 10_000), 2),
            )
        )

    return data


def make_sensor_readings(
    n: int = 50,
    seed: int = 42,
    include_anomalies: bool = False,
) -> list[SensorReading]:
    """Generate synthetic DAC sensor readings.

    Normal ranges:
        co2_capture_rate: 40-60 kg/h
        energy_consumption: 90-110 kWh
        flow_rate: 18-22 m3/h
        temperature: 20-30 C
        pressure: 0.9-1.1 bar
    """
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    readings: list[SensorReading] = []

    for i in range(n):
        reading = SensorReading(
            timestamp=now - timedelta(minutes=n - i),
            unit_id=f"DAC-{rng.randint(1, 5):03d}",
            co2_capture_rate=round(rng.gauss(50, 3), 2),
            energy_consumption=round(rng.gauss(100, 5), 2),
            flow_rate=round(rng.gauss(20, 1), 2),
            temperature=round(rng.gauss(25, 2), 2),
            pressure=round(rng.gauss(1.0, 0.05), 4),
        )
        readings.append(reading)

    if include_anomalies and n >= 5:
        # Inject some clearly anomalous readings
        anomalous_indices = [n - 1, n - 2, n - 3]
        for idx in anomalous_indices:
            if idx < len(readings):
                readings[idx] = SensorReading(
                    timestamp=readings[idx].timestamp,
                    unit_id=readings[idx].unit_id,
                    co2_capture_rate=200.0,  # way too high
                    energy_consumption=500.0,  # way too high
                    flow_rate=-5.0,  # negative
                    temperature=90.0,  # way too high
                    pressure=5.0,  # way too high
                )

    return readings


def make_credit_holdings(
    n: int = 5,
    seed: int = 42,
) -> list[CreditHolding]:
    """Generate synthetic credit portfolio holdings."""
    rng = random.Random(seed)
    methodologies = list(Methodology)
    holdings: list[CreditHolding] = []

    for i in range(n):
        purchase = round(rng.uniform(10, 40), 2)
        current = round(purchase * rng.uniform(0.8, 1.3), 2)
        holdings.append(
            CreditHolding(
                credit_id=f"TQ-{i + 1:06d}",
                tonnes_co2=round(rng.uniform(10, 500), 2),
                vintage_year=rng.randint(2020, 2026),
                methodology=rng.choice(methodologies),
                verification_status=VerificationStatus.VERIFIED,
                purchase_price=purchase,
                current_price=current,
            )
        )

    return holdings


@pytest.fixture()
def price_data() -> list[PriceDataPoint]:
    return make_price_data()


@pytest.fixture()
def sensor_readings() -> list[SensorReading]:
    return make_sensor_readings()


@pytest.fixture()
def anomalous_readings() -> list[SensorReading]:
    return make_sensor_readings(include_anomalies=True)


@pytest.fixture()
def credit_holdings() -> list[CreditHolding]:
    return make_credit_holdings()
