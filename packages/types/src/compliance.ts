/**
 * Compliance and audit types for ADGM regulatory requirements
 */

export enum AuditAction {
  // User actions
  USER_CREATED = "user_created",
  USER_KYC_VERIFIED = "user_kyc_verified",
  USER_KYC_REJECTED = "user_kyc_rejected",

  // DAC actions
  DAC_REGISTERED = "dac_registered",
  DAC_WHITELISTED = "dac_whitelisted",
  DAC_SUSPENDED = "dac_suspended",

  // Sensor actions
  SENSOR_READING = "sensor_reading",
  ANOMALY_DETECTED = "anomaly_detected",

  // Verification actions
  VERIFICATION_STARTED = "verification_started",
  VERIFICATION_COMPLETED = "verification_completed",
  VERIFICATION_FAILED = "verification_failed",

  // Credit actions
  CREDIT_MINTED = "credit_minted",
  CREDIT_TRANSFERRED = "credit_transferred",
  CREDIT_RETIRED = "credit_retired",

  // Admin actions
  ADMIN_ACTION = "admin_action",

  // Compliance actions
  DATA_ERASURE_REQUEST = "data_erasure_request",
}

/**
 * Audit log entry (append-only)
 */
export interface AuditLogEntry {
  id: string;

  action: AuditAction;
  actorId: string | null;
  actorWallet: string | null;

  // Target entity
  entityType: string | null;
  entityId: string | null;

  // Details
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;

  // Blockchain anchoring
  dataHash: string | null;
  anchoredTxHash: string | null;
  anchoredAt: Date | null;

  createdAt: Date;
}

export interface CreateAuditLogInput {
  action: AuditAction;
  actorId?: string;
  actorWallet?: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Data erasure request (GDPR/ADGM Right to Erasure)
 */
export enum ErasureStatus {
  REQUESTED = "requested",
  PROCESSING = "processing",
  COMPLETED = "completed",
  REJECTED = "rejected",
}

export interface ErasureRequest {
  id: string;
  userId: string;

  status: ErasureStatus;

  // What to erase
  erasePersonalData: boolean;
  eraseSensorRawData: boolean;

  // Processing
  requestedAt: Date;
  processedAt: Date | null;
  processedBy: string | null;

  // Compliance note
  rejectionReason: string | null;
  complianceNotes: string | null;

  // Audit
  dataHashBeforeErasure: string | null;
  dataHashAfterErasure: string | null;
}

export interface CreateErasureRequestInput {
  erasePersonalData?: boolean;
  eraseSensorRawData?: boolean;
}

/**
 * KYC verification types
 */
export interface KYCInitiationResponse {
  applicantId: string;
  accessToken: string;
  redirectUrl: string;
}

export interface KYCWebhookPayload {
  type: string;
  applicantId: string;
  inspectionId: string;
  correlationId: string;
  levelName: string;
  reviewStatus: "init" | "pending" | "prechecked" | "queued" | "completed" | "onHold";
  reviewResult: {
    reviewAnswer: "GREEN" | "RED" | "RETRY";
    rejectLabels?: string[];
    reviewRejectType?: string;
    clientComment?: string;
  } | null;
  createdAtMs: number;
}

/**
 * AML check types
 */
export interface AMLCheckRequest {
  walletAddress: string;
  userId: string;
}

export interface AMLCheckResult {
  walletAddress: string;
  riskScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
  flags: AMLFlag[];
  checkedAt: Date;
  provider: "chainalysis" | "elliptic" | "manual";
}

export interface AMLFlag {
  type: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  source: string;
}

/**
 * ADGM-specific compliance types
 */
export interface ADGMComplianceStatus {
  userId: string;

  // KYC
  kycCompleted: boolean;
  kycVerifiedAt: Date | null;

  // AML
  amlChecked: boolean;
  amlRiskScore: number | null;
  amlLastCheckedAt: Date | null;

  // ADGM specific
  isAdgmRegistered: boolean;
  regulatoryId: string | null;
  licenseType: string | null;

  // Overall status
  isFullyCompliant: boolean;
  complianceIssues: string[];
}
