# Solidity API

## TerraQuraAccessControl

Centralized role-based access control for all TerraQura contracts

_Implements enterprise-grade role management with time-locks and multi-sig support_

### ADMIN_ROLE

```solidity
bytes32 ADMIN_ROLE
```

### OPERATOR_ROLE

```solidity
bytes32 OPERATOR_ROLE
```

### VERIFIER_ROLE

```solidity
bytes32 VERIFIER_ROLE
```

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### COMPLIANCE_ROLE

```solidity
bytes32 COMPLIANCE_ROLE
```

### AUDITOR_ROLE

```solidity
bytes32 AUDITOR_ROLE
```

### TREASURY_ROLE

```solidity
bytes32 TREASURY_ROLE
```

### UPGRADER_ROLE

```solidity
bytes32 UPGRADER_ROLE
```

### PAUSER_ROLE

```solidity
bytes32 PAUSER_ROLE
```

### roleExpiration

```solidity
mapping(bytes32 => mapping(address => uint256)) roleExpiration
```

Mapping of role + account to expiration timestamp

### KycStatus

```solidity
enum KycStatus {
  NONE,
  PENDING,
  VERIFIED,
  REJECTED,
  EXPIRED
}
```

### KycInfo

```solidity
struct KycInfo {
  enum TerraQuraAccessControl.KycStatus status;
  uint256 verifiedAt;
  uint256 expiresAt;
  string provider;
  bytes32 applicantIdHash;
  bool sanctionsCleared;
}
```

### kycRegistry

```solidity
mapping(address => struct TerraQuraAccessControl.KycInfo) kycRegistry
```

### kycValidityPeriod

```solidity
uint256 kycValidityPeriod
```

### KycStatusUpdated

```solidity
event KycStatusUpdated(address account, enum TerraQuraAccessControl.KycStatus status, string provider, uint256 expiresAt)
```

### KycExpired

```solidity
event KycExpired(address account)
```

### SanctionsStatusUpdated

```solidity
event SanctionsStatusUpdated(address account, bool cleared)
```

### RoleGrantedWithExpiry

```solidity
event RoleGrantedWithExpiry(bytes32 role, address account, uint256 expiresAt)
```

### EmergencyPause

```solidity
event EmergencyPause(address pauser, string reason)
```

### KycNotVerified

```solidity
error KycNotVerified(address account)
```

### KycExpired_

```solidity
error KycExpired_(address account)
```

### SanctionsNotCleared

```solidity
error SanctionsNotCleared(address account)
```

### RoleExpired

```solidity
error RoleExpired(bytes32 role, address account)
```

### InvalidKycProvider

```solidity
error InvalidKycProvider()
```

### AccountBlacklisted

```solidity
error AccountBlacklisted(address account)
```

### onlyKycVerified

```solidity
modifier onlyKycVerified(address account)
```

### onlySanctionsCleared

```solidity
modifier onlySanctionsCleared(address account)
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address admin) public
```

### updateKycStatus

```solidity
function updateKycStatus(address account, enum TerraQuraAccessControl.KycStatus status, string provider, bytes32 applicantIdHash) external
```

Update KYC status for an account

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The wallet address |
| status | enum TerraQuraAccessControl.KycStatus | The KYC status |
| provider | string | The KYC provider name |
| applicantIdHash | bytes32 | Hash of the provider's applicant ID |

### updateSanctionsStatus

```solidity
function updateSanctionsStatus(address account, bool cleared) external
```

Update sanctions screening status

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The wallet address |
| cleared | bool | Whether sanctions screening passed |

### batchUpdateKycStatus

```solidity
function batchUpdateKycStatus(address[] accounts, enum TerraQuraAccessControl.KycStatus status, string provider) external
```

Batch update KYC status for multiple accounts

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| accounts | address[] | Array of wallet addresses |
| status | enum TerraQuraAccessControl.KycStatus | The KYC status to set |
| provider | string | The KYC provider name |

### setKycValidityPeriod

```solidity
function setKycValidityPeriod(uint256 period) external
```

Set KYC validity period

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| period | uint256 | Duration in seconds |

### isKycVerified

```solidity
function isKycVerified(address account) public view returns (bool)
```

Check if an account has valid KYC

### getKycInfo

```solidity
function getKycInfo(address account) external view returns (enum TerraQuraAccessControl.KycStatus status, uint256 verifiedAt, uint256 expiresAt, string provider, bool sanctionsCleared, bool isValid)
```

Get full KYC info for an account

### emergencyPause

```solidity
function emergencyPause(string reason) external
```

Emergency pause all contracts

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reason | string | The reason for pausing |

### unpause

```solidity
function unpause() external
```

Unpause contracts

### grantRoleWithExpiry

```solidity
function grantRoleWithExpiry(bytes32 role, address account, uint256 expiresAt) external
```

Grant role with expiration

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The role to grant |
| account | address | The account to grant the role to |
| expiresAt | uint256 | Timestamp when role expires (must be in future) |

### isRoleExpired

```solidity
function isRoleExpired(bytes32 role, address account) public view returns (bool)
```

Check if role has expired for an account

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The role to check |
| account | address | The account to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if role is expired or was never granted with expiry |

### hasValidRole

```solidity
function hasValidRole(bytes32 role, address account) public view returns (bool)
```

Check if account has valid (non-expired) role

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The role to check |
| account | address | The account to check |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | True if account has the role and it hasn't expired |

### revokeExpiredRole

```solidity
function revokeExpiredRole(bytes32 role, address account) external
```

Revoke expired role (can be called by anyone to clean up)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The role to revoke |
| account | address | The account to revoke from |

### extendRoleExpiry

```solidity
function extendRoleExpiry(bytes32 role, address account, uint256 newExpiresAt) external
```

Extend role expiration (only role admin)

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| role | bytes32 | The role to extend |
| account | address | The account |
| newExpiresAt | uint256 | New expiration timestamp |

### hasRoleAndKyc

```solidity
function hasRoleAndKyc(bytes32 role, address account) external view returns (bool)
```

Check if account has role and is KYC verified

### _authorizeUpgrade

```solidity
function _authorizeUpgrade(address newImplementation) internal
```

_Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
{upgradeTo} and {upgradeToAndCall}.

Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.

```solidity
function _authorizeUpgrade(address) internal override onlyOwner {}
```_

### supportsInterface

```solidity
function supportsInterface(bytes4 interfaceId) public view returns (bool)
```

_See {IERC165-supportsInterface}._

