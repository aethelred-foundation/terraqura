"""Risk assessment service for carbon credit portfolios."""

from __future__ import annotations

import math

import numpy as np

from terraqura_analytics.schemas import (
    CreditHolding,
    Methodology,
    RiskAssessment,
    ValueAtRisk,
    VerificationStatus,
)


# Methodology risk scores (lower = riskier)
_METHODOLOGY_SCORES: dict[Methodology, float] = {
    Methodology.DAC: 95.0,
    Methodology.BIOCHAR: 82.0,
    Methodology.ENHANCED_WEATHERING: 78.0,
    Methodology.OCEAN_ALKALINITY: 72.0,
    Methodology.REFORESTATION: 65.0,
    Methodology.SOIL_CARBON: 58.0,
}

_VERIFICATION_SCORES: dict[VerificationStatus, float] = {
    VerificationStatus.VERIFIED: 100.0,
    VerificationStatus.PENDING: 45.0,
    VerificationStatus.UNVERIFIED: 15.0,
    VerificationStatus.REVOKED: 0.0,
}

_CURRENT_YEAR = 2026


def _norm_ppf(p: float) -> float:
    """Approximate inverse of the standard normal CDF (percent-point function).

    Uses the Beasley-Springer-Moro algorithm which is accurate to ~1e-9
    for 0 < p < 1.
    """
    a = [
        -3.969683028665376e01,
        2.209460984245205e02,
        -2.759285104469687e02,
        1.383577518672690e02,
        -3.066479806614716e01,
        2.506628277459239e00,
    ]
    b = [
        -5.447609879822406e01,
        1.615858368580409e02,
        -1.556989798598866e02,
        6.680131188771972e01,
        -1.328068155288572e01,
    ]
    c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e00,
        -2.549732539343734e00,
        4.374664141464968e00,
        2.938163982698783e00,
    ]
    d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e00,
        3.754408661907416e00,
    ]

    p_low = 0.02425
    p_high = 1 - p_low

    if p < p_low:
        q = math.sqrt(-2 * math.log(p))
        return (
            ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
        ) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    elif p <= p_high:
        q = p - 0.5
        r = q * q
        return (
            (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
        ) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    else:
        q = math.sqrt(-2 * math.log(1 - p))
        return -(
            ((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]
        ) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)


def _vintage_score(vintage_year: int) -> float:
    """Score a credit's vintage year. Newer vintages score higher."""
    age = _CURRENT_YEAR - vintage_year
    return max(0.0, min(100.0, 100.0 - age * 6.0))


def _overall_risk_label(score: float) -> str:
    if score >= 80:
        return "low"
    if score >= 60:
        return "medium"
    if score >= 40:
        return "high"
    return "critical"


class RiskAssessor:
    """Assess credit quality and portfolio market risk."""

    def assess_credit_risk(
        self,
        credit_id: str,
        verification_status: VerificationStatus,
        methodology: Methodology,
        vintage_year: int,
        volume: float,
    ) -> RiskAssessment:
        """Produce a risk assessment for a single credit.

        Args:
            credit_id: Unique identifier of the credit.
            verification_status: Current verification state.
            methodology: Carbon removal methodology used.
            vintage_year: Year the credit was issued.
            volume: Tonnes of CO2 represented by the credit.

        Returns:
            A detailed risk assessment with component scores.
        """
        ver_score = _VERIFICATION_SCORES.get(verification_status, 0.0)
        meth_score = _METHODOLOGY_SCORES.get(methodology, 50.0)
        vint_score = _vintage_score(vintage_year)

        quality = 0.35 * ver_score + 0.40 * meth_score + 0.25 * vint_score

        details: dict[str, str] = {}
        if ver_score < 50:
            details["verification"] = "Credit is not fully verified -- elevated risk"
        if vint_score < 40:
            details["vintage"] = f"Vintage {vintage_year} is aging -- consider replacement"
        if volume > 10_000:
            details["concentration"] = "Large single-credit position increases concentration risk"

        return RiskAssessment(
            credit_id=credit_id,
            quality_score=round(quality, 2),
            verification_score=ver_score,
            methodology_score=meth_score,
            vintage_score=round(vint_score, 2),
            overall_risk=_overall_risk_label(quality),
            details=details,
        )

    def calculate_var(
        self,
        portfolio: list[CreditHolding],
        confidence: float = 0.95,
        holding_period_days: int = 10,
    ) -> ValueAtRisk:
        """Calculate parametric Value at Risk for a credit portfolio.

        Assumes log-normal price returns and uses the variance-covariance
        method for simplicity.

        Args:
            portfolio: List of credit holdings with current and purchase prices.
            confidence: Confidence level (e.g. 0.95 or 0.99).
            holding_period_days: Holding period in days.

        Returns:
            VaR and expected shortfall metrics.

        Raises:
            ValueError: If confidence or holding period is out of range, or
                portfolio is empty.
        """
        if not portfolio:
            raise ValueError("Portfolio must contain at least one holding")
        if not (0.9 <= confidence <= 0.999):
            raise ValueError("Confidence must be between 0.9 and 0.999")
        if holding_period_days < 1:
            raise ValueError("Holding period must be at least 1 day")

        portfolio_value = sum(c.current_price * c.tonnes_co2 for c in portfolio)
        if portfolio_value <= 0:
            return ValueAtRisk(
                var_amount=0.0,
                confidence=confidence,
                holding_period_days=holding_period_days,
                portfolio_value=0.0,
                expected_shortfall=0.0,
            )

        # Estimate daily volatility from price changes
        returns: list[float] = []
        for c in portfolio:
            if c.purchase_price > 0:
                ret = math.log(c.current_price / c.purchase_price)
                returns.append(ret)
            else:
                returns.append(0.0)

        # Weight by position size
        weights = np.array(
            [c.current_price * c.tonnes_co2 / portfolio_value for c in portfolio]
        )
        ret_arr = np.array(returns)

        portfolio_return = float(np.dot(weights, ret_arr))
        portfolio_vol = float(np.sqrt(np.dot(weights**2, ret_arr**2)))

        # If all prices are identical, use a small default volatility
        if portfolio_vol < 1e-10:
            portfolio_vol = 0.02

        # Scale to holding period
        scaled_vol = portfolio_vol * math.sqrt(holding_period_days)

        # Z-score for confidence level (rational approximation of inverse normal CDF)
        z = _norm_ppf(confidence)

        var_amount = portfolio_value * z * scaled_vol

        # Expected shortfall (conditional VaR)
        pdf_z = math.exp(-0.5 * z * z) / math.sqrt(2 * math.pi)
        es = portfolio_value * scaled_vol * pdf_z / (1 - confidence)

        return ValueAtRisk(
            var_amount=round(var_amount, 4),
            confidence=confidence,
            holding_period_days=holding_period_days,
            portfolio_value=round(portfolio_value, 4),
            expected_shortfall=round(es, 4),
        )
