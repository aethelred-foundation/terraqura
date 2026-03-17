/**
 * User types for TerraQura platform
 */

export enum UserType {
  OPERATOR = "operator",
  BUYER = "buyer",
  INVESTOR = "investor",
  ADMIN = "admin",
}

export enum KYCStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  REJECTED = "rejected",
  EXPIRED = "expired",
}

export interface User {
  id: string;
  walletAddress: string | null;
  email: string | null;
  userType: UserType;

  // KYC/AML
  kycStatus: KYCStatus;
  kycProviderId: string | null;
  kycVerifiedAt: Date | null;
  amlRiskScore: number | null;

  // Profile
  companyName: string | null;
  countryCode: string | null;

  // ADGM Compliance
  isAdgmRegulated: boolean;
  regulatoryId: string | null;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface CreateUserInput {
  walletAddress?: string;
  email?: string;
  userType: UserType;
  companyName?: string;
  countryCode?: string;
}

export interface UpdateUserInput {
  email?: string;
  companyName?: string;
  countryCode?: string;
}

export interface UserSession {
  userId: string;
  walletAddress: string | null;
  email: string | null;
  userType: UserType;
  kycStatus: KYCStatus;
  isAdgmRegulated: boolean;
}
