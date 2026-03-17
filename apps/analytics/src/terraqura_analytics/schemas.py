"""Pydantic models and schemas for request/response types."""

from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Interval(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class LeaderboardMetric(str, Enum):
    RETIRED = "retired"
    VERIFIED = "verified"
    TRADED = "traded"


class CarbonIntensityCategory(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    VERY_HIGH = "very_high"


class VerificationStatus(str, Enum):
    UNVERIFIED = "unverified"
    PENDING = "pending"
    VERIFIED = "verified"
    REVOKED = "revoked"


class Methodology(str, Enum):
    DAC = "dac"
    REFORESTATION = "reforestation"
    SOIL_CARBON = "soil_carbon"
    BIOCHAR = "biochar"
    ENHANCED_WEATHERING = "enhanced_weathering"
    OCEAN_ALKALINITY = "ocean_alkalinity"


# ---------------------------------------------------------------------------
# Price prediction
# ---------------------------------------------------------------------------

class PriceDataPoint(BaseModel):
    """A single historical price observation."""
    timestamp: datetime
    price: float = Field(ge=0, description="Price in AETH")
    volume: float = Field(ge=0, description="Trading volume in AETH")
    retirement_rate: float = Field(ge=0, le=1, description="Fraction of supply retired in period")
    total_supply: float = Field(ge=0, description="Total outstanding supply of credits")


class PricePrediction(BaseModel):
    """Result of a price prediction."""
    predicted_price: float
    lower_bound: float
    upper_bound: float
    confidence: float = Field(ge=0, le=1)
    horizon_days: int
    model_used: str
    generated_at: datetime


class PricePredictionRequest(BaseModel):
    horizon_days: int = Field(ge=1, le=365, default=30)
    historical_data: list[PriceDataPoint] = Field(min_length=5)


class TrainingResult(BaseModel):
    """Result of training a price model."""
    r2_score: float
    rmse: float
    samples_used: int
    model_name: str
    trained_at: datetime


# ---------------------------------------------------------------------------
# Anomaly detection
# ---------------------------------------------------------------------------

class SensorReading(BaseModel):
    """A single DAC unit sensor reading."""
    timestamp: datetime
    unit_id: str
    co2_capture_rate: float = Field(description="kg CO2 per hour")
    energy_consumption: float = Field(description="kWh")
    flow_rate: float = Field(description="m3/h")
    temperature: float = Field(description="Celsius")
    pressure: float = Field(description="bar")


class AnomalyResult(BaseModel):
    """Result for one sensor reading."""
    reading: SensorReading
    is_anomaly: bool
    anomaly_score: float = Field(description="Negative = more anomalous (isolation forest convention)")
    contributing_features: list[str] = Field(default_factory=list)


class AnomalyDetectionRequest(BaseModel):
    readings: list[SensorReading] = Field(min_length=1)


class AnomalyDetectionResponse(BaseModel):
    results: list[AnomalyResult]
    anomaly_count: int
    total_readings: int


# ---------------------------------------------------------------------------
# Impact
# ---------------------------------------------------------------------------

class ImpactEquivalencies(BaseModel):
    """EPA-style equivalency metrics for a given quantity of CO2."""
    tonnes_co2: float
    trees_planted: float = Field(description="Equivalent mature trees grown for 10 years")
    cars_removed: float = Field(description="Passenger vehicles removed for one year")
    homes_powered: float = Field(description="Homes' electricity use for one year")
    flights_offset: float = Field(description="One-way transatlantic flights offset")
    gallons_gasoline: float = Field(description="Equivalent gallons of gasoline not consumed")
    carbon_intensity: CarbonIntensityCategory


class ImpactRequest(BaseModel):
    tonnes_co2: float = Field(gt=0)


class CreditHolding(BaseModel):
    """A single credit holding in a portfolio."""
    credit_id: str
    tonnes_co2: float = Field(ge=0)
    vintage_year: int = Field(ge=2000, le=2100)
    methodology: Methodology
    verification_status: VerificationStatus
    purchase_price: float = Field(ge=0, description="Purchase price in AETH per tonne")
    current_price: float = Field(ge=0, description="Current market price in AETH per tonne")


class PortfolioScore(BaseModel):
    """Aggregate portfolio impact and quality assessment."""
    total_tonnes_co2: float
    weighted_quality_score: float = Field(ge=0, le=100)
    methodology_diversity: float = Field(ge=0, le=1)
    average_vintage_age: float
    impact: ImpactEquivalencies
    risk_rating: str


# ---------------------------------------------------------------------------
# Protocol stats
# ---------------------------------------------------------------------------

class ProtocolStats(BaseModel):
    total_supply: float
    total_retired: float
    total_verified: float
    average_price: float
    total_volume_24h: float
    active_projects: int
    timestamp: datetime


class PricePoint(BaseModel):
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class LeaderboardEntry(BaseModel):
    rank: int
    address: str
    value: float
    label: str = ""


class LeaderboardRequest(BaseModel):
    metric: LeaderboardMetric = LeaderboardMetric.RETIRED
    limit: int = Field(ge=1, le=100, default=10)


# ---------------------------------------------------------------------------
# Risk
# ---------------------------------------------------------------------------

class RiskAssessment(BaseModel):
    credit_id: str
    quality_score: float = Field(ge=0, le=100)
    verification_score: float = Field(ge=0, le=100)
    methodology_score: float = Field(ge=0, le=100)
    vintage_score: float = Field(ge=0, le=100)
    overall_risk: str  # low / medium / high / critical
    details: dict[str, str] = Field(default_factory=dict)


class RiskAssessRequest(BaseModel):
    credit_id: str
    verification_status: VerificationStatus
    methodology: Methodology
    vintage_year: int = Field(ge=2000, le=2100)
    volume: float = Field(ge=0)


class ValueAtRisk(BaseModel):
    """Value at Risk result."""
    var_amount: float = Field(description="VaR in AETH")
    confidence: float
    holding_period_days: int
    portfolio_value: float
    expected_shortfall: float


class VaRRequest(BaseModel):
    portfolio: list[CreditHolding] = Field(min_length=1)
    confidence: float = Field(ge=0.9, le=0.999, default=0.95)
    holding_period_days: int = Field(ge=1, le=365, default=10)


# ---------------------------------------------------------------------------
# Common
# ---------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "ok"
    version: str
    timestamp: datetime


class ErrorResponse(BaseModel):
    detail: str
