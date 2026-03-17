# 🔍 TERRAQURA BRANCH COVERAGE GAP ANALYSIS
## Current: 81.95% → Target: 95%+

### EXECUTIVE SUMMARY

To reach 95% branch coverage, you need to add **~70-90 targeted tests** covering specific uncovered branches across 5 key contracts.

| Contract | Current | Target | Missing Branches | Priority |
|----------|---------|--------|------------------|----------|
| EfficiencyCalculator.sol | 64.3% | 95% | ~12 branches | 🔴 CRITICAL |
| CarbonMarketplace.sol | 80.5% | 95% | ~38 branches | 🔴 CRITICAL |
| VerificationEngine.sol | 81.9% | 95% | ~15 branches | 🟡 HIGH |
| CarbonCredit.sol | 83.3% | 95% | ~12 branches | 🟡 HIGH |
| TerraQuraTimelockMainnet.sol | 78% | 95% | ~5 branches | 🟢 MEDIUM |

---

## 🔴 CRITICAL GAPS

### 1. EfficiencyCalculator.sol (64.3% → 95%)

**MISSING BRANCHES:**

#### Line 162-164: `if (co2AmountKg == 0)` 
- **Branch 0 (true)**: ❌ NOT COVERED - Returns (false, 0) when CO2 is zero
- **Test Needed:**
```typescript
it("should return not plausible when CO2 amount is zero", async () => {
  const result = await calculator.isPhysicallyPlausible(0, 1000);
  expect(result.isPlausible).to.be.false;
  expect(result.kwhPerTonne).to.equal(0);
});
```

#### Line 171: `if (co2Tonnes == 0) co2Tonnes = 1`
- **Branch**: ❌ NOT COVERED - Handles tiny CO2 amounts < 1kg
- **Test Needed:**
```typescript
it("should handle CO2 amounts less than 1kg", async () => {
  const result = await calculator.isPhysicallyPlausible(500, 100); // 0.5kg
  expect(result.isPlausible).to.be.true; // Should not divide by zero
});
```

#### Line 244: `if (kwhPerTonne < minAcceptable || kwhPerTonne > maxAcceptable)`
- **Branch 0 (below min)**: ✅ Covered
- **Branch 1 (above max)**: ✅ Covered  
- **Branch 2 (within range)**: ❌ NOT COVERED - The else path
- **Test Needed:**
```typescript
it("should calculate efficiency for values within acceptable range", async () => {
  // 300 kWh/tonne is within 200-600 range
  const result = await calculator.calculate(1000, 300000, 10000, 100);
  expect(result.isValid).to.be.true;
});
```

#### Line 249-259: Efficiency factor calculation branches
- **Line 249 if (kwhPerTonne <= optimal)**: ✅ Covered
- **Line 253 if (range > 0)**: ❌ NOT COVERED - Range check
- **Line 256 else**: ❌ NOT COVERED - When range is 0
- **Line 259 else (above optimal)**: ✅ Covered
- **Tests Needed:** 3 tests for range edge cases

#### Line 272-273: Factor clamping
- **Line 272 if (factor < minFactor)**: ❌ NOT COVERED
- **Line 273 if (factor > maxFactor)**: ❌ NOT COVERED
- **Tests Needed:** 2 tests for extreme efficiency values

#### Line 299: `if (adjustedFactor < minFactor)`
- **Branch 0 (true)**: ❌ NOT COVERED
- **Test Needed:** Factor adjustment below minimum

#### Line 339-346: Purity factor calculation
- **Line 339 if (purityBps > MAX_PURITY_BPS)**: ✅ Covered
- **Line 343 if (purityBps >= PURITY_PENALTY_THRESHOLD_BPS)**: ✅ Covered
- **Line 346 else**: ✅ Covered

**ACTION: Create 12 tests in EfficiencyCalculatorBranchCoverage.test.ts**

---

### 2. CarbonMarketplace.sol (80.5% → 95%)

**MISSING BRANCHES:**

#### Line 239: `if (_owner != msg.sender)`
- **Branch 1 (false - owner IS msg.sender)**: ❌ NOT COVERED
- **Test Needed:**
```typescript
it("should not transfer ownership when owner is deployer", async () => {
  const marketplace = await upgrades.deployProxy(
    MarketplaceFactory,
    [carbonCredit.address, feeRecipient.address, 250, owner.address], // owner = deployer
    { initializer: "initialize" }
  );
  expect(await marketplace.owner()).to.equal(owner.address);
});
```

#### Line 269-276: createListing validation
- **Line 269 Branch checks**: Multiple condition branches
- **Line 274 if (carbonCredit.balanceOf(sender, tokenId) < amount)**: ❌ ELSE BRANCH NOT COVERED
- **Test Needed:** Successful listing creation (balance sufficient)

#### Line 309: `if (listing.expiresAt > 0 && block.timestamp > listing.expiresAt)`
- **Branch 0 (expiresAt == 0)**: ❌ NOT COVERED - No expiry
- **Branch 1 (not expired)**: ✅ Covered
- **Test Needed:**
```typescript
it("should allow purchase of listing with no expiry", async () => {
  await marketplace.createListing(tokenId, 100, price, 0, 0); // duration = 0
  await marketplace.purchase(1, 50, { value: payment }); // Should succeed
});
```

#### Line 341-360: updateListing branches
- **Line 341 if (newPricePerUnit > 0) else**: ❌ NOT COVERED
- **Line 353 if (newAmount > 0 && newAmount != listing.amount) else**: ❌ NOT COVERED
- **Line 354 if (newAmount > listing.amount)**: ✅ Covered
- **Line 367 else (reduce amount)**: ✅ Covered
- **Tests Needed:** 3 tests for price-only update, same amount, edge cases

#### Line 392-445: purchase function branches
- **Line 416 if (listing.amount == 0)**: ✅ Covered
- **Line 431 if (!sellerSuccess)**: ❌ NOT COVERED - Transfer failure
- **Line 436 if (!feeSuccess)**: ❌ NOT COVERED - Fee transfer failure  
- **Line 442 if (!refundSuccess)**: ❌ NOT COVERED - Refund failure
- **Tests Needed:** 3 tests using mock reverting receivers

#### Line 470-525: createOffer/acceptOffer branches
- **Line 496 if (msg.value > totalDeposit) else**: ❌ NOT COVERED - Exact deposit
- **Line 537 if (offer.expiresAt > 0 && block.timestamp > offer.expiresAt)**: ❌ NOT COVERED
- **Tests Needed:** 2 tests

#### Line 587-612: rejectOffer authorization
- **Line 598 if (!isBuyer && !canFulfillOffer)**: ❌ NOT COVERED - The revert case
- **Test Needed:** Unauthorized rejection attempt

**ACTION: Add 38 targeted tests to BranchCoverageMarketplace.test.ts**

---

## 🟡 HIGH PRIORITY GAPS

### 3. VerificationEngine.sol (81.9% → 95%)

**MISSING BRANCHES:**

#### Line 222: `if (_carbonCreditContract != address(0))`
- **Branch 1 (false - address is zero)**: ❌ NOT COVERED
- **Test Needed:**
```typescript
it("should initialize with zero carbon credit address", async () => {
  const ve = await upgrades.deployProxy(
    VerificationEngineFactory,
    [accessControl.address, ethers.ZeroAddress],
    { initializer: "initialize" }
  );
  expect(await ve.carbonCreditContract()).to.equal(ethers.ZeroAddress);
});
```

#### Line 309-335: _verifyLogic branches
- **Line 309 thermodynamic check**: Multiple sub-branches
- **Line 319 if (kwhPerTonne < minKwh)**: ✅ Covered
- **Line 331 if (kwhPerTonne > maxKwh)**: ✅ Covered
- **Line 338 if (purityPercentage < minPurity)**: ✅ Covered
- **Line 345 if (netCreditsScaled == 0)**: ✅ Covered
- **Line 362 purityFactor calculation**: ❌ SOME BRANCHES UNCOVERED

#### Line 404-408: Preview functions
- **Line 404 if (netCreditsScaled == 0) return**: ❌ NOT COVERED
- **Line 408-411 if (kwhPerTonne < minKwh)**: ❌ NOT COVERED  
- **Tests Needed:** 5 tests for preview edge cases

**ACTION: Add 15 tests to BranchCoverageVerification.test.ts**

---

### 4. CarbonCredit.sol (83.3% → 95%)

**MISSING BRANCHES:**

#### Line 265: `if (bytes(ipfsMetadataUri).length == 0)`
- **Branch 0 (true - empty URI)**: ❌ NOT COVERED
- **Test Already Exists:** Add to BranchCoverageCarbonCredit.test.ts

#### Line 272: `if (usedDataHashes[sourceDataHash])`
- **Branch 0 (true - duplicate hash)**: ❌ NOT COVERED
- **Test Already Exists:** Should be covered

#### Line 342: `if (bufferPoolAddress != address(0) && bufferPercentageBps > 0)`
- **Complex condition - 4 branch combinations**:
  - T && T: ✅ Covered (buffer active)
  - T && F: ❌ NOT COVERED (address set, 0%)
  - F && T: ❌ NOT COVERED (no address, >0%)
  - F && F: ✅ Covered (no buffer)
- **Tests Needed:** 2 tests

#### Line 400: `if (balanceOf(msg.sender, tokenId) == 0)`
- **Branch 1 (false - still has balance)**: ❌ NOT COVERED
- **Test Needed:** Partial retirement test

#### Line 525-531: setBufferConfiguration validation
- **Line 525 if (_bufferPercentageBps > MAX_BUFFER_BPS)**: ✅ Covered
- **Line 529 if (_bufferPercentageBps > 0 && _bufferPoolAddress == address(0))**: ✅ Covered

#### Line 557-561: releaseBufferCredits validation
- **Line 557 if (amount == 0)**: ❌ NOT COVERED
- **Line 558 if (bufferPoolBalance[tokenId] < amount)**: ❌ NOT COVERED
- **Line 561 if (releaseTo == address(0))**: ❌ NOT COVERED
- **Tests Needed:** 3 validation tests

#### Line 596-601: handleReversal validation  
- **Line 596 if (amountToBurn == 0)**: ❌ NOT COVERED
- **Line 597 if (bufferPoolBalance[tokenId] < amountToBurn)**: ❌ NOT COVERED
- **Line 600 if (bufferPoolAddress == address(0))**: ❌ NOT COVERED
- **Tests Needed:** 3 validation tests

**ACTION: Add 12 tests to BranchCoverageCarbonCredit.test.ts**

---

## 🟢 MEDIUM PRIORITY GAPS

### 5. TerraQuraTimelockMainnet.sol (78% → 95%)

**MISSING BRANCHES:**

#### Line 165-173: getDelayForType switch
- Some enum values may not be fully covered
- **Test Needed:** Test all OperationType values

#### Line 289-300: getOperationStatus
- Edge cases for operation status
- **Tests Needed:** 3 tests

**ACTION: Add 5 tests to TerraQuraTimelockMainnet.test.ts**

---

## 📋 COMPLETE ACTION PLAN

### Phase 1: Create Missing Test Files (This Week)

```bash
# Create new focused test file
test/BranchCoverageEfficiencyCalculator.test.ts      # 12 tests
test/BranchCoverageMarketplaceFinal.test.ts          # 38 tests  
test/BranchCoverageVerificationFinal.test.ts         # 15 tests
test/BranchCoverageCarbonCreditFinal.test.ts         # 12 tests
test/BranchCoverageTimelockFinal.test.ts             # 5 tests
```

### Phase 2: Test Implementation Priority

**Week 1 (Days 1-2): Critical Contracts**
- [ ] EfficiencyCalculator: 12 tests
- [ ] CarbonMarketplace initialization: 5 tests

**Week 1 (Days 3-4): High Priority**
- [ ] CarbonMarketplace purchase failures: 8 tests
- [ ] CarbonMarketplace offer/edge cases: 15 tests
- [ ] VerificationEngine: 15 tests

**Week 1 (Days 5-7): Final Push**
- [ ] CarbonCredit buffer/retirement: 12 tests
- [ ] Timelock: 5 tests
- [ ] Run full coverage, verify 95%+

### Phase 3: Verification

```bash
npm test
npx hardhat coverage

# Verify targets:
# - EfficiencyCalculator: 64.3% → 95%+
# - CarbonMarketplace: 80.5% → 95%+
# - VerificationEngine: 81.9% → 95%+
# - CarbonCredit: 83.3% → 95%+
# - OVERALL: 81.95% → 95%+
```

---

## 🎯 EXPECTED RESULTS

### After Implementation:

| Contract | Before | After | Tests Added |
|----------|--------|-------|-------------|
| EfficiencyCalculator.sol | 64.3% | 95%+ | 12 |
| CarbonMarketplace.sol | 80.5% | 95%+ | 38 |
| VerificationEngine.sol | 81.9% | 95%+ | 15 |
| CarbonCredit.sol | 83.3% | 95%+ | 12 |
| TimelockMainnet.sol | 78% | 95%+ | 5 |
| **OVERALL** | **81.95%** | **95%+** | **82** |

### New Test Count:
- **Current:** 1,099 tests
- **After:** ~1,181 tests (+82)
- **Target Branch Coverage:** 95%+

---

## 💡 PRO TIPS FOR 95%+

1. **Use `npx hardhat coverage` after each test file** to track progress
2. **Focus on `else` branches** - they're often missed
3. **Test error/revert paths** explicitly
4. **Use mocks** to simulate failure conditions (transfer failures)
5. **Test boundary values** (0, 1, max, max+1)

---

## ⚡ QUICK WINS (Do These First)

These 10 tests will give you the biggest coverage boost:

1. EfficiencyCalculator - zero CO2 amount
2. EfficiencyCalculator - CO2 < 1kg  
3. CarbonMarketplace - owner is deployer
4. CarbonMarketplace - no expiry listing
5. CarbonMarketplace - exact deposit offer
6. CarbonMarketplace - purchase with mock reverting seller
7. VerificationEngine - zero address init
8. CarbonCredit - partial retirement (balance > 0)
9. CarbonCredit - release with amount = 0
10. CarbonCredit - buffer config with address=0, % > 0

**These alone will add ~5-8% to your overall branch coverage!**

