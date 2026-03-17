// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EfficiencyCalculator v3.0.0 — Net-Negative Accounting
 * @author TerraQura
 * @notice Enterprise-grade library for Net-Negative carbon credit calculations
 * @dev Implements the auditor-recommended Net-Negative Verification model:
 *
 *   Net Credits = (CO2_gross × F_purity) − (Energy_consumed × Grid_Intensity)
 *
 * Key design principles:
 *   - 1e18 precision (Wei-standard) eliminates rounding dust
 *   - Thermodynamic plausibility enforcement (100-800 kWh/tonne physical limits)
 *   - Non-linear purity penalty below 90% (quadratic degradation)
 *   - Grid intensity accounting for energy source carbon footprint
 *   - All legacy functions preserved for backwards compatibility
 *
 * Precision Architecture:
 *   - PRECISION_SCALE = 1e18 (all internal math)
 *   - BPS_SCALE = 10000 (legacy compatibility layer)
 *   - Grid intensity: gCO2/kWh (integer, e.g., 400 = 400 gCO2/kWh)
 *   - CO2 amounts: kilograms (integer)
 *   - Energy: kilowatt-hours (integer)
 */
library EfficiencyCalculator {

    // ============ Precision Constants ============

    /**
     * @notice Wei-standard precision scale (1e18)
     * @dev All Net-Negative math uses this to prevent rounding dust
     */
    uint256 internal constant PRECISION_SCALE = 1e18;

    /**
     * @notice Basis points scale for legacy compatibility
     */
    uint256 internal constant BPS_SCALE = 10000;

    /**
     * @notice Maximum purity percentage (100%)
     */
    uint256 internal constant MAX_PURITY_BPS = 10000;

    /**
     * @notice Purity threshold below which non-linear penalty applies (90%)
     */
    uint256 internal constant PURITY_PENALTY_THRESHOLD_BPS = 9000;

    // ============ Thermodynamic Constants ============

    /**
     * @notice Absolute minimum kWh/tonne — below this is physically impossible
     * @dev Based on the thermodynamic minimum for CO2 separation from air.
     *      Real-world DAC systems cannot operate below ~100 kWh/tonne.
     */
    uint256 internal constant THERMODYNAMIC_MIN_KWH = 100;

    /**
     * @notice Absolute maximum kWh/tonne — above this is not economically viable
     * @dev Captures that require > 800 kWh/tonne are not viable for any
     *      known carbon removal technology at scale.
     */
    uint256 internal constant THERMODYNAMIC_MAX_KWH = 800;

    // ============ Net-Negative Core Functions ============

    /**
     * @notice Calculate net carbon credits using the Net-Negative Accounting model
     * @dev Formula: netCredits = (co2Gross × purityFactor) − energyDebt
     *
     *      Where:
     *        purityFactor = purityBps / 10000 (if >= 90%), or
     *                     = (purityBps² / 10000) / 10000 (if < 90%, quadratic penalty)
     *        energyDebt   = (energyKwh × gridIntensity) / 1_000_000
     *                       (converts gCO2 to kgCO2: gCO2/kWh × kWh = gCO2, ÷ 1e6 → kgCO2...
     *                        actually gCO2/kWh × kWh = gCO2, ÷ 1000 = kgCO2)
     *
     *      All intermediate calculations use 1e18 precision.
     *
     *      Gas Optimization (v3.0.1): Uses unchecked blocks for operations that cannot
     *      overflow given input constraints (purity <= 10000, realistic CO2/energy values).
     *
     * @param co2AmountKg Gross CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @param purityBps CO2 purity in basis points (9500 = 95.00%)
     * @param gridIntensityGCO2PerKwh Grid carbon intensity in gCO2/kWh (e.g., 400)
     * @return netCredits Net carbon credits (in kg, 1e18 precision)
     * @return grossCredits Gross credits before energy deduction (1e18 precision)
     * @return energyDebtKg Energy debt in kg CO2 (1e18 precision)
     * @return purityFactor Applied purity factor (1e18 precision, where 1e18 = 100%)
     */
    function calculateNetCredits(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint256 purityBps,
        uint256 gridIntensityGCO2PerKwh
    ) internal pure returns (
        uint256 netCredits,
        uint256 grossCredits,
        uint256 energyDebtKg,
        uint256 purityFactor
    ) {
        // Step 1: Calculate purity factor (1e18 precision)
        purityFactor = _calculatePurityFactor(purityBps);

        // GAS OPTIMIZATION: unchecked blocks for operations that cannot overflow
        // - co2AmountKg: realistic max ~1e12 kg (1 billion tonnes)
        // - purityFactor: max 1e18 (100%)
        // - Product: max ~1e30, well under uint256 max (~1e77)
        unchecked {
            // Step 2: Calculate gross credits = CO2_gross × purityFactor
            // co2AmountKg × purityFactor(1e18) / 1e18 → result in kg at 1e18 precision
            grossCredits = co2AmountKg * purityFactor;
            // grossCredits is now in (kg × 1e18) units — i.e., scaled kg

            // Step 3: Calculate energy debt = energyKwh × gridIntensity / 1000
            // gridIntensity is gCO2/kWh, so energyKwh × gCO2/kWh = gCO2 total
            // Convert gCO2 → kgCO2: divide by 1000
            // Scale to 1e18 precision: multiply by PRECISION_SCALE first
            // - energyConsumedKwh: realistic max ~1e12 kWh
            // - gridIntensity: realistic max ~2000 gCO2/kWh
            // - PRECISION_SCALE: 1e18
            // - Product before division: max ~2e33, well under uint256 max
            energyDebtKg = (energyConsumedKwh * gridIntensityGCO2PerKwh * PRECISION_SCALE) / 1000;
        }

        // Step 4: Net credits = gross - energyDebt
        // Both are in (kg × 1e18) units
        // NOTE: Underflow check is intentional here (business logic)
        if (grossCredits > energyDebtKg) {
            unchecked {
                netCredits = grossCredits - energyDebtKg;
            }
        } else {
            // Net-negative scenario: energy debt exceeds gross capture
            netCredits = 0;
        }

        return (netCredits, grossCredits, energyDebtKg, purityFactor);
    }

    /**
     * @notice Check if energy consumption is physically plausible
     * @dev Enforces thermodynamic limits (100-800 kWh/tonne) as a hard fraud check.
     *      Values outside this range indicate either:
     *        - Below 100: Physically impossible (violates thermodynamics)
     *        - Above 800: Not economically viable for any known technology
     *
     *      Gas Optimization (v3.0.1): Uses unchecked blocks for safe arithmetic.
     *
     * @param co2AmountKg CO2 captured in kilograms
     * @param energyConsumedKwh Energy consumed in kilowatt-hours
     * @return isPlausible Whether the values fall within thermodynamic limits
     * @return kwhPerTonne Calculated kWh per tonne (for diagnostics)
     */
    function isPhysicallyPlausible(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh
    ) internal pure returns (bool isPlausible, uint256 kwhPerTonne) {
        if (co2AmountKg == 0) {
            return (false, 0);
        }

        // GAS OPTIMIZATION: unchecked for simple arithmetic
        unchecked {
            // Convert kg to tonnes (round up to prevent gaming with tiny amounts)
            // co2AmountKg + 999 cannot overflow for any realistic value
            uint256 co2Tonnes = (co2AmountKg + 999) / 1000;
            if (co2Tonnes == 0) co2Tonnes = 1;

            kwhPerTonne = energyConsumedKwh / co2Tonnes;
        }

        isPlausible = (kwhPerTonne >= THERMODYNAMIC_MIN_KWH && kwhPerTonne <= THERMODYNAMIC_MAX_KWH);

        return (isPlausible, kwhPerTonne);
    }

    /**
     * @notice Convert net credits from 1e18 precision to integer kg
     * @dev Final step before minting: scales down from Wei-precision to mintable units.
     *      Uses floor division — any fractional kg is discarded (conservative approach).
     *
     * @param netCreditsScaled Net credits in 1e18 precision
     * @return credits Integer credits in kg (ready for minting)
     */
    function scaleToMintable(uint256 netCreditsScaled) internal pure returns (uint256 credits) {
        credits = netCreditsScaled / PRECISION_SCALE;
        return credits;
    }

    /**
     * @notice Convert net credits from 1e18 precision to a legacy efficiency factor (1e4 scale)
     * @dev Backwards compatibility: derives an effective efficiency factor from net credits.
     *      efficiencyFactor = (netCredits / co2AmountKg) scaled to BPS_SCALE
     *
     *      This allows existing code that uses `(co2AmountKg * efficiencyFactor) / SCALE`
     *      to produce the same result as the Net-Negative calculation.
     *
     *      Gas Optimization (v3.0.1): Uses unchecked blocks for safe arithmetic.
     *
     * @param netCreditsScaled Net credits in 1e18 precision
     * @param co2AmountKg Original gross CO2 in kilograms
     * @return efficiencyFactor Legacy efficiency factor (scaled by 1e4)
     */
    function toLegacyEfficiencyFactor(
        uint256 netCreditsScaled,
        uint256 co2AmountKg
    ) internal pure returns (uint256 efficiencyFactor) {
        if (co2AmountKg == 0) return 0;

        // GAS OPTIMIZATION: unchecked for division (cannot overflow)
        // netCreditsScaled is in (kg × 1e18), so:
        // efficiencyFactor = (netCreditsScaled × BPS_SCALE) / (co2AmountKg × PRECISION_SCALE)
        unchecked {
            efficiencyFactor = (netCreditsScaled * BPS_SCALE) / (co2AmountKg * PRECISION_SCALE);
        }

        return efficiencyFactor;
    }

    // ============ Legacy Functions (Backwards Compatibility) ============

    /**
     * @notice Calculate efficiency factor based on energy consumption and purity
     * @dev LEGACY: Preserved for backwards compatibility. New code should use calculateNetCredits().
     * @param kwhPerTonne Actual kWh consumed per tonne of CO2
     * @param optimal Optimal kWh per tonne (best case scenario)
     * @param minAcceptable Minimum acceptable (below = fraud indicator)
     * @param maxAcceptable Maximum acceptable (above = too inefficient)
     * @param scale Scaling factor (e.g., 10000 = 100%)
     * @return factor Efficiency factor (scaled)
     */
    function calculate(
        uint256 kwhPerTonne,
        uint256 optimal,
        uint256 minAcceptable,
        uint256 maxAcceptable,
        uint256 scale
    ) internal pure returns (uint256 factor) {
        // Outside acceptable range
        if (kwhPerTonne < minAcceptable || kwhPerTonne > maxAcceptable) {
            return 0;
        }

        // Better than or equal to optimal - apply bonus
        if (kwhPerTonne <= optimal) {
            uint256 improvement = optimal - kwhPerTonne;
            uint256 range = optimal - minAcceptable;

            if (range > 0) {
                uint256 bonus = (scale * improvement) / (range * 20);
                factor = scale + bonus;
            } else {
                factor = scale;
            }
        } else {
            // Worse than optimal - apply penalty
            uint256 degradation = kwhPerTonne - optimal;
            uint256 range = maxAcceptable - optimal;

            uint256 penalty = (scale * degradation) / (range * 2);
            factor = scale > penalty ? scale - penalty : scale / 2;
        }

        // Ensure bounds: minimum 50%, maximum 105%
        uint256 minFactor = scale / 2;
        uint256 maxFactor = scale + (scale / 20);

        if (factor < minFactor) factor = minFactor;
        if (factor > maxFactor) factor = maxFactor;

        return factor;
    }

    /**
     * @notice Apply purity adjustment to efficiency factor
     * @dev LEGACY: Preserved for backwards compatibility. New code uses _calculatePurityFactor().
     * @param baseFactor The base efficiency factor from energy calculation
     * @param purityPercentage The CO2 purity percentage (0-100)
     * @param scale Scaling factor (10000 = 100%)
     * @return adjustedFactor The purity-adjusted efficiency factor
     */
    function applyPurityAdjustment(
        uint256 baseFactor,
        uint8 purityPercentage,
        uint256 scale
    ) internal pure returns (uint256 adjustedFactor) {
        int256 purityDelta = int256(uint256(purityPercentage)) - 95;
        int256 purityFactor = int256(scale) + (purityDelta * 100);

        // Apply purity factor to base factor
        adjustedFactor = (baseFactor * uint256(purityFactor)) / scale;

        // Ensure minimum floor
        uint256 minFactor = scale / 2;
        if (adjustedFactor < minFactor) {
            adjustedFactor = minFactor;
        }

        return adjustedFactor;
    }

    /**
     * @notice Calculate credits to mint based on CO2 amount and efficiency
     * @dev LEGACY: Preserved for backwards compatibility. New code uses calculateNetCredits().
     * @param co2AmountKg Raw CO2 captured in kilograms
     * @param efficiencyFactor The efficiency factor (scaled by 1e4)
     * @param scale The scale factor (10000 = 100%)
     * @return credits Number of credits to mint
     */
    function calculateCredits(
        uint256 co2AmountKg,
        uint256 efficiencyFactor,
        uint256 scale
    ) internal pure returns (uint256 credits) {
        credits = (co2AmountKg * efficiencyFactor) / scale;
        return credits;
    }

    // ============ Internal Helper Functions ============

    /**
     * @notice Calculate the purity factor with non-linear penalty below 90%
     * @dev
     *   - Purity >= 90% (9000 bps): Linear factor = purityBps / 10000
     *     e.g., 9500 bps → 0.95 × 1e18 = 950000000000000000
     *
     *   - Purity < 90% (9000 bps): Quadratic penalty = (purityBps² / 10000) / 10000
     *     e.g., 8000 bps → (8000² / 10000) / 10000 = 6400/10000 = 0.64
     *     This discourages low-purity submissions more aggressively.
     *
     * @param purityBps Purity in basis points (9500 = 95.00%)
     * @return factor Purity factor in 1e18 precision (1e18 = 100%)
     */
    function _calculatePurityFactor(uint256 purityBps) internal pure returns (uint256 factor) {
        if (purityBps > MAX_PURITY_BPS) {
            purityBps = MAX_PURITY_BPS; // Cap at 100%
        }

        if (purityBps >= PURITY_PENALTY_THRESHOLD_BPS) {
            // Linear: purityBps / 10000 → scaled to 1e18
            factor = (purityBps * PRECISION_SCALE) / BPS_SCALE;
        } else {
            // Non-linear (quadratic penalty):
            // effectiveBps = purityBps² / 10000
            // factor = effectiveBps / 10000 → scaled to 1e18
            uint256 squaredBps = (purityBps * purityBps) / BPS_SCALE;
            factor = (squaredBps * PRECISION_SCALE) / BPS_SCALE;
        }

        return factor;
    }
}
