/**
 * Verification types for TerraQura Proof-of-Physics engine
 */

export enum VerificationPhase {
  SOURCE = "SOURCE",
  LOGIC = "LOGIC",
  MINT = "MINT",
}

export enum VerificationStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  PASSED = "PASSED",
  FAILED = "FAILED",
}

/**
 * Verification request to initiate the process
 */
export interface VerificationRequest {
  dacUnitId: string;
  startTime: Date;
  endTime: Date;
  requestedBy: string;
}

/**
 * Result of the three-phase verification
 */
export interface VerificationResult {
  id: string;
  dacUnitId: string;
  requestedAt: Date;
  completedAt: Date | null;

  // Overall status
  status: VerificationStatus;

  // Phase results
  sourceCheck: PhaseResult;
  logicCheck: LogicCheckResult;
  mintCheck: PhaseResult;

  // Calculated values
  efficiencyFactor: number | null;
  creditsToMint: number | null;

  // Data reference
  sourceDataHash: string;
  sensorReadingIds: string[];
}

export interface PhaseResult {
  phase: VerificationPhase;
  status: VerificationStatus;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}

export interface LogicCheckResult extends PhaseResult {
  // Input values
  co2CapturedKg: number;
  energyConsumedKwh: number;
  purityPercentage: number;

  // Calculated values
  kwhPerTonne: number;
  efficiencyFactor: number;

  // Thresholds used
  minKwhPerTonne: number;
  maxKwhPerTonne: number;
  optimalKwhPerTonne: number;
}

/**
 * Verification constants (matching smart contract)
 */
export const VERIFICATION_CONSTANTS = {
  // Energy efficiency thresholds (kWh per tonne of CO2)
  MIN_KWH_PER_TONNE: 200, // Below = fraud indicator
  MAX_KWH_PER_TONNE: 600, // Above = too inefficient
  OPTIMAL_KWH_PER_TONNE: 350, // Industry optimal

  // Purity requirements
  MIN_PURITY_PERCENTAGE: 90,

  // Scaling factor for efficiency calculation
  SCALE: 10000, // 1e4 = 100%

  // Efficiency bonus/penalty
  MAX_BONUS_PERCENTAGE: 5, // Up to 105% for optimal efficiency
  MAX_PENALTY_PERCENTAGE: 50, // Down to 50% for worst acceptable
} as const;

/**
 * Calculate efficiency factor based on energy consumption
 */
export function calculateEfficiencyFactor(
  kwhPerTonne: number,
  purityPercentage: number
): { factor: number; isValid: boolean; reason: string | null } {
  const { MIN_KWH_PER_TONNE, MAX_KWH_PER_TONNE, OPTIMAL_KWH_PER_TONNE, SCALE, MIN_PURITY_PERCENTAGE } =
    VERIFICATION_CONSTANTS;

  // Check purity threshold
  if (purityPercentage < MIN_PURITY_PERCENTAGE) {
    return { factor: 0, isValid: false, reason: "Purity below minimum threshold" };
  }

  // Check efficiency bounds
  if (kwhPerTonne < MIN_KWH_PER_TONNE) {
    return { factor: 0, isValid: false, reason: "Suspiciously efficient - potential fraud" };
  }

  if (kwhPerTonne > MAX_KWH_PER_TONNE) {
    return { factor: 0, isValid: false, reason: "Energy consumption too high" };
  }

  // Calculate base efficiency factor
  let factor: number;

  if (kwhPerTonne <= OPTIMAL_KWH_PER_TONNE) {
    // Better than optimal - apply bonus
    const bonus =
      ((OPTIMAL_KWH_PER_TONNE - kwhPerTonne) * SCALE) / (OPTIMAL_KWH_PER_TONNE - MIN_KWH_PER_TONNE);
    factor = SCALE + bonus / 20; // Max 5% bonus
  } else {
    // Worse than optimal - apply penalty
    const penalty =
      ((kwhPerTonne - OPTIMAL_KWH_PER_TONNE) * SCALE) / (MAX_KWH_PER_TONNE - OPTIMAL_KWH_PER_TONNE);
    factor = SCALE - penalty / 2; // Max 50% penalty
  }

  // Apply purity adjustment (100% = 105%, 90% = 95%)
  const purityFactor = SCALE + (purityPercentage - 95) * 100;
  factor = (factor * purityFactor) / SCALE;

  // Ensure bounds
  const minFactor = SCALE / 2;
  const maxFactor = SCALE + SCALE / 20;
  factor = Math.max(minFactor, Math.min(maxFactor, factor));

  return { factor: Math.round(factor), isValid: true, reason: null };
}

/**
 * Verification event for audit log
 */
export interface VerificationEvent {
  verificationId: string;
  phase: VerificationPhase;
  status: VerificationStatus;
  timestamp: Date;
  details: Record<string, unknown>;
}
