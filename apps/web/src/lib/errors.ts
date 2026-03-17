/**
 * TerraQura Production Error Handling
 *
 * Enterprise-grade error classification, handling, and reporting utilities.
 * Designed for mainnet deployment with user-friendly error messages
 * and structured error logging for monitoring.
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 */

// ============================================
// Error Classification
// ============================================

export enum ErrorCategory {
  /** Blockchain/Web3 errors */
  BLOCKCHAIN = 'BLOCKCHAIN',
  /** Network/RPC errors */
  NETWORK = 'NETWORK',
  /** User action errors (rejection, insufficient funds) */
  USER_ACTION = 'USER_ACTION',
  /** Smart contract revert errors */
  CONTRACT = 'CONTRACT',
  /** Validation errors */
  VALIDATION = 'VALIDATION',
  /** Authentication/Authorization errors */
  AUTH = 'AUTH',
  /** API errors */
  API = 'API',
  /** Unknown errors */
  UNKNOWN = 'UNKNOWN',
}

export enum ErrorSeverity {
  /** Informational - no action needed */
  INFO = 'INFO',
  /** Warning - may need attention */
  WARNING = 'WARNING',
  /** Error - needs attention */
  ERROR = 'ERROR',
  /** Critical - immediate attention required */
  CRITICAL = 'CRITICAL',
}

export interface ClassifiedError {
  /** Original error */
  original: unknown;
  /** Error category */
  category: ErrorCategory;
  /** Error severity */
  severity: ErrorSeverity;
  /** User-friendly error message */
  userMessage: string;
  /** Technical error message (for logs) */
  technicalMessage: string;
  /** Unique error code */
  code: string;
  /** Whether error is recoverable */
  recoverable: boolean;
  /** Suggested action for user */
  suggestedAction?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================
// Error Messages - User Friendly
// ============================================

const USER_FRIENDLY_MESSAGES = {
  // Wallet errors
  'user rejected': 'Transaction was cancelled. No action was taken.',
  'user denied': 'Transaction was cancelled. No action was taken.',
  'insufficient funds': 'Insufficient funds in your wallet. Please add more AETH.',
  'insufficient balance': 'Insufficient balance for this transaction.',

  // Network errors
  'network changed': 'Network changed. Please reconnect your wallet.',
  'could not coalesce': 'Network connection issue. Please try again.',
  'network error': 'Unable to connect to the network. Please check your connection.',
  'timeout': 'Request timed out. Please try again.',
  'rpc error': 'Blockchain network is busy. Please try again in a moment.',

  // Contract errors
  'execution reverted': 'Transaction failed. Please check your inputs and try again.',
  'call revert': 'Unable to complete this action. Please try again.',
  'gas estimation': 'Unable to estimate gas. The transaction may fail.',
  'nonce too low': 'Transaction conflict detected. Please wait and try again.',
  'replacement fee too low': 'Gas price too low. Please increase gas and retry.',

  // Circuit breaker
  'circuit breaker': 'Platform is temporarily paused for maintenance. Please try again later.',
  'paused': 'This operation is temporarily unavailable. Please try again later.',

  // KYC/Verification
  'kyc required': 'Verification required. Please complete KYC to continue.',
  'not verified': 'Your account needs verification to perform this action.',

  // Marketplace
  'listing not found': 'This listing is no longer available.',
  'listing expired': 'This listing has expired.',
  'below minimum': 'Purchase amount is below the minimum required.',
  'insufficient amount': 'Not enough credits available in this listing.',

  // Credits
  'already retired': 'These credits have already been retired.',
  'data hash already used': 'This capture data has already been processed.',

  // Default
  'default': 'Something went wrong. Please try again or contact support.',
} as const;

// ============================================
// Error Classification Logic
// ============================================

/**
 * Classifies an error into categories with user-friendly messages
 */
export function classifyError(error: unknown): ClassifiedError {
  const errorMessage = getErrorMessage(error).toLowerCase();

  // User action errors (lowest severity - expected)
  if (errorMessage.includes('user rejected') || errorMessage.includes('user denied')) {
    return {
      original: error,
      category: ErrorCategory.USER_ACTION,
      severity: ErrorSeverity.INFO,
      userMessage: USER_FRIENDLY_MESSAGES['user rejected'],
      technicalMessage: getErrorMessage(error),
      code: 'USER_REJECTED',
      recoverable: true,
      suggestedAction: 'Try again when ready',
    };
  }

  // Insufficient funds
  if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
    return {
      original: error,
      category: ErrorCategory.USER_ACTION,
      severity: ErrorSeverity.WARNING,
      userMessage: USER_FRIENDLY_MESSAGES['insufficient funds'],
      technicalMessage: getErrorMessage(error),
      code: 'INSUFFICIENT_FUNDS',
      recoverable: true,
      suggestedAction: 'Add more AETH to your wallet',
    };
  }

  // Network errors
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('coalesce') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('rpc')
  ) {
    return {
      original: error,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.WARNING,
      userMessage: USER_FRIENDLY_MESSAGES['network error'],
      technicalMessage: getErrorMessage(error),
      code: 'NETWORK_ERROR',
      recoverable: true,
      suggestedAction: 'Check your internet connection and try again',
    };
  }

  // Circuit breaker / pause
  if (errorMessage.includes('circuit breaker') || errorMessage.includes('paused')) {
    return {
      original: error,
      category: ErrorCategory.CONTRACT,
      severity: ErrorSeverity.WARNING,
      userMessage: USER_FRIENDLY_MESSAGES['circuit breaker'],
      technicalMessage: getErrorMessage(error),
      code: 'PLATFORM_PAUSED',
      recoverable: false,
      suggestedAction: 'Wait for maintenance to complete',
    };
  }

  // Contract revert errors
  if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
    const revertReason = extractRevertReason(errorMessage);
    return {
      original: error,
      category: ErrorCategory.CONTRACT,
      severity: ErrorSeverity.ERROR,
      userMessage: mapRevertReason(revertReason),
      technicalMessage: getErrorMessage(error),
      code: 'CONTRACT_REVERT',
      recoverable: true,
      suggestedAction: 'Check your inputs and try again',
      metadata: { revertReason },
    };
  }

  // KYC errors
  if (errorMessage.includes('kyc') || errorMessage.includes('not verified')) {
    return {
      original: error,
      category: ErrorCategory.AUTH,
      severity: ErrorSeverity.WARNING,
      userMessage: USER_FRIENDLY_MESSAGES['kyc required'],
      technicalMessage: getErrorMessage(error),
      code: 'KYC_REQUIRED',
      recoverable: true,
      suggestedAction: 'Complete identity verification',
    };
  }

  // Gas estimation errors
  if (errorMessage.includes('gas')) {
    return {
      original: error,
      category: ErrorCategory.BLOCKCHAIN,
      severity: ErrorSeverity.WARNING,
      userMessage: USER_FRIENDLY_MESSAGES['gas estimation'],
      technicalMessage: getErrorMessage(error),
      code: 'GAS_ESTIMATION_FAILED',
      recoverable: true,
      suggestedAction: 'Try again or contact support',
    };
  }

  // Default unknown error
  return {
    original: error,
    category: ErrorCategory.UNKNOWN,
    severity: ErrorSeverity.ERROR,
    userMessage: USER_FRIENDLY_MESSAGES['default'],
    technicalMessage: getErrorMessage(error),
    code: 'UNKNOWN_ERROR',
    recoverable: true,
    suggestedAction: 'Try again or contact support',
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Safely extracts error message from any error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  if (error && typeof error === 'object' && 'reason' in error) {
    return String((error as { reason: unknown }).reason);
  }
  return 'Unknown error occurred';
}

/**
 * Extracts revert reason from error message
 */
function extractRevertReason(errorMessage: string): string {
  // Try to find revert reason in different formats
  const patterns = [
    /reason="([^"]+)"/,
    /reverted with reason string '([^']+)'/,
    /reverted: ([^"]+)/,
    /error=\{[^}]*"message":"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = errorMessage.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return 'unknown';
}

/**
 * Maps contract revert reasons to user-friendly messages
 */
function mapRevertReason(reason: string): string {
  const reasonLower = reason.toLowerCase();

  for (const [key, message] of Object.entries(USER_FRIENDLY_MESSAGES)) {
    if (reasonLower.includes(key)) {
      return message;
    }
  }

  // Return the reason itself if no mapping found (but cleaned up)
  return `Transaction failed: ${reason}`;
}

// ============================================
// Error Reporting
// ============================================

export interface ErrorReport {
  timestamp: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  code: string;
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
  userAgent?: string;
  url?: string;
}

/**
 * Creates an error report for logging/monitoring
 */
export function createErrorReport(
  classifiedError: ClassifiedError,
  additionalContext?: Record<string, unknown>
): ErrorReport {
  return {
    timestamp: new Date().toISOString(),
    category: classifiedError.category,
    severity: classifiedError.severity,
    code: classifiedError.code,
    message: classifiedError.technicalMessage,
    stack: classifiedError.original instanceof Error
      ? classifiedError.original.stack
      : undefined,
    metadata: {
      ...classifiedError.metadata,
      ...additionalContext,
    },
    userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };
}

/**
 * Reports error to monitoring service (placeholder for integration)
 * In production, integrate with Sentry, DataDog, or similar
 */
export async function reportError(report: ErrorReport): Promise<void> {
  // Only report errors and critical severity
  if (report.severity === ErrorSeverity.INFO) {
    return;
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[TerraQura Error Report]', report);
    return;
  }

  // In production, send to monitoring service
  // TODO: Integrate with Sentry or DataDog
  try {
    // Example: Send to analytics endpoint
    // await fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(report),
    // });
    console.error('[TerraQura Error]', report.code, report.message);
  } catch {
    // Fail silently - don't want error reporting to cause more errors
  }
}

// ============================================
// React Hook for Error Handling
// ============================================

import { useCallback } from 'react';

export interface UseErrorHandlerResult {
  handleError: (error: unknown, context?: Record<string, unknown>) => ClassifiedError;
  reportAndHandle: (error: unknown, context?: Record<string, unknown>) => Promise<ClassifiedError>;
}

/**
 * React hook for error handling
 * @example
 * const { handleError, reportAndHandle } = useErrorHandler();
 * try { ... } catch (e) { const classified = await reportAndHandle(e); }
 */
export function useErrorHandler(): UseErrorHandlerResult {
  const handleError = useCallback((
    error: unknown,
    context?: Record<string, unknown>
  ): ClassifiedError => {
    const classified = classifyError(error);
    if (context) {
      classified.metadata = { ...classified.metadata, ...context };
    }
    return classified;
  }, []);

  const reportAndHandle = useCallback(async (
    error: unknown,
    context?: Record<string, unknown>
  ): Promise<ClassifiedError> => {
    const classified = handleError(error, context);
    const report = createErrorReport(classified, context);
    await reportError(report);
    return classified;
  }, [handleError]);

  return { handleError, reportAndHandle };
}

// ============================================
// Transaction Error Helpers
// ============================================

/**
 * Check if error is due to user rejection
 */
export function isUserRejection(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('user rejected') || message.includes('user denied');
}

/**
 * Check if error is recoverable by retrying
 */
export function isRetryableError(error: unknown): boolean {
  const classified = classifyError(error);
  return (
    classified.recoverable &&
    classified.category !== ErrorCategory.USER_ACTION &&
    classified.severity !== ErrorSeverity.CRITICAL
  );
}

/**
 * Format error for toast notification
 */
export function formatErrorForToast(error: unknown): {
  title: string;
  description: string;
  variant: 'default' | 'destructive';
} {
  const classified = classifyError(error);

  return {
    title: classified.severity === ErrorSeverity.INFO
      ? 'Cancelled'
      : 'Error',
    description: classified.userMessage,
    variant: classified.severity === ErrorSeverity.INFO
      ? 'default'
      : 'destructive',
  };
}
