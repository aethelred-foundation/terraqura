# TerraQura Smart Contracts

> 25 Solidity contracts implementing the carbon credit lifecycle on the Aethelred network.

---

## Overview

| Property | Value |
|----------|-------|
| Solidity version | 0.8.28 |
| EVM target | Cancun |
| Compiler | viaIR enabled, optimizer 200 runs |
| Framework | Hardhat 2.19+ |
| Upgrade pattern | UUPS (OpenZeppelin) |
| Dependencies | OpenZeppelin Contracts 4.9.6, Chainlink Contracts 1.5.0 |
| Test suite | Hardhat + Chai + hardhat-network-helpers |
| Coverage tool | solidity-coverage |
| Gas reporting | hardhat-gas-reporter |
| Linting | solhint 4.1+ |
| Documentation | solidity-docgen |

---

## Contract Categories

### Core (6 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **CarbonCredit** | `core/CarbonCredit.sol` | ERC-1155 token representing verified carbon removal credits. Supports batch minting, provenance tracking, and retirement flags. |
| **CarbonMarketplace** | `core/CarbonMarketplace.sol` | P2P marketplace for listing, purchasing, and settling carbon credit trades with escrow mechanics. |
| **VerificationEngine** | `core/VerificationEngine.sol` | On-chain verification logic for the Proof-of-Physics pipeline. Validates oracle data hashes, efficiency calculations, and minting authorisation. |
| **CarbonRetirement** | `core/CarbonRetirement.sol` | Handles permanent retirement of credits, burning tokens and emitting retirement events for registry recording. |
| **RetirementCertificate** | `core/RetirementCertificate.sol` | Non-transferable NFT certificates issued upon credit retirement, containing retirement metadata and provenance links. |
| **CarbonBatchAuction** | `core/CarbonBatchAuction.sol` | Dutch/batch auction mechanism for bulk credit sales with configurable price decay and minimum bid thresholds. |

### DeFi (4 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **CarbonAMM** | `defi/CarbonAMM.sol` | Automated market maker for continuous carbon credit price discovery with constant-product pools. |
| **CarbonVault** | `defi/CarbonVault.sol` | ERC-4626-style vault for pooled carbon credit strategies, enabling institutional portfolio management. |
| **CarbonFutures** | `defi/CarbonFutures.sol` | Forward contracts for future carbon credit delivery, enabling price hedging and pre-purchase agreements. |
| **FractionalCredit** | `defi/FractionalCredit.sol` | Fractionalisation of carbon credits into smaller denominations for retail accessibility. |

### Oracle (2 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **NativeIoTOracle** | `oracle/NativeIoTOracle.sol` | 1st-party sovereign oracle for DAC telemetry. Stores source data hashes, reading aggregates, and device attestations. |
| **ChainlinkVerifier** | `oracle/ChainlinkVerifier.sol` | Integration with Chainlink VRF for randomised audit selection and Chainlink Functions for off-chain computation verification. |

### Governance (4 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **TerraQuraMultisig** | `governance/TerraQuraMultisig.sol` | Multi-signature wallet for testnet governance actions (contract upgrades, role grants, parameter changes). |
| **TerraQuraMultisigMainnet** | `governance/TerraQuraMultisigMainnet.sol` | Production multisig with stricter quorum and signer requirements. |
| **TerraQuraTimelock** | `governance/TerraQuraTimelock.sol` | Timelock controller for testnet -- enforces a delay between proposal and execution. |
| **TerraQuraTimelockMainnet** | `governance/TerraQuraTimelockMainnet.sol` | Production timelock with extended delay periods for mainnet security. |

### Infrastructure (3 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **TerraQuraAccessControl** | `access/TerraQuraAccessControl.sol` | Centralised role-based access control. Defines the role hierarchy and provides modifiers used across all contracts. |
| **TerraQuraForwarder** | `gasless/TerraQuraForwarder.sol` | ERC-2771 trusted forwarder for meta-transactions, enabling gasless user interactions. |
| **CircuitBreaker** | `security/CircuitBreaker.sol` | Emergency pause mechanism that can halt all contract operations when anomalous conditions are detected. |

### Compliance (2 contracts)

| Contract | File | Description |
|----------|------|-------------|
| **ComplianceRegistry** | `compliance/ComplianceRegistry.sol` | On-chain registry of KYC attestations, jurisdiction whitelists, and transfer restriction rules. |
| **ITMORegistry** | `compliance/ITMORegistry.sol` | International Transferred Mitigation Outcomes registry for Article 6 Paris Agreement compliance. Records retirement-to-ITMO linkages. |

### Insurance (1 contract)

| Contract | File | Description |
|----------|------|-------------|
| **InsurancePool** | `insurance/InsurancePool.sol` | Insurance pool for credit validity risk. Stakers provide collateral; claims are triggered if credits are invalidated post-issuance. |

### Rewards (1 contract)

| Contract | File | Description |
|----------|------|-------------|
| **RewardDistributor** | `rewards/RewardDistributor.sol` | Distributes protocol rewards to participants (operators, verifiers, liquidity providers) based on configurable schedules. |

### Libraries (1 library)

| Library | File | Description |
|---------|------|-------------|
| **EfficiencyCalculator** | `libraries/EfficiencyCalculator.sol` | Pure library for computing DAC efficiency factors from energy consumption and CO2 capture rates. Used by VerificationEngine. |

### Interfaces (13 interfaces)

All core and DeFi contracts expose interfaces in `contracts/interfaces/` for external integration: `ICarbonCredit`, `IVerificationEngine`, `ICarbonRetirement`, `IRetirementCertificate`, `ICarbonAMM`, `ICarbonVault`, `ICarbonFutures`, `IFractionalCredit`, `IInsurancePool`, `IComplianceRegistry`, `IITMORegistry`, `IRewardDistributor`, `ICarbonBatchAuction`.

---

## Role Hierarchy

```
DEFAULT_ADMIN_ROLE (held by multisig)
  |
  +-- OPERATOR_ROLE
  |     Can register DAC units, submit sensor data,
  |     request verifications, manage own listings.
  |
  +-- MINTER_ROLE
  |     Can mint carbon credits after successful verification.
  |     Typically granted to the API backend / worker service.
  |
  +-- PAUSER_ROLE
        Can trigger circuit breaker / emergency pause.
        Granted to monitoring infrastructure and admin multisig.
```

Role assignments are managed through `TerraQuraAccessControl`. The `DEFAULT_ADMIN_ROLE` is the only role that can grant or revoke other roles, and it is held exclusively by the governance multisig.

---

## Deployment Addresses

### Aethelred Testnet (Chain ID: 78432)

| Contract | Proxy Address | Implementation |
|----------|---------------|----------------|
| TerraQuraAccessControl | `TBD` | `TBD` |
| CarbonCredit | `TBD` | `TBD` |
| VerificationEngine | `TBD` | `TBD` |
| CarbonMarketplace | `TBD` | `TBD` |
| CarbonRetirement | `TBD` | `TBD` |
| RetirementCertificate | `TBD` | `TBD` |
| CarbonBatchAuction | `TBD` | `TBD` |
| NativeIoTOracle | `TBD` | `TBD` |
| ChainlinkVerifier | `TBD` | `TBD` |
| CarbonAMM | `TBD` | `TBD` |
| CarbonVault | `TBD` | `TBD` |
| CarbonFutures | `TBD` | `TBD` |
| FractionalCredit | `TBD` | `TBD` |
| ComplianceRegistry | `TBD` | `TBD` |
| ITMORegistry | `TBD` | `TBD` |
| InsurancePool | `TBD` | `TBD` |
| RewardDistributor | `TBD` | `TBD` |
| TerraQuraMultisig | `TBD` | -- |
| TerraQuraTimelock | `TBD` | -- |
| TerraQuraForwarder | `TBD` | `TBD` |
| CircuitBreaker | `TBD` | `TBD` |
| GaslessMarketplace | `TBD` | `TBD` |

> Addresses will be populated after the next testnet deployment cycle. The deploy script is located at `apps/contracts/scripts/deploy.ts`.

---

## Upgrade Process

All upgradeable contracts follow the UUPS pattern. The upgrade lifecycle:

1. **Proposal** -- A multisig signer submits an upgrade proposal specifying the new implementation address and optional initialiser calldata.
2. **Quorum** -- Additional multisig signers approve the proposal until the required quorum is reached.
3. **Timelock Queue** -- The approved proposal is queued in the `TerraQuraTimelock` contract, starting the mandatory delay period.
4. **Execution** -- After the timelock delay, any authorised account can execute the upgrade, which calls `upgradeToAndCall` on the proxy.
5. **Verification** -- The new implementation is verified on the block explorer. Post-upgrade integration tests are executed.

### Timelock Delays

| Network | Minimum Delay |
|---------|---------------|
| Testnet | 1 hour |
| Mainnet | 48 hours |

### Emergency Upgrades

In the event of a critical vulnerability, the `PAUSER_ROLE` can activate the `CircuitBreaker` to halt operations while a standard upgrade is prepared through the timelock.

---

## Audit Status

| Scope | Status | Auditor |
|-------|--------|---------|
| Core contracts (6) | Audit packet prepared | Pending |
| DeFi contracts (4) | Audit packet prepared | Pending |
| Governance + Infrastructure | Audit packet prepared | Pending |
| Oracle contracts | Audit packet prepared | Pending |

Flattened contracts for audit are stored in `apps/contracts/audit-packet/flattened/`.

---

## Gas Benchmarks

Representative gas costs on Aethelred Testnet (estimates, subject to optimiser settings):

| Operation | Estimated Gas |
|-----------|---------------|
| CarbonCredit.mint (single) | ~120,000 |
| CarbonCredit.mintBatch (10 tokens) | ~280,000 |
| CarbonMarketplace.createListing | ~95,000 |
| CarbonMarketplace.purchase | ~140,000 |
| VerificationEngine.submitVerification | ~180,000 |
| CarbonRetirement.retire | ~110,000 |
| RetirementCertificate.mint | ~130,000 |
| CarbonAMM.swap | ~160,000 |
| NativeIoTOracle.submitReading | ~85,000 |

> For detailed gas optimisation analysis, see [GAS_OPTIMIZATION_REVIEW.md](../GAS_OPTIMIZATION_REVIEW.md).

---

## Development

### Compile

```bash
cd apps/contracts
pnpm compile
```

### Test

```bash
pnpm test                 # Run all contract tests
pnpm test:coverage        # Run with coverage report
```

### Deploy

```bash
pnpm deploy:testnet       # Deploy to Aethelred Testnet
pnpm deploy:mainnet       # Deploy to Aethelred Mainnet (requires PRIVATE_KEY)
```

### Verify

```bash
pnpm verify --network aethelredTestnet <CONTRACT_ADDRESS>
```

### Generate Documentation

```bash
npx hardhat docgen
```
