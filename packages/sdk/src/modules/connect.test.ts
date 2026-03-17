/**
 * Connect module tests.
 *
 * Tests partner registration, BIP-44 deterministic wallets,
 * fee splitting logic, delegated operations,
 * and connection lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";

import { ConnectModule } from "./connect.js";
import {
  ValidationError,
  AuthenticationError,
} from "../errors.js";
import { PLATFORM_CONFIG } from "../constants.js";
import {
  mockTelemetry,
  buildTestConfig,
  buildReadOnlyTestConfig,
  mockFetch,
  TEST_ADDRESSES,
  TEST_TX_HASH,
} from "../__test__/helpers.js";

import type { OffsetModule } from "./offset.js";

// ============================================
// Mock Dependencies
// ============================================

function createMockOffset(): OffsetModule {
  return {
    offsetFootprint: vi.fn().mockResolvedValue({
      tokenIds: ["42"],
      amountRetiredKg: 100,
      txHashes: [TEST_TX_HASH],
      certificate: "<svg>certificate</svg>",
      retirementReason: "test offset",
      cost: {
        subtotal: ethers.parseEther("1"),
        platformFee: ethers.parseEther("0.025"),
        total: ethers.parseEther("1.025"),
        feeBps: 250,
      },
    }),
    getRetirementHistory: vi.fn().mockResolvedValue([
      {
        tokenId: "42",
        amount: 100n,
        reason: "Carbon offset",
        retiree: TEST_ADDRESSES.user,
        txHash: TEST_TX_HASH,
        blockNumber: 1000,
        timestamp: 1700000000,
      },
    ]),
  } as unknown as OffsetModule;
}

// BIP-39 test mnemonic (DO NOT use in production)
const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

describe("ConnectModule", () => {
  let connect: ConnectModule;
  let telemetry: ReturnType<typeof mockTelemetry>;
  let offset: ReturnType<typeof createMockOffset>;

  beforeEach(() => {
    vi.clearAllMocks();
    telemetry = mockTelemetry();
    offset = createMockOffset();

    const config = buildTestConfig();
    connect = new ConnectModule(config, telemetry, offset as unknown as OffsetModule);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================
  // registerPartner
  // ============================================

  describe("registerPartner", () => {
    it("registers a partner with default fee structure", async () => {
      const result = await connect.registerPartner({ name: "FedEx Green" });

      expect(result.name).toBe("FedEx Green");
      expect(result.id).toMatch(/^tqp_/);
      expect(result.apiKey).toMatch(/^tqk_live_/);
      expect(result.platformFeeBps).toBe(PLATFORM_CONFIG.platformFeeBps);
      expect(result.terraquraFeeBps).toBe(PLATFORM_CONFIG.platformFeeBps);
      expect(result.partnerMarkupBps).toBe(0);
      expect(result.hasMasterSeed).toBe(false);
      expect(result.subAccountCount).toBe(0);
    });

    it("registers a partner with custom fee markup", async () => {
      const result = await connect.registerPartner({
        name: "Etihad Carbon",
        platformFeeBps: 350,
      });

      expect(result.platformFeeBps).toBe(350);
      expect(result.terraquraFeeBps).toBe(PLATFORM_CONFIG.platformFeeBps);
      expect(result.partnerMarkupBps).toBe(100); // 350 - 250
    });

    it("registers a partner with BIP-39 master seed", async () => {
      const result = await connect.registerPartner({
        name: "Test Partner",
        masterSeed: TEST_MNEMONIC,
      });

      expect(result.hasMasterSeed).toBe(true);
    });

    it("throws when partner name is empty", async () => {
      await expect(
        connect.registerPartner({ name: "" }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws when fee is below TerraQura base fee", async () => {
      await expect(
        connect.registerPartner({ name: "Test", platformFeeBps: 100 }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws when fee exceeds 50%", async () => {
      await expect(
        connect.registerPartner({ name: "Test", platformFeeBps: 5001 }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for invalid webhook URL", async () => {
      await expect(
        connect.registerPartner({
          name: "Test",
          webhookUrl: "not-a-url",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for invalid BIP-39 mnemonic", async () => {
      await expect(
        connect.registerPartner({
          name: "Test",
          masterSeed: "invalid mnemonic phrase that is not valid",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("accepts valid webhook URL", async () => {
      const result = await connect.registerPartner({
        name: "Test",
        webhookUrl: "https://example.com/webhook",
      });

      expect(result.webhookUrl).toBe("https://example.com/webhook");
    });
  });

  // ============================================
  // getPartner / authenticatePartner
  // ============================================

  describe("getPartner", () => {
    it("retrieves a registered partner by ID", async () => {
      const registered = await connect.registerPartner({ name: "Test Partner" });
      const partner = await connect.getPartner(registered.id);

      expect(partner.name).toBe("Test Partner");
      expect(partner.id).toBe(registered.id);
    });

    it("throws for unknown partner ID", async () => {
      await expect(
        connect.getPartner("tqp_unknown_123456"),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("authenticatePartner", () => {
    it("authenticates with valid API key", async () => {
      const registered = await connect.registerPartner({ name: "Auth Test" });
      const partner = await connect.authenticatePartner(registered.apiKey);

      expect(partner.id).toBe(registered.id);
    });

    it("throws AuthenticationError for invalid API key", async () => {
      await expect(
        connect.authenticatePartner("tqk_live_invalid_key"),
      ).rejects.toThrow(AuthenticationError);
    });
  });

  // ============================================
  // createSubAccount / BIP-44 Wallets
  // ============================================

  describe("createSubAccount", () => {
    it("creates a sub-account with deterministic wallet", async () => {
      const partner = await connect.registerPartner({
        name: "Wallet Test",
        masterSeed: TEST_MNEMONIC,
      });

      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "SHIPMENT-001",
      });

      expect(sub.id).toMatch(/^tqs_/);
      expect(sub.externalId).toBe("SHIPMENT-001");
      expect(sub.partnerId).toBe(partner.id);
      expect(sub.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(sub.totalRetiredKg).toBe(0);
      expect(sub.totalSpentWei).toBe(0n);
    });

    it("derives deterministic addresses from BIP-44 path", async () => {
      const partner = await connect.registerPartner({
        name: "Deterministic Test",
        masterSeed: TEST_MNEMONIC,
      });

      const sub1 = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "SUB-1",
      });

      const sub2 = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "SUB-2",
      });

      // Different sub-accounts should have different addresses
      expect(sub1.walletAddress).not.toBe(sub2.walletAddress);

      // Both should be valid Ethereum addresses
      expect(ethers.isAddress(sub1.walletAddress)).toBe(true);
      expect(ethers.isAddress(sub2.walletAddress)).toBe(true);
    });

    it("generates deterministic addresses without seed", async () => {
      const partner = await connect.registerPartner({ name: "No Seed" });

      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "EXT-1",
      });

      expect(ethers.isAddress(sub.walletAddress)).toBe(true);
    });

    it("throws for unknown partner ID", async () => {
      await expect(
        connect.createSubAccount({
          partnerId: "tqp_unknown_123",
          externalId: "EXT-1",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for empty external ID", async () => {
      const partner = await connect.registerPartner({ name: "Test" });

      await expect(
        connect.createSubAccount({
          partnerId: partner.id,
          externalId: "",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for duplicate external ID within same partner", async () => {
      const partner = await connect.registerPartner({ name: "Dup Test" });

      await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "SAME-ID",
      });

      await expect(
        connect.createSubAccount({
          partnerId: partner.id,
          externalId: "SAME-ID",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("allows same external ID for different partners", async () => {
      const p1 = await connect.registerPartner({ name: "Partner 1" });
      const p2 = await connect.registerPartner({ name: "Partner 2" });

      const sub1 = await connect.createSubAccount({
        partnerId: p1.id,
        externalId: "SHARED-ID",
      });

      const sub2 = await connect.createSubAccount({
        partnerId: p2.id,
        externalId: "SHARED-ID",
      });

      expect(sub1.id).not.toBe(sub2.id);
    });

    it("stores metadata on sub-account", async () => {
      const partner = await connect.registerPartner({ name: "Meta Test" });

      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "META-1",
        metadata: { region: "US-WEST", tier: "premium" },
      });

      expect(sub.metadata.region).toBe("US-WEST");
      expect(sub.metadata.tier).toBe("premium");
    });
  });

  // ============================================
  // resolveByExternalId
  // ============================================

  describe("resolveByExternalId", () => {
    it("resolves sub-account by partner + external ID", async () => {
      const partner = await connect.registerPartner({ name: "Resolve Test" });
      const created = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "RESOLVE-ME",
      });

      const resolved = await connect.resolveByExternalId(
        partner.id,
        "RESOLVE-ME",
      );

      expect(resolved.id).toBe(created.id);
    });

    it("throws for unknown external ID", async () => {
      const partner = await connect.registerPartner({ name: "Not Found" });

      await expect(
        connect.resolveByExternalId(partner.id, "DOES-NOT-EXIST"),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // Fee Splitting
  // ============================================

  describe("calculateFeeSplit", () => {
    it("splits fees correctly between TerraQura and partner", () => {
      const baseCost = {
        subtotal: ethers.parseEther("10"),
        platformFee: ethers.parseEther("0.25"),
        total: ethers.parseEther("10.25"),
        feeBps: 250,
      };

      const split = connect.calculateFeeSplit(baseCost, 350);

      // TerraQura: 250 BPS of 10 ETH = 0.25 ETH
      expect(split.terraquraFee).toBe(ethers.parseEther("10") * 250n / 10000n);
      // Partner: 100 BPS of 10 ETH = 0.1 ETH
      expect(split.partnerMarkup).toBe(ethers.parseEther("10") * 100n / 10000n);
      expect(split.totalFeeBps).toBe(350);
      expect(split.partnerMarkupBps).toBe(100);
      // Total = subtotal + total fee
      expect(split.total).toBe(split.subtotal + split.platformFee);
    });

    it("returns zero partner markup when fee equals TerraQura base", () => {
      const baseCost = {
        subtotal: ethers.parseEther("5"),
        platformFee: ethers.parseEther("0.125"),
        total: ethers.parseEther("5.125"),
        feeBps: 250,
      };

      const split = connect.calculateFeeSplit(baseCost, 250);

      expect(split.partnerMarkup).toBe(0n);
      expect(split.partnerMarkupBps).toBe(0);
    });
  });

  // ============================================
  // retireOnBehalf (Delegated Operations)
  // ============================================

  describe("retireOnBehalf", () => {
    it("retires carbon on behalf of a sub-account", async () => {
      const partner = await connect.registerPartner({
        name: "Retire Test",
        platformFeeBps: 350,
      });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "RETIRE-SUB",
      });

      const result = await connect.retireOnBehalf({
        partnerId: partner.id,
        subAccountId: sub.id,
        amountKg: 100,
        reason: "Carbon neutral shipping",
      });

      expect(result.amountRetiredKg).toBe(100);
      expect(result.tokenIds).toContain("42");
      expect(result.cost.totalFeeBps).toBe(350);
      expect(result.cost.partnerMarkupBps).toBe(100);
      expect(result.subAccount.totalRetiredKg).toBe(100);
    });

    it("resolves sub-account by external ID", async () => {
      const partner = await connect.registerPartner({ name: "Ext Resolve" });
      await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "EXT-RETIRE",
      });

      const result = await connect.retireOnBehalf({
        partnerId: partner.id,
        subAccountId: "EXT-RETIRE",
        amountKg: 50,
        reason: "Test",
      });

      // amountRetiredKg comes from the offset mock (always returns 100)
      expect(result.amountRetiredKg).toBe(100);
    });

    it("includes attributed reason with partner/sub metadata", async () => {
      const partner = await connect.registerPartner({ name: "FedEx" });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "SHIP-123",
      });

      await connect.retireOnBehalf({
        partnerId: partner.id,
        subAccountId: sub.id,
        amountKg: 50,
        reason: "Neutral shipping",
      });

      const offsetCall = (offset.offsetFootprint as ReturnType<typeof vi.fn>).mock.calls[0];
      const reason = offsetCall[1] as string;

      expect(reason).toContain("Neutral shipping");
      expect(reason).toContain("TQ-Connect");
      expect(reason).toContain("FedEx");
      expect(reason).toContain("SHIP-123");
    });

    it("throws for non-positive amount", async () => {
      const partner = await connect.registerPartner({ name: "Test" });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "T1",
      });

      await expect(
        connect.retireOnBehalf({
          partnerId: partner.id,
          subAccountId: sub.id,
          amountKg: 0,
          reason: "test",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws for empty reason", async () => {
      const partner = await connect.registerPartner({ name: "Test" });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "T2",
      });

      await expect(
        connect.retireOnBehalf({
          partnerId: partner.id,
          subAccountId: sub.id,
          amountKg: 100,
          reason: "",
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("throws AuthenticationError in read-only mode", async () => {
      const readOnlyConfig = buildReadOnlyTestConfig();
      const readOnlyConnect = new ConnectModule(
        readOnlyConfig,
        telemetry,
        offset as unknown as OffsetModule,
      );

      const partner = await readOnlyConnect.registerPartner({ name: "ReadOnly" });
      const sub = await readOnlyConnect.createSubAccount({
        partnerId: partner.id,
        externalId: "RO-1",
      });

      await expect(
        readOnlyConnect.retireOnBehalf({
          partnerId: partner.id,
          subAccountId: sub.id,
          amountKg: 100,
          reason: "test",
        }),
      ).rejects.toThrow(AuthenticationError);
    });

    it("throws for sub-account belonging to different partner", async () => {
      const p1 = await connect.registerPartner({ name: "Partner A" });
      const p2 = await connect.registerPartner({ name: "Partner B" });
      const sub = await connect.createSubAccount({
        partnerId: p1.id,
        externalId: "SUB-A",
      });

      await expect(
        connect.retireOnBehalf({
          partnerId: p2.id,
          subAccountId: sub.id,
          amountKg: 100,
          reason: "cross-partner",
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // listSubAccounts
  // ============================================

  describe("listSubAccounts", () => {
    it("lists sub-accounts with pagination", async () => {
      const partner = await connect.registerPartner({ name: "List Test" });

      for (let i = 0; i < 5; i++) {
        await connect.createSubAccount({
          partnerId: partner.id,
          externalId: `SUB-${i}`,
        });
      }

      const page1 = await connect.listSubAccounts(partner.id, { offset: 0, limit: 3 });

      expect(page1.items).toHaveLength(3);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);

      const page2 = await connect.listSubAccounts(partner.id, { offset: 3, limit: 3 });

      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(false);
    });
  });

  // ============================================
  // getPartnerAnalytics
  // ============================================

  describe("getPartnerAnalytics", () => {
    it("returns aggregated analytics for a partner", async () => {
      const partner = await connect.registerPartner({
        name: "Analytics Test",
        platformFeeBps: 350,
      });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "ANALYTICS-1",
      });

      // Trigger a retirement to generate analytics
      await connect.retireOnBehalf({
        partnerId: partner.id,
        subAccountId: sub.id,
        amountKg: 500,
        reason: "Analytics test",
      });

      const analytics = await connect.getPartnerAnalytics(partner.id);

      expect(analytics.partnerId).toBe(partner.id);
      expect(analytics.totalSubAccounts).toBe(1);
      expect(analytics.totalRetiredKg).toBe(500);
      expect(analytics.totalRevenue).toBeGreaterThan(0n);
      expect(analytics.activeSubAccounts).toBe(1);
    });

    it("throws for unknown partner", async () => {
      await expect(
        connect.getPartnerAnalytics("tqp_unknown_123"),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ============================================
  // getSubAccountLedger
  // ============================================

  describe("getSubAccountLedger", () => {
    it("returns retirement ledger for a sub-account", async () => {
      const partner = await connect.registerPartner({ name: "Ledger Test" });
      const sub = await connect.createSubAccount({
        partnerId: partner.id,
        externalId: "LEDGER-1",
      });

      const ledger = await connect.getSubAccountLedger(sub.id);

      expect(ledger.subAccountId).toBe(sub.id);
      expect(ledger.externalId).toBe("LEDGER-1");
      expect(ledger.walletAddress).toMatch(/^0x/);
      expect(Array.isArray(ledger.retirements)).toBe(true);
    });

    it("throws for unknown sub-account", async () => {
      await expect(
        connect.getSubAccountLedger("tqs_unknown"),
      ).rejects.toThrow(ValidationError);
    });
  });
});
