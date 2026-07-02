import assert from "node:assert/strict";

import {
  buildCarbonRemovalAuditLineageQuery,
  getCarbonRemovalAuditLineage,
} from "../src/domain/index.ts";

const scopedQuery = buildCarbonRemovalAuditLineageQuery({
  tenantId: "11111111-1111-1111-1111-111111111111",
  carbonInstrumentId: "22222222-2222-2222-2222-222222222222",
  tokenId: "42",
  startAt: new Date("2026-01-01T00:00:00.000Z"),
  endAt: new Date("2026-02-01T00:00:00.000Z"),
  limit: 25,
});

assert.equal(scopedQuery.values[0], false);
assert.equal(scopedQuery.values.at(-1), 25);
assert.match(scopedQuery.text, /digest\(de\.payload::text, 'sha256'\)/);
assert.match(scopedQuery.text, /facility\.tenant_id = \$2/);
assert.match(scopedQuery.text, /ci\.id = \$3::uuid/);
assert.match(scopedQuery.text, /ci\.token_id = \$4/);
assert.match(scopedQuery.text, /LIMIT \$7/);

const payloadQuery = buildCarbonRemovalAuditLineageQuery({
  includeEventPayload: true,
  limit: 999,
});
assert.equal(payloadQuery.values[0], true);
assert.equal(payloadQuery.values.at(-1), 500);

assert.throws(
  () => buildCarbonRemovalAuditLineageQuery({ limit: 0 }),
  /audit export limit must be a positive integer/,
);

const db = {
  async query(text: string, values: unknown[]) {
    assert.match(text, /FROM domain_carbon_instruments/);
    assert.deepEqual(values, [false, "token-7", 1]);

    return {
      rows: [
        {
          carbon_instrument_id: "33333333-3333-3333-3333-333333333333",
          token_id: "token-7",
          chain_id: 7332,
          contract_address: "0x1111111111111111111111111111111111111111",
          status: "retired",
          initial_quantity: "100.000000",
          available_quantity: "0.000000",
          retired_quantity: "100.000000",
          owner_wallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          mint_tx_hash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          metadata_uri: "ipfs://metadata",
          minted_at: new Date("2026-01-02T00:00:00.000Z"),
          verification_batch_id: "44444444-4444-4444-4444-444444444444",
          source_data_hash: "source-hash",
          telemetry_window_hash: "telemetry-hash",
          capture_start_at: new Date("2026-01-01T00:00:00.000Z"),
          capture_end_at: new Date("2026-01-02T00:00:00.000Z"),
          total_co2_captured_kg: "100000.000000",
          total_energy_kwh: "35000.000000",
          quality_score: "0.990000",
          dac_unit_id: "55555555-5555-5555-5555-555555555555",
          unit_code: "DAC-AE-001",
          facility_id: "66666666-6666-6666-6666-666666666666",
          facility_code: "FAC-AE-001",
          facility_country_code: "AE",
          market_orders: [
            {
              orderId: "77777777-7777-7777-7777-777777777777",
              listingId: "listing-1",
              sellerWallet: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
              buyerWallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              quantity: "100.000000",
              pricePerUnitWei: "1000000000000000000",
              status: "filled",
              openedAt: "2026-01-02T00:00:00.000Z",
              closedAt: "2026-01-03T00:00:00.000Z",
            },
          ],
          retirements: JSON.stringify([
            {
              retirementId: "88888888-8888-8888-8888-888888888888",
              retiredByWallet: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              beneficiaryName: "Example Buyer",
              quantity: "100.000000",
              reason: "Annual retirement",
              certificateTokenId: "cert-1",
              retirementTxHash:
                "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
              retiredAt: "2026-01-04T00:00:00.000Z",
            },
          ]),
          events: [
            {
              eventId: "99999999-9999-9999-9999-999999999999",
              eventType: "carbon_credit.retired",
              eventVersion: 1,
              aggregateType: "carbon_credit",
              aggregateId: "33333333-3333-3333-3333-333333333333",
              chainId: 7332,
              txHash:
                "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
              occurredAt: "2026-01-04T00:00:00.000Z",
              payloadSha256: "hash",
            },
          ],
        },
      ],
    };
  },
};

const records = await getCarbonRemovalAuditLineage(db, {
  tokenId: "token-7",
  limit: 1,
});

assert.equal(records.length, 1);
assert.equal(records[0].tokenId, "token-7");
assert.equal(records[0].mintedAt, "2026-01-02T00:00:00.000Z");
assert.equal(records[0].marketOrders[0]?.listingId, "listing-1");
assert.equal(records[0].retirements[0]?.certificateTokenId, "cert-1");
assert.equal(records[0].events[0]?.payloadSha256, "hash");

console.log("Domain audit export tests passed.");
