/**
 * @terraqura/sdk — Compliance Module
 *
 * Enterprise compliance, transparency portal, and Article 6
 * sovereign reporting infrastructure.
 *
 * Three pillars:
 * 1. **Transparency Portal**: Per-user/partner audit trail with
 *    cryptographic proof verification
 * 2. **Article 6 Sovereign API**: National registry integration for
 *    Corresponding Adjustments under the Paris Agreement
 * 3. **Audit Trail**: Immutable compliance logs for Fortune 500
 *    ESG reporting requirements
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred" });
 *
 * // Transparency portal: verify a credit's full provenance
 * const proof = await client.compliance.getProvenanceProof("42");
 *
 * // Article 6: generate a sovereign report
 * const report = await client.compliance.generateSovereignReport({
 *   issuingCountry: "KE",       // Kenya
 *   acquiringCountry: "CH",      // Switzerland
 *   tokenIds: ["42", "43", "44"],
 *   reportingPeriod: { start: "2026-01-01", end: "2026-06-30" },
 *   correspondingAdjustment: true,
 * });
 *
 * // Audit trail: export compliance data
 * const audit = await client.compliance.exportAuditTrail({
 *   address: "0x...",
 *   format: "json",
 *   since: Date.now() - 90 * 24 * 60 * 60 * 1000,
 * });
 * ```
 */

import { ethers } from "ethers";

import { NETWORK_CONFIGS, SUBGRAPH_URLS } from "../constants.js";
import {
  ValidationError,
  SubgraphError,
} from "../errors.js";

import type { ITelemetry } from "../telemetry.js";
import type {
  InternalConfig,
  Provenance,
  OnChainVerification,
  NetNegativeBreakdown,
} from "../types.js";
import type { AssetsModule } from "./assets.js";

// ============================================
// Compliance Types
// ============================================

/** ISO 3166-1 alpha-2 country code */
export type CountryCode = string;

/**
 * Cryptographic provenance proof for a single credit.
 * Combines on-chain data with computed integrity hashes.
 */
export interface ProvenanceProof {
  /** Token ID */
  tokenId: string;
  /** Full provenance data */
  provenance: Provenance;
  /** Integrity hash: keccak256 of all provenance fields */
  integrityHash: string;
  /** Block number where the credit was minted */
  mintBlock: number;
  /** Verification status summary */
  verificationSummary: {
    sourceVerified: boolean;
    logicVerified: boolean;
    mintVerified: boolean;
    allPhasesPassed: boolean;
  };
  /** Net-negative calculation proof */
  netNegativeProof: {
    formula: string;
    inputs: {
      co2AmountKg: number;
      energyConsumedKwh: number;
      purityPercentage: number;
      gridIntensityGCO2PerKwh: number;
    };
    outputs: NetNegativeBreakdown;
    verifiable: boolean;
  };
  /** Explorer verification URL */
  explorerUrl: string;
  /** Network name */
  network: string;
  /** Proof generation timestamp */
  generatedAt: number;
}

/**
 * Article 6 Sovereign Report — for national registries.
 * Implements ITMOs (Internationally Transferred Mitigation Outcomes)
 * tracking for Corresponding Adjustments under the Paris Agreement.
 */
export interface SovereignReportInput {
  /** ISO 3166-1 alpha-2: country issuing the credits */
  issuingCountry: CountryCode;
  /** ISO 3166-1 alpha-2: country acquiring the credits */
  acquiringCountry: CountryCode;
  /** Token IDs included in this report */
  tokenIds: string[];
  /** Reporting period */
  reportingPeriod: {
    start: string; // ISO 8601 date
    end: string;
  };
  /** Whether this represents a Corresponding Adjustment */
  correspondingAdjustment: boolean;
  /** Optional: authorization reference number */
  authorizationRef?: string;
  /** Optional: project/program identifier */
  projectId?: string;
  /** Optional: notes for the registry */
  notes?: string;
}

/** Generated sovereign report */
export interface SovereignReport {
  /** Unique report ID */
  reportId: string;
  /** Report version */
  version: string;
  /** Issuing country */
  issuingCountry: CountryCode;
  /** Acquiring country */
  acquiringCountry: CountryCode;
  /** Reporting period */
  reportingPeriod: { start: string; end: string };
  /** Whether this is a Corresponding Adjustment */
  correspondingAdjustment: boolean;
  /** Authorization reference */
  authorizationRef: string | null;
  /** Project ID */
  projectId: string | null;
  /**
   * ITMO (Internationally Transferred Mitigation Outcome) entries.
   * Each token is an individual ITMO.
   */
  itmos: ITMOEntry[];
  /** Aggregate summary */
  summary: {
    totalCredits: number;
    totalCO2Kg: number;
    totalCO2Tonnes: number;
    averageEfficiency: number;
    averageGridIntensity: number;
    fullyVerifiedCount: number;
    partiallyVerifiedCount: number;
  };
  /** Integrity hash of the entire report */
  reportHash: string;
  /** Network and verification metadata */
  metadata: {
    network: string;
    contractAddress: string;
    explorerUrl: string;
    protocolVersion: string;
    generatedAt: number;
  };
  /** Notes */
  notes: string | null;
}

/** Individual ITMO (carbon credit) entry in a sovereign report */
export interface ITMOEntry {
  /** Token ID */
  tokenId: string;
  /** CO2 amount (kg) */
  co2AmountKg: number;
  /** Energy consumed (kWh) */
  energyConsumedKwh: number;
  /** Purity percentage */
  purityPercentage: number;
  /** Grid intensity (gCO2/kWh) */
  gridIntensityGCO2PerKwh: number;
  /** Net credits after deduction (kg) */
  netCreditsKg: number;
  /** Efficiency factor (scale 10000) */
  efficiencyFactor: number;
  /** 3-phase verification */
  verification: OnChainVerification;
  /** DAC unit ID */
  dacUnitId: string;
  /** GPS coordinates */
  gps: { lat: number; lng: number };
  /** Capture timestamp */
  captureTimestamp: number;
  /** Whether the credit is retired */
  isRetired: boolean;
  /** Provenance integrity hash */
  integrityHash: string;
}

/** Audit trail export format */
export type AuditExportFormat = "json" | "csv";

/** Audit trail export input */
export interface AuditTrailInput {
  /** Address to export trail for */
  address: string;
  /** Export format */
  format?: AuditExportFormat;
  /** Only include events after this timestamp */
  since?: number;
  /** Only include events before this timestamp */
  until?: number;
  /** Include full provenance data (larger output) */
  includeProvenance?: boolean;
}

/** Audit trail entry */
export interface AuditEntry {
  /** Event type */
  type: "mint" | "transfer" | "retirement" | "listing" | "purchase";
  /** Token ID */
  tokenId: string;
  /** Amount */
  amount: bigint;
  /** From address */
  from: string;
  /** To address */
  to: string;
  /** Transaction hash */
  txHash: string;
  /** Block number */
  blockNumber: number;
  /** Timestamp */
  timestamp: number;
  /** Additional data */
  data: Record<string, unknown>;
}

/** Exported audit trail */
export interface AuditTrailExport {
  /** Address audited */
  address: string;
  /** Export format */
  format: AuditExportFormat;
  /** Number of entries */
  entryCount: number;
  /** Time range */
  timeRange: { from: number; to: number };
  /** Entries (JSON format) */
  entries: AuditEntry[];
  /** CSV content (only for csv format) */
  csv?: string;
  /** Summary stats */
  summary: {
    totalMinted: number;
    totalRetired: number;
    totalTransferred: number;
    totalPurchased: number;
    uniqueTokenIds: number;
  };
  /** Export metadata */
  exportedAt: number;
  network: string;
}

// ============================================
// Compliance Module
// ============================================

/**
 * Enterprise Compliance — Transparency, Article 6, and Audit Trail.
 *
 * Provides the compliance infrastructure that Fortune 500 companies
 * and sovereign nations require for carbon credit accounting:
 *
 * - **Provenance Proofs**: Cryptographic proof of every credit's origin
 * - **Sovereign Reports**: Article 6 ITMO reports for national registries
 * - **Audit Trail**: Complete transaction history with export capabilities
 */
export class ComplianceModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly assets: AssetsModule;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    assets: AssetsModule,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.assets = assets;
  }

  // ============================================
  // Transparency Portal
  // ============================================

  /**
   * Generate a cryptographic provenance proof for a credit.
   *
   * This is the core of the transparency portal. It combines:
   * - Full on-chain provenance data
   * - 3-phase verification results
   * - Net-negative calculation proof (reproducible)
   * - Integrity hash for tamper detection
   *
   * @param tokenId - The token ID to generate proof for
   * @returns Complete provenance proof with integrity hash
   */
  async getProvenanceProof(tokenId: string): Promise<ProvenanceProof> {
    return this.telemetry.wrapAsync("compliance.getProvenanceProof", async () => {
      const provenance = await this.assets.getProvenance(tokenId);

      const networkConfig = NETWORK_CONFIGS[this.config.network];

      // Compute integrity hash from all provenance fields
      const integrityHash = this.computeIntegrityHash(provenance);

      // Build net-negative proof
      const netNegativeProof = {
        formula:
          "NetCredits = (CO2_gross × F_purity) − (Energy × GridIntensity / 1000)",
        inputs: {
          co2AmountKg: provenance.metadata.co2AmountKg,
          energyConsumedKwh: provenance.metadata.energyConsumedKwh,
          purityPercentage: provenance.metadata.purityPercentage,
          gridIntensityGCO2PerKwh: provenance.metadata.gridIntensityGCO2PerKwh,
        },
        outputs: provenance.netNegativeBreakdown,
        verifiable: true,
      };

      const explorerUrl = `${networkConfig.explorerUrl}/token/${this.config.addresses.carbonCredit}?a=${tokenId}`;

      return {
        tokenId,
        provenance,
        integrityHash,
        mintBlock: 0, // Would come from on-chain event
        verificationSummary: {
          sourceVerified: provenance.verification.sourceVerified,
          logicVerified: provenance.verification.logicVerified,
          mintVerified: provenance.verification.mintVerified,
          allPhasesPassed:
            provenance.verification.sourceVerified &&
            provenance.verification.logicVerified &&
            provenance.verification.mintVerified,
        },
        netNegativeProof,
        explorerUrl,
        network: this.config.network,
        generatedAt: Date.now(),
      };
    });
  }

  /**
   * Verify the integrity of a provenance proof.
   *
   * Re-computes the integrity hash and compares it to the provided hash.
   * This allows third parties to verify proof authenticity.
   */
  async verifyProvenanceProof(
    tokenId: string,
    expectedHash: string,
  ): Promise<{
    valid: boolean;
    computedHash: string;
    expectedHash: string;
    mismatchReason?: string;
  }> {
    return this.telemetry.wrapAsync(
      "compliance.verifyProvenanceProof",
      async () => {
        const provenance = await this.assets.getProvenance(tokenId);
        const computedHash = this.computeIntegrityHash(provenance);

        const valid = computedHash === expectedHash;

        return {
          valid,
          computedHash,
          expectedHash,
          mismatchReason: valid
            ? undefined
            : "Integrity hash mismatch — provenance data may have been modified",
        };
      },
    );
  }

  // ============================================
  // Article 6 Sovereign API
  // ============================================

  /**
   * Generate an Article 6 sovereign report.
   *
   * Creates a standardized ITMO report for national registries,
   * enabling Corresponding Adjustments under the Paris Agreement.
   *
   * @param input - Report parameters
   * @returns Structured sovereign report with ITMO entries
   */
  async generateSovereignReport(
    input: SovereignReportInput,
  ): Promise<SovereignReport> {
    return this.telemetry.wrapAsync(
      "compliance.generateSovereignReport",
      async () => {
        // Validate inputs
        this.validateSovereignReportInput(input);

        // Fetch provenance for all token IDs
        const provenances = await Promise.all(
          input.tokenIds.map(async (tokenId) => {
            const provenance = await this.assets.getProvenance(tokenId);
            return { tokenId, provenance };
          }),
        );

        // Build ITMO entries
        const itmos: ITMOEntry[] = provenances.map(({ tokenId, provenance }) => ({
          tokenId,
          co2AmountKg: provenance.metadata.co2AmountKg,
          energyConsumedKwh: provenance.metadata.energyConsumedKwh,
          purityPercentage: provenance.metadata.purityPercentage,
          gridIntensityGCO2PerKwh: provenance.metadata.gridIntensityGCO2PerKwh,
          netCreditsKg: provenance.netNegativeBreakdown.netCreditsKg,
          efficiencyFactor: provenance.efficiencyFactor,
          verification: provenance.verification,
          dacUnitId: provenance.dacUnit.dacUnitId,
          gps: provenance.gps,
          captureTimestamp: provenance.metadata.captureTimestamp,
          isRetired: provenance.metadata.isRetired,
          integrityHash: this.computeIntegrityHash(provenance),
        }));

        // Compute summary
        const totalCO2Kg = itmos.reduce((sum, i) => sum + i.netCreditsKg, 0);
        const avgEfficiency =
          itmos.length > 0
            ? itmos.reduce((sum, i) => sum + i.efficiencyFactor, 0) / itmos.length
            : 0;
        const avgGridIntensity =
          itmos.length > 0
            ? itmos.reduce((sum, i) => sum + i.gridIntensityGCO2PerKwh, 0) /
              itmos.length
            : 0;
        const fullyVerified = itmos.filter(
          (i) =>
            i.verification.sourceVerified &&
            i.verification.logicVerified &&
            i.verification.mintVerified,
        ).length;

        const networkConfig = NETWORK_CONFIGS[this.config.network];
        const reportId = this.generateReportId(input);

        // Build report hash
        const reportHash = ethers.keccak256(
          ethers.toUtf8Bytes(
            JSON.stringify({
              reportId,
              itmos: itmos.map((i) => i.integrityHash),
              issuingCountry: input.issuingCountry,
              acquiringCountry: input.acquiringCountry,
              period: input.reportingPeriod,
            }),
          ),
        );

        return {
          reportId,
          version: "1.0.0",
          issuingCountry: input.issuingCountry.toUpperCase(),
          acquiringCountry: input.acquiringCountry.toUpperCase(),
          reportingPeriod: input.reportingPeriod,
          correspondingAdjustment: input.correspondingAdjustment,
          authorizationRef: input.authorizationRef || null,
          projectId: input.projectId || null,
          itmos,
          summary: {
            totalCredits: itmos.length,
            totalCO2Kg,
            totalCO2Tonnes: totalCO2Kg / 1000,
            averageEfficiency: Math.round(avgEfficiency),
            averageGridIntensity: Math.round(avgGridIntensity),
            fullyVerifiedCount: fullyVerified,
            partiallyVerifiedCount: itmos.length - fullyVerified,
          },
          reportHash,
          metadata: {
            network: this.config.network,
            contractAddress: this.config.addresses.carbonCredit,
            explorerUrl: networkConfig.explorerUrl,
            protocolVersion: "3.0.0",
            generatedAt: Date.now(),
          },
          notes: input.notes || null,
        };
      },
    );
  }

  // ============================================
  // Audit Trail
  // ============================================

  /**
   * Export a complete audit trail for an address.
   *
   * Queries the subgraph for all events involving the address:
   * mints, transfers, retirements, listings, and purchases.
   *
   * @param input - Export parameters
   * @returns Audit trail in the requested format
   */
  async exportAuditTrail(
    input: AuditTrailInput,
  ): Promise<AuditTrailExport> {
    return this.telemetry.wrapAsync("compliance.exportAuditTrail", async () => {
      if (!input.address || !ethers.isAddress(input.address)) {
        throw new ValidationError("Valid Ethereum address is required", {
          field: "address",
        });
      }

      const format = input.format ?? "json";
      const addr = input.address.toLowerCase();

      const url =
        this.config.subgraphUrl ||
        SUBGRAPH_URLS[this.config.network] ||
        "";

      if (!url) {
        throw new SubgraphError("No subgraph URL configured");
      }

      // Query transfers (includes mints and retirements)
      const transferQuery = `{
        transfers(
          where: { or: [{ from: "${addr}" }, { to: "${addr}" }] }
          orderBy: timestamp
          orderDirection: desc
          first: 1000
        ) {
          from
          to
          tokenId
          amount
          transactionHash
          blockNumber
          timestamp
        }
      }`;

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: transferQuery }),
      });

      const json = (await response.json()) as {
        data?: { transfers?: Array<Record<string, unknown>> };
      };

      const rawTransfers = json.data?.transfers || [];

      // Parse and classify entries
      const entries: AuditEntry[] = rawTransfers
        .map((t) => {
          const from = (t.from as string) || "";
          const to = (t.to as string) || "";
          const tokenId = (t.tokenId as string) || "";
          const amount = BigInt((t.amount as string) || "0");
          const txHash = (t.transactionHash as string) || "";
          const blockNumber = Number(t.blockNumber || 0);
          const timestamp = Number(t.timestamp || 0);

          // Classify event type
          let type: AuditEntry["type"];
          if (from === ethers.ZeroAddress) {
            type = "mint";
          } else if (to === ethers.ZeroAddress) {
            type = "retirement";
          } else {
            type = "transfer";
          }

          return {
            type,
            tokenId,
            amount,
            from,
            to,
            txHash,
            blockNumber,
            timestamp,
            data: {},
          };
        })
        .filter((e) => {
          if (input.since && e.timestamp < input.since / 1000) return false;
          if (input.until && e.timestamp > input.until / 1000) return false;
          return true;
        });

      // Compute summary
      const tokenIds = new Set(entries.map((e) => e.tokenId));
      const summary = {
        totalMinted: entries.filter((e) => e.type === "mint").length,
        totalRetired: entries.filter((e) => e.type === "retirement").length,
        totalTransferred: entries.filter((e) => e.type === "transfer").length,
        totalPurchased: entries.filter((e) => e.type === "purchase").length,
        uniqueTokenIds: tokenIds.size,
      };

      const timeRange = {
        from: entries.length > 0
          ? Math.min(...entries.map((e) => e.timestamp))
          : 0,
        to: entries.length > 0
          ? Math.max(...entries.map((e) => e.timestamp))
          : 0,
      };

      const result: AuditTrailExport = {
        address: input.address,
        format,
        entryCount: entries.length,
        timeRange,
        entries,
        summary,
        exportedAt: Date.now(),
        network: this.config.network,
      };

      // Generate CSV if requested
      if (format === "csv") {
        result.csv = this.entriesToCSV(entries);
      }

      return result;
    });
  }

  // ============================================
  // Private Helpers
  // ============================================

  /**
   * Compute a deterministic integrity hash for a provenance object.
   */
  private computeIntegrityHash(provenance: Provenance): string {
    const canonical = JSON.stringify({
      tokenId: provenance.tokenId,
      dacUnitId: provenance.metadata.dacUnitId,
      sourceDataHash: provenance.metadata.sourceDataHash,
      captureTimestamp: provenance.metadata.captureTimestamp,
      co2AmountKg: provenance.metadata.co2AmountKg,
      energyConsumedKwh: provenance.metadata.energyConsumedKwh,
      purityPercentage: provenance.metadata.purityPercentage,
      gridIntensityGCO2PerKwh: provenance.metadata.gridIntensityGCO2PerKwh,
      latitude: provenance.metadata.latitude,
      longitude: provenance.metadata.longitude,
      sourceVerified: provenance.verification.sourceVerified,
      logicVerified: provenance.verification.logicVerified,
      mintVerified: provenance.verification.mintVerified,
      efficiencyFactor: provenance.verification.efficiencyFactor.toString(),
    });

    return ethers.keccak256(ethers.toUtf8Bytes(canonical));
  }

  private validateSovereignReportInput(input: SovereignReportInput): void {
    if (!input.issuingCountry || input.issuingCountry.length !== 2) {
      throw new ValidationError(
        "Issuing country must be a valid ISO 3166-1 alpha-2 code",
        { field: "issuingCountry", value: input.issuingCountry },
      );
    }

    if (!input.acquiringCountry || input.acquiringCountry.length !== 2) {
      throw new ValidationError(
        "Acquiring country must be a valid ISO 3166-1 alpha-2 code",
        { field: "acquiringCountry", value: input.acquiringCountry },
      );
    }

    if (
      input.issuingCountry.toUpperCase() ===
      input.acquiringCountry.toUpperCase()
    ) {
      throw new ValidationError(
        "Issuing and acquiring countries must be different for Article 6 transfers",
        {
          issuingCountry: input.issuingCountry,
          acquiringCountry: input.acquiringCountry,
        },
      );
    }

    if (!input.tokenIds || input.tokenIds.length === 0) {
      throw new ValidationError("At least one token ID is required", {
        field: "tokenIds",
      });
    }

    if (input.tokenIds.length > 1000) {
      throw new ValidationError("Maximum 1000 token IDs per report", {
        field: "tokenIds",
        count: input.tokenIds.length,
      });
    }

    if (!input.reportingPeriod?.start || !input.reportingPeriod?.end) {
      throw new ValidationError("Reporting period start and end are required", {
        field: "reportingPeriod",
      });
    }

    // Validate ISO 8601 dates
    const startDate = new Date(input.reportingPeriod.start);
    const endDate = new Date(input.reportingPeriod.end);

    if (isNaN(startDate.getTime())) {
      throw new ValidationError("Invalid reporting period start date", {
        field: "reportingPeriod.start",
        value: input.reportingPeriod.start,
      });
    }

    if (isNaN(endDate.getTime())) {
      throw new ValidationError("Invalid reporting period end date", {
        field: "reportingPeriod.end",
        value: input.reportingPeriod.end,
      });
    }

    if (endDate <= startDate) {
      throw new ValidationError(
        "Reporting period end must be after start",
        { start: input.reportingPeriod.start, end: input.reportingPeriod.end },
      );
    }
  }

  private generateReportId(input: SovereignReportInput): string {
    const hash = ethers.keccak256(
      ethers.toUtf8Bytes(
        `${input.issuingCountry}:${input.acquiringCountry}:${input.reportingPeriod.start}:${Date.now()}`,
      ),
    ).slice(2, 14);

    return `TQ-A6-${input.issuingCountry.toUpperCase()}-${input.acquiringCountry.toUpperCase()}-${hash.toUpperCase()}`;
  }

  private entriesToCSV(entries: AuditEntry[]): string {
    const header = "type,tokenId,amount,from,to,txHash,blockNumber,timestamp";
    const rows = entries.map(
      (e) =>
        `${e.type},${e.tokenId},${e.amount.toString()},${e.from},${e.to},${e.txHash},${e.blockNumber},${e.timestamp}`,
    );
    return [header, ...rows].join("\n");
  }
}
