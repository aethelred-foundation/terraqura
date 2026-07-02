/**
 * @terraqura/sdk — Checkout Module
 *
 * Carbon-Offset-as-a-Service: hosted checkout sessions that abstract
 * the entire offset pipeline behind a single API call.
 *
 * Architecture:
 * - Consumer calls `createSession()` with CO2 amount
 * - SDK estimates cost and reserves credits
 * - Returns a checkout URL / payment intent
 * - On payment confirmation, executes the offset pipeline
 * - Sends certificate via webhook or returns inline
 *
 * This is the "Stripe Checkout" equivalent for carbon credits.
 *
 * @example
 * ```ts
 * const client = new TerraQuraClient({
 *   network: "aethelred",
 *   privateKey: "0x...",
 * });
 *
 * // Create a checkout session
 * const session = await client.checkout.createSession({
 *   amountKg: 50,
 *   reason: "Carbon neutral shipping — Order #12345",
 *   successUrl: "https://mystore.com/thank-you",
 *   cancelUrl: "https://mystore.com/cart",
 *   metadata: { orderId: "12345", customer: "john@example.com" },
 * });
 *
 * console.log(session.checkoutUrl);  // Redirect user here
 * console.log(session.estimatedCost); // Show price preview
 *
 * // Confirm and execute (after payment)
 * const result = await client.checkout.confirmSession(session.id);
 * console.log(result.certificate); // SVG certificate
 *
 * // Check session status
 * const status = await client.checkout.getSession(session.id);
 * ```
 */

import { ethers } from "ethers";

import {
  ValidationError,
  AuthenticationError,
  TerraQuraError,
} from "../errors.js";

import type { ITelemetry } from "../telemetry.js";
import type { InternalConfig, PriceBreakdown, OffsetEstimate } from "../types.js";
import type { ISessionBackend } from "../utils.js";
import type { OffsetModule } from "./offset.js";

// ============================================
// Checkout Types
// ============================================

/** Checkout session status */
export type CheckoutSessionStatus =
  | "pending"     // Created, awaiting payment
  | "processing"  // Payment confirmed, executing offset
  | "completed"   // Offset executed, certificate generated
  | "expired"     // Session TTL exceeded
  | "cancelled"   // User cancelled
  | "failed";     // Offset execution failed

/** Checkout session creation input */
export interface CreateCheckoutSessionInput {
  /** Amount of CO2 to offset in kilograms */
  amountKg: number;
  /** Retirement reason (stored on-chain) */
  reason: string;
  /** URL to redirect on successful payment */
  successUrl?: string;
  /** URL to redirect on cancellation */
  cancelUrl?: string;
  /** Session TTL in milliseconds (default: 15 minutes) */
  expiresInMs?: number;
  /** Generate SVG certificate */
  generateCertificate?: boolean;
  /**
   * Partner ID for Connect integrations.
   * When set, fees are split according to the partner's markup.
   */
  partnerId?: string;
  /** Sub-account ID for Connect integrations */
  subAccountId?: string;
  /** Arbitrary metadata attached to the session */
  metadata?: Record<string, string | number | boolean>;
  /**
   * Currency for price display (default: "AETHEL").
   * Note: On-chain settlement is always in AETHEL.
   */
  displayCurrency?: string;
  /** Customer email for receipt delivery */
  customerEmail?: string;
  /** Webhook URL for session status updates */
  webhookUrl?: string;
}

/** Checkout session record */
export interface CheckoutSession {
  /** Unique session identifier */
  id: string;
  /** Current session status */
  status: CheckoutSessionStatus;
  /** CO2 amount to offset (kg) */
  amountKg: number;
  /** Retirement reason */
  reason: string;
  /** Cost estimate at session creation */
  estimatedCost: PriceBreakdown;
  /** Best available listings snapshot */
  estimate: OffsetEstimate;
  /** Hosted checkout URL */
  checkoutUrl: string;
  /** Success redirect URL */
  successUrl: string | null;
  /** Cancel redirect URL */
  cancelUrl: string | null;
  /** Session expiry timestamp */
  expiresAt: number;
  /** Partner ID (Connect integration) */
  partnerId: string | null;
  /** Sub-account ID (Connect integration) */
  subAccountId: string | null;
  /** Session metadata */
  metadata: Record<string, string | number | boolean>;
  /** Customer email */
  customerEmail: string | null;
  /** Webhook URL */
  webhookUrl: string | null;
  /** Creation timestamp */
  createdAt: number;
  /** Completion timestamp */
  completedAt: number | null;
  /** Result data (populated after completion) */
  result: CheckoutSessionResult | null;
}

/** Checkout session completion result */
export interface CheckoutSessionResult {
  /** Token IDs of retired credits */
  tokenIds: string[];
  /** Total CO2 retired (kg) */
  amountRetiredKg: number;
  /** Transaction hashes */
  txHashes: string[];
  /** SVG certificate (if requested) */
  certificate?: string;
  /** Final cost (may differ slightly from estimate) */
  finalCost: PriceBreakdown;
}

/** Checkout session list filter */
export interface CheckoutSessionFilter {
  /** Filter by status */
  status?: CheckoutSessionStatus;
  /** Filter by partner ID */
  partnerId?: string;
  /** Filter sessions created after this timestamp */
  createdAfter?: number;
  /** Filter sessions created before this timestamp */
  createdBefore?: number;
  /** Pagination offset */
  offset?: number;
  /** Pagination limit (max 100) */
  limit?: number;
}

// ============================================
// Internal Session Record
// ============================================

export interface CheckoutSessionStoreRecord extends CheckoutSession {
  /** Internal: whether the session has been locked for execution */
  executionLock: boolean;
}

export type CheckoutSessionBackend =
  ISessionBackend<CheckoutSessionStoreRecord>;

export class InMemoryCheckoutSessionBackend implements CheckoutSessionBackend {
  private readonly sessions = new Map<string, CheckoutSessionStoreRecord>();

  get(id: string): CheckoutSessionStoreRecord | undefined {
    const session = this.sessions.get(id);
    return session ? cloneSessionRecord(session) : undefined;
  }

  put(id: string, session: CheckoutSessionStoreRecord): void {
    this.sessions.set(id, cloneSessionRecord(session));
  }

  async update(
    id: string,
    updater: (
      session: CheckoutSessionStoreRecord,
    ) => CheckoutSessionStoreRecord | Promise<CheckoutSessionStoreRecord>,
  ): Promise<CheckoutSessionStoreRecord | undefined> {
    const existing = this.sessions.get(id);
    if (!existing) {
      return undefined;
    }

    const updated = await updater(cloneSessionRecord(existing));
    this.sessions.set(id, cloneSessionRecord(updated));
    return cloneSessionRecord(updated);
  }

  list(): CheckoutSessionStoreRecord[] {
    return Array.from(this.sessions.values()).map(cloneSessionRecord);
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }

  destroy(): void {
    this.sessions.clear();
  }
}

function cloneSessionRecord(
  session: CheckoutSessionStoreRecord,
): CheckoutSessionStoreRecord {
  return globalThis.structuredClone(session);
}

// ============================================
// Checkout Module
// ============================================

/** Default session TTL: 15 minutes */
const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

/** Maximum session TTL: 24 hours */
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/** Base URL for hosted checkout (configurable per deployment) */
const CHECKOUT_BASE_URL = "https://checkout.terraqura.io/pay";

/**
 * TerraQura Checkout — Carbon-Offset-as-a-Service.
 *
 * Provides a "Stripe Checkout" style API for carbon offsetting.
 * Partners can create checkout sessions, redirect users to pay,
 * and receive certificates on completion.
 *
 * Session lifecycle:
 * ```
 * pending → processing → completed
 *     ↓         ↓
 *  expired    failed
 *     ↓
 * cancelled
 * ```
 */
export class CheckoutModule {
  private readonly config: InternalConfig;
  private readonly telemetry: ITelemetry;
  private readonly offset: OffsetModule;
  private readonly sessions: CheckoutSessionBackend;
  private readonly ownsSessionBackend: boolean;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: InternalConfig,
    telemetry: ITelemetry,
    offset: OffsetModule,
    sessionBackend?: CheckoutSessionBackend,
  ) {
    this.config = config;
    this.telemetry = telemetry;
    this.offset = offset;
    const configuredBackend =
      sessionBackend ??
      (config.checkoutSessionBackend as CheckoutSessionBackend | undefined);
    this.sessions =
      configuredBackend ?? new InMemoryCheckoutSessionBackend();
    this.ownsSessionBackend = configuredBackend === undefined;

    // Periodic cleanup of expired sessions
    this.cleanupInterval = setInterval(() => {
      void this.cleanupExpired();
    }, 60_000);
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  // ============================================
  // Session Management
  // ============================================

  /**
   * Create a hosted checkout session.
   *
   * Estimates the offset cost, reserves credit availability,
   * and returns a checkout URL for the user to complete payment.
   *
   * @param input - Session creation parameters
   * @returns Created session with checkout URL and cost estimate
   *
   * @example
   * ```ts
   * const session = await client.checkout.createSession({
   *   amountKg: 100,
   *   reason: "Carbon neutral conference — TechConf 2026",
   *   successUrl: "https://techconf.io/green-confirmed",
   *   customerEmail: "attendee@example.com",
   * });
   *
   * // Redirect user to session.checkoutUrl
   * // After payment, call confirmSession(session.id)
   * ```
   */
  async createSession(
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSession> {
    return this.telemetry.wrapAsync("checkout.createSession", async () => {
      // Validate inputs
      this.validateSessionInput(input);

      // Get cost estimate from the offset module
      const estimate = await this.offset.estimateOffset(input.amountKg);

      if (!estimate.sufficientSupply) {
        throw new ValidationError(
          `Insufficient supply to offset ${input.amountKg} kg CO2. ` +
          `Only ${estimate.bestListings.reduce((sum, l) => sum + Number(l.amount), 0)} kg available.`,
          {
            amountKg: input.amountKg,
            availableKg: estimate.bestListings.reduce(
              (sum, l) => sum + Number(l.amount),
              0,
            ),
          },
        );
      }

      // Calculate session expiry
      const ttl = Math.min(
        input.expiresInMs ?? DEFAULT_SESSION_TTL_MS,
        MAX_SESSION_TTL_MS,
      );

      // Generate session ID
      const sessionId = this.generateSessionId();

      const now = Date.now();
      const session: CheckoutSessionStoreRecord = {
        id: sessionId,
        status: "pending",
        amountKg: input.amountKg,
        reason: input.reason.trim(),
        estimatedCost: estimate.estimatedCost,
        estimate,
        checkoutUrl: `${CHECKOUT_BASE_URL}/${sessionId}`,
        successUrl: input.successUrl || null,
        cancelUrl: input.cancelUrl || null,
        expiresAt: now + ttl,
        partnerId: input.partnerId || null,
        subAccountId: input.subAccountId || null,
        metadata: input.metadata || {},
        customerEmail: input.customerEmail || null,
        webhookUrl: input.webhookUrl || null,
        createdAt: now,
        completedAt: null,
        result: null,
        executionLock: false,
      };

      await this.sessions.put(sessionId, session);

      return this.toCheckoutSession(session);
    });
  }

  /**
   * Confirm and execute a checkout session.
   *
   * Called after payment is confirmed. Triggers the full offset pipeline:
   * find credits → purchase → retire → generate certificate.
   *
   * @param sessionId - The session to confirm
   * @returns Completed session with results
   *
   * @throws ValidationError if the session is expired, already completed, or not found
   */
  async confirmSession(sessionId: string): Promise<CheckoutSession> {
    return this.telemetry.wrapAsync("checkout.confirmSession", async () => {
      this.requireSigner();

      let shouldExecute = false;
      const lockedSession = await this.sessions.update(sessionId, (session) => {
        if (session.status === "completed") {
          return session;
        }

        if (session.status === "cancelled") {
          throw new ValidationError("Session has been cancelled", {
            sessionId,
            status: session.status,
          });
        }

        if (session.status === "processing") {
          throw new ValidationError("Session is already being processed", {
            sessionId,
            status: session.status,
          });
        }

        if (session.expiresAt < Date.now()) {
          session.status = "expired";
          return session;
        }

        if (session.executionLock) {
          throw new ValidationError("Session is locked for execution", {
            sessionId,
          });
        }

        session.executionLock = true;
        session.status = "processing";
        shouldExecute = true;
        return session;
      });

      if (!lockedSession) {
        throw new ValidationError(`Session not found: ${sessionId}`, {
          field: "sessionId",
        });
      }

      if (lockedSession.status === "completed") {
        return this.toCheckoutSession(lockedSession); // Idempotent
      }

      if (lockedSession.status === "expired" && !shouldExecute) {
        throw new ValidationError("Session has expired", {
          sessionId,
          expiresAt: lockedSession.expiresAt,
        });
      }

      try {
        // Execute the offset
        const result = await this.offset.offsetFootprint(
          lockedSession.amountKg,
          lockedSession.reason,
          { generateCertificate: true },
        );

        const completed = await this.sessions.update(sessionId, (session) => {
          session.status = "completed";
          session.executionLock = false;
          session.completedAt = Date.now();
          session.result = {
            tokenIds: result.tokenIds,
            amountRetiredKg: result.amountRetiredKg,
            txHashes: result.txHashes,
            certificate: result.certificate,
            finalCost: result.cost,
          };
          return session;
        });

        if (!completed) {
          throw new ValidationError(`Session not found: ${sessionId}`, {
            field: "sessionId",
          });
        }

        // Dispatch webhook if configured
        if (completed.webhookUrl) {
          this.dispatchWebhook(completed).catch(() => {
            // Webhook failures are non-fatal
          });
        }

        return this.toCheckoutSession(completed);
      } catch (error) {
        await this.sessions.update(sessionId, (session) => {
          session.status = "failed";
          session.executionLock = false;
          return session;
        });

        if (error instanceof TerraQuraError) throw error;
        throw TerraQuraError.fromContractRevert(error);
      }
    });
  }

  /**
   * Cancel a pending checkout session.
   */
  async cancelSession(sessionId: string): Promise<CheckoutSession> {
    return this.telemetry.wrapAsync("checkout.cancelSession", async () => {
      const session = await this.sessions.update(sessionId, (session) => {
        if (session.status !== "pending") {
          throw new ValidationError(
            `Cannot cancel session in "${session.status}" state`,
            { sessionId, status: session.status },
          );
        }

        session.status = "cancelled";
        return session;
      });

      if (!session) {
        throw new ValidationError(`Session not found: ${sessionId}`, {
          field: "sessionId",
        });
      }

      return this.toCheckoutSession(session);
    });
  }

  /**
   * Get a checkout session by ID.
   */
  async getSession(sessionId: string): Promise<CheckoutSession> {
    return this.telemetry.wrapAsync("checkout.getSession", async () => {
      const session = await this.sessions.update(sessionId, (session) => {
        if (
          session.status === "pending" &&
          session.expiresAt < Date.now()
        ) {
          session.status = "expired";
        }
        return session;
      });

      if (!session) {
        throw new ValidationError(`Session not found: ${sessionId}`, {
          field: "sessionId",
        });
      }

      return this.toCheckoutSession(session);
    });
  }

  /**
   * List checkout sessions with optional filters.
   */
  async listSessions(
    filter?: CheckoutSessionFilter,
  ): Promise<{
    items: CheckoutSession[];
    total: number;
    hasMore: boolean;
  }> {
    return this.telemetry.wrapAsync("checkout.listSessions", async () => {
      let sessions = await this.sessions.list();

      // Apply filters
      if (filter?.status) {
        sessions = sessions.filter((s) => s.status === filter.status);
      }
      if (filter?.partnerId) {
        sessions = sessions.filter((s) => s.partnerId === filter.partnerId);
      }
      if (typeof filter?.createdAfter === "number") {
        const createdAfter = filter.createdAfter;
        sessions = sessions.filter((s) => s.createdAt >= createdAfter);
      }
      if (typeof filter?.createdBefore === "number") {
        const createdBefore = filter.createdBefore;
        sessions = sessions.filter((s) => s.createdAt <= createdBefore);
      }

      // Sort by creation time (newest first)
      sessions.sort((a, b) => b.createdAt - a.createdAt);

      const offset = filter?.offset ?? 0;
      const limit = Math.min(filter?.limit ?? 50, 100);
      const total = sessions.length;
      const items = sessions
        .slice(offset, offset + limit)
        .map((s) => this.toCheckoutSession(s));

      return { items, total, hasMore: offset + limit < total };
    });
  }

  /**
   * Get checkout analytics / summary stats.
   */
  async getAnalytics(
    options?: { partnerId?: string; since?: number },
  ): Promise<{
    totalSessions: number;
    completedSessions: number;
    failedSessions: number;
    cancelledSessions: number;
    expiredSessions: number;
    totalCO2RetiredKg: number;
    totalRevenueWei: bigint;
    averageSessionValueWei: bigint;
    conversionRate: number;
  }> {
    return this.telemetry.wrapAsync("checkout.getAnalytics", async () => {
      let sessions = await this.sessions.list();

      if (options?.partnerId) {
        sessions = sessions.filter((s) => s.partnerId === options.partnerId);
      }
      if (typeof options?.since === "number") {
        const since = options.since;
        sessions = sessions.filter((s) => s.createdAt >= since);
      }

      const completed = sessions.filter((s) => s.status === "completed");
      const totalRevenue = completed.reduce(
        (sum, s) => sum + (s.result?.finalCost.total ?? 0n),
        0n,
      );

      const totalCO2 = completed.reduce(
        (sum, s) => sum + (s.result?.amountRetiredKg ?? 0),
        0,
      );

      return {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        failedSessions: sessions.filter((s) => s.status === "failed").length,
        cancelledSessions: sessions.filter((s) => s.status === "cancelled").length,
        expiredSessions: sessions.filter((s) => s.status === "expired").length,
        totalCO2RetiredKg: totalCO2,
        totalRevenueWei: totalRevenue,
        averageSessionValueWei:
          completed.length > 0
            ? totalRevenue / BigInt(completed.length)
            : 0n,
        conversionRate:
          sessions.length > 0
            ? completed.length / sessions.length
            : 0,
      };
    });
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Stop the cleanup interval. Call during shutdown.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.ownsSessionBackend) {
      void this.sessions.destroy?.();
    }
  }

  // ============================================
  // Private Helpers
  // ============================================

  private validateSessionInput(input: CreateCheckoutSessionInput): void {
    if (!input.amountKg || input.amountKg <= 0) {
      throw new ValidationError("Amount must be positive", {
        field: "amountKg",
        value: input.amountKg,
      });
    }

    if (input.amountKg > 1_000_000) {
      throw new ValidationError("Amount exceeds maximum (1,000,000 kg)", {
        field: "amountKg",
        value: input.amountKg,
        maximum: 1_000_000,
      });
    }

    if (!input.reason || input.reason.trim().length === 0) {
      throw new ValidationError("Reason is required", {
        field: "reason",
      });
    }

    if (input.reason.length > 500) {
      throw new ValidationError("Reason exceeds 500 characters", {
        field: "reason",
        length: input.reason.length,
      });
    }

    if (input.successUrl) {
      try { new URL(input.successUrl); } catch {
        throw new ValidationError("Invalid success URL", {
          field: "successUrl",
        });
      }
    }

    if (input.cancelUrl) {
      try { new URL(input.cancelUrl); } catch {
        throw new ValidationError("Invalid cancel URL", {
          field: "cancelUrl",
        });
      }
    }

    if (input.webhookUrl) {
      try { new URL(input.webhookUrl); } catch {
        throw new ValidationError("Invalid webhook URL", {
          field: "webhookUrl",
        });
      }
    }

    if (input.customerEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(input.customerEmail)) {
        throw new ValidationError("Invalid email address", {
          field: "customerEmail",
        });
      }
    }

    if (
      input.expiresInMs !== undefined &&
      (input.expiresInMs <= 0 || input.expiresInMs > MAX_SESSION_TTL_MS)
    ) {
      throw new ValidationError(
        `Session TTL must be between 1ms and ${MAX_SESSION_TTL_MS}ms (24 hours)`,
        { field: "expiresInMs", value: input.expiresInMs },
      );
    }
  }

  private generateSessionId(): string {
    const randomBytes = ethers.randomBytes(16);
    const hex = ethers.hexlify(randomBytes).slice(2);
    return `tqcs_${hex}`;
  }

  private toCheckoutSession(record: CheckoutSessionStoreRecord): CheckoutSession {
    const { executionLock: _lock, ...session } = record;
    return session;
  }

  /**
   * Dispatch a webhook notification for session status change.
   */
  private async dispatchWebhook(session: CheckoutSessionStoreRecord): Promise<void> {
    if (!session.webhookUrl) return;

    const payload = {
      event: "checkout.session.completed",
      sessionId: session.id,
      status: session.status,
      amountKg: session.amountKg,
      result: session.result
        ? {
            tokenIds: session.result.tokenIds,
            amountRetiredKg: session.result.amountRetiredKg,
            txHashes: session.result.txHashes,
            hasCertificate: !!session.result.certificate,
          }
        : null,
      metadata: session.metadata,
      timestamp: Date.now(),
    };

    const body = JSON.stringify(payload);

    // Sign the payload with HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(session.id), // Use session ID as HMAC key
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );
    const signature = ethers.hexlify(new Uint8Array(signatureBuffer));

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 10_000);

      await fetch(session.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-TerraQura-Signature": signature,
          "X-TerraQura-Event": "checkout.session.completed",
          "X-TerraQura-Session-Id": session.id,
        },
        body,
        signal: controller.signal,
      });
    } catch {
      // Webhook delivery failure is non-fatal
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  /**
   * Cleanup expired sessions older than 24 hours.
   */
  private async cleanupExpired(): Promise<void> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    for (const session of await this.sessions.list()) {
      if (session.status === "pending" && session.expiresAt < Date.now()) {
        await this.sessions.update(session.id, (current) => ({
          ...current,
          status: current.status === "pending" ? "expired" : current.status,
        }));
      }
      // Remove completed/expired sessions older than 24h
      if (
        (session.status === "expired" || session.status === "cancelled") &&
        session.createdAt < cutoff
      ) {
        await this.sessions.delete(session.id);
      }
    }
  }

  private requireSigner(): void {
    if (!this.config.signer) {
      throw new AuthenticationError();
    }
  }
}
