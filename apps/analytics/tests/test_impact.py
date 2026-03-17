"""Tests for the ImpactCalculator model."""

from __future__ import annotations

import pytest

from terraqura_analytics.models.impact import (
    ImpactCalculator,
    _CARS_PER_TONNE,
    _FLIGHTS_PER_TONNE,
    _GALLONS_GASOLINE_PER_TONNE,
    _HOMES_PER_TONNE,
    _TREES_PER_TONNE,
)
from terraqura_analytics.schemas import (
    CarbonIntensityCategory,
    CreditHolding,
    Methodology,
    VerificationStatus,
)


@pytest.fixture()
def calculator() -> ImpactCalculator:
    return ImpactCalculator()


class TestCalculateImpact:
    """Tests for ImpactCalculator.calculate_impact."""

    def test_one_tonne_trees(self, calculator):
        result = calculator.calculate_impact(1.0)
        assert result.trees_planted == pytest.approx(_TREES_PER_TONNE, rel=0.01)

    def test_one_tonne_cars(self, calculator):
        result = calculator.calculate_impact(1.0)
        assert result.cars_removed == pytest.approx(_CARS_PER_TONNE, rel=0.01)

    def test_one_tonne_homes(self, calculator):
        result = calculator.calculate_impact(1.0)
        assert result.homes_powered == pytest.approx(_HOMES_PER_TONNE, rel=0.01)

    def test_one_tonne_flights(self, calculator):
        result = calculator.calculate_impact(1.0)
        assert result.flights_offset == pytest.approx(_FLIGHTS_PER_TONNE, rel=0.01)

    def test_one_tonne_gallons(self, calculator):
        result = calculator.calculate_impact(1.0)
        assert result.gallons_gasoline == pytest.approx(_GALLONS_GASOLINE_PER_TONNE, rel=0.01)

    def test_zero_tonnes(self, calculator):
        result = calculator.calculate_impact(0.0)
        assert result.trees_planted == 0.0
        assert result.cars_removed == 0.0
        assert result.homes_powered == 0.0

    def test_negative_tonnes_raises(self, calculator):
        with pytest.raises(ValueError, match="non-negative"):
            calculator.calculate_impact(-1.0)

    def test_large_scale(self, calculator):
        result = calculator.calculate_impact(1_000_000.0)
        assert result.trees_planted > 0
        assert result.cars_removed > 0

    def test_linearity(self, calculator):
        r1 = calculator.calculate_impact(10.0)
        r2 = calculator.calculate_impact(20.0)
        assert r2.trees_planted == pytest.approx(r1.trees_planted * 2, rel=0.01)

    def test_carbon_intensity_low(self, calculator):
        result = calculator.calculate_impact(5.0)
        assert result.carbon_intensity == CarbonIntensityCategory.LOW

    def test_carbon_intensity_medium(self, calculator):
        result = calculator.calculate_impact(50.0)
        assert result.carbon_intensity == CarbonIntensityCategory.MEDIUM

    def test_carbon_intensity_high(self, calculator):
        result = calculator.calculate_impact(500.0)
        assert result.carbon_intensity == CarbonIntensityCategory.HIGH

    def test_carbon_intensity_very_high(self, calculator):
        result = calculator.calculate_impact(5000.0)
        assert result.carbon_intensity == CarbonIntensityCategory.VERY_HIGH

    def test_tonnes_co2_echoed(self, calculator):
        result = calculator.calculate_impact(42.5)
        assert result.tonnes_co2 == 42.5

    def test_small_fractional_value(self, calculator):
        result = calculator.calculate_impact(0.001)
        assert result.trees_planted >= 0
        assert result.cars_removed >= 0


class TestScorePortfolio:
    """Tests for ImpactCalculator.score_portfolio."""

    def _make_holding(self, **overrides) -> CreditHolding:
        defaults = {
            "credit_id": "TQ-000001",
            "tonnes_co2": 100.0,
            "vintage_year": 2025,
            "methodology": Methodology.DAC,
            "verification_status": VerificationStatus.VERIFIED,
            "purchase_price": 20.0,
            "current_price": 25.0,
        }
        defaults.update(overrides)
        return CreditHolding(**defaults)

    def test_empty_portfolio_raises(self, calculator):
        with pytest.raises(ValueError, match="at least one"):
            calculator.score_portfolio([])

    def test_single_high_quality_credit(self, calculator):
        holding = self._make_holding(
            methodology=Methodology.DAC,
            verification_status=VerificationStatus.VERIFIED,
            vintage_year=2026,
        )
        score = calculator.score_portfolio([holding])
        assert score.weighted_quality_score > 80

    def test_single_low_quality_credit(self, calculator):
        holding = self._make_holding(
            methodology=Methodology.SOIL_CARBON,
            verification_status=VerificationStatus.UNVERIFIED,
            vintage_year=2010,
        )
        score = calculator.score_portfolio([holding])
        assert score.weighted_quality_score < 50

    def test_total_tonnes(self, calculator):
        holdings = [
            self._make_holding(tonnes_co2=100),
            self._make_holding(credit_id="TQ-2", tonnes_co2=200),
        ]
        score = calculator.score_portfolio(holdings)
        assert score.total_tonnes_co2 == 300.0

    def test_methodology_diversity_single(self, calculator):
        score = calculator.score_portfolio([self._make_holding()])
        assert score.methodology_diversity == pytest.approx(1 / len(Methodology), rel=0.01)

    def test_methodology_diversity_multiple(self, calculator):
        holdings = [
            self._make_holding(credit_id="TQ-1", methodology=Methodology.DAC),
            self._make_holding(credit_id="TQ-2", methodology=Methodology.BIOCHAR),
            self._make_holding(credit_id="TQ-3", methodology=Methodology.REFORESTATION),
        ]
        score = calculator.score_portfolio(holdings)
        assert score.methodology_diversity == pytest.approx(3 / len(Methodology), rel=0.01)

    def test_impact_included(self, calculator):
        score = calculator.score_portfolio([self._make_holding(tonnes_co2=50)])
        assert score.impact.tonnes_co2 == 50.0
        assert score.impact.trees_planted > 0

    def test_risk_rating_low(self, calculator):
        holding = self._make_holding(
            methodology=Methodology.DAC,
            verification_status=VerificationStatus.VERIFIED,
            vintage_year=2026,
        )
        score = calculator.score_portfolio([holding])
        assert score.risk_rating == "low"

    def test_risk_rating_critical(self, calculator):
        holding = self._make_holding(
            methodology=Methodology.SOIL_CARBON,
            verification_status=VerificationStatus.REVOKED,
            vintage_year=2005,
        )
        score = calculator.score_portfolio([holding])
        assert score.risk_rating == "critical"

    def test_average_vintage_age(self, calculator):
        holdings = [
            self._make_holding(credit_id="TQ-1", vintage_year=2024),
            self._make_holding(credit_id="TQ-2", vintage_year=2022),
        ]
        score = calculator.score_portfolio(holdings)
        # (2026-2024 + 2026-2022) / 2 = (2+4)/2 = 3
        assert score.average_vintage_age == pytest.approx(3.0, rel=0.01)
