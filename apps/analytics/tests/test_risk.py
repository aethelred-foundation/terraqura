"""Tests for the RiskAssessor service."""

from __future__ import annotations

import pytest

from terraqura_analytics.schemas import (
    CreditHolding,
    Methodology,
    VerificationStatus,
)
from terraqura_analytics.services.risk_service import RiskAssessor

from .conftest import make_credit_holdings


@pytest.fixture()
def assessor() -> RiskAssessor:
    return RiskAssessor()


class TestAssessCreditRisk:
    """Tests for RiskAssessor.assess_credit_risk."""

    def test_verified_dac_is_low_risk(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-001",
            verification_status=VerificationStatus.VERIFIED,
            methodology=Methodology.DAC,
            vintage_year=2026,
            volume=100,
        )
        assert result.overall_risk == "low"
        assert result.quality_score > 80

    def test_unverified_old_is_high_risk(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-002",
            verification_status=VerificationStatus.UNVERIFIED,
            methodology=Methodology.SOIL_CARBON,
            vintage_year=2010,
            volume=100,
        )
        assert result.overall_risk in ("high", "critical")

    def test_revoked_is_critical(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-003",
            verification_status=VerificationStatus.REVOKED,
            methodology=Methodology.REFORESTATION,
            vintage_year=2020,
            volume=100,
        )
        assert result.overall_risk in ("high", "critical")
        assert result.verification_score == 0.0

    def test_component_scores_in_range(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-004",
            verification_status=VerificationStatus.PENDING,
            methodology=Methodology.BIOCHAR,
            vintage_year=2024,
            volume=50,
        )
        assert 0 <= result.verification_score <= 100
        assert 0 <= result.methodology_score <= 100
        assert 0 <= result.vintage_score <= 100
        assert 0 <= result.quality_score <= 100

    def test_concentration_risk_detail(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-005",
            verification_status=VerificationStatus.VERIFIED,
            methodology=Methodology.DAC,
            vintage_year=2025,
            volume=50_000,
        )
        assert "concentration" in result.details

    def test_old_vintage_detail(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-006",
            verification_status=VerificationStatus.VERIFIED,
            methodology=Methodology.DAC,
            vintage_year=2005,
            volume=100,
        )
        assert "vintage" in result.details

    def test_verification_detail_for_unverified(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="TQ-007",
            verification_status=VerificationStatus.UNVERIFIED,
            methodology=Methodology.REFORESTATION,
            vintage_year=2025,
            volume=100,
        )
        assert "verification" in result.details

    def test_credit_id_preserved(self, assessor):
        result = assessor.assess_credit_risk(
            credit_id="MY-CREDIT-ID",
            verification_status=VerificationStatus.VERIFIED,
            methodology=Methodology.DAC,
            vintage_year=2026,
            volume=100,
        )
        assert result.credit_id == "MY-CREDIT-ID"


class TestCalculateVaR:
    """Tests for RiskAssessor.calculate_var."""

    def test_basic_var(self, assessor, credit_holdings):
        result = assessor.calculate_var(credit_holdings, confidence=0.95)
        assert result.var_amount >= 0
        assert result.confidence == 0.95
        assert result.portfolio_value > 0

    def test_empty_portfolio_raises(self, assessor):
        with pytest.raises(ValueError, match="at least one"):
            assessor.calculate_var([], confidence=0.95)

    def test_invalid_confidence_low(self, assessor, credit_holdings):
        with pytest.raises(ValueError, match="Confidence"):
            assessor.calculate_var(credit_holdings, confidence=0.5)

    def test_invalid_confidence_high(self, assessor, credit_holdings):
        with pytest.raises(ValueError, match="Confidence"):
            assessor.calculate_var(credit_holdings, confidence=1.0)

    def test_higher_confidence_higher_var(self, assessor, credit_holdings):
        var_95 = assessor.calculate_var(credit_holdings, confidence=0.95)
        var_99 = assessor.calculate_var(credit_holdings, confidence=0.99)
        assert var_99.var_amount >= var_95.var_amount

    def test_longer_horizon_higher_var(self, assessor, credit_holdings):
        var_1d = assessor.calculate_var(credit_holdings, holding_period_days=1)
        var_30d = assessor.calculate_var(credit_holdings, holding_period_days=30)
        assert var_30d.var_amount >= var_1d.var_amount

    def test_expected_shortfall_positive(self, assessor, credit_holdings):
        result = assessor.calculate_var(credit_holdings, confidence=0.95)
        assert result.expected_shortfall >= 0

    def test_zero_price_portfolio(self, assessor):
        holding = CreditHolding(
            credit_id="TQ-ZERO",
            tonnes_co2=100,
            vintage_year=2025,
            methodology=Methodology.DAC,
            verification_status=VerificationStatus.VERIFIED,
            purchase_price=0,
            current_price=0,
        )
        result = assessor.calculate_var([holding], confidence=0.95)
        assert result.portfolio_value == 0.0
        assert result.var_amount == 0.0

    def test_holding_period_days_preserved(self, assessor, credit_holdings):
        result = assessor.calculate_var(credit_holdings, holding_period_days=7)
        assert result.holding_period_days == 7

    def test_single_holding(self, assessor):
        holding = CreditHolding(
            credit_id="TQ-SINGLE",
            tonnes_co2=500,
            vintage_year=2025,
            methodology=Methodology.DAC,
            verification_status=VerificationStatus.VERIFIED,
            purchase_price=20.0,
            current_price=25.0,
        )
        result = assessor.calculate_var([holding], confidence=0.95)
        assert result.portfolio_value == pytest.approx(25.0 * 500, rel=0.01)
