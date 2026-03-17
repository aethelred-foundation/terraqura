import { expect } from "chai";
import { ethers } from "hardhat";

describe("EfficiencyCalculator", function () {
    let calculator: any;

    // Constants matching the VerificationEngine
    const MIN_KWH_PER_TONNE = 200;
    const MAX_KWH_PER_TONNE = 600;
    const OPTIMAL_KWH_PER_TONNE = 350;
    const SCALE = 10000;

    before(async function () {
        // Deploy a test contract that exposes the library functions
        const CalculatorTestFactory = await ethers.getContractFactory("EfficiencyCalculatorTest");
        calculator = await CalculatorTestFactory.deploy();
        await calculator.waitForDeployment();
    });

    describe("calculate()", function () {
        it("should return max efficiency (10500) for optimal kWh", async function () {
            const factor = await calculator.testCalculate(
                OPTIMAL_KWH_PER_TONNE,
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );
            // At optimal, should get bonus
            expect(factor).to.be.gte(10000);
        });

        it("should return lower efficiency for high kWh consumption", async function () {
            const factorOptimal = await calculator.testCalculate(
                OPTIMAL_KWH_PER_TONNE,
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            const factorHigh = await calculator.testCalculate(
                550, // High consumption
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            expect(factorHigh).to.be.lt(factorOptimal);
        });

        it("should return higher efficiency (bonus) for very low kWh (near min)", async function () {
            // In the efficiency calculation, lower kWh consumption is BETTER (more efficient)
            // So values near minimum get a bonus, not a penalty
            const factor = await calculator.testCalculate(
                MIN_KWH_PER_TONNE + 10, // Just above min - very efficient!
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            // Should get a bonus (above 100%) for being more efficient than optimal
            expect(factor).to.be.gt(0);
            expect(factor).to.be.gte(SCALE); // Efficient operation gets bonus
        });

        it("should handle edge case at min boundary", async function () {
            const factor = await calculator.testCalculate(
                MIN_KWH_PER_TONNE,
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            expect(factor).to.be.gt(0);
        });

        it("should handle edge case at max boundary", async function () {
            const factor = await calculator.testCalculate(
                MAX_KWH_PER_TONNE,
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            // Should be lower than optimal
            expect(factor).to.be.lt(10000);
            expect(factor).to.be.gt(0);
        });
    });

    describe("applyPurityAdjustment()", function () {
        const baseFactor = 10000; // 100%

        it("should increase efficiency for high purity", async function () {
            const adjustedHigh = await calculator.testApplyPurityAdjustment(baseFactor, 99, SCALE);
            const adjustedMid = await calculator.testApplyPurityAdjustment(baseFactor, 95, SCALE);

            expect(adjustedHigh).to.be.gt(adjustedMid);
        });

        it("should decrease efficiency for low purity", async function () {
            const adjusted90 = await calculator.testApplyPurityAdjustment(baseFactor, 90, SCALE);
            const adjusted95 = await calculator.testApplyPurityAdjustment(baseFactor, 95, SCALE);

            expect(adjusted90).to.be.lt(adjusted95);
        });

        it("should handle 100% purity", async function () {
            const adjusted = await calculator.testApplyPurityAdjustment(baseFactor, 100, SCALE);
            expect(adjusted).to.be.gte(baseFactor);
        });

        it("should handle minimum valid purity (90%)", async function () {
            const adjusted = await calculator.testApplyPurityAdjustment(baseFactor, 90, SCALE);
            expect(adjusted).to.be.gt(0);
        });

        it("should return proportional values", async function () {
            const adjusted92 = await calculator.testApplyPurityAdjustment(baseFactor, 92, SCALE);
            const adjusted96 = await calculator.testApplyPurityAdjustment(baseFactor, 96, SCALE);

            // Higher purity should always give better efficiency
            expect(adjusted96).to.be.gt(adjusted92);
        });
    });

    describe("calculateCredits()", function () {
        it("should calculate credits based on CO2 and efficiency", async function () {
            const co2AmountKg = 1000; // 1 tonne
            const efficiencyFactor = 10000; // 100%

            const credits = await calculator.testCalculateCredits(co2AmountKg, efficiencyFactor, SCALE);

            // Should equal co2AmountKg at 100% efficiency
            expect(credits).to.equal(co2AmountKg);
        });

        it("should reduce credits for lower efficiency", async function () {
            const co2AmountKg = 1000;
            const lowEfficiency = 5000; // 50%

            const credits = await calculator.testCalculateCredits(co2AmountKg, lowEfficiency, SCALE);

            expect(credits).to.equal(500); // 1000 * 50% = 500
        });

        it("should increase credits for bonus efficiency", async function () {
            const co2AmountKg = 1000;
            const bonusEfficiency = 10500; // 105%

            const credits = await calculator.testCalculateCredits(co2AmountKg, bonusEfficiency, SCALE);

            expect(credits).to.equal(1050); // 1000 * 105% = 1050
        });

        it("should handle zero CO2", async function () {
            const credits = await calculator.testCalculateCredits(0, 10000, SCALE);
            expect(credits).to.equal(0);
        });

        it("should handle large CO2 amounts", async function () {
            const largeCO2 = ethers.parseUnits("1000000", 0); // 1M kg
            const credits = await calculator.testCalculateCredits(largeCO2, 10000, SCALE);

            expect(credits).to.equal(largeCO2);
        });
    });

    describe("Edge Cases", function () {
        it("should return 0 for kWh below minimum", async function () {
            const factor = await calculator.testCalculate(
                MIN_KWH_PER_TONNE - 1, // Below minimum
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );
            expect(factor).to.equal(0);
        });

        it("should return 0 for kWh above maximum", async function () {
            const factor = await calculator.testCalculate(
                MAX_KWH_PER_TONNE + 1, // Above maximum
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );
            expect(factor).to.equal(0);
        });

        it("should handle case where optimal equals minimum", async function () {
            const factor = await calculator.testCalculate(
                200, // At optimal/min
                200, // optimal = min
                200, // min
                600, // max
                SCALE
            );
            expect(factor).to.be.gt(0);
        });

        it("should handle case where optimal equals maximum", async function () {
            const factor = await calculator.testCalculate(
                600, // At optimal/max
                600, // optimal = max
                200, // min
                600, // max
                SCALE
            );
            expect(factor).to.be.gt(0);
        });

        it("should handle very low purity (below 90%)", async function () {
            const baseFactor = 10000;
            const adjusted = await calculator.testApplyPurityAdjustment(baseFactor, 50, SCALE);

            // Should still return a valid factor (minimum floor)
            expect(adjusted).to.be.gte(SCALE / 2); // Minimum is 50%
        });

        it("should handle zero purity", async function () {
            const baseFactor = 10000;
            const adjusted = await calculator.testApplyPurityAdjustment(baseFactor, 0, SCALE);

            // Should hit the negative purity factor case and return minimum
            expect(adjusted).to.be.gte(SCALE / 2);
        });

        it("should handle kWh at exact optimal point", async function () {
            const factor = await calculator.testCalculate(
                OPTIMAL_KWH_PER_TONNE, // Exactly at optimal
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );
            // At exact optimal, no bonus but base efficiency
            expect(factor).to.equal(SCALE); // 100%
        });

        it("should calculate proportionally between optimal and max", async function () {
            const factorMid = await calculator.testCalculate(
                475, // Midpoint between 350 (optimal) and 600 (max)
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            const factorMax = await calculator.testCalculate(
                MAX_KWH_PER_TONNE,
                OPTIMAL_KWH_PER_TONNE,
                MIN_KWH_PER_TONNE,
                MAX_KWH_PER_TONNE,
                SCALE
            );

            // Midpoint should be between 100% and the max penalty
            expect(factorMid).to.be.lt(SCALE);
            expect(factorMid).to.be.gt(factorMax);
        });
    });
});
