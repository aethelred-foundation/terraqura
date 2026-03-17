# TerraQura Smart Contract Audit Packet

**Prepared for:** Professional Security Audit
**Date:** February 2025
**Version:** 1.1.0
**Network:** Polygon (Amoy Testnet / Mainnet)

---

## 📋 Executive Summary

TerraQura is an enterprise-grade carbon credit verification and trading platform built on Polygon. The protocol implements:

- **Proof-of-Physics Verification**: Three-phase verification ensuring carbon capture data is legitimate
- **ERC-1155 Carbon Credits**: Tokenized carbon credits with full provenance tracking
- **Gasless Marketplace**: Meta-transaction enabled marketplace for seamless UX
- **Enterprise Governance**: Timelock, Multisig, and Circuit Breaker security controls

---

## 📁 Audit Packet Contents

```
audit-packet/
├── README.md                    # This file
├── flattened/                   # Single-file contracts (for easy auditing)
│   ├── CarbonCredit_Flat.sol
│   ├── CarbonMarketplace_Flat.sol
│   ├── VerificationEngine_Flat.sol
│   ├── TerraQuraAccessControl_Flat.sol
│   ├── TerraQuraTimelock_Flat.sol
│   ├── TerraQuraMultisig_Flat.sol
│   ├── CircuitBreaker_Flat.sol
│   └── GaslessMarketplace_Flat.sol
├── docs/                        # NatSpec documentation
│   ├── core/
│   ├── access/
│   ├── governance/
│   └── security/
├── coverage/                    # Test coverage report (HTML)
├── coverage.json                # Raw coverage data
└── SolidityMetrics.html         # Code complexity analysis
```

---

## 🏗️ Contract Architecture

### Core Contracts

| Contract | Description | Lines | Complexity |
|----------|-------------|-------|------------|
| **CarbonCredit.sol** | ERC-1155 token for carbon credits | ~460 | Medium |
| **VerificationEngine.sol** | Proof-of-Physics verification | ~500 | High |
| **CarbonMarketplace.sol** | P2P trading marketplace | ~760 | High |
| **GaslessMarketplace.sol** | ERC-2771 meta-transaction wrapper | ~150 | Low |

### Access Control & Governance

| Contract | Description | Lines | Complexity |
|----------|-------------|-------|------------|
| **TerraQuraAccessControl.sol** | Role-based access + KYC management | ~420 | Medium |
| **TerraQuraTimelock.sol** | OpenZeppelin TimelockController wrapper | ~100 | Low |
| **TerraQuraMultisig.sol** | M-of-N multisig wallet | ~380 | Medium |
| **CircuitBreaker.sol** | Emergency stop + rate limiting | ~390 | Medium |

### Supporting Contracts

| Contract | Description |
|----------|-------------|
| **EfficiencyCalculator.sol** | Library for efficiency factor calculations |
| **TerraQuraForwarder.sol** | ERC-2771 trusted forwarder |
| **ChainlinkVerifier.sol** | Chainlink Functions integration |

---

## 🔒 Security Features

### Implemented Patterns

- ✅ **Reentrancy Guards**: All state-modifying functions protected
- ✅ **Access Control**: Role-based permissions with expiration
- ✅ **Upgradeable (UUPS)**: Safe upgrade pattern with authorization
- ✅ **Pausable**: Emergency pause capability
- ✅ **Rate Limiting**: Configurable operation limits
- ✅ **Volume Limits**: Daily transaction caps
- ✅ **Timelock Governance**: 2-day minimum delay for critical operations
- ✅ **Multisig Support**: M-of-N transaction approval
- ✅ **Circuit Breaker**: Multiple security levels

### Recent Bug Fixes (v1.1.0)

1. **Role Expiration Enforcement** - Fixed: Roles now properly expire
2. **Offer Rejection Griefing** - Fixed: Only authorized parties can reject offers
3. **KYC Verification** - Enhanced: Requires sanctions clearance

---

## 📊 Test Coverage Summary

**Total Tests: 324 passing**

| Contract | Statements | Branches | Functions | Lines |
|----------|-----------|----------|-----------|-------|
| TerraQuraAccessControl | 95.83% | 70.45% | 85% | 90.63% |
| CarbonCredit | 97.83% | 78% | 95.45% | 97.01% |
| VerificationEngine | 98.18% | 77.78% | 94.12% | 98.72% |
| CarbonMarketplace | 89.29% | 63.79% | 81.48% | 86.93% |
| GaslessMarketplace | 83.87% | 67.86% | 87.5% | 86.49% |
| TerraQuraMultisig | 95% | 69.32% | 100% | 92.59% |
| TerraQuraTimelock | 93.75% | 93.75% | 100% | 93.75% |
| CircuitBreaker | 94% | 75% | 86.36% | 94.25% |
| ChainlinkVerifier | 97.56% | 89.29% | 100% | 95.71% |
| EfficiencyCalculator | 100% | 75% | 100% | 93.55% |
| **Overall** | **90.68%** | **70.52%** | **87.57%** | **89.76%** |

Coverage increased from 52.89% to **89.76%** - approaching enterprise-grade target of 90%+.

---

## 🎯 Areas of Focus for Audit

### High Priority

1. **VerificationEngine.verify()** - Core verification logic
2. **CarbonCredit.mintVerifiedCredits()** - Token minting with verification
3. **CarbonMarketplace.purchase()** - Fund handling and transfers
4. **CarbonMarketplace.acceptOffer()** - Offer acceptance logic
5. **TerraQuraMultisig.executeTransaction()** - Multisig execution

### Medium Priority

1. **Role expiration enforcement** in TerraQuraAccessControl
2. **ERC-2771 implementation** in GaslessMarketplace
3. **Fee calculation and distribution** in marketplace
4. **Upgrade authorization** in all UUPS contracts

### Low Priority

1. View functions
2. Event emissions
3. Admin setters with proper access control

---

## 🔐 Privileged Roles

| Role | Permissions | Recommended Holder |
|------|-------------|-------------------|
| DEFAULT_ADMIN_ROLE | Grant/revoke all roles | Timelock |
| ADMIN_ROLE | Manage operators, parameters | Multisig → Timelock |
| MINTER_ROLE | Mint carbon credits | VerificationEngine contract |
| OPERATOR_ROLE | Submit verifications | DAC facility operators |
| COMPLIANCE_ROLE | Manage KYC/AML | Compliance team multisig |
| PAUSER_ROLE | Emergency pause | Security multisig |
| UPGRADER_ROLE | Upgrade contracts | Timelock (with 2+ day delay) |
| TREASURY_ROLE | Withdraw fees | Treasury multisig |

---

## 📝 Deployment Configuration

### Constructor Parameters

**TerraQuraTimelock:**
- `minDelay`: 172800 (2 days for production)
- `proposers`: [Multisig address]
- `executors`: [address(0)] for anyone
- `admin`: address(0) after setup

**TerraQuraMultisig:**
- `signers`: [signer1, signer2, signer3, signer4, signer5]
- `threshold`: 3 (3-of-5)

**CarbonMarketplace:**
- `platformFeeBps`: 250 (2.5%)
- `maxFeeBps`: 500 (5% cap)

---

## 📞 Contact

**Project:** TerraQura
**Website:** [terraqura.io]
**Repository:** [github.com/terraqura]

---

## ⚠️ Disclaimer

This audit packet is provided for security review purposes. The contracts are in active development. Do not use in production without a completed professional security audit.
