"""Environmental impact calculator using EPA equivalency factors."""

from __future__ import annotations

from terraqura_analytics.schemas import (
    CarbonIntensityCategory,
    CreditHolding,
    ImpactEquivalencies,
    Methodology,
    PortfolioScore,
    VerificationStatus,
)


# EPA equivalency factors per metric tonne of CO2
# Source: https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator
_TREES_PER_TONNE = 16.5  # seedlings grown for 10 years
_CARS_PER_TONNE = 1.0 / 4.6  # avg passenger vehicle emits 4.6 t/yr
_HOMES_PER_TONNE = 1.0 / 7.72  # avg US home electricity = 7.72 t/yr
_FLIGHTS_PER_TONNE = 1.0 / 1.6  # one-way transatlantic ~ 1.6 t
_GALLONS_GASOLINE_PER_TONNE = 1.0 / 0.00887  # 8.887 kg CO2 per gallon

# Methodology quality weights (higher = higher quality removal)
_METHODOLOGY_WEIGHTS: dict[Methodology, float] = {
    Methodology.DAC: 95.0,
    Methodology.BIOCHAR: 80.0,
    Methodology.ENHANCED_WEATHERING: 78.0,
    Methodology.OCEAN_ALKALINITY: 75.0,
    Methodology.REFORESTATION: 60.0,
    Methodology.SOIL_CARBON: 55.0,
}

_VERIFICATION_WEIGHTS: dict[VerificationStatus, float] = {
    VerificationStatus.VERIFIED: 100.0,
    VerificationStatus.PENDING: 50.0,
    VerificationStatus.UNVERIFIED: 20.0,
    VerificationStatus.REVOKED: 0.0,
}


def _carbon_intensity_category(tonnes: float) -> CarbonIntensityCategory:
    """Classify the absolute amount of CO2 into an intensity category."""
    if tonnes < 10:
        return CarbonIntensityCategory.LOW
    if tonnes < 100:
        return CarbonIntensityCategory.MEDIUM
    if tonnes < 1000:
        return CarbonIntensityCategory.HIGH
    return CarbonIntensityCategory.VERY_HIGH


class ImpactCalculator:
    """Calculate EPA-equivalent environmental impact metrics."""

    def calculate_impact(self, tonnes_co2: float) -> ImpactEquivalencies:
        """Compute EPA equivalency metrics for the given CO2 quantity.

        Args:
            tonnes_co2: Metric tonnes of CO2 offset.

        Returns:
            Equivalency metrics for the supplied amount.

        Raises:
            ValueError: If tonnes_co2 is negative.
        """
        if tonnes_co2 < 0:
            raise ValueError("tonnes_co2 must be non-negative")

        return ImpactEquivalencies(
            tonnes_co2=tonnes_co2,
            trees_planted=round(tonnes_co2 * _TREES_PER_TONNE, 2),
            cars_removed=round(tonnes_co2 * _CARS_PER_TONNE, 4),
            homes_powered=round(tonnes_co2 * _HOMES_PER_TONNE, 4),
            flights_offset=round(tonnes_co2 * _FLIGHTS_PER_TONNE, 4),
            gallons_gasoline=round(tonnes_co2 * _GALLONS_GASOLINE_PER_TONNE, 2),
            carbon_intensity=_carbon_intensity_category(tonnes_co2),
        )

    def score_portfolio(self, credits: list[CreditHolding]) -> PortfolioScore:
        """Evaluate an entire carbon credit portfolio.

        Args:
            credits: List of credit holdings to assess.

        Returns:
            Aggregate portfolio quality and impact metrics.

        Raises:
            ValueError: If the portfolio is empty.
        """
        if not credits:
            raise ValueError("Portfolio must contain at least one credit")

        total_tonnes = sum(c.tonnes_co2 for c in credits)
        current_year = 2026  # platform reference year

        # Weighted quality score
        weighted_quality = 0.0
        total_weight = 0.0
        methodologies_seen: set[Methodology] = set()

        for c in credits:
            w = c.tonnes_co2
            meth_score = _METHODOLOGY_WEIGHTS.get(c.methodology, 50.0)
            ver_score = _VERIFICATION_WEIGHTS.get(c.verification_status, 0.0)
            vintage_age = current_year - c.vintage_year
            vintage_score = max(0.0, 100.0 - vintage_age * 5.0)

            credit_quality = 0.4 * meth_score + 0.35 * ver_score + 0.25 * vintage_score
            weighted_quality += w * credit_quality
            total_weight += w
            methodologies_seen.add(c.methodology)

        avg_quality = weighted_quality / total_weight if total_weight > 0 else 0.0
        methodology_diversity = len(methodologies_seen) / len(Methodology)

        avg_vintage_age = (
            sum(current_year - c.vintage_year for c in credits) / len(credits)
        )

        impact = self.calculate_impact(total_tonnes)

        if avg_quality >= 80:
            risk_rating = "low"
        elif avg_quality >= 60:
            risk_rating = "medium"
        elif avg_quality >= 40:
            risk_rating = "high"
        else:
            risk_rating = "critical"

        return PortfolioScore(
            total_tonnes_co2=total_tonnes,
            weighted_quality_score=round(avg_quality, 2),
            methodology_diversity=round(methodology_diversity, 4),
            average_vintage_age=round(avg_vintage_age, 2),
            impact=impact,
            risk_rating=risk_rating,
        )
