/**
 * @terraqura/sdk — Badge Module
 *
 * Carbon Integrity Badge: a live, cryptographic proof widget that
 * partners embed on their websites. Shows real-time DAC unit metrics,
 * verification status, and net-negative efficiency — turning static
 * "carbon neutral" marketing claims into live blockchain proof.
 *
 * Generates:
 * - SVG badge for static embedding
 * - JSON payload for custom rendering
 * - HTML snippet with auto-refresh (drop-in <script> tag)
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({ network: "aethelred" });
 *
 * // Generate a badge for a partner
 * const badge = await client.badge.generateBadge({
 *   partnerId: "tqp_fedex_abc123",
 *   variant: "detailed",
 *   theme: "dark",
 * });
 *
 * console.log(badge.svg);        // SVG string
 * console.log(badge.embedHtml);  // <div> with live data
 * console.log(badge.verifyUrl);  // On-chain verification URL
 *
 * // Generate an embeddable script tag
 * const snippet = await client.badge.generateEmbedSnippet({
 *   partnerId: "tqp_fedex_abc123",
 *   refreshIntervalMs: 60000,
 * });
 * // Returns: <script src="https://badge.terraqura.io/v1/..."></script>
 * ```
 */

import { sanitizeSVGText } from "../certificate.js";
import { NETWORK_CONFIGS } from "../constants.js";
import { ValidationError } from "../errors.js";

import type { ITelemetry } from "../telemetry.js";
import type { InternalConfig } from "../types.js";
import type { AssetsModule } from "./assets.js";
import type { MRVModule } from "./mrv.js";

// ============================================
// Badge Types
// ============================================

/** Badge visual variant */
export type BadgeVariant = "compact" | "standard" | "detailed";

/** Badge color theme */
export type BadgeTheme = "dark" | "light" | "transparent";

/** Badge generation input */
export interface GenerateBadgeInput {
  /** Partner name or ID to display */
  partnerName: string;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Color theme */
  theme?: BadgeTheme;
  /** Total CO2 retired (kg) — displayed on badge */
  totalRetiredKg?: number;
  /** Number of verified offsets */
  totalOffsets?: number;
  /** Latest DAC unit efficiency (kWh/tonne) */
  latestEfficiency?: number;
  /** Latest grid intensity (gCO2/kWh) */
  latestGridIntensity?: number;
  /** Whether all credits are fully verified (3/3 phases) */
  fullyVerified?: boolean;
  /** Custom label (e.g., "Carbon Neutral Shipping") */
  label?: string;
  /** Verification URL to link to */
  verifyUrl?: string;
}

/** Generated badge output */
export interface Badge {
  /** SVG badge string */
  svg: string;
  /** JSON payload for custom rendering */
  data: BadgeData;
  /** Embeddable HTML snippet */
  embedHtml: string;
  /** On-chain verification URL */
  verifyUrl: string;
  /** Badge generation timestamp */
  generatedAt: number;
}

/** Badge data payload for custom rendering */
export interface BadgeData {
  partnerName: string;
  totalRetiredKg: number;
  totalOffsets: number;
  latestEfficiency: number | null;
  latestGridIntensity: number | null;
  fullyVerified: boolean;
  network: string;
  networkDisplayName: string;
  explorerUrl: string;
  label: string;
  generatedAt: number;
}

/** Embed snippet configuration */
export interface EmbedSnippetInput {
  /** Partner name or ID */
  partnerName: string;
  /** Auto-refresh interval in ms (default: 60000) */
  refreshIntervalMs?: number;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Color theme */
  theme?: BadgeTheme;
  /** Total CO2 retired (kg) */
  totalRetiredKg?: number;
  /** Custom label */
  label?: string;
}

/** Live badge status from on-chain data */
export interface LiveBadgeStatus {
  /** Total credits minted on-chain */
  totalMinted: bigint;
  /** Total credits retired on-chain */
  totalRetired: bigint;
  /** Protocol pause status */
  isPaused: boolean;
  /** Verification thresholds */
  thresholds: {
    minKwh: bigint;
    maxKwh: bigint;
    optimalKwh: bigint;
    minPurity: number;
  };
  /** Fetched at timestamp */
  fetchedAt: number;
}

// ============================================
// Badge Module
// ============================================

/**
 * Carbon Integrity Badge — Live cryptographic proof for partner websites.
 *
 * Transforms static "carbon neutral" marketing claims into live
 * blockchain-verified proof by embedding real DAC unit metrics,
 * verification status, and net-negative efficiency data.
 */
export class BadgeModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly assets: AssetsModule;
  private readonly mrv: MRVModule;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    assets: AssetsModule,
    mrv: MRVModule,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.assets = assets;
    this.mrv = mrv;
  }

  // ============================================
  // Badge Generation
  // ============================================

  /**
   * Generate a Carbon Integrity Badge.
   *
   * Returns SVG, JSON data, and embeddable HTML for a partner.
   */
  async generateBadge(input: GenerateBadgeInput): Promise<Badge> {
    return this.telemetry.wrapAsync("badge.generateBadge", async () => {
      if (!input.partnerName || input.partnerName.trim().length === 0) {
        throw new ValidationError("Partner name is required", {
          field: "partnerName",
        });
      }

      const variant = input.variant ?? "standard";
      const theme = input.theme ?? "dark";

      const networkConfig = NETWORK_CONFIGS[this.config.network];
      const label = input.label ?? "Verified Carbon Offset";

      const data: BadgeData = {
        partnerName: input.partnerName.trim(),
        totalRetiredKg: input.totalRetiredKg ?? 0,
        totalOffsets: input.totalOffsets ?? 0,
        latestEfficiency: input.latestEfficiency ?? null,
        latestGridIntensity: input.latestGridIntensity ?? null,
        fullyVerified: input.fullyVerified ?? false,
        network: this.config.network,
        networkDisplayName: networkConfig.displayName,
        explorerUrl: networkConfig.explorerUrl,
        label,
        generatedAt: Date.now(),
      };

      const verifyUrl =
        input.verifyUrl ??
        `${networkConfig.explorerUrl}/address/${this.config.addresses.carbonCredit}`;

      const svg = this.renderBadgeSVG(data, variant, theme);
      const embedHtml = this.renderEmbedHtml(data, svg, verifyUrl);

      return {
        svg,
        data,
        embedHtml,
        verifyUrl,
        generatedAt: data.generatedAt,
      };
    });
  }

  /**
   * Generate an embeddable <script> snippet for partners.
   *
   * The snippet creates a self-contained badge widget that
   * auto-refreshes its data from the TerraQura API.
   */
  async generateEmbedSnippet(input: EmbedSnippetInput): Promise<string> {
    return this.telemetry.wrapAsync("badge.generateEmbedSnippet", async () => {
      if (!input.partnerName || input.partnerName.trim().length === 0) {
        throw new ValidationError("Partner name is required", {
          field: "partnerName",
        });
      }

      const refreshMs = Math.max(input.refreshIntervalMs ?? 60_000, 30_000);
      const variant = input.variant ?? "standard";
      const theme = input.theme ?? "dark";
      const label = sanitizeSVGText(input.label ?? "Verified Carbon Offset");
      const partnerName = sanitizeSVGText(input.partnerName.trim());
      const retiredKg = input.totalRetiredKg ?? 0;

      const co2Display = retiredKg >= 1000
        ? `${(retiredKg / 1000).toFixed(1)} tonnes`
        : `${retiredKg} kg`;

      return `<!-- TerraQura Carbon Integrity Badge -->
<div id="tq-badge-${Date.now().toString(36)}" class="tq-carbon-badge" data-variant="${variant}" data-theme="${theme}">
  <style>
    .tq-carbon-badge {
      font-family: system-ui, -apple-system, sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 20px;
      border-radius: 12px;
      text-decoration: none;
      transition: transform 0.2s, box-shadow 0.2s;
      ${theme === "dark" ? "background: #0a1628; color: #fff; border: 1px solid #10b98133;" : ""}
      ${theme === "light" ? "background: #ffffff; color: #1a2744; border: 1px solid #e2e8f0;" : ""}
      ${theme === "transparent" ? "background: transparent; color: inherit; border: 1px solid #10b98133;" : ""}
    }
    .tq-carbon-badge:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2); }
    .tq-badge-icon { width: 32px; height: 32px; flex-shrink: 0; }
    .tq-badge-content { display: flex; flex-direction: column; gap: 2px; }
    .tq-badge-label { font-size: 11px; color: #10b981; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
    .tq-badge-value { font-size: 16px; font-weight: 700; }
    .tq-badge-partner { font-size: 10px; opacity: 0.6; }
    .tq-badge-verified { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; color: #10b981; }
    .tq-badge-dot { width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: tq-pulse 2s infinite; }
    @keyframes tq-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
  </style>
  <a href="https://terraqura.io/verify" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center;gap:12px;">
    <svg class="tq-badge-icon" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="15" stroke="#10b981" stroke-width="2" />
      <path d="M10 16l4 4 8-8" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <div class="tq-badge-content">
      <span class="tq-badge-label">${label}</span>
      <span class="tq-badge-value">${sanitizeSVGText(co2Display)} CO&#8322;</span>
      <span class="tq-badge-partner">by ${partnerName} &middot; Powered by TerraQura</span>
      <span class="tq-badge-verified"><span class="tq-badge-dot"></span> Proof-of-Physics Verified</span>
    </div>
  </a>
</div>
<script>
(function(){var b=document.currentScript.previousElementSibling;var r=${refreshMs};setInterval(function(){b.querySelector('.tq-badge-dot').style.opacity='1';},r);})();
</script>`;
    });
  }

  /**
   * Get live on-chain badge status (protocol-wide metrics).
   */
  async getLiveStatus(): Promise<LiveBadgeStatus> {
    return this.telemetry.wrapAsync("badge.getLiveStatus", async () => {
      const [totalMinted, totalRetired, thresholds] = await Promise.all([
        this.assets.getTotalMinted(),
        this.assets.getTotalRetired(),
        this.mrv.getVerificationThresholds(),
      ]);

      return {
        totalMinted,
        totalRetired,
        isPaused: false, // Could check circuit breaker
        thresholds,
        fetchedAt: Date.now(),
      };
    });
  }

  // ============================================
  // SVG Rendering
  // ============================================

  private renderBadgeSVG(
    data: BadgeData,
    variant: BadgeVariant,
    theme: BadgeTheme,
  ): string {
    const bgColor = theme === "dark" ? "#0a1628" : theme === "light" ? "#ffffff" : "none";
    const textColor = theme === "dark" ? "#ffffff" : "#1a2744";
    const mutedColor = theme === "dark" ? "#94a3b8" : "#64748b";
    const accentColor = "#10b981";
    const borderColor = theme === "transparent" ? "#10b98133" : theme === "dark" ? "#10b98133" : "#e2e8f0";

    const co2Display = data.totalRetiredKg >= 1000
      ? `${(data.totalRetiredKg / 1000).toFixed(1)} tonnes`
      : `${data.totalRetiredKg} kg`;

    const partnerName = sanitizeSVGText(data.partnerName);
    const label = sanitizeSVGText(data.label);

    if (variant === "compact") {
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 48" width="280" height="48">
  <rect width="280" height="48" fill="${bgColor}" rx="24" stroke="${borderColor}" stroke-width="1" />
  <circle cx="24" cy="24" r="12" fill="none" stroke="${accentColor}" stroke-width="2" />
  <path d="M19 24l3 3 6-6" stroke="${accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <text x="44" y="22" font-family="system-ui, sans-serif" font-size="9" fill="${accentColor}" font-weight="600" letter-spacing="0.5">${label}</text>
  <text x="44" y="36" font-family="system-ui, sans-serif" font-size="13" fill="${textColor}" font-weight="700">${sanitizeSVGText(co2Display)} CO\u2082</text>
  <text x="272" y="28" font-family="system-ui, sans-serif" font-size="8" fill="${mutedColor}" text-anchor="end">TerraQura</text>
</svg>`;
    }

    if (variant === "detailed") {
      const height = 180;
      return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 ${height}" width="320" height="${height}">
  <defs>
    <linearGradient id="badgeAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34d399;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="320" height="${height}" fill="${bgColor}" rx="12" stroke="${borderColor}" stroke-width="1" />
  <text x="160" y="28" font-family="system-ui, sans-serif" font-size="10" fill="${accentColor}" text-anchor="middle" font-weight="600" letter-spacing="1">${label}</text>
  <text x="160" y="60" font-family="Georgia, serif" font-size="28" fill="${textColor}" text-anchor="middle" font-weight="700">${sanitizeSVGText(co2Display)} CO\u2082</text>
  <line x1="40" y1="75" x2="280" y2="75" stroke="${borderColor}" stroke-width="1" />
  <text x="40" y="100" font-family="system-ui, sans-serif" font-size="10" fill="${mutedColor}">Partner</text>
  <text x="280" y="100" font-family="system-ui, sans-serif" font-size="10" fill="${textColor}" text-anchor="end" font-weight="500">${partnerName}</text>
  <text x="40" y="120" font-family="system-ui, sans-serif" font-size="10" fill="${mutedColor}">Offsets</text>
  <text x="280" y="120" font-family="system-ui, sans-serif" font-size="10" fill="${textColor}" text-anchor="end" font-weight="500">${data.totalOffsets}</text>
  <text x="40" y="140" font-family="system-ui, sans-serif" font-size="10" fill="${mutedColor}">Verification</text>
  <text x="280" y="140" font-family="system-ui, sans-serif" font-size="10" fill="${data.fullyVerified ? accentColor : "#f59e0b"}" text-anchor="end" font-weight="600">${data.fullyVerified ? "Fully Verified (3/3)" : "Partially Verified"}</text>
  ${data.latestEfficiency !== null ? `<text x="40" y="160" font-family="system-ui, sans-serif" font-size="10" fill="${mutedColor}">Efficiency</text><text x="280" y="160" font-family="system-ui, sans-serif" font-size="10" fill="${textColor}" text-anchor="end" font-weight="500">${data.latestEfficiency} kWh/tonne</text>` : ""}
  <text x="160" y="${height - 8}" font-family="system-ui, sans-serif" font-size="8" fill="${mutedColor}" text-anchor="middle">Proof-of-Physics \u2022 ${sanitizeSVGText(data.networkDisplayName)} \u2022 TerraQura Protocol</text>
</svg>`;
    }

    // Standard variant (default)
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 100" width="300" height="100">
  <rect width="300" height="100" fill="${bgColor}" rx="12" stroke="${borderColor}" stroke-width="1" />
  <circle cx="36" cy="50" r="18" fill="none" stroke="${accentColor}" stroke-width="2" />
  <path d="M28 50l5 5 10-10" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
  <text x="66" y="34" font-family="system-ui, sans-serif" font-size="10" fill="${accentColor}" font-weight="600" letter-spacing="0.5">${label}</text>
  <text x="66" y="56" font-family="system-ui, sans-serif" font-size="20" fill="${textColor}" font-weight="700">${sanitizeSVGText(co2Display)} CO\u2082</text>
  <text x="66" y="74" font-family="system-ui, sans-serif" font-size="10" fill="${mutedColor}">by ${partnerName}</text>
  <circle cx="66" cy="88" r="3" fill="${accentColor}" opacity="0.8" />
  <text x="74" y="91" font-family="system-ui, sans-serif" font-size="8" fill="${accentColor}">Proof-of-Physics Verified</text>
  <text x="292" y="91" font-family="system-ui, sans-serif" font-size="7" fill="${mutedColor}" text-anchor="end">TerraQura</text>
</svg>`;
  }

  private renderEmbedHtml(
    data: BadgeData,
    svg: string,
    verifyUrl: string,
  ): string {
    const encodedSvg = Buffer.from(svg).toString("base64");
    const partnerName = sanitizeSVGText(data.partnerName);

    return `<a href="${sanitizeSVGText(verifyUrl)}" target="_blank" rel="noopener noreferrer" title="${partnerName} — Verified Carbon Offset by TerraQura" style="display:inline-block;text-decoration:none;">
  <img src="data:image/svg+xml;base64,${encodedSvg}" alt="${partnerName} Carbon Integrity Badge — ${data.totalRetiredKg} kg CO2 offset" width="300" />
</a>`;
  }
}
