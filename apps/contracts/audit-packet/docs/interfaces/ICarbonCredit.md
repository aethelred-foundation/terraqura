# Solidity API

## ICarbonCredit

Interface for the TerraQura Carbon Credit NFT

### CreditMetadata

Credit metadata structure

```solidity
struct CreditMetadata {
  bytes32 dacUnitId;
  bytes32 sourceDataHash;
  uint256 captureTimestamp;
  uint256 co2AmountKg;
  uint256 energyConsumedKwh;
  int256 latitude;
  int256 longitude;
  uint8 purityPercentage;
  bool isRetired;
  string ipfsMetadataUri;
  string arweaveBackupTxId;
}
```

### VerificationResult

Verification result structure

```solidity
struct VerificationResult {
  bool sourceVerified;
  bool logicVerified;
  bool mintVerified;
  uint256 efficiencyFactor;
  uint256 verifiedAt;
}
```

### CreditMinted

```solidity
event CreditMinted(uint256 tokenId, bytes32 dacUnitId, address operator, uint256 co2AmountKg, bytes32 sourceDataHash)
```

Emitted when credits are minted

### CreditRetired

```solidity
event CreditRetired(uint256 tokenId, address retiredBy, uint256 amount, string retirementReason)
```

Emitted when credits are retired

### VerificationCompleted

```solidity
event VerificationCompleted(uint256 tokenId, bool sourceVerified, bool logicVerified, bool mintVerified, uint256 efficiencyFactor)
```

Emitted when verification is completed

### mintVerifiedCredits

```solidity
function mintVerifiedCredits(address to, bytes32 dacUnitId, bytes32 sourceDataHash, uint256 captureTimestamp, uint256 co2AmountKg, uint256 energyConsumedKwh, int256 latitude, int256 longitude, uint8 purityPercentage, string ipfsMetadataUri, string arweaveBackupTxId) external returns (uint256 tokenId)
```

Mint verified carbon credits

### retireCredits

```solidity
function retireCredits(uint256 tokenId, uint256 amount, string reason) external
```

Retire carbon credits

### getCreditProvenance

```solidity
function getCreditProvenance(uint256 tokenId) external view returns (struct ICarbonCredit.CreditMetadata metadata, struct ICarbonCredit.VerificationResult verification)
```

Get credit provenance

### totalCreditsMinted

```solidity
function totalCreditsMinted() external view returns (uint256)
```

Get total credits minted

### totalCreditsRetired

```solidity
function totalCreditsRetired() external view returns (uint256)
```

Get total credits retired

