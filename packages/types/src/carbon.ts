/**
 * Carbon credit types for TerraQura platform
 */

export enum CreditStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  MINTED = "minted",
  TRANSFERRED = "transferred",
  RETIRED = "retired",
}

export enum DACStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  DECOMMISSIONED = "decommissioned",
}

/**
 * Direct Air Capture (DAC) Unit
 */
export interface DACUnit {
  id: string;
  unitId: string; // bytes32 identifier for blockchain (hex string)

  // Operator
  operatorId: string;
  operatorWallet: string;

  // Location
  name: string;
  facilityType: string | null;
  latitude: number;
  longitude: number;
  countryCode: string;
  region: string | null;

  // Specifications
  capacityTonnesPerYear: number | null;
  technologyType: string | null;
  commissioningDate: Date | null;

  // Status
  status: DACStatus;
  whitelistedAt: Date | null;
  whitelistedBy: string | null;

  // Blockchain
  registryTxHash: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDACUnitInput {
  name: string;
  facilityType?: string;
  latitude: number;
  longitude: number;
  countryCode: string;
  region?: string;
  capacityTonnesPerYear?: number;
  technologyType?: string;
  commissioningDate?: Date;
}

/**
 * Carbon Credit (NFT representation)
 */
export interface CarbonCredit {
  id: string;
  tokenId: string; // uint256 as string

  // Source
  dacUnitId: string;
  captureStartTime: Date;
  captureEndTime: Date;

  // Amounts
  co2CapturedKg: number;
  energyConsumedKwh: number;
  creditsIssued: number | null;

  // Verification
  sourceDataHash: string; // bytes32 hex string
  verificationStatus: CreditStatus;
  efficiencyFactor: number | null;

  // Three verification checks
  sourceVerified: boolean;
  logicVerified: boolean;
  mintVerified: boolean;
  verifiedAt: Date | null;

  // Blockchain
  mintTxHash: string | null;
  blockNumber: number | null;

  // Decentralized storage
  ipfsMetadataCid: string | null;
  arweaveTxId: string | null;

  // Current owner
  currentOwnerId: string | null;
  currentOwnerWallet: string | null;

  // Retirement
  isRetired: boolean;
  retiredAt: Date | null;
  retiredBy: string | null;
  retirementReason: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Credit metadata stored on IPFS/Arweave
 */
export interface CreditMetadata {
  // Core identifiers
  tokenId: string;
  dacUnitId: string;
  dacUnitName: string;

  // Capture details
  captureStartTime: string; // ISO 8601
  captureEndTime: string;
  co2CapturedKg: number;
  energyConsumedKwh: number;
  purityPercentage: number;

  // Location
  location: {
    latitude: number;
    longitude: number;
    countryCode: string;
    region: string | null;
  };

  // Verification
  verification: {
    sourceVerified: boolean;
    logicVerified: boolean;
    mintVerified: boolean;
    efficiencyFactor: number;
    verifiedAt: string;
  };

  // Data integrity
  sourceDataHash: string;

  // Schema version for future compatibility
  schemaVersion: "1.0.0";
}

/**
 * Credit transfer record
 */
export interface CreditTransfer {
  id: string;
  creditId: string;

  fromUserId: string | null;
  fromWallet: string | null;
  toUserId: string | null;
  toWallet: string;

  amount: number;

  // Transaction
  txHash: string;
  blockNumber: number | null;
  gasUsed: number | null;

  // Pricing
  salePriceUsd: number | null;

  transferredAt: Date;
}

/**
 * Provenance event for timeline display
 */
export interface ProvenanceEvent {
  type:
    | "CAPTURE_STARTED"
    | "CAPTURE_COMPLETED"
    | "VERIFICATION_STARTED"
    | "SOURCE_VERIFIED"
    | "LOGIC_VERIFIED"
    | "MINT_VERIFIED"
    | "MINTED"
    | "TRANSFERRED"
    | "RETIRED";
  timestamp: Date;
  txHash: string | null;
  details: Record<string, unknown>;
}
