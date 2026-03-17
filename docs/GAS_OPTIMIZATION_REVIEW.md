# TerraQura Gas Optimization Review

> **Version:** 1.0.0
> **Date:** February 2026
> **Network Target:** Polygon PoS / Polygon zkEVM
> **Author:** TerraQura Engineering

---

## Executive Summary

This document provides a comprehensive gas optimization review for TerraQura's mainnet deployment. Based on Slither/Mythril static analysis patterns and manual code review, we've identified optimization opportunities across all core contracts.

### Key Findings

| Contract | Current Est. Gas | Optimized Est. Gas | Savings |
|----------|-----------------|-------------------|---------|
| CarbonCredit.mintVerifiedCredits | ~350,000 | ~280,000 | ~20% |
| CarbonMarketplace.purchase | ~250,000 | ~200,000 | ~20% |
| VerificationEngine.verify | ~180,000 | ~140,000 | ~22% |
| CircuitBreaker.checkRateLimit | ~45,000 | ~35,000 | ~22% |

---

## 1. Storage Optimization Recommendations

### 1.1 Struct Packing

**Current Issue:** CreditMetadata struct is not optimally packed.

```solidity
// BEFORE: ~7 storage slots
struct CreditMetadata {
    bytes32 dacUnitId;           // slot 1
    bytes32 sourceDataHash;      // slot 2
    uint256 captureTimestamp;    // slot 3
    uint256 co2AmountKg;         // slot 4
    uint256 energyConsumedKwh;   // slot 5
    int256 latitude;             // slot 6
    int256 longitude;            // slot 7
    uint8 purityPercentage;      // slot 8 (wastes 31 bytes)
    uint256 gridIntensityGCO2;   // slot 9
    bool isRetired;              // slot 10 (wastes 31 bytes)
    string ipfsMetadataUri;      // dynamic
    string arweaveBackupTxId;    // dynamic
}

// AFTER: ~6 storage slots (pack smaller types together)
struct CreditMetadataOptimized {
    bytes32 dacUnitId;           // slot 1
    bytes32 sourceDataHash;      // slot 2
    uint256 captureTimestamp;    // slot 3
    uint128 co2AmountKg;         // slot 4 (left)
    uint128 energyConsumedKwh;   // slot 4 (right)
    int128 latitude;             // slot 5 (left)
    int128 longitude;            // slot 5 (right)
    uint32 gridIntensityGCO2;    // slot 6 (can't exceed 4B)
    uint8 purityPercentage;      // slot 6
    bool isRetired;              // slot 6
    // 18 bytes remaining in slot 6
    string ipfsMetadataUri;      // dynamic
    string arweaveBackupTxId;    // dynamic
}
```

**Savings:** ~20,000 gas per mint (1 fewer SSTORE)

### 1.2 Listing Struct Packing (CarbonMarketplace)

```solidity
// BEFORE: ~5 slots
struct Listing {
    uint256 listingId;       // slot 1
    address seller;          // slot 2 (12 bytes unused)
    uint256 tokenId;         // slot 3
    uint256 amount;          // slot 4
    uint256 pricePerUnit;    // slot 5
    uint256 minPurchaseAmount; // slot 6
    bool isActive;           // slot 7 (31 bytes unused)
    uint256 createdAt;       // slot 8
    uint256 expiresAt;       // slot 9
}

// AFTER: ~5 slots (optimized)
struct ListingOptimized {
    address seller;          // slot 1 (20 bytes)
    uint48 createdAt;        // slot 1 (6 bytes) - unix timestamp fits in uint48
    uint48 expiresAt;        // slot 1 (6 bytes)
    uint256 listingId;       // slot 2
    uint256 tokenId;         // slot 3
    uint128 amount;          // slot 4 (left)
    uint128 pricePerUnit;    // slot 4 (right) - price in wei fits uint128
    uint128 minPurchaseAmount; // slot 5 (left)
    bool isActive;           // slot 5 (1 byte)
    // 15 bytes remaining
}
```

**Savings:** ~40,000 gas per listing (4 fewer SSTORE)

---

## 2. View Function Optimization

### 2.1 Pagination Gas Optimization

**Issue:** getPaginatedListings does two passes over the array.

```solidity
// BEFORE: O(2n) iteration
function getPaginatedListings(...) {
    // First pass: count active
    for (uint256 i = 0; i < totalLength; i++) {
        if (listings[allListings[i]].isActive) {
            totalActive++;
        }
    }
    // Second pass: collect
    for (uint256 i = 0; i < totalLength; i++) {
        // ...
    }
}

// AFTER: O(n) single pass with early termination
function getPaginatedListingsOptimized(...) {
    uint256[] memory pageIds = new uint256[](limit);
    uint256 skipped = 0;
    uint256 collected = 0;

    for (uint256 i = 0; collected < limit && i < totalLength; ) {
        if (listings[allListings[i]].isActive) {
            if (skipped >= offset) {
                pageIds[collected] = allListings[i];
                unchecked { ++collected; }
            } else {
                unchecked { ++skipped; }
            }
        }
        unchecked { ++i; }
    }
    // Resize array to actual size
    assembly {
        mstore(pageIds, collected)
    }
}
```

**Savings:** ~50% gas on large lists

### 2.2 Memory vs Storage

```solidity
// BEFORE: Multiple storage reads
function getContractStatus(address contractAddr) external view returns (...) {
    ContractStatus storage status = contractStatus[contractAddr];
    return (status.isPaused, status.level, status.pausedAt, status.pauseReason);
}

// AFTER: Single storage copy to memory
function getContractStatus(address contractAddr) external view returns (...) {
    ContractStatus memory status = contractStatus[contractAddr];
    return (status.isPaused, status.level, status.pausedAt, status.pauseReason);
}
```

---

## 3. Unchecked Math Optimization

### 3.1 Safe Unchecked Blocks

For operations that cannot overflow due to business logic constraints:

```solidity
// In EfficiencyCalculator
function calculateNetCredits(...) internal pure returns (...) {
    // These operations cannot overflow given input constraints
    unchecked {
        purityFactor = _calculatePurityFactor(purityBps);
        grossCredits = (co2AmountKg * purityFactor);
        energyDebtKg = (energyConsumedKwh * gridIntensityGCO2PerKwh * PRECISION_SCALE) / 1000;
    }

    // Underflow check is intentional
    if (grossCredits > energyDebtKg) {
        unchecked {
            netCredits = grossCredits - energyDebtKg;
        }
    }
}
```

**Savings:** ~200-400 gas per call

### 3.2 Loop Optimization

```solidity
// BEFORE
for (uint256 i = 0; i < length; i++) {
    // ...
}

// AFTER
for (uint256 i = 0; i < length; ) {
    // ...
    unchecked { ++i; }
}
```

**Savings:** ~50 gas per iteration

---

## 4. Event Optimization

### 4.1 Indexed Parameter Limit

Each indexed parameter costs extra gas. Use maximum 3 indexed params per event.

```solidity
// Optimal: 3 indexed params (for filtering)
event CreditMinted(
    uint256 indexed tokenId,
    bytes32 indexed dacUnitId,
    address indexed recipient,
    uint256 amount,           // Not indexed (searchable via logs)
    bytes32 sourceDataHash    // Not indexed
);
```

### 4.2 Avoid Redundant Events

Don't emit events for values that can be derived:

```solidity
// BEFORE: Emits computed value
emit Purchase(listingId, buyer, seller, tokenId, amount, totalPrice, platformFee);

// AFTER: Emit only essential data (totalPrice = amount * pricePerUnit, fee = totalPrice * bps / 10000)
emit Purchase(listingId, buyer, seller, tokenId, amount);
```

---

## 5. Calldata vs Memory

### 5.1 Use calldata for Read-Only Arrays

```solidity
// BEFORE: Copies to memory
function batchSetKycStatus(
    address[] memory users,
    bool[] memory statuses
) external onlyOwner {
    // ...
}

// AFTER: Read directly from calldata
function batchSetKycStatus(
    address[] calldata users,
    bool[] calldata statuses
) external onlyOwner {
    // ...
}
```

**Savings:** ~60 gas per array element

---

## 6. Short-Circuit Optimization

### 6.1 Order Conditionals by Gas Cost

```solidity
// BEFORE: Expensive check first
function isOperationAllowed(address contractAddr) external view returns (bool) {
    if (globalSecurityLevel == SecurityLevel.EMERGENCY) return false;  // SLOAD
    if (globalPause) return false;                                      // SLOAD
    if (contractStatus[contractAddr].isPaused) return false;           // SLOAD + mapping lookup
    return true;
}

// AFTER: Cheapest check first
function isOperationAllowed(address contractAddr) external view returns (bool) {
    if (globalPause) return false;                                      // SLOAD (bool = cheap)
    if (globalSecurityLevel == SecurityLevel.EMERGENCY) return false;  // SLOAD (enum)
    if (contractStatus[contractAddr].isPaused) return false;           // SLOAD + mapping
    return true;
}
```

---

## 7. Batch Operations

### 7.1 Batch Minting (New Feature)

```solidity
/**
 * @notice Batch mint verified credits for multiple captures
 * @dev Amortizes base transaction cost across multiple mints
 * @param captures Array of capture data to mint
 * @return tokenIds Array of minted token IDs
 */
function batchMintVerifiedCredits(
    CaptureData[] calldata captures
) external onlyMinter whenNotPaused nonReentrant returns (uint256[] memory tokenIds) {
    uint256 len = captures.length;
    require(len <= 50, "Batch too large");  // Gas limit protection

    tokenIds = new uint256[](len);

    for (uint256 i = 0; i < len; ) {
        tokenIds[i] = _mintSingleCredit(captures[i]);
        unchecked { ++i; }
    }

    return tokenIds;
}
```

**Savings:** ~21,000 gas per mint in batch (base tx cost amortization)

### 7.2 Batch Retirement

```solidity
/**
 * @notice Batch retire multiple credits
 * @param tokenIds Token IDs to retire
 * @param amounts Amounts to retire
 * @param reason Common retirement reason
 */
function batchRetireCredits(
    uint256[] calldata tokenIds,
    uint256[] calldata amounts,
    string calldata reason
) external whenNotPaused nonReentrant {
    require(tokenIds.length == amounts.length, "Length mismatch");
    require(tokenIds.length <= 100, "Batch too large");

    for (uint256 i = 0; i < tokenIds.length; ) {
        _retireSingle(tokenIds[i], amounts[i], reason);
        unchecked { ++i; }
    }
}
```

---

## 8. L2-Specific Optimizations (Polygon zkEVM)

### 8.1 Calldata Compression

Polygon zkEVM charges per byte of calldata. Optimize function signatures and parameter encoding.

```solidity
// BEFORE: Long function name
function mintVerifiedCreditsWithFullVerification(...) external;

// AFTER: Shorter selector (saves calldata bytes)
function mint(...) external;
```

### 8.2 Storage vs Calldata Tradeoffs

On zkEVM, storage is relatively cheaper than L1. Consider caching more computed values.

---

## 9. Implementation Priority

| Priority | Optimization | Est. Savings | Effort |
|----------|-------------|--------------|--------|
| P0 | Unchecked math in loops | 5-10% | Low |
| P0 | Calldata vs memory | 5% | Low |
| P1 | Struct packing | 10-20% | Medium |
| P1 | Batch operations | 30%+ per batch | Medium |
| P2 | Pagination single-pass | 50% view gas | Medium |
| P2 | Event optimization | 5% | Low |
| P3 | L2-specific optimizations | Variable | High |

---

## 10. Gas Benchmarks (Target)

| Operation | Current | Target | Network |
|-----------|---------|--------|---------|
| mintVerifiedCredits | 350,000 | 280,000 | Polygon PoS |
| purchase | 250,000 | 200,000 | Polygon PoS |
| retireCredits | 120,000 | 95,000 | Polygon PoS |
| createListing | 200,000 | 160,000 | Polygon PoS |
| batchMint (10 items) | 2,500,000 | 2,100,000 | Polygon PoS |

---

## 11. Security Considerations

**Important:** Gas optimizations must not compromise security:

- ✅ Unchecked blocks only where overflow is impossible
- ✅ Reentrancy guards preserved on all state-changing functions
- ✅ Access control checks remain in place
- ✅ Validation logic unchanged
- ❌ Never remove input validation for gas savings

---

## Next Steps

1. **Implement P0 optimizations** in current contracts
2. **Add batch operation functions** to CarbonCredit and CarbonMarketplace
3. **Profile on testnet** with Tenderly gas profiling
4. **Consider zkEVM deployment** for additional L2 savings
5. **Update SDK** with batch operation support

---

## Appendix: Mythril/Slither Analysis Commands

```bash
# Run Slither analysis
slither apps/contracts --exclude-dependencies --filter-paths "mocks|test"

# Run Mythril analysis
myth analyze apps/contracts/contracts/core/CarbonCredit.sol --max-depth 10

# Hardhat gas reporter
npx hardhat test --gas-reporter
```
