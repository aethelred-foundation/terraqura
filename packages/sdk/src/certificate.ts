/**
 * @terraqura/sdk — Certificate Generator
 *
 * Generates SVG carbon offset certificates with TerraQura branding.
 * Pure template literals — no external dependencies.
 */

import { NETWORK_CONFIGS } from "./constants.js";

import type { NetworkName } from "./constants.js";
import type { CertificateData } from "./types.js";

// ============================================
// SVG Certificate Generator
// ============================================

/**
 * Generate an SVG carbon offset certificate.
 *
 * The certificate includes:
 * - TerraQura branding
 * - Certificate ID and retirement date
 * - CO2 amount retired
 * - Verification status badge
 * - Provenance data (DAC unit, GPS, efficiency, grid intensity)
 * - On-chain transaction hash linked to block explorer
 *
 * @param data - Certificate data
 * @returns SVG string
 *
 * @example
 * ```ts
 * const svg = generateCertificateSVG({
 *   certificateId: "TQ-2026-001",
 *   tokenId: "42",
 *   co2AmountKg: 1000,
 *   retirementDate: new Date(),
 *   retiredBy: "0x1234...abcd",
 *   reason: "Carbon neutral shipping",
 *   dacUnitName: "DAC-001",
 *   verificationStatus: "Fully Verified",
 *   efficiencyFactor: 95.5,
 *   gps: { lat: 24.5, lng: 54.7 },
 *   txHash: "0xabc...def",
 *   gridIntensity: 50,
 *   network: "aethelred-testnet",
 * });
 * ```
 */
export function generateCertificateSVG(data: CertificateData): string {
  const {
    certificateId,
    tokenId,
    co2AmountKg,
    retirementDate,
    retiredBy,
    reason,
    dacUnitName,
    verificationStatus,
    efficiencyFactor,
    gps,
    txHash,
    gridIntensity,
    network,
  } = data;

  const co2Display = co2AmountKg >= 1000
    ? `${(co2AmountKg / 1000).toFixed(2)} tonnes`
    : `${co2AmountKg} kg`;

  const dateStr = retirementDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const shortAddress = `${retiredBy.slice(0, 6)}...${retiredBy.slice(-4)}`;
  const shortTxHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  const explorerUrl = NETWORK_CONFIGS[network as NetworkName]?.explorerUrl || "https://explorer.aethelred.io";
  const txLink = `${explorerUrl}/tx/${txHash}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a2744;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#34d399;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#fbbf24;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="800" height="1100" fill="url(#bgGrad)" rx="16" />

  <!-- Border -->
  <rect x="20" y="20" width="760" height="1060" fill="none" stroke="url(#accentGrad)" stroke-width="2" rx="12" />
  <rect x="30" y="30" width="740" height="1040" fill="none" stroke="#10b98133" stroke-width="1" rx="10" />

  <!-- Header -->
  <text x="400" y="80" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#10b981" text-anchor="middle" letter-spacing="6" font-weight="600">TERRAQURA PROTOCOL</text>

  <text x="400" y="130" font-family="Georgia, serif" font-size="36" fill="#ffffff" text-anchor="middle" font-weight="700">Carbon Offset Certificate</text>

  <line x1="200" y1="155" x2="600" y2="155" stroke="url(#accentGrad)" stroke-width="2" />

  <!-- Certificate ID -->
  <text x="400" y="190" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Certificate ID: ${escapeXml(certificateId)}</text>

  <!-- CO2 Amount - Large Display -->
  <rect x="150" y="220" width="500" height="120" fill="#10b98115" rx="12" stroke="#10b98133" stroke-width="1" />
  <text x="400" y="270" font-family="system-ui, sans-serif" font-size="16" fill="#10b981" text-anchor="middle" font-weight="600">VERIFIED CARBON OFFSET</text>
  <text x="400" y="320" font-family="Georgia, serif" font-size="48" fill="#ffffff" text-anchor="middle" font-weight="700">${escapeXml(co2Display)} CO\u2082</text>

  <!-- Verification Badge -->
  <rect x="250" y="370" width="300" height="40" fill="#10b98125" rx="20" stroke="#10b981" stroke-width="1" />
  <circle cx="280" cy="390" r="8" fill="#10b981" />
  <text x="295" y="395" font-family="system-ui, sans-serif" font-size="14" fill="#10b981" font-weight="600">${escapeXml(verificationStatus)}</text>

  <!-- Details Section -->
  <text x="80" y="460" font-family="system-ui, sans-serif" font-size="13" fill="#10b981" font-weight="600" letter-spacing="3">RETIREMENT DETAILS</text>
  <line x1="80" y1="475" x2="720" y2="475" stroke="#1e3a5f" stroke-width="1" />

  ${renderDetailRow(80, 510, "Date", dateStr)}
  ${renderDetailRow(80, 550, "Retired By", shortAddress)}
  ${renderDetailRow(80, 590, "Reason", truncate(reason, 60))}
  ${renderDetailRow(80, 630, "Token ID", `#${tokenId}`)}

  <!-- Provenance Section -->
  <text x="80" y="690" font-family="system-ui, sans-serif" font-size="13" fill="#10b981" font-weight="600" letter-spacing="3">PROVENANCE DATA</text>
  <line x1="80" y1="705" x2="720" y2="705" stroke="#1e3a5f" stroke-width="1" />

  ${renderDetailRow(80, 740, "DAC Unit", escapeXml(dacUnitName))}
  ${renderDetailRow(80, 780, "GPS Coordinates", `${gps.lat.toFixed(4)}\u00b0, ${gps.lng.toFixed(4)}\u00b0`)}
  ${renderDetailRow(80, 820, "Efficiency Factor", `${efficiencyFactor.toFixed(1)}%`)}
  ${renderDetailRow(80, 860, "Grid Intensity", `${gridIntensity} gCO\u2082/kWh`)}

  <!-- On-Chain Verification -->
  <text x="80" y="920" font-family="system-ui, sans-serif" font-size="13" fill="#10b981" font-weight="600" letter-spacing="3">ON-CHAIN VERIFICATION</text>
  <line x1="80" y1="935" x2="720" y2="935" stroke="#1e3a5f" stroke-width="1" />

  ${renderDetailRow(80, 970, "Transaction", shortTxHash)}
  ${renderDetailRow(80, 1010, "Network", network === "aethelred" ? "Aethelred Mainnet" : "Aethelred Testnet")}

  <!-- Footer -->
  <line x1="80" y1="1040" x2="720" y2="1040" stroke="#1e3a5f" stroke-width="1" />
  <text x="400" y="1060" font-family="system-ui, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">Powered by TerraQura Protocol \u2014 Proof-of-Physics Verified \u2014 ${txLink}</text>
</svg>`;
}

// ============================================
// Helper Functions
// ============================================

function renderDetailRow(
  x: number,
  y: number,
  label: string,
  value: string,
): string {
  return `<text x="${x}" y="${y}" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">${escapeXml(label)}</text>
  <text x="720" y="${y}" font-family="system-ui, sans-serif" font-size="14" fill="#ffffff" text-anchor="end" font-weight="500">${escapeXml(value)}</text>`;
}

// ============================================
// SVG-Safe Sanitization (Defense-in-Depth)
// ============================================

/**
 * Strict SVG sanitizer that goes beyond basic XML escaping.
 *
 * Defends against:
 * - XML entity injection (standard &, <, >, ", ')
 * - SVG/CSS injection via `url()`, `expression()`, `javascript:`
 * - Event handler injection (`onload`, `onerror`, etc.)
 * - Embedded `<script>`, `<style>`, `<foreignObject>` tags
 * - Unicode-based obfuscation (zero-width chars, homoglyphs)
 * - CSS `@import`, `@charset` directives
 * - Data URI payloads (`data:text/html`, `data:image/svg+xml`)
 *
 * @param str - Raw input string (e.g., DAC unit name, retirement reason)
 * @returns Sanitized string safe for SVG text content and attributes
 */
export function sanitizeSVGText(str: string): string {
  // Step 1: Strip control characters and zero-width Unicode
  let safe = str.replace(
    /[\p{Cc}\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFFF9-\uFFFC]/gu,
    "",
  );

  // Step 2: Standard XML entity escaping
  safe = safe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  // Step 3: Neutralize dangerous SVG/CSS patterns (case-insensitive)
  // These could be used for CSS injection or JS execution in SVG renderers
  safe = safe
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/vbscript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text/gi, "blocked:text")
    .replace(/data\s*:\s*image\/svg/gi, "blocked:image/svg")
    .replace(/expression\s*\(/gi, "blocked(")
    .replace(/url\s*\(/gi, "blocked(")
    .replace(/@import/gi, "blocked-import")
    .replace(/@charset/gi, "blocked-charset")
    .replace(/binding\s*:/gi, "blocked:")
    .replace(/-moz-binding\s*:/gi, "blocked:");

  // Step 4: Neutralize event handler patterns
  // Even though these are in text content, some SVG parsers may
  // re-parse during innerHTML assignment
  safe = safe.replace(
    /on(abort|blur|change|click|dblclick|error|focus|load|mousedown|mousemove|mouseout|mouseover|mouseup|reset|resize|scroll|select|submit|unload|keydown|keypress|keyup|input|beforeunload|hashchange|message|offline|online|pagehide|pageshow|popstate|storage|animationend|animationstart|animationiteration|transitionend)\s*=/gi,
    "blocked=",
  );

  // Step 5: Length limit (prevent SVG size bombing)
  if (safe.length > 2000) {
    safe = safe.slice(0, 1997) + "...";
  }

  return safe;
}

/**
 * Legacy alias — wraps sanitizeSVGText for backward compatibility.
 */
function escapeXml(str: string): string {
  return sanitizeSVGText(str);
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
