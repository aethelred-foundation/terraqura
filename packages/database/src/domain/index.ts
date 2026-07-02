import type { Pool, PoolClient, QueryResult } from "pg";

export type DomainEventPayload = Record<string, unknown>;

export interface DomainEventInput {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: DomainEventPayload;
  eventVersion?: number;
  tenantId?: string;
  chainId?: number;
  txHash?: string;
  causationId?: string;
  correlationId?: string;
}

export interface DomainEventRecord {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: Date;
}

export type AuditDataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "restricted";

export interface AuditFieldClassification {
  classification: AuditDataClassification;
  handling: string;
}

export const DOMAIN_AUDIT_EXPORT_FIELD_CLASSIFICATION = {
  tenantId: {
    classification: "confidential",
    handling: "Tenant-scoped identifier; include only for authorized auditors.",
  },
  walletAddress: {
    classification: "restricted",
    handling:
      "Pseudonymous financial identifier; redact or tokenize in broad exports.",
  },
  kycStatus: {
    classification: "restricted",
    handling: "Compliance status only; never export provider PII or documents.",
  },
  telemetryHash: {
    classification: "internal",
    handling: "Integrity proof for off-chain sensor readings.",
  },
  domainEventPayload: {
    classification: "confidential",
    handling:
      "Hash by default; include payload only for approved audit scopes.",
  },
  transactionHash: {
    classification: "public",
    handling: "Public chain reference.",
  },
} satisfies Record<string, AuditFieldClassification>;

export interface CarbonRemovalAuditExportScope {
  tenantId?: string;
  carbonInstrumentId?: string;
  tokenId?: string;
  startAt?: Date;
  endAt?: Date;
  includeEventPayload?: boolean;
  limit?: number;
}

export interface BuiltAuditQuery {
  text: string;
  values: unknown[];
}

export interface AuditMarketOrder {
  orderId: string;
  listingId: string | null;
  sellerWallet: string;
  buyerWallet: string | null;
  quantity: string;
  pricePerUnitWei: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

export interface AuditRetirementRecord {
  retirementId: string;
  retiredByWallet: string;
  beneficiaryName: string | null;
  quantity: string;
  reason: string;
  certificateTokenId: string | null;
  retirementTxHash: string | null;
  retiredAt: string;
}

export interface AuditDomainEvent {
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateType: string;
  aggregateId: string;
  chainId: number | null;
  txHash: string | null;
  occurredAt: string;
  payload?: DomainEventPayload;
  payloadSha256?: string;
}

export interface CarbonRemovalAuditLineageRecord {
  carbonInstrumentId: string;
  tokenId: string | null;
  chainId: number;
  contractAddress: string;
  status: string;
  initialQuantity: string;
  availableQuantity: string;
  retiredQuantity: string;
  ownerWallet: string;
  mintTxHash: string | null;
  metadataUri: string | null;
  mintedAt: string | null;
  verificationBatchId: string;
  sourceDataHash: string;
  telemetryWindowHash: string | null;
  captureStartAt: string;
  captureEndAt: string;
  totalCo2CapturedKg: string;
  totalEnergyKwh: string;
  qualityScore: string | null;
  dacUnitId: string;
  unitCode: string;
  facilityId: string;
  facilityCode: string;
  facilityCountryCode: string;
  marketOrders: AuditMarketOrder[];
  retirements: AuditRetirementRecord[];
  events: AuditDomainEvent[];
}

type Queryable = Pick<Pool | PoolClient, "query">;

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function normalizeAuditExportLimit(limit = 100): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("audit export limit must be a positive integer");
  }
  return Math.min(limit, 500);
}

function jsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  }
  return [];
}

function iso(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export async function recordDomainEvent(
  db: Queryable,
  input: DomainEventInput,
): Promise<DomainEventRecord> {
  assertNonEmpty(input.eventType, "eventType");
  assertNonEmpty(input.aggregateType, "aggregateType");
  assertNonEmpty(input.aggregateId, "aggregateId");

  const result: QueryResult<{
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    occurred_at: Date;
  }> = await db.query(
    `
      INSERT INTO domain_events (
        event_type,
        event_version,
        aggregate_type,
        aggregate_id,
        tenant_id,
        chain_id,
        tx_hash,
        payload,
        causation_id,
        correlation_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
      RETURNING id, event_type, aggregate_type, aggregate_id, occurred_at
    `,
    [
      input.eventType,
      input.eventVersion ?? 1,
      input.aggregateType,
      input.aggregateId,
      input.tenantId ?? null,
      input.chainId ?? null,
      input.txHash ?? null,
      JSON.stringify(input.payload),
      input.causationId ?? null,
      input.correlationId ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    throw new Error("Failed to persist domain event");
  }

  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    occurredAt: row.occurred_at,
  };
}

interface RawCarbonRemovalAuditLineageRow {
  carbon_instrument_id: string;
  token_id: string | null;
  chain_id: number;
  contract_address: string;
  status: string;
  initial_quantity: string;
  available_quantity: string;
  retired_quantity: string;
  owner_wallet: string;
  mint_tx_hash: string | null;
  metadata_uri: string | null;
  minted_at: Date | string | null;
  verification_batch_id: string;
  source_data_hash: string;
  telemetry_window_hash: string | null;
  capture_start_at: Date | string;
  capture_end_at: Date | string;
  total_co2_captured_kg: string;
  total_energy_kwh: string;
  quality_score: string | null;
  dac_unit_id: string;
  unit_code: string;
  facility_id: string;
  facility_code: string;
  facility_country_code: string;
  market_orders: unknown;
  retirements: unknown;
  events: unknown;
}

export function buildCarbonRemovalAuditLineageQuery(
  scope: CarbonRemovalAuditExportScope = {},
): BuiltAuditQuery {
  const values: unknown[] = [];
  const pushValue = (value: unknown): string => {
    values.push(value);
    return `$${values.length}`;
  };

  const includePayloadParam = pushValue(scope.includeEventPayload === true);
  const filters: string[] = [];

  if (scope.tenantId) {
    filters.push(`facility.tenant_id = ${pushValue(scope.tenantId)}`);
  }
  if (scope.carbonInstrumentId) {
    filters.push(`ci.id = ${pushValue(scope.carbonInstrumentId)}::uuid`);
  }
  if (scope.tokenId) {
    filters.push(`ci.token_id = ${pushValue(scope.tokenId)}`);
  }
  if (scope.startAt) {
    filters.push(`vb.capture_end_at >= ${pushValue(scope.startAt)}`);
  }
  if (scope.endAt) {
    filters.push(`vb.capture_start_at < ${pushValue(scope.endAt)}`);
  }

  const limitParam = pushValue(normalizeAuditExportLimit(scope.limit));
  const whereClause =
    filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

  return {
    text: `
      SELECT
        ci.id::text AS carbon_instrument_id,
        ci.token_id,
        ci.chain_id,
        ci.contract_address,
        ci.status,
        ci.initial_quantity::text,
        ci.available_quantity::text,
        ci.retired_quantity::text,
        ci.owner_wallet,
        ci.mint_tx_hash,
        ci.metadata_uri,
        ci.minted_at,
        vb.id::text AS verification_batch_id,
        vb.source_data_hash,
        vb.telemetry_window_hash,
        vb.capture_start_at,
        vb.capture_end_at,
        vb.total_co2_captured_kg::text,
        vb.total_energy_kwh::text,
        vb.quality_score::text,
        du.id::text AS dac_unit_id,
        du.unit_code,
        facility.id::text AS facility_id,
        facility.facility_code,
        facility.country_code AS facility_country_code,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'orderId', mo.id::text,
              'listingId', mo.listing_id,
              'sellerWallet', mo.seller_wallet,
              'buyerWallet', mo.buyer_wallet,
              'quantity', mo.quantity::text,
              'pricePerUnitWei', mo.price_per_unit_wei::text,
              'status', mo.status,
              'openedAt', mo.opened_at,
              'closedAt', mo.closed_at
            )
          ) FILTER (WHERE mo.id IS NOT NULL),
          '[]'::jsonb
        ) AS market_orders,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'retirementId', rr.id::text,
              'retiredByWallet', rr.retired_by_wallet,
              'beneficiaryName', rr.beneficiary_name,
              'quantity', rr.quantity::text,
              'reason', rr.reason,
              'certificateTokenId', rr.certificate_token_id,
              'retirementTxHash', rr.retirement_tx_hash,
              'retiredAt', rr.retired_at
            )
          ) FILTER (WHERE rr.id IS NOT NULL),
          '[]'::jsonb
        ) AS retirements,
        COALESCE(
          jsonb_agg(
            DISTINCT jsonb_build_object(
              'eventId', de.id::text,
              'eventType', de.event_type,
              'eventVersion', de.event_version,
              'aggregateType', de.aggregate_type,
              'aggregateId', de.aggregate_id,
              'chainId', de.chain_id,
              'txHash', de.tx_hash,
              'occurredAt', de.occurred_at,
              'payload', CASE WHEN ${includePayloadParam}::boolean THEN de.payload ELSE NULL END,
              'payloadSha256', CASE
                WHEN ${includePayloadParam}::boolean THEN NULL
                ELSE encode(digest(de.payload::text, 'sha256'), 'hex')
              END
            )
          ) FILTER (WHERE de.id IS NOT NULL),
          '[]'::jsonb
        ) AS events
      FROM domain_carbon_instruments ci
      JOIN domain_verification_batches vb
        ON vb.id = ci.verification_batch_id
      JOIN domain_dac_units du
        ON du.id = vb.dac_unit_id
      JOIN domain_dac_facilities facility
        ON facility.id = du.facility_id
      LEFT JOIN domain_market_orders mo
        ON mo.carbon_instrument_id = ci.id
      LEFT JOIN domain_retirement_records rr
        ON rr.carbon_instrument_id = ci.id
      LEFT JOIN domain_events de
        ON (
          (de.aggregate_type = 'carbon_credit' AND de.aggregate_id IN (ci.id::text, ci.token_id))
          OR (de.aggregate_type = 'market_listing' AND de.aggregate_id IN (mo.id::text, mo.listing_id))
          OR (
            de.aggregate_type = 'market_purchase'
            AND (
              de.payload->>'listingId' IN (mo.id::text, mo.listing_id)
              OR de.payload->>'creditId' IN (ci.id::text, ci.token_id)
            )
          )
          OR (de.aggregate_type = 'verification_batch' AND de.aggregate_id = vb.id::text)
        )
      ${whereClause}
      GROUP BY
        ci.id,
        vb.id,
        du.id,
        facility.id
      ORDER BY ci.created_at DESC
      LIMIT ${limitParam}
    `,
    values,
  };
}

function mapCarbonRemovalAuditLineageRow(
  row: RawCarbonRemovalAuditLineageRow,
): CarbonRemovalAuditLineageRecord {
  return {
    carbonInstrumentId: row.carbon_instrument_id,
    tokenId: row.token_id,
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    status: row.status,
    initialQuantity: row.initial_quantity,
    availableQuantity: row.available_quantity,
    retiredQuantity: row.retired_quantity,
    ownerWallet: row.owner_wallet,
    mintTxHash: row.mint_tx_hash,
    metadataUri: row.metadata_uri,
    mintedAt: iso(row.minted_at),
    verificationBatchId: row.verification_batch_id,
    sourceDataHash: row.source_data_hash,
    telemetryWindowHash: row.telemetry_window_hash,
    captureStartAt: iso(row.capture_start_at) ?? "",
    captureEndAt: iso(row.capture_end_at) ?? "",
    totalCo2CapturedKg: row.total_co2_captured_kg,
    totalEnergyKwh: row.total_energy_kwh,
    qualityScore: row.quality_score,
    dacUnitId: row.dac_unit_id,
    unitCode: row.unit_code,
    facilityId: row.facility_id,
    facilityCode: row.facility_code,
    facilityCountryCode: row.facility_country_code,
    marketOrders: jsonArray<AuditMarketOrder>(row.market_orders),
    retirements: jsonArray<AuditRetirementRecord>(row.retirements),
    events: jsonArray<AuditDomainEvent>(row.events),
  };
}

export async function getCarbonRemovalAuditLineage(
  db: Queryable,
  scope: CarbonRemovalAuditExportScope = {},
): Promise<CarbonRemovalAuditLineageRecord[]> {
  const query = buildCarbonRemovalAuditLineageQuery(scope);
  const result: QueryResult<RawCarbonRemovalAuditLineageRow> = await db.query(
    query.text,
    query.values,
  );

  return result.rows.map(mapCarbonRemovalAuditLineageRow);
}
