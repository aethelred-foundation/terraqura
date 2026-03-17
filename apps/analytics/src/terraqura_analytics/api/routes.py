"""FastAPI router with all analytics endpoints."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from terraqura_analytics import __version__
from terraqura_analytics.models.anomaly_detection import SensorAnomalyDetector
from terraqura_analytics.models.carbon_price import CarbonPricePredictor
from terraqura_analytics.models.impact import ImpactCalculator
from terraqura_analytics.schemas import (
    AnomalyDetectionRequest,
    AnomalyDetectionResponse,
    HealthResponse,
    ImpactEquivalencies,
    ImpactRequest,
    Interval,
    LeaderboardEntry,
    LeaderboardMetric,
    LeaderboardRequest,
    PricePoint,
    PricePrediction,
    PricePredictionRequest,
    ProtocolStats,
    RiskAssessment,
    RiskAssessRequest,
    ValueAtRisk,
    VaRRequest,
)
from terraqura_analytics.services.analytics_service import AnalyticsService
from terraqura_analytics.services.risk_service import RiskAssessor


def create_router() -> APIRouter:
    """Build and return the API router with fresh service instances."""
    router = APIRouter()

    price_predictor = CarbonPricePredictor()
    anomaly_detector = SensorAnomalyDetector()
    impact_calculator = ImpactCalculator()
    analytics_service = AnalyticsService()
    risk_assessor = RiskAssessor()

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        """Health check endpoint."""
        return HealthResponse(
            status="ok",
            version=__version__,
            timestamp=datetime.now(timezone.utc),
        )

    @router.post("/predict/price", response_model=PricePrediction)
    async def predict_price(req: PricePredictionRequest) -> PricePrediction:
        """Predict future carbon credit price."""
        try:
            price_predictor.train(req.historical_data)
            return price_predictor.predict_price(req.horizon_days)
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/detect/anomalies", response_model=AnomalyDetectionResponse)
    async def detect_anomalies(req: AnomalyDetectionRequest) -> AnomalyDetectionResponse:
        """Detect anomalous DAC unit sensor readings."""
        readings = req.readings

        if not anomaly_detector.is_trained:
            if len(readings) < 10:
                raise HTTPException(
                    status_code=400,
                    detail="At least 10 readings required to train anomaly detector",
                )
            anomaly_detector.train(readings)

        try:
            results = anomaly_detector.detect_anomalies(readings)
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return AnomalyDetectionResponse(
            results=results,
            anomaly_count=sum(1 for r in results if r.is_anomaly),
            total_readings=len(results),
        )

    @router.post("/impact", response_model=ImpactEquivalencies)
    async def calculate_impact(req: ImpactRequest) -> ImpactEquivalencies:
        """Calculate EPA-equivalent environmental impact."""
        try:
            return impact_calculator.calculate_impact(req.tonnes_co2)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/stats/protocol", response_model=ProtocolStats)
    async def protocol_stats() -> ProtocolStats:
        """Get protocol-level aggregate statistics."""
        return await analytics_service.get_protocol_stats()

    @router.get("/stats/leaderboard", response_model=list[LeaderboardEntry])
    async def leaderboard(
        metric: LeaderboardMetric = Query(default=LeaderboardMetric.RETIRED),
        limit: int = Query(default=10, ge=1, le=100),
    ) -> list[LeaderboardEntry]:
        """Get ranked leaderboard for a given metric."""
        return await analytics_service.get_leaderboard(metric=metric, limit=limit)

    @router.post("/risk/assess", response_model=RiskAssessment)
    async def assess_risk(req: RiskAssessRequest) -> RiskAssessment:
        """Assess credit risk for a single carbon credit."""
        return risk_assessor.assess_credit_risk(
            credit_id=req.credit_id,
            verification_status=req.verification_status,
            methodology=req.methodology,
            vintage_year=req.vintage_year,
            volume=req.volume,
        )

    @router.post("/risk/var", response_model=ValueAtRisk)
    async def value_at_risk(req: VaRRequest) -> ValueAtRisk:
        """Calculate Value at Risk for a credit portfolio."""
        try:
            return risk_assessor.calculate_var(
                portfolio=req.portfolio,
                confidence=req.confidence,
                holding_period_days=req.holding_period_days,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
