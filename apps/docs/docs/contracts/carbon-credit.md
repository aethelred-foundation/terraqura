---
sidebar_position: 2
---

# CarbonCredit Contract

The `CarbonCredit` contract is an ERC-1155 multi-token contract that represents verified carbon credits.

## Contract Details

- **Standard**: ERC-1155
- **Upgradeability**: UUPS Proxy
- **Dependencies**: OpenZeppelin Contracts Upgradeable

## Key Features

### Token Representation

Each token ID represents a unique batch of carbon credits with:
- Verification batch reference
- CO2 amount (in wei, 18 decimals)
- Energy efficiency metrics
- Provenance data hash
- IPFS/Arweave CID for full data

### Minting

Only verified batches can be minted through the `VerificationEngine`.

```solidity
/**
 * @notice Mint carbon credits from a verified batch
 * @param to Recipient address (must be KYC verified)
 * @param co2Amount Amount of CO2 in tonnes (18 decimals)
 * @param energyUsed Energy consumed in kWh (18 decimals)
 * @param dataHash SHA-256 hash of verification data
 * @param ipfsCid IPFS CID for full provenance data
 * @return tokenId The minted token ID
 */
function mintFromVerification(
    address to,
    uint256 co2Amount,
    uint256 energyUsed,
    bytes32 dataHash,
    string calldata ipfsCid
) external onlyRole(MINTER_ROLE) returns (uint256 tokenId);
```

### Retirement

Credits can be permanently retired to offset emissions:

```solidity
/**
 * @notice Retire carbon credits (permanent offset)
 * @param tokenId The token ID to retire
 * @param amount Amount to retire
 * @param reason Retirement reason (for records)
 */
function retire(
    uint256 tokenId,
    uint256 amount,
    string calldata reason
) external;
```

### Provenance Tracking

Every credit maintains a complete provenance chain:

```solidity
struct ProvenanceRecord {
    uint256 timestamp;
    address actor;
    string action; // MINTED, TRANSFERRED, RETIRED
    bytes32 dataHash;
}

// Get provenance history
function getProvenance(uint256 tokenId)
    external view
    returns (ProvenanceRecord[] memory);
```

## Events

```solidity
event CreditMinted(
    uint256 indexed tokenId,
    address indexed to,
    uint256 amount,
    uint256 energyUsed,
    bytes32 dataHash,
    uint256 vintage
);

event CreditRetired(
    uint256 indexed tokenId,
    address indexed retiree,
    uint256 amount,
    string reason
);

event ProvenanceUpdated(
    uint256 indexed tokenId,
    string ipfsCid,
    bytes32 dataHash
);
```

## Metadata

Token metadata follows a standard structure stored on IPFS:

```json
{
  "name": "TerraQura Carbon Credit #12345",
  "description": "Verified carbon removal credit",
  "image": "ipfs://...",
  "properties": {
    "vintage": 2026,
    "co2_tonnes": "10.5",
    "efficiency_kwh_per_tonne": "350",
    "dac_unit": "TQ-DAC-001",
    "verification_batch": "batch-xyz-123",
    "data_hash": "0x..."
  }
}
```

## Security Considerations

- Only MINTER_ROLE can mint new credits
- Retirement is irreversible
- All recipients must be KYC verified
- Transfers respect KYC requirements
