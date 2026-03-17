/**
 * @terraqura/sdk — Webhook Manager
 *
 * Event listener system for on-chain events with HTTP webhook dispatch.
 * Supports HMAC-SHA256 signed payloads and exponential backoff retries.
 */

import { ethers } from "ethers";

import {
  CarbonCreditABI,
  CarbonMarketplaceABI,
  CircuitBreakerABI,
  type ContractAddresses,
} from "./constants.js";
import { sleep } from "./utils.js";

import type {
  SDKEvent,
  SDKEventPayload,
  WebhookOptions,
} from "./types.js";

// ============================================
// Types
// ============================================

type EventCallback = (payload: SDKEventPayload) => void | Promise<void>;
type Unsubscribe = () => void;

interface WebhookEndpoint {
  url: string;
  events: SDKEvent[];
  options: Required<WebhookOptions>;
}

interface EventMapping {
  contract: ethers.Contract;
  eventName: string;
}

// ============================================
// Webhook Manager
// ============================================

/**
 * On-chain event listener and webhook dispatch system.
 *
 * Listens to TerraQura smart contract events and dispatches to:
 * 1. In-process callbacks (synchronous)
 * 2. HTTP webhook URLs (async with retry)
 *
 * @example
 * ```ts
 * const manager = new WebhookManager(provider, addresses);
 *
 * // In-process callback
 * const unsub = manager.on("CreditMinted", (payload) => {
 *   console.log("New credit minted:", payload.data.tokenId);
 * });
 *
 * // HTTP webhook
 * manager.addWebhookUrl("https://my-erp.com/webhook", ["CreditRetired"], {
 *   secret: "my-hmac-secret",
 * });
 *
 * manager.start();
 * // ... later
 * manager.stop();
 * unsub();
 * ```
 */
export class WebhookManager {
  private readonly provider: ethers.Provider;
  private readonly addresses: ContractAddresses;
  private readonly callbacks = new Map<SDKEvent, Set<EventCallback>>();
  private readonly webhookEndpoints: WebhookEndpoint[] = [];
  private contracts: Map<string, ethers.Contract> | null = null;
  private isRunning = false;

  constructor(provider: ethers.Provider, addresses: ContractAddresses) {
    this.provider = provider;
    this.addresses = addresses;
  }

  /**
   * Subscribe to an on-chain event.
   * @returns Unsubscribe function
   */
  on(event: SDKEvent, callback: EventCallback): Unsubscribe {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, new Set());
    }
    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      callbacks.add(callback);
    }

    return () => {
      this.callbacks.get(event)?.delete(callback);
    };
  }

  /**
   * Register an HTTP webhook endpoint for event notifications.
   */
  addWebhookUrl(
    url: string,
    events: SDKEvent[],
    options: WebhookOptions = {},
  ): void {
    this.webhookEndpoints.push({
      url,
      events,
      options: {
        secret: options.secret || "",
        retries: options.retries ?? 3,
        timeoutMs: options.timeoutMs ?? 10_000,
      },
    });
  }

  /** Remove a webhook endpoint by URL */
  removeWebhookUrl(url: string): void {
    const index = this.webhookEndpoints.findIndex((e) => e.url === url);
    if (index >= 0) {
      this.webhookEndpoints.splice(index, 1);
    }
  }

  /** Start listening to blockchain events */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.contracts = this.createContracts();
    this.attachListeners();
  }

  /** Stop all listeners and cleanup */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.contracts) {
      for (const contract of this.contracts.values()) {
        contract.removeAllListeners();
      }
      this.contracts = null;
    }
  }

  /** Check if the manager is currently listening */
  get listening(): boolean {
    return this.isRunning;
  }

  // ============================================
  // Private Methods
  // ============================================

  private createContracts(): Map<string, ethers.Contract> {
    const contracts = new Map<string, ethers.Contract>();

    contracts.set(
      "carbonCredit",
      new ethers.Contract(
        this.addresses.carbonCredit,
        CarbonCreditABI,
        this.provider,
      ),
    );

    contracts.set(
      "carbonMarketplace",
      new ethers.Contract(
        this.addresses.carbonMarketplace,
        CarbonMarketplaceABI,
        this.provider,
      ),
    );

    contracts.set(
      "circuitBreaker",
      new ethers.Contract(
        this.addresses.circuitBreaker,
        CircuitBreakerABI,
        this.provider,
      ),
    );

    return contracts;
  }

  private getEventMapping(event: SDKEvent): EventMapping | null {
    if (!this.contracts) return null;

    const mappings: Record<SDKEvent, { contractKey: string; eventName: string }> = {
      CreditMinted: { contractKey: "carbonCredit", eventName: "CreditMinted" },
      CreditRetired: { contractKey: "carbonCredit", eventName: "CreditRetired" },
      ListingCreated: { contractKey: "carbonMarketplace", eventName: "ListingCreated" },
      Purchase: { contractKey: "carbonMarketplace", eventName: "Purchase" },
      OfferCreated: { contractKey: "carbonMarketplace", eventName: "OfferCreated" },
      OfferAccepted: { contractKey: "carbonMarketplace", eventName: "OfferAccepted" },
      GlobalPauseActivated: { contractKey: "circuitBreaker", eventName: "GlobalPauseActivated" },
      GlobalPauseDeactivated: { contractKey: "circuitBreaker", eventName: "GlobalPauseDeactivated" },
    };

    const mapping = mappings[event];
    if (!mapping) return null;

    const contract = this.contracts.get(mapping.contractKey);
    if (!contract) return null;

    return { contract, eventName: mapping.eventName };
  }

  private attachListeners(): void {
    // Collect all unique events needed
    const allEvents = new Set<SDKEvent>();
    for (const event of this.callbacks.keys()) {
      allEvents.add(event);
    }
    for (const endpoint of this.webhookEndpoints) {
      for (const event of endpoint.events) {
        allEvents.add(event);
      }
    }

    // Attach a listener for each event
    for (const event of allEvents) {
      const mapping = this.getEventMapping(event);
      if (!mapping) continue;

      mapping.contract.on(mapping.eventName, (...args: unknown[]) => {
        // The last argument is the ethers EventLog
        const eventLog = args[args.length - 1] as ethers.EventLog;

        const payload: SDKEventPayload = {
          event,
          data: this.parseEventArgs(args.slice(0, -1), event),
          txHash: eventLog?.transactionHash || "",
          blockNumber: eventLog?.blockNumber || 0,
          timestamp: Date.now(),
        };

        this.dispatch(payload);
      });
    }
  }

  private parseEventArgs(
    args: unknown[],
    event: SDKEvent,
  ): Record<string, unknown> {
    // Map positional args to named fields based on event type
    const fieldMaps: Record<string, string[]> = {
      CreditMinted: ["tokenId", "dacUnitId", "recipient", "creditsAmount", "sourceDataHash"],
      CreditRetired: ["tokenId", "retiree", "amount", "reason"],
      ListingCreated: ["listingId", "seller", "tokenId", "amount", "pricePerUnit"],
      Purchase: ["listingId", "buyer", "seller", "tokenId", "amount", "totalPrice", "platformFee"],
      OfferCreated: ["offerId", "buyer", "tokenId", "amount", "pricePerUnit"],
      OfferAccepted: ["offerId", "seller", "buyer", "tokenId", "amount", "totalPrice"],
      GlobalPauseActivated: ["by", "reason"],
      GlobalPauseDeactivated: ["by"],
    };

    const fields = fieldMaps[event] || [];
    const result: Record<string, unknown> = {};

    fields.forEach((field, index) => {
      if (index < args.length) {
        const value = args[index];
        result[field] = typeof value === "bigint" ? value.toString() : value;
      }
    });

    return result;
  }

  private dispatch(payload: SDKEventPayload): void {
    // Dispatch to in-process callbacks
    const callbacks = this.callbacks.get(payload.event);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          const result = callback(payload);
          // If callback returns a promise, catch errors silently
          if (result instanceof Promise) {
            result.catch(() => {});
          }
        } catch {
          // Don't let one callback failure affect others
        }
      }
    }

    // Dispatch to webhook endpoints
    for (const endpoint of this.webhookEndpoints) {
      if (endpoint.events.includes(payload.event)) {
        this.dispatchWebhook(endpoint, payload).catch(() => {});
      }
    }
  }

  private async dispatchWebhook(
    endpoint: WebhookEndpoint,
    payload: SDKEventPayload,
  ): Promise<void> {
    const body = JSON.stringify(payload);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-TerraQura-Event": payload.event,
      "X-TerraQura-Timestamp": payload.timestamp.toString(),
    };

    // Add HMAC-SHA256 signature if secret is configured
    if (endpoint.options.secret) {
      const signature = await this.computeHmac(
        endpoint.options.secret,
        body,
      );
      headers["X-TerraQura-Signature"] = signature;
    }

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= endpoint.options.retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(
          () => controller.abort(),
          endpoint.options.timeoutMs,
        );

        const response = await fetch(endpoint.url, {
          method: "POST",
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (response.ok) return;

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500) return;
      } catch {
        // Network error — will retry
      }

      if (attempt < endpoint.options.retries) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }

  private async computeHmac(
    secret: string,
    message: string,
  ): Promise<string> {
    // Use Web Crypto API (available in Node.js 18+ and browsers)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signature = await crypto.subtle.sign("HMAC", key, msgData);
    const bytes = new Uint8Array(signature);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}
