import { CreditStatus } from "@terraqura/types";

export interface StoredCredit {
  id: string;
  tokenId: string;
  verificationId: string;
  dacUnitId: string;
  captureStartTime: string;
  captureEndTime: string;
  co2CapturedKg: number;
  energyConsumedKwh: number;
  creditsIssued: number;
  escrowedAmount: number;
  initialCreditsIssued: number;
  retiredAmount: number;
  sourceDataHash: string;
  verificationStatus: CreditStatus;
  efficiencyFactor: number;
  mintTxHash: string | null;
  ipfsMetadataCid: string | null;
  arweaveTxId: string | null;
  currentOwnerId: string | null;
  currentOwnerWallet: string | null;
  isRetired: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  retirementTxHash?: string | null;
  retirementTxHashes?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreditsState {
  credits: Record<string, StoredCredit>;
  verificationToCredit: Record<string, string>;
  nextTokenId: number;
}

export const CREDITS_STORE_KEY = "credits:v1";
export const DEFAULT_CREDITS_STATE: CreditsState = {
  credits: {},
  verificationToCredit: {},
  nextTokenId: 1,
};
