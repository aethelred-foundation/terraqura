# TerraQura Security Audit Report

**Version:** 1.0.0
**Date:** February 2, 2026
**Prepared for:** Security Auditors & Investors
**Network:** Polygon Amoy Testnet (Chain ID: 80002)

---

## Executive Summary

TerraQura is an enterprise-grade carbon credit verification and trading platform built on Polygon. This document provides a comprehensive security overview of the smart contract architecture, test coverage, deployed contracts, and security mechanisms.

### Key Metrics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Statement Coverage | 100% | 99% | ✅ Exceeded |
| Line Coverage | 100% | 99% | ✅ Exceeded |
| Function Coverage | 96.25% | 95% | ✅ Exceeded |
| Branch Coverage | 82.36% | 80% | ✅ Exceeded |
| Total Tests | 562 | 500+ | ✅ Exceeded |
| Contracts Deployed | 7/8 | 8/8 | ⚠️ Pending |

---

## 1. Contract Architecture

### 1.1 Core Contracts

| Contract | Purpose | Proxy Pattern | Lines of Code |
|----------|---------|---------------|---------------|
| TerraQuraAccessControl | Role-based access control | UUPS | ~150 |
| VerificationEngine | Proof-of-Physics verification | UUPS | ~300 |
| CarbonCredit | ERC-1155 carbon credit tokens | UUPS | ~350 |
| CarbonMarketplace | Carbon credit trading | UUPS | ~280 |

### 1.2 Governance Contracts

| Contract | Purpose | Pattern | Security Level |
|----------|---------|---------|----------------|
| TerraQuraMultisig | M-of-N signature wallet | Standard | Critical |
| TerraQuraTimelock | Operation delay mechanism | Standard | Critical |

### 1.3 Security Contracts

| Contract | Purpose | Proxy Pattern |
|----------|---------|---------------|
| CircuitBreaker | Emergency pause & rate limiting | UUPS |
| GaslessMarketplace | Meta-transaction marketplace | UUPS (Pending) |

---

## 2. Security Features

### 2.1 Access Control

```
Role Hierarchy:
├── DEFAULT_ADMIN_ROLE (Owner)
│   ├── MINTER_ROLE (Can mint carbon credits)
│   ├── OPERATOR_ROLE (Can manage DAC units)
│   ├── VERIFIER_ROLE (Can verify captures)
│   └── PAUSER_ROLE (Can pause contracts)
```

**Implementation:**
- OpenZeppelin AccessControlUpgradeable
- Role expiration support (time-limited roles)
- Granular permissions per contract

### 2.2 Upgrade Safety (UUPS Pattern)

All upgradeable contracts implement:
- `_authorizeUpgrade()` with owner-only restriction
- `_disableInitializers()` in constructor
- Storage gap for future upgrades

```solidity
// Example from CarbonCredit.sol
function _authorizeUpgrade(address) internal override onlyOwner {}
```

### 2.3 Multi-Signature Governance

**Configuration:** 2-of-3 (testnet), recommended 3-of-5 for mainnet

Features:
- EIP-712 typed signatures
- Transaction expiration (7 days default)
- Nonce-based replay protection
- Signer rotation support

### 2.4 Timelock Protection

**Delay:** 1 hour (testnet), 2 days minimum for production

Protected Operations:
- Contract upgrades
- Fee changes
- Role management
- Parameter updates

### 2.5 Circuit Breaker

Security Levels:
1. **NORMAL** - All operations allowed
2. **ELEVATED** - Enhanced monitoring
3. **HIGH** - Strict limits applied
4. **CRITICAL** - Essential operations only
5. **EMERGENCY** - All operations paused

Features:
- Global pause capability
- Per-contract pause
- Rate limiting (100 ops/hour default)
- Volume limits (1000 ETH/day default)
- 1-hour cooldown after unpause

---

## 3. Deployed Contracts (Polygon Amoy)

### 3.1 Core Contracts

| Contract | Proxy Address | Implementation |
|----------|---------------|----------------|
| TerraQuraAccessControl | `0x6098a0cF16D90817f4C8d730DeA998453F2DE904` | `0x5496df69...` |
| VerificationEngine | `0xcB746aB50254A735566676979e69aD6F5842080d` | `0x8f78979E...` |
| CarbonCredit | `0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036` | `0x4874BA94...` |
| CarbonMarketplace | `0xABc0Fa37a6B78DA9514ee36974DAf16ABafFd682` | `0xb8340233...` |

### 3.2 Governance Contracts

| Contract | Address |
|----------|---------|
| TerraQuraMultisig | `0xBcCeB8cc6995c54467D144De05eD0325f0448a05` |
| TerraQuraTimelock | `0x57AA5593dD9a8cBB6080247cb2CD2F2a7D21Ac31` |

### 3.3 Security Contracts

| Contract | Proxy Address | Implementation |
|----------|---------------|----------------|
| CircuitBreaker | `0xa0489d8a69075908926bCDdAe2D6BD61EbBb550B` | `0x8a02DD0A...` |

---

## 4. Test Coverage Analysis

### 4.1 Coverage by Contract

| File | Statements | Branches | Functions | Lines |
|------|------------|----------|-----------|-------|
| TerraQuraAccessControl.sol | 100% | 82.5% | 94.44% | 100% |
| CarbonCredit.sol | 100% | 81.25% | 95.45% | 100% |
| CarbonMarketplace.sol | 100% | 79.31% | 96.3% | 100% |
| VerificationEngine.sol | 100% | 83.33% | 94.12% | 100% |
| TerraQuraMultisig.sol | 100% | 81.4% | 100% | 100% |
| TerraQuraTimelock.sol | 100% | 100% | 100% | 100% |
| CircuitBreaker.sol | 100% | 83.33% | 95% | 100% |
| EfficiencyCalculator.sol | 100% | 81.25% | 100% | 100% |
| GaslessMarketplace.sol | 100% | 76.67% | 88.89% | 100% |

### 4.2 Test Categories

| Category | Tests | Status |
|----------|-------|--------|
| Unit Tests | 350+ | ✅ Passing |
| Integration Tests | 100+ | ✅ Passing |
| Access Control Tests | 50+ | ✅ Passing |
| Edge Case Tests | 40+ | ✅ Passing |
| Sabotage Path Tests | 20+ | ✅ Passing |

---

## 5. Known Considerations

### 5.1 Branch Coverage Notes

The following branches are intentionally not covered due to architectural constraints:

1. **CarbonCredit.sol (mintVerified check)**
   - Replaced with `assert()` - invariant that should never fail
   - Hash uniqueness enforced at entry point

2. **TerraQuraMultisig.sol (threshold auto-adjustment)**
   - Guard condition makes branch mathematically impossible
   - Documented and removed as dead code

3. **GaslessMarketplace.sol (_msgData function)**
   - ERC-2771 compliance function
   - Not used internally but required for standard compliance

### 5.2 Testnet vs Production Differences

| Setting | Testnet | Production |
|---------|---------|------------|
| Timelock Delay | 1 hour | 2+ days |
| Multisig Threshold | 2-of-3 | 3-of-5+ |
| Rate Limits | 100/hour | Configurable |
| Volume Limits | 1000 ETH/day | Configurable |

---

## 6. Security Recommendations

### 6.1 Pre-Mainnet Checklist

- [ ] Professional third-party audit
- [ ] Bug bounty program setup
- [ ] Multisig with hardware wallets
- [ ] Timelock delay increased to 48+ hours
- [ ] Emergency response plan documented
- [ ] Monitoring and alerting configured

### 6.2 Operational Security

1. **Key Management**
   - Use hardware wallets for all signers
   - Geographically distribute signers
   - Regular key rotation schedule

2. **Monitoring**
   - Set up event monitoring for all contracts
   - Alert on unusual activity patterns
   - Monitor gas prices for frontrunning

3. **Incident Response**
   - Document emergency procedures
   - Test circuit breaker activation
   - Maintain communication channels

---

## 7. Verification Instructions

### 7.1 Run Tests Locally

```bash
cd apps/contracts
npm install
npx hardhat test
npx hardhat coverage
```

### 7.2 Verify Deployed Contracts

```bash
# Check contract on Polygonscan
https://amoy.polygonscan.com/address/0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036

# Interact via Hardhat Console
npx hardhat console --network polygonAmoy
const cc = await ethers.getContractAt("CarbonCredit", "0xfc0CaCA6C6abc035562F4a47e12a0d8f7Cd51036")
await cc.name() // "TerraQura Carbon Credit"
```

---

## 8. Contact Information

**Repository:** TerraQuraMVP
**Audit Packet Location:** `/apps/contracts/audit-packet/`
**Documentation:** `/apps/contracts/audit-packet/docs/`

---

## Appendix A: Deployment Transaction Hashes

| Contract | Deployment Block | Verified |
|----------|------------------|----------|
| TerraQuraAccessControl | 33201xxx | ⏳ Pending |
| VerificationEngine | 33201xxx | ⏳ Pending |
| CarbonCredit | 33201xxx | ⏳ Pending |
| CarbonMarketplace | 33201xxx | ⏳ Pending |
| TerraQuraMultisig | 33201xxx | ⏳ Pending |
| TerraQuraTimelock | 33201xxx | ⏳ Pending |
| CircuitBreaker | 33201xxx | ⏳ Pending |

## Appendix B: Verified Test Mint

- **Transaction:** `0x7100551076ac5a4129d8498369098fa99afaa0bc6aa35236d35dbfb94af2a0d0`
- **Block:** 33201985
- **Token ID:** 41026877200893154473076554262386697368627741192364320104672419990764443973203
- **Amount:** 1000 credits (1 tonne CO2)
- **Status:** ✅ Successful
