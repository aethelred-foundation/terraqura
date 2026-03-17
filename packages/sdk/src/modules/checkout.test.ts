import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { ValidationError, AuthenticationError } from "../errors.js";
import { CheckoutModule } from "./checkout.js";

import type { InternalConfig, PriceBreakdown, OffsetEstimate, ListingSummary } from "../types.js";
import type { ITelemetry } from "../telemetry.js";
import type { OffsetModule } from "./offset.js";
import type { CreateCheckoutSessionInput } from "./checkout.js";

// ============================================
// Helpers
// ============================================

function makeTelemetry(): ITelemetry {
  return {
    wrapAsync: (_name: string, fn: () => unknown) => fn(),
    recordMetric: vi.fn(),
  } as unknown as ITelemetry;
}

function makeConfig(hasSigner = false): InternalConfig {
  return {
    network: "aethelred-testnet",
    provider: {} as InternalConfig["provider"],
    signer: hasSigner ? ({} as InternalConfig["signer"]) : null,
    addresses: {
      accessControl: "0x0000000000000000000000000000000000000001",
      verificationEngine: "0x0000000000000000000000000000000000000002",
      carbonCredit: "0x0000000000000000000000000000000000000003",
      carbonMarketplace: "0x0000000000000000000000000000000000000004",
      gaslessMarketplace: "0x0000000000000000000000000000000000000005",
      circuitBreaker: "0x0000000000000000000000000000000000000006",
    },
    subgraphUrl: "",
    gas: { multiplier: 1.2, maxGasPrice: 100n, maxPriorityFee: 30n, cacheTtlMs: 15000, gasLimits: {} },
    retry: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, retryableErrors: [] },
    telemetryEnabled: false,
  };
}

function makeEstimate(amountKg: number, sufficient = true): OffsetEstimate {
  const breakdown: PriceBreakdown = {
    subtotal: 1_000_000n,
    platformFee: 25_000n,
    total: 1_025_000n,
    feeBps: 250,
  };
  const listing: ListingSummary = {
    listingId: 1n,
    tokenId: 42n,
    amount: BigInt(amountKg),
    pricePerUnit: 1000n,
    seller: "0x1234567890abcdef1234567890abcdef12345678",
  };
  return {
    amountKg,
    estimatedCost: breakdown,
    bestListings: [listing],
    sufficientSupply: sufficient,
  };
}

function makeOffsetModule(amountKg = 100): OffsetModule {
  return {
    estimateOffset: vi.fn().mockResolvedValue(makeEstimate(amountKg)),
    offsetFootprint: vi.fn().mockResolvedValue({
      tokenIds: ["42"],
      amountRetiredKg: amountKg,
      txHashes: ["0xabc"],
      certificate: "<svg>cert</svg>",
      retirementReason: "Carbon neutral",
      cost: {
        subtotal: 1_000_000n,
        platformFee: 25_000n,
        total: 1_025_000n,
        feeBps: 250,
      },
    }),
  } as unknown as OffsetModule;
}

function validSessionInput(
  overrides: Partial<CreateCheckoutSessionInput> = {},
): CreateCheckoutSessionInput {
  return {
    amountKg: 100,
    reason: "Carbon neutral shipping",
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("CheckoutModule", () => {
  let checkout: CheckoutModule;
  let offsetModule: OffsetModule;

  beforeEach(() => {
    offsetModule = makeOffsetModule();
    checkout = new CheckoutModule(
      makeConfig(),
      makeTelemetry(),
      offsetModule,
    );
  });

  afterEach(() => {
    checkout.destroy();
  });

  // -----------------------------------------------
  // createSession — input validation
  // -----------------------------------------------
  describe("createSession — validation", () => {
    it("rejects amountKg of 0", async () => {
      await expect(
        checkout.createSession(validSessionInput({ amountKg: 0 })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects negative amountKg", async () => {
      await expect(
        checkout.createSession(validSessionInput({ amountKg: -10 })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects amountKg > 1,000,000", async () => {
      await expect(
        checkout.createSession(validSessionInput({ amountKg: 1_000_001 })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects empty reason", async () => {
      await expect(
        checkout.createSession(validSessionInput({ reason: "" })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects whitespace-only reason", async () => {
      await expect(
        checkout.createSession(validSessionInput({ reason: "   " })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects reason longer than 500 characters", async () => {
      await expect(
        checkout.createSession(validSessionInput({ reason: "x".repeat(501) })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects invalid successUrl", async () => {
      await expect(
        checkout.createSession(validSessionInput({ successUrl: "not-a-url" })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects invalid cancelUrl", async () => {
      await expect(
        checkout.createSession(validSessionInput({ cancelUrl: "bad" })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects invalid webhookUrl", async () => {
      await expect(
        checkout.createSession(validSessionInput({ webhookUrl: "not-a-url" })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects invalid customerEmail", async () => {
      await expect(
        checkout.createSession(validSessionInput({ customerEmail: "notanemail" })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects expiresInMs <= 0", async () => {
      await expect(
        checkout.createSession(validSessionInput({ expiresInMs: 0 })),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects expiresInMs > 24 hours", async () => {
      await expect(
        checkout.createSession(
          validSessionInput({ expiresInMs: 24 * 60 * 60 * 1000 + 1 }),
        ),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects when supply is insufficient", async () => {
      const insufficientOffset = {
        ...makeOffsetModule(),
        estimateOffset: vi.fn().mockResolvedValue(makeEstimate(100, false)),
      } as unknown as OffsetModule;

      const co = new CheckoutModule(makeConfig(), makeTelemetry(), insufficientOffset);
      await expect(
        co.createSession(validSessionInput()),
      ).rejects.toThrow(ValidationError);
      co.destroy();
    });
  });

  // -----------------------------------------------
  // createSession — happy path
  // -----------------------------------------------
  describe("createSession — creation", () => {
    it("creates a session with pending status", async () => {
      const session = await checkout.createSession(validSessionInput());
      expect(session.id).toMatch(/^tqcs_/);
      expect(session.status).toBe("pending");
      expect(session.amountKg).toBe(100);
      expect(session.reason).toBe("Carbon neutral shipping");
    });

    it("generates checkout URL", async () => {
      const session = await checkout.createSession(validSessionInput());
      expect(session.checkoutUrl).toContain("https://checkout.terraqura.io/pay/");
      expect(session.checkoutUrl).toContain(session.id);
    });

    it("includes cost estimate", async () => {
      const session = await checkout.createSession(validSessionInput());
      expect(session.estimatedCost.total).toBeGreaterThan(0n);
      expect(session.estimatedCost.feeBps).toBe(250);
    });

    it("sets correct expiry time with default TTL", async () => {
      const before = Date.now();
      const session = await checkout.createSession(validSessionInput());
      const after = Date.now();

      const defaultTtl = 15 * 60 * 1000;
      expect(session.expiresAt).toBeGreaterThanOrEqual(before + defaultTtl);
      expect(session.expiresAt).toBeLessThanOrEqual(after + defaultTtl);
    });

    it("respects custom TTL", async () => {
      const ttl = 5 * 60 * 1000; // 5 minutes
      const before = Date.now();
      const session = await checkout.createSession(
        validSessionInput({ expiresInMs: ttl }),
      );
      expect(session.expiresAt).toBeGreaterThanOrEqual(before + ttl);
    });

    it("caps TTL at 24 hours", async () => {
      const before = Date.now();
      const maxTtl = 24 * 60 * 60 * 1000;
      const session = await checkout.createSession(
        validSessionInput({ expiresInMs: maxTtl }),
      );
      expect(session.expiresAt).toBeLessThanOrEqual(before + maxTtl + 100);
    });

    it("stores optional fields", async () => {
      const session = await checkout.createSession(
        validSessionInput({
          successUrl: "https://example.com/ok",
          cancelUrl: "https://example.com/cancel",
          partnerId: "partner-001",
          subAccountId: "sub-001",
          customerEmail: "test@example.com",
          webhookUrl: "https://hooks.example.com/cb",
          metadata: { orderId: "X123" },
        }),
      );
      expect(session.successUrl).toBe("https://example.com/ok");
      expect(session.cancelUrl).toBe("https://example.com/cancel");
      expect(session.partnerId).toBe("partner-001");
      expect(session.subAccountId).toBe("sub-001");
      expect(session.customerEmail).toBe("test@example.com");
      expect(session.webhookUrl).toBe("https://hooks.example.com/cb");
      expect(session.metadata).toEqual({ orderId: "X123" });
    });

    it("initializes result and completedAt as null", async () => {
      const session = await checkout.createSession(validSessionInput());
      expect(session.result).toBeNull();
      expect(session.completedAt).toBeNull();
    });
  });

  // -----------------------------------------------
  // getSession
  // -----------------------------------------------
  describe("getSession", () => {
    it("retrieves a created session", async () => {
      const created = await checkout.createSession(validSessionInput());
      const fetched = await checkout.getSession(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.status).toBe("pending");
    });

    it("throws for non-existent session", async () => {
      await expect(checkout.getSession("tqcs_nonexistent")).rejects.toThrow(
        ValidationError,
      );
    });

    it("auto-expires sessions past TTL", async () => {
      const session = await checkout.createSession(validSessionInput());
      // Force expiry
      const internalSessions = (checkout as unknown as { sessions: Map<string, { expiresAt: number }> }).sessions;
      const record = internalSessions.get(session.id)!;
      record.expiresAt = Date.now() - 1000;

      const fetched = await checkout.getSession(session.id);
      expect(fetched.status).toBe("expired");
    });
  });

  // -----------------------------------------------
  // cancelSession
  // -----------------------------------------------
  describe("cancelSession", () => {
    it("cancels a pending session", async () => {
      const session = await checkout.createSession(validSessionInput());
      const cancelled = await checkout.cancelSession(session.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("throws for non-existent session", async () => {
      await expect(checkout.cancelSession("tqcs_nonexistent")).rejects.toThrow(
        ValidationError,
      );
    });

    it("throws when cancelling non-pending session", async () => {
      const session = await checkout.createSession(validSessionInput());
      await checkout.cancelSession(session.id);
      await expect(checkout.cancelSession(session.id)).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // -----------------------------------------------
  // confirmSession
  // -----------------------------------------------
  describe("confirmSession", () => {
    it("requires signer", async () => {
      const session = await checkout.createSession(validSessionInput());
      // No signer configured
      await expect(checkout.confirmSession(session.id)).rejects.toThrow(
        AuthenticationError,
      );
    });

    it("completes session with signer", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      const session = await co.createSession(validSessionInput());
      const confirmed = await co.confirmSession(session.id);

      expect(confirmed.status).toBe("completed");
      expect(confirmed.completedAt).not.toBeNull();
      expect(confirmed.result).not.toBeNull();
      expect(confirmed.result!.tokenIds).toEqual(["42"]);
      expect(confirmed.result!.amountRetiredKg).toBe(100);
      expect(confirmed.result!.txHashes).toEqual(["0xabc"]);
      expect(confirmed.result!.certificate).toBe("<svg>cert</svg>");
      co.destroy();
    });

    it("returns completed session idempotently", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      const session = await co.createSession(validSessionInput());
      await co.confirmSession(session.id);
      // Second confirm should return same result
      const second = await co.confirmSession(session.id);
      expect(second.status).toBe("completed");
      co.destroy();
    });

    it("throws for cancelled session", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      const session = await co.createSession(validSessionInput());
      await co.cancelSession(session.id);
      await expect(co.confirmSession(session.id)).rejects.toThrow(
        ValidationError,
      );
      co.destroy();
    });

    it("throws for expired session", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      const session = await co.createSession(validSessionInput());
      // Force expiry
      const internalSessions = (co as unknown as { sessions: Map<string, { expiresAt: number }> }).sessions;
      const record = internalSessions.get(session.id)!;
      record.expiresAt = Date.now() - 1000;

      await expect(co.confirmSession(session.id)).rejects.toThrow(
        ValidationError,
      );
      co.destroy();
    });

    it("throws for non-existent session", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );
      await expect(co.confirmSession("tqcs_nonexistent")).rejects.toThrow(
        ValidationError,
      );
      co.destroy();
    });
  });

  // -----------------------------------------------
  // listSessions
  // -----------------------------------------------
  describe("listSessions", () => {
    it("returns empty list initially", async () => {
      const result = await checkout.listSessions();
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("lists created sessions", async () => {
      await checkout.createSession(validSessionInput());
      await checkout.createSession(validSessionInput({ reason: "Another offset" }));
      const result = await checkout.listSessions();
      expect(result.items).toHaveLength(2);
    });

    it("filters by status", async () => {
      const s1 = await checkout.createSession(validSessionInput());
      await checkout.createSession(validSessionInput({ reason: "keep" }));
      await checkout.cancelSession(s1.id);

      const pending = await checkout.listSessions({ status: "pending" });
      expect(pending.items).toHaveLength(1);

      const cancelled = await checkout.listSessions({ status: "cancelled" });
      expect(cancelled.items).toHaveLength(1);
    });

    it("filters by partnerId", async () => {
      await checkout.createSession(validSessionInput({ partnerId: "partner-A" }));
      await checkout.createSession(validSessionInput({ partnerId: "partner-B" }));
      const result = await checkout.listSessions({ partnerId: "partner-A" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.partnerId).toBe("partner-A");
    });

    it("respects pagination", async () => {
      for (let i = 0; i < 5; i++) {
        await checkout.createSession(validSessionInput({ reason: `Reason ${i}` }));
      }
      const result = await checkout.listSessions({ offset: 2, limit: 2 });
      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });
  });

  // -----------------------------------------------
  // Session lifecycle states
  // -----------------------------------------------
  describe("session lifecycle", () => {
    it("pending -> cancelled is valid", async () => {
      const session = await checkout.createSession(validSessionInput());
      const cancelled = await checkout.cancelSession(session.id);
      expect(cancelled.status).toBe("cancelled");
    });

    it("pending -> expired via TTL", async () => {
      const session = await checkout.createSession(validSessionInput());
      const internalSessions = (checkout as unknown as { sessions: Map<string, { expiresAt: number }> }).sessions;
      internalSessions.get(session.id)!.expiresAt = Date.now() - 1;

      const fetched = await checkout.getSession(session.id);
      expect(fetched.status).toBe("expired");
    });

    it("pending -> processing -> completed with signer", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );
      const session = await co.createSession(validSessionInput());
      const confirmed = await co.confirmSession(session.id);
      expect(confirmed.status).toBe("completed");
      co.destroy();
    });

    it("pending -> processing -> failed when offset throws", async () => {
      const failingOffset = {
        estimateOffset: vi.fn().mockResolvedValue(makeEstimate(100)),
        offsetFootprint: vi.fn().mockRejectedValue(new Error("Offset failed")),
      } as unknown as OffsetModule;

      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        failingOffset,
      );
      const session = await co.createSession(validSessionInput());
      await expect(co.confirmSession(session.id)).rejects.toThrow();

      const fetched = await co.getSession(session.id);
      expect(fetched.status).toBe("failed");
      co.destroy();
    });
  });

  // -----------------------------------------------
  // Webhook notification structure
  // -----------------------------------------------
  describe("webhook dispatch", () => {
    it("dispatches webhook on completion when URL is configured", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("OK", { status: 200 }),
      );

      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      const session = await co.createSession(
        validSessionInput({ webhookUrl: "https://hooks.example.com/cb" }),
      );
      await co.confirmSession(session.id);

      // Give async webhook dispatch a tick
      await new Promise((r) => setTimeout(r, 50));

      expect(fetchSpy).toHaveBeenCalledWith(
        "https://hooks.example.com/cb",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-TerraQura-Event": "checkout.session.completed",
          }),
        }),
      );

      fetchSpy.mockRestore();
      co.destroy();
    });
  });

  // -----------------------------------------------
  // destroy
  // -----------------------------------------------
  describe("destroy", () => {
    it("clears sessions on destroy", () => {
      checkout.destroy();
      const internalSessions = (checkout as unknown as { sessions: Map<string, unknown> }).sessions;
      expect(internalSessions.size).toBe(0);
    });
  });

  // -----------------------------------------------
  // getAnalytics
  // -----------------------------------------------
  describe("getAnalytics", () => {
    it("returns zero stats when empty", async () => {
      const analytics = await checkout.getAnalytics();
      expect(analytics.totalSessions).toBe(0);
      expect(analytics.completedSessions).toBe(0);
      expect(analytics.conversionRate).toBe(0);
      expect(analytics.totalRevenueWei).toBe(0n);
    });

    it("tracks completed sessions", async () => {
      const co = new CheckoutModule(
        makeConfig(true),
        makeTelemetry(),
        offsetModule,
      );

      await co.createSession(validSessionInput());
      const s2 = await co.createSession(validSessionInput({ reason: "two" }));
      await co.confirmSession(s2.id);

      const analytics = await co.getAnalytics();
      expect(analytics.totalSessions).toBe(2);
      expect(analytics.completedSessions).toBe(1);
      expect(analytics.conversionRate).toBe(0.5);
      co.destroy();
    });

    it("filters by partnerId", async () => {
      await checkout.createSession(validSessionInput({ partnerId: "A" }));
      await checkout.createSession(validSessionInput({ partnerId: "B" }));

      const analytics = await checkout.getAnalytics({ partnerId: "A" });
      expect(analytics.totalSessions).toBe(1);
    });
  });
});
