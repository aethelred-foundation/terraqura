/**
 * @terraqura/sdk — Custom Error Hierarchy
 *
 * Enterprise-grade error classes with structured context,
 * error codes for programmatic handling, and JSON serialization.
 */

// ============================================
// Error Codes
// ============================================

export enum SDKErrorCode {
  /** RPC/transport failure */
  NETWORK_ERROR = "NETWORK_ERROR",
  /** Smart contract revert */
  CONTRACT_REVERT = "CONTRACT_REVERT",
  /** Input validation failure (Zod) */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** Insufficient AETH for gas */
  INSUFFICIENT_FUNDS = "INSUFFICIENT_FUNDS",
  /** Insufficient carbon credit balance */
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  /** Protocol circuit breaker active */
  CIRCUIT_BREAKER = "CIRCUIT_BREAKER",
  /** Transaction failed after submission */
  TX_FAILED = "TX_FAILED",
  /** Subgraph query failure */
  SUBGRAPH_ERROR = "SUBGRAPH_ERROR",
  /** No signer configured for write operation */
  AUTH_REQUIRED = "AUTH_REQUIRED",
  /** Duplicate operation detected */
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  /** Operation timed out */
  TIMEOUT = "TIMEOUT",
  /** Unknown/unclassified error */
  UNKNOWN = "UNKNOWN",
}

// ============================================
// Base Error
// ============================================

/**
 * Base error class for all TerraQura SDK errors.
 *
 * @example
 * ```ts
 * try {
 *   await client.market.purchase(listingId, amount);
 * } catch (error) {
 *   if (error instanceof TerraQuraError) {
 *     console.error(error.code, error.message, error.details);
 *   }
 * }
 * ```
 */
export class TerraQuraError extends Error {
  /** Machine-readable error code for programmatic handling */
  public readonly code: SDKErrorCode;

  /** Structured context about the error */
  public readonly details: Record<string, unknown>;

  /** Unix timestamp when the error occurred */
  public readonly timestamp: number;

  constructor(
    message: string,
    code: SDKErrorCode = SDKErrorCode.UNKNOWN,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "TerraQuraError";
    this.code = code;
    this.details = details;
    this.timestamp = Date.now();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Factory method to parse ethers v6 contract revert errors.
   * Extracts the revert reason from CALL_EXCEPTION errors.
   */
  static fromContractRevert(error: unknown): ContractError {
    const err = error as Record<string, unknown>;

    // ethers v6 CALL_EXCEPTION format
    if (err?.code === "CALL_EXCEPTION") {
      const reason =
        (err.reason as string) ||
        (err.revert as Record<string, unknown>)?.name?.toString() ||
        "Unknown revert reason";
      const contractName = (err.transaction as Record<string, unknown>)
        ?.to as string;

      return new ContractError(reason, {
        contractAddress: contractName,
        functionName: (err.data as string)?.slice(0, 10) || "unknown",
        reason,
        originalError: err,
      });
    }

    // ethers v6 ACTION_REJECTED (user rejected tx)
    if (err?.code === "ACTION_REJECTED") {
      return new ContractError("Transaction rejected by user", {
        reason: "ACTION_REJECTED",
        originalError: err,
      });
    }

    // Generic fallback
    const message =
      (err?.message as string) ||
      (err?.reason as string) ||
      "Unknown contract error";
    return new ContractError(message, { originalError: err });
  }

  /** Serialize to JSON for logging/telemetry */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ============================================
// Specific Error Classes
// ============================================

/** RPC or transport-level failure */
export class NetworkError extends TerraQuraError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.NETWORK_ERROR, details);
    this.name = "NetworkError";
  }
}

/** Smart contract revert or execution failure */
export class ContractError extends TerraQuraError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(
      `Contract error: ${message}`,
      SDKErrorCode.CONTRACT_REVERT,
      details,
    );
    this.name = "ContractError";
  }
}

/** Input validation failure (Zod schema) */
export class ValidationError extends TerraQuraError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.VALIDATION_ERROR, details);
    this.name = "ValidationError";
  }
}

/** Insufficient native token (AETH) for gas */
export class InsufficientFundsError extends TerraQuraError {
  constructor(
    message: string = "Insufficient AETH for gas fees",
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.INSUFFICIENT_FUNDS, details);
    this.name = "InsufficientFundsError";
  }
}

/** Insufficient carbon credit balance for operation */
export class InsufficientBalanceError extends TerraQuraError {
  constructor(
    message: string = "Insufficient carbon credit balance",
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.INSUFFICIENT_BALANCE, details);
    this.name = "InsufficientBalanceError";
  }
}

/** Protocol circuit breaker is active — operations blocked */
export class CircuitBreakerError extends TerraQuraError {
  constructor(
    message: string = "Operations paused by circuit breaker",
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.CIRCUIT_BREAKER, details);
    this.name = "CircuitBreakerError";
  }
}

/** Transaction failed after being submitted on-chain */
export class TransactionError extends TerraQuraError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.TX_FAILED, details);
    this.name = "TransactionError";
  }
}

/** The Graph subgraph query failure */
export class SubgraphError extends TerraQuraError {
  constructor(
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(
      `Subgraph query failed: ${message}`,
      SDKErrorCode.SUBGRAPH_ERROR,
      details,
    );
    this.name = "SubgraphError";
  }
}

/** No signer configured — write operation requires authentication */
export class AuthenticationError extends TerraQuraError {
  constructor(
    message: string = "Signer required for write operations. Initialize TerraQuraClient with a privateKey or signer.",
    details: Record<string, unknown> = {},
  ) {
    super(message, SDKErrorCode.AUTH_REQUIRED, details);
    this.name = "AuthenticationError";
  }
}

/** Duplicate operation detected by idempotency guard */
export class IdempotencyError extends TerraQuraError {
  constructor(
    key: string,
    details: Record<string, unknown> = {},
  ) {
    super(
      `Duplicate operation detected (key: ${key}). Use a unique idempotency key or wait for the pending operation to complete.`,
      SDKErrorCode.IDEMPOTENCY_CONFLICT,
      { ...details, idempotencyKey: key },
    );
    this.name = "IdempotencyError";
  }
}

/** Operation exceeded the configured timeout */
export class TimeoutError extends TerraQuraError {
  constructor(
    operation: string,
    timeoutMs: number,
    details: Record<string, unknown> = {},
  ) {
    super(
      `Operation "${operation}" timed out after ${timeoutMs}ms`,
      SDKErrorCode.TIMEOUT,
      { ...details, operation, timeoutMs },
    );
    this.name = "TimeoutError";
  }
}
