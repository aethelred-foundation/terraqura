/**
 * TerraQura Mock Data Generation
 *
 * Deterministic, seeded random data generators for development and testing.
 * NO Math.random() or Date.now() at module level — all functions are pure.
 */

// ─── Seeded Random Utilities ────────────────

export function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

export function seededFloat(seed: number, min: number, max: number): number {
  return seededRandom(seed) * (max - min) + min;
}

export function seededPick<T>(seed: number, arr: T[]): T {
  return arr[seededInt(seed, 0, arr.length - 1)]!;
}

export function seededAddress(seed: number): string {
  let hex = '0x';
  for (let i = 0; i < 40; i++) {
    hex += Math.floor(seededRandom(seed + i + 1) * 16).toString(16);
  }
  return hex;
}

export function seededTxHash(seed: number): string {
  let hex = '0x';
  for (let i = 0; i < 64; i++) {
    hex += Math.floor(seededRandom(seed + i + 100) * 16).toString(16);
  }
  return hex;
}

// ─── Time Series ────────────────────────────

export function generateTimeSeriesData(
  seed: number,
  days: number,
  minVal: number,
  maxVal: number,
): { day: number; value: number }[] {
  const result: { day: number; value: number }[] = [];
  for (let i = 0; i < days; i++) {
    result.push({
      day: i + 1,
      value: seededFloat(seed + i * 7, minVal, maxVal),
    });
  }
  return result;
}

export function generateWeeklyData(
  seed: number,
  weeks: number,
  minVal: number,
  maxVal: number,
): { week: number; value: number }[] {
  const result: { week: number; value: number }[] = [];
  for (let i = 0; i < weeks; i++) {
    result.push({
      week: i + 1,
      value: seededFloat(seed + i * 13, minVal, maxVal),
    });
  }
  return result;
}

// ─── Governance Proposals ───────────────────

const PROPOSAL_TITLES = [
  'Increase platform fee to 3%',
  'Add NEOM DAC region',
  'Upgrade verification thresholds v2',
  'Enable cross-chain bridge to Polygon',
  'Reduce timelock delay to 30min',
  'Approve Jubail expansion budget',
  'Onboard Riyadh solar DAC cluster',
  'Update oracle heartbeat to 5min',
  'Grant compliance role to auditor DAO',
  'Migrate treasury to multisig v2',
];

const PROPOSAL_DESCRIPTIONS = [
  'This proposal aims to adjust the platform fee structure to better sustain protocol development.',
  'Expanding coverage to new DAC regions increases carbon capture capacity and market reach.',
  'Updated verification thresholds improve accuracy and reduce false positive rates.',
  'Cross-chain bridging enables broader liquidity and marketplace access for credit holders.',
  'Reducing the timelock delay improves governance responsiveness for time-sensitive operations.',
  'Allocating budget for the Jubail industrial zone expansion doubles capture capacity.',
  'Onboarding solar-powered DAC units in Riyadh for sustainable carbon capture operations.',
  'Shortening the oracle heartbeat ensures more timely detection of device anomalies.',
  'Granting compliance roles enables the auditor DAO to perform on-chain compliance checks.',
  'Migrating treasury funds to the upgraded multisig contract with improved security features.',
];

const PROPOSAL_STATUSES = ['Draft', 'Active', 'Passed', 'Defeated', 'Executed'] as const;

export interface MockProposal {
  id: number;
  title: string;
  proposer: string;
  description: string;
  forVotes: number;
  againstVotes: number;
  status: (typeof PROPOSAL_STATUSES)[number];
  quorumPercentage: number;
}

export function generateMockProposals(seed: number, count: number): MockProposal[] {
  const result: MockProposal[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 31;
    const forVotes = seededInt(s + 1, 100, 50000);
    const againstVotes = seededInt(s + 2, 50, 30000);
    result.push({
      id: i + 1,
      title: seededPick(s + 3, PROPOSAL_TITLES),
      proposer: seededAddress(s + 4),
      description: seededPick(s + 5, PROPOSAL_DESCRIPTIONS),
      forVotes,
      againstVotes,
      status: seededPick(s + 6, [...PROPOSAL_STATUSES]),
      quorumPercentage: seededInt(s + 7, 20, 95),
    });
  }
  return result;
}

// ─── Multisig Transactions ──────────────────

const TARGET_CONTRACTS = [
  'CarbonCredit',
  'CarbonMarketplace',
  'VerificationEngine',
  'CircuitBreaker',
  'AccessControl',
  'NativeIoTOracle',
  'Timelock',
];

const FUNCTION_NAMES = [
  'setPlatformFee',
  'pause',
  'unpause',
  'grantRole',
  'revokeRole',
  'updateThresholds',
  'setHeartbeatTimeout',
  'whitelistDevice',
  'suspendDevice',
  'setFeeRecipient',
];

const MULTISIG_STATUSES = ['Pending', 'Executed', 'Failed', 'Cancelled'] as const;

export interface MockMultisigTxn {
  id: number;
  submittedBy: string;
  targetContract: string;
  functionName: string;
  value: string;
  confirmations: string[];
  required: number;
  status: (typeof MULTISIG_STATUSES)[number];
  submittedAt: number;
}

export function generateMockMultisigTxns(seed: number, count: number): MockMultisigTxn[] {
  const result: MockMultisigTxn[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 37;
    const required = seededInt(s + 1, 2, 5);
    const numConfirmations = seededInt(s + 2, 0, required);
    const confirmations: string[] = [];
    for (let j = 0; j < numConfirmations; j++) {
      confirmations.push(seededAddress(s + 10 + j));
    }
    result.push({
      id: i + 1,
      submittedBy: seededAddress(s + 3),
      targetContract: seededPick(s + 4, TARGET_CONTRACTS),
      functionName: seededPick(s + 5, FUNCTION_NAMES),
      value: seededInt(s + 6, 0, 100).toString(),
      confirmations,
      required,
      status: seededPick(s + 7, [...MULTISIG_STATUSES]),
      submittedAt: 1710000000 + seededInt(s + 8, 0, 700000),
    });
  }
  return result;
}

// ─── Telemetry History ──────────────────────

export interface TelemetryReading {
  hour: number;
  co2Captured: number;
  energyUsed: number;
  efficiency: number;
  temperature: number;
  humidity: number;
}

export function generateTelemetryHistory(
  seed: number,
  deviceId: string,
  hours: number,
): TelemetryReading[] {
  const deviceSeed = seed + deviceId.length * 17;
  const result: TelemetryReading[] = [];
  for (let i = 0; i < hours; i++) {
    const s = deviceSeed + i * 11;
    result.push({
      hour: i,
      co2Captured: seededFloat(s + 1, 5, 45),
      energyUsed: seededFloat(s + 2, 20, 120),
      efficiency: seededFloat(s + 3, 60, 99),
      temperature: seededFloat(s + 4, 18, 55),
      humidity: seededFloat(s + 5, 10, 85),
    });
  }
  return result;
}

// ─── Retirement Certificates ────────────────

const BENEFICIARIES = [
  'Saudi Aramco Carbon Fund',
  'NEOM Green Initiative',
  'Abu Dhabi Sustainability Corp',
  'Jubail Industrial Authority',
  'Riyadh Climate Foundation',
  'Gulf Carbon Alliance',
  'Red Sea Development Co',
  'Diriyah Gate Authority',
];

const RETIREMENT_REASONS = [
  'Voluntary corporate offset',
  'Regulatory compliance (Article 6)',
  'ESG portfolio commitment',
  'Net-zero pledge fulfillment',
  'Carbon neutral event sponsorship',
  'Supply chain decarbonization',
  'Aviation carbon offset program',
  'Municipal sustainability target',
];

const DAC_UNITS = [
  'DAC-NEOM-001',
  'DAC-NEOM-002',
  'DAC-JUB-001',
  'DAC-RIY-001',
  'DAC-RIY-002',
  'DAC-DHAH-001',
  'DAC-JED-001',
  'DAC-ABH-001',
];

export interface RetirementCertificate {
  tokenId: number;
  co2Amount: number;
  retiredAt: number;
  beneficiary: string;
  reason: string;
  txHash: string;
  dacUnit: string;
  vintage: number;
}

export function generateRetirementCertificates(
  seed: number,
  count: number,
): RetirementCertificate[] {
  const result: RetirementCertificate[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 43;
    result.push({
      tokenId: seededInt(s + 1, 1, 9999),
      co2Amount: seededFloat(s + 2, 10, 5000),
      retiredAt: 1700000000 + seededInt(s + 3, 0, 10000000),
      beneficiary: seededPick(s + 4, BENEFICIARIES),
      reason: seededPick(s + 5, RETIREMENT_REASONS),
      txHash: seededTxHash(s + 6),
      dacUnit: seededPick(s + 7, DAC_UNITS),
      vintage: seededInt(s + 8, 2024, 2026),
    });
  }
  return result;
}

// ─── Marketplace Offers ─────────────────────

const OFFER_STATUSES = ['Pending', 'Accepted', 'Rejected', 'Expired'] as const;

export interface MockOffer {
  id: number;
  buyer: string;
  pricePerUnit: number;
  quantity: number;
  expiration: number;
  status: (typeof OFFER_STATUSES)[number];
}

export function generateMockOffers(seed: number, count: number): MockOffer[] {
  const result: MockOffer[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 29;
    result.push({
      id: i + 1,
      buyer: seededAddress(s + 1),
      pricePerUnit: seededFloat(s + 2, 5, 150),
      quantity: seededInt(s + 3, 1, 10000),
      expiration: 1710700000 + seededInt(s + 4, 86400, 2592000),
      status: seededPick(s + 5, [...OFFER_STATUSES]),
    });
  }
  return result;
}

// ─── Price History ──────────────────────────

export interface PriceDataPoint {
  day: number;
  avgPrice: number;
  volume: number;
  highPrice: number;
  lowPrice: number;
}

export function generatePriceHistory(seed: number, days: number): PriceDataPoint[] {
  const result: PriceDataPoint[] = [];
  for (let i = 0; i < days; i++) {
    const s = seed + i * 19;
    const low = seededFloat(s + 1, 10, 80);
    const high = low + seededFloat(s + 2, 2, 40);
    const avg = (low + high) / 2 + seededFloat(s + 3, -5, 5);
    result.push({
      day: i + 1,
      avgPrice: avg,
      volume: seededInt(s + 4, 100, 50000),
      highPrice: high,
      lowPrice: low,
    });
  }
  return result;
}

// ─── Audit Events ───────────────────────────

const AUDIT_EVENT_TYPES = [
  'RoleGranted',
  'RoleRevoked',
  'EmergencyAction',
  'CircuitBreakerTrip',
  'TimelockScheduled',
] as const;

const AUDIT_TARGETS = [
  'AccessControl',
  'CarbonCredit',
  'CarbonMarketplace',
  'CircuitBreaker',
  'VerificationEngine',
  'Timelock',
  'Multisig',
];

const AUDIT_DETAILS = [
  'Granted OPERATOR role to new DAC manager',
  'Revoked MINTER role from deprecated service',
  'Emergency pause triggered due to anomaly spike',
  'Circuit breaker tripped for marketplace contract',
  'Scheduled platform fee update via timelock',
  'Granted VERIFIER role to oracle node',
  'Revoked PAUSER role after key rotation',
  'Emergency unpause after investigation cleared',
  'Circuit breaker reset after manual review',
  'Scheduled threshold update for verification engine',
];

export interface MockAuditEvent {
  type: (typeof AUDIT_EVENT_TYPES)[number];
  actor: string;
  target: string;
  timestamp: number;
  txHash: string;
  details: string;
}

export function generateMockAuditEvents(seed: number, count: number): MockAuditEvent[] {
  const result: MockAuditEvent[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 41;
    result.push({
      type: seededPick(s + 1, [...AUDIT_EVENT_TYPES]),
      actor: seededAddress(s + 2),
      target: seededPick(s + 3, AUDIT_TARGETS),
      timestamp: 1710000000 + seededInt(s + 4, 0, 700000),
      txHash: seededTxHash(s + 5),
      details: seededPick(s + 6, AUDIT_DETAILS),
    });
  }
  return result;
}

// ─── Anomaly Events ─────────────────────────

const SENSOR_TYPES = ['co2Captured', 'energyUsed', 'temperature', 'humidity', 'pressure'] as const;
const ANOMALY_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
const ANOMALY_STATUSES = ['Open', 'Investigating', 'Resolved', 'DeviceSuspended'] as const;

const ROOT_CAUSES = [
  'Sensor calibration drift detected',
  'Power supply voltage fluctuation',
  'Ambient temperature exceeded operating range',
  'Filter blockage reducing capture efficiency',
  'Network latency causing stale readings',
  'Firmware bug in data aggregation module',
  'Physical tampering detected via accelerometer',
  'Coolant loop pressure drop',
  'Fan motor RPM below threshold',
  'Dust accumulation on intake sensors',
];

export interface MockAnomaly {
  deviceId: string;
  timestamp: number;
  sensorType: (typeof SENSOR_TYPES)[number];
  expectedMin: number;
  expectedMax: number;
  actualValue: number;
  severity: (typeof ANOMALY_SEVERITIES)[number];
  status: (typeof ANOMALY_STATUSES)[number];
  rootCause: string;
}

export function generateMockAnomalies(seed: number, count: number): MockAnomaly[] {
  const result: MockAnomaly[] = [];
  for (let i = 0; i < count; i++) {
    const s = seed + i * 47;
    const expectedMin = seededFloat(s + 1, 5, 30);
    const expectedMax = expectedMin + seededFloat(s + 2, 10, 50);
    const deviation = seededPick(s + 9, [true, false]);
    const actualValue = deviation
      ? expectedMax + seededFloat(s + 3, 5, 40)
      : expectedMin - seededFloat(s + 3, 5, 20);
    result.push({
      deviceId: seededPick(s + 4, DAC_UNITS),
      timestamp: 1710000000 + seededInt(s + 5, 0, 700000),
      sensorType: seededPick(s + 6, [...SENSOR_TYPES]),
      expectedMin,
      expectedMax,
      actualValue,
      severity: seededPick(s + 7, [...ANOMALY_SEVERITIES]),
      status: seededPick(s + 8, [...ANOMALY_STATUSES]),
      rootCause: seededPick(s + 10, ROOT_CAUSES),
    });
  }
  return result;
}
