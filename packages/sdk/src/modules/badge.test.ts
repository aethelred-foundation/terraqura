import { describe, expect, it, vi, beforeEach } from "vitest";

import { ValidationError } from "../errors.js";
import { BadgeModule } from "./badge.js";

import type { InternalConfig } from "../types.js";
import type { ITelemetry } from "../telemetry.js";
import type { AssetsModule } from "./assets.js";
import type { MRVModule } from "./mrv.js";
import type { GenerateBadgeInput } from "./badge.js";

// ============================================
// Helpers
// ============================================

function makeTelemetry(): ITelemetry {
  return {
    wrapAsync: (_name: string, fn: () => unknown) => fn(),
    recordMetric: vi.fn(),
  } as unknown as ITelemetry;
}

function makeConfig(): InternalConfig {
  return {
    network: "aethelred-testnet",
    provider: {} as InternalConfig["provider"],
    signer: null,
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

function makeAssetsModule(): AssetsModule {
  return {
    getTotalMinted: vi.fn().mockResolvedValue(1000n),
    getTotalRetired: vi.fn().mockResolvedValue(500n),
  } as unknown as AssetsModule;
}

function makeMRVModule(): MRVModule {
  return {
    getVerificationThresholds: vi.fn().mockResolvedValue({
      minKwh: 100n,
      maxKwh: 300n,
      optimalKwh: 200n,
      minPurity: 95,
    }),
  } as unknown as MRVModule;
}

function defaultBadgeInput(overrides: Partial<GenerateBadgeInput> = {}): GenerateBadgeInput {
  return {
    partnerName: "FedEx Green",
    ...overrides,
  };
}

// ============================================
// Tests
// ============================================

describe("BadgeModule", () => {
  let badge: BadgeModule;

  beforeEach(() => {
    badge = new BadgeModule(
      makeConfig(),
      makeTelemetry(),
      makeAssetsModule(),
      makeMRVModule(),
    );
  });

  // -----------------------------------------------
  // generateBadge — input validation
  // -----------------------------------------------
  describe("generateBadge — validation", () => {
    it("rejects empty partnerName", async () => {
      await expect(badge.generateBadge({ partnerName: "" })).rejects.toThrow(
        ValidationError,
      );
    });

    it("rejects whitespace-only partnerName", async () => {
      await expect(badge.generateBadge({ partnerName: "   " })).rejects.toThrow(
        ValidationError,
      );
    });
  });

  // -----------------------------------------------
  // generateBadge — SVG output
  // -----------------------------------------------
  describe("generateBadge — SVG generation", () => {
    it("returns valid SVG string", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.svg).toContain("<?xml version");
      expect(result.svg).toContain("<svg");
      expect(result.svg).toContain("</svg>");
    });

    it("includes partner name in SVG", async () => {
      const result = await badge.generateBadge(defaultBadgeInput({ partnerName: "TestCorp" }));
      expect(result.svg).toContain("TestCorp");
    });

    it("includes CO2 amount in SVG", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ totalRetiredKg: 5000 }),
      );
      // 5000 kg >= 1000 → displayed as "5.0 tonnes"
      expect(result.svg).toContain("5.0 tonnes");
    });

    it("displays kg for amounts below 1000", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ totalRetiredKg: 500 }),
      );
      expect(result.svg).toContain("500 kg");
    });

    it("defaults totalRetiredKg to 0", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.svg).toContain("0 kg");
    });
  });

  // -----------------------------------------------
  // generateBadge — theme variants
  // -----------------------------------------------
  describe("generateBadge — dark theme", () => {
    it("uses dark background color", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ theme: "dark" }),
      );
      expect(result.svg).toContain("#0a1628");
    });

    it("uses white text for dark theme", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ theme: "dark" }),
      );
      expect(result.svg).toContain("#ffffff");
    });
  });

  describe("generateBadge — light theme", () => {
    it("uses white background", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ theme: "light" }),
      );
      expect(result.svg).toContain('fill="#ffffff"');
    });

    it("uses dark text for light theme", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ theme: "light" }),
      );
      expect(result.svg).toContain("#1a2744");
    });
  });

  describe("generateBadge — transparent theme", () => {
    it("uses 'none' background", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ theme: "transparent" }),
      );
      expect(result.svg).toContain('fill="none"');
    });
  });

  // -----------------------------------------------
  // generateBadge — variant sizes
  // -----------------------------------------------
  describe("generateBadge — compact variant", () => {
    it("generates compact SVG with smaller dimensions", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "compact" }),
      );
      expect(result.svg).toContain('width="280"');
      expect(result.svg).toContain('height="48"');
    });
  });

  describe("generateBadge — standard variant", () => {
    it("generates standard SVG (default)", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.svg).toContain('width="300"');
      expect(result.svg).toContain('height="100"');
    });
  });

  describe("generateBadge — detailed variant", () => {
    it("generates detailed SVG with larger dimensions", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "detailed" }),
      );
      expect(result.svg).toContain('width="320"');
      expect(result.svg).toContain('height="180"');
    });

    it("includes offsets count", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "detailed", totalOffsets: 42 }),
      );
      expect(result.svg).toContain("42");
    });

    it("shows fully verified status", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "detailed", fullyVerified: true }),
      );
      expect(result.svg).toContain("Fully Verified (3/3)");
    });

    it("shows partially verified when not fully verified", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "detailed", fullyVerified: false }),
      );
      expect(result.svg).toContain("Partially Verified");
    });

    it("includes efficiency when provided", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ variant: "detailed", latestEfficiency: 250 }),
      );
      expect(result.svg).toContain("250 kWh/tonne");
    });
  });

  // -----------------------------------------------
  // generateBadge — embed HTML
  // -----------------------------------------------
  describe("generateBadge — embed HTML", () => {
    it("returns embeddable HTML with base64 SVG", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.embedHtml).toContain("<a href=");
      expect(result.embedHtml).toContain("data:image/svg+xml;base64,");
      expect(result.embedHtml).toContain("Carbon Integrity Badge");
    });

    it("includes partner name in alt text", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ partnerName: "Acme Inc" }),
      );
      expect(result.embedHtml).toContain("Acme Inc");
    });
  });

  // -----------------------------------------------
  // generateBadge — JSON data
  // -----------------------------------------------
  describe("generateBadge — data payload", () => {
    it("returns complete BadgeData object", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({
          totalRetiredKg: 2000,
          totalOffsets: 15,
          latestEfficiency: 250,
          latestGridIntensity: 300,
          fullyVerified: true,
          label: "Green Shipping",
        }),
      );

      expect(result.data.partnerName).toBe("FedEx Green");
      expect(result.data.totalRetiredKg).toBe(2000);
      expect(result.data.totalOffsets).toBe(15);
      expect(result.data.latestEfficiency).toBe(250);
      expect(result.data.latestGridIntensity).toBe(300);
      expect(result.data.fullyVerified).toBe(true);
      expect(result.data.label).toBe("Green Shipping");
      expect(result.data.network).toBe("aethelred-testnet");
      expect(result.data.networkDisplayName).toBe("Aethelred Testnet");
      expect(result.data.generatedAt).toBeGreaterThan(0);
    });

    it("uses defaults for optional fields", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.data.totalRetiredKg).toBe(0);
      expect(result.data.totalOffsets).toBe(0);
      expect(result.data.latestEfficiency).toBeNull();
      expect(result.data.latestGridIntensity).toBeNull();
      expect(result.data.fullyVerified).toBe(false);
      expect(result.data.label).toBe("Verified Carbon Offset");
    });
  });

  // -----------------------------------------------
  // generateBadge — verification URL
  // -----------------------------------------------
  describe("generateBadge — verification URL", () => {
    it("generates default verification URL from network config", async () => {
      const result = await badge.generateBadge(defaultBadgeInput());
      expect(result.verifyUrl).toContain("explorer-testnet.aethelred.network");
      expect(result.verifyUrl).toContain("0x0000000000000000000000000000000000000003");
    });

    it("uses custom verifyUrl when provided", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ verifyUrl: "https://custom.verify.io/badge" }),
      );
      expect(result.verifyUrl).toBe("https://custom.verify.io/badge");
    });
  });

  // -----------------------------------------------
  // generateBadge — timestamp
  // -----------------------------------------------
  describe("generateBadge — timestamp", () => {
    it("includes generatedAt timestamp", async () => {
      const before = Date.now();
      const result = await badge.generateBadge(defaultBadgeInput());
      const after = Date.now();
      expect(result.generatedAt).toBeGreaterThanOrEqual(before);
      expect(result.generatedAt).toBeLessThanOrEqual(after);
    });
  });

  // -----------------------------------------------
  // generateEmbedSnippet
  // -----------------------------------------------
  describe("generateEmbedSnippet", () => {
    it("rejects empty partnerName", async () => {
      await expect(
        badge.generateEmbedSnippet({ partnerName: "" }),
      ).rejects.toThrow(ValidationError);
    });

    it("returns HTML with CSS and script", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
      });
      expect(snippet).toContain("tq-carbon-badge");
      expect(snippet).toContain("<style>");
      expect(snippet).toContain("<script>");
      expect(snippet).toContain("TestCo");
    });

    it("displays tonnes for large amounts", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        totalRetiredKg: 5000,
      });
      expect(snippet).toContain("5.0 tonnes");
    });

    it("displays kg for small amounts", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        totalRetiredKg: 999,
      });
      expect(snippet).toContain("999 kg");
    });

    it("enforces minimum refresh interval of 30 seconds", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        refreshIntervalMs: 1000, // too low
      });
      // Should use 30000 as minimum
      expect(snippet).toContain("30000");
    });

    it("includes custom label", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        label: "Green Logistics",
      });
      expect(snippet).toContain("Green Logistics");
    });

    it("applies theme class", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        theme: "light",
      });
      expect(snippet).toContain('data-theme="light"');
    });

    it("applies variant class", async () => {
      const snippet = await badge.generateEmbedSnippet({
        partnerName: "TestCo",
        variant: "compact",
      });
      expect(snippet).toContain('data-variant="compact"');
    });
  });

  // -----------------------------------------------
  // XSS / sanitization
  // -----------------------------------------------
  describe("sanitization", () => {
    it("sanitizes partner name with HTML entities", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ partnerName: '<script>alert("xss")</script>' }),
      );
      // Should not contain raw script tags in SVG
      expect(result.svg).not.toContain("<script>");
    });

    it("sanitizes label with special characters", async () => {
      const result = await badge.generateBadge(
        defaultBadgeInput({ label: "Test & <Label>" }),
      );
      // Raw & should be escaped to &amp; and < > to &lt; &gt;
      expect(result.svg).not.toContain("Test & <Label>");
      expect(result.svg).toContain("&amp;");
    });
  });
});
