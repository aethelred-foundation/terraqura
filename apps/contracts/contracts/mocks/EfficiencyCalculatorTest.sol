// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../libraries/EfficiencyCalculator.sol";

/**
 * @title EfficiencyCalculatorTest
 * @notice Test wrapper contract to expose library functions for testing
 * @dev This contract is only used in testing to call library functions.
 *      v3.0.0: Added Net-Negative functions alongside legacy wrappers.
 */
contract EfficiencyCalculatorTest {

    // ============ Net-Negative v3.0.0 Test Wrappers ============

    /**
     * @notice Test wrapper for calculateNetCredits
     */
    function testCalculateNetCredits(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh,
        uint256 purityBps,
        uint256 gridIntensityGCO2PerKwh
    ) external pure returns (
        uint256 netCredits,
        uint256 grossCredits,
        uint256 energyDebtKg,
        uint256 purityFactor
    ) {
        return EfficiencyCalculator.calculateNetCredits(
            co2AmountKg,
            energyConsumedKwh,
            purityBps,
            gridIntensityGCO2PerKwh
        );
    }

    /**
     * @notice Test wrapper for isPhysicallyPlausible
     */
    function testIsPhysicallyPlausible(
        uint256 co2AmountKg,
        uint256 energyConsumedKwh
    ) external pure returns (bool isPlausible, uint256 kwhPerTonne) {
        return EfficiencyCalculator.isPhysicallyPlausible(co2AmountKg, energyConsumedKwh);
    }

    /**
     * @notice Test wrapper for scaleToMintable
     */
    function testScaleToMintable(
        uint256 netCreditsScaled
    ) external pure returns (uint256 credits) {
        return EfficiencyCalculator.scaleToMintable(netCreditsScaled);
    }

    /**
     * @notice Test wrapper for toLegacyEfficiencyFactor
     */
    function testToLegacyEfficiencyFactor(
        uint256 netCreditsScaled,
        uint256 co2AmountKg
    ) external pure returns (uint256 efficiencyFactor) {
        return EfficiencyCalculator.toLegacyEfficiencyFactor(netCreditsScaled, co2AmountKg);
    }

    // ============ Legacy Test Wrappers ============

    /**
     * @notice Test wrapper for calculate function
     */
    function testCalculate(
        uint256 kwhPerTonne,
        uint256 optimal,
        uint256 minAcceptable,
        uint256 maxAcceptable,
        uint256 scale
    ) external pure returns (uint256) {
        return EfficiencyCalculator.calculate(
            kwhPerTonne,
            optimal,
            minAcceptable,
            maxAcceptable,
            scale
        );
    }

    /**
     * @notice Test wrapper for applyPurityAdjustment function
     */
    function testApplyPurityAdjustment(
        uint256 baseFactor,
        uint8 purityPercentage,
        uint256 scale
    ) external pure returns (uint256) {
        return EfficiencyCalculator.applyPurityAdjustment(
            baseFactor,
            purityPercentage,
            scale
        );
    }

    /**
     * @notice Test wrapper for calculateCredits function
     */
    function testCalculateCredits(
        uint256 co2AmountKg,
        uint256 efficiencyFactor,
        uint256 scale
    ) external pure returns (uint256) {
        return EfficiencyCalculator.calculateCredits(
            co2AmountKg,
            efficiencyFactor,
            scale
        );
    }
}
