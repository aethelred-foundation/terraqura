/**
 * TerraQura Loading State Components
 *
 * Production-ready loading indicators and skeleton screens
 * for a polished user experience during data loading.
 *
 * @version 1.0.0
 * @author TerraQura Engineering
 */

"use client";

import React from "react";

// ============================================
// Spinner Component
// ============================================

interface SpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Spinner({ size = "md", className = "" }: SpinnerProps): React.JSX.Element {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12",
  };

  return (
    <div
      className={`${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <svg
        className="animate-spin text-terra-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// ============================================
// Full Page Loading
// ============================================

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = "Loading..." }: PageLoadingProps): React.JSX.Element {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center">
      <Spinner size="xl" />
      <p className="mt-4 text-gray-400 text-sm animate-pulse">{message}</p>
    </div>
  );
}

// ============================================
// Button Loading State
// ============================================

interface ButtonLoadingProps {
  children: React.ReactNode;
  isLoading: boolean;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  variant?: "primary" | "secondary" | "danger";
}

export function ButtonLoading({
  children,
  isLoading,
  loadingText = "Processing...",
  className = "",
  disabled = false,
  onClick,
  type = "button",
  variant = "primary",
}: ButtonLoadingProps): React.JSX.Element {
  const variantClasses = {
    primary: "bg-terra-500 hover:bg-terra-600 text-white disabled:bg-terra-500/50",
    secondary: "bg-terra-800 hover:bg-terra-700 text-gray-200 disabled:bg-terra-800/50",
    danger: "bg-red-500 hover:bg-red-600 text-white disabled:bg-red-500/50",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        relative px-4 py-2 rounded-lg font-medium transition-all
        disabled:cursor-not-allowed
        ${variantClasses[variant]}
        ${className}
      `}
    >
      <span className={isLoading ? "invisible" : ""}>{children}</span>
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span>{loadingText}</span>
        </span>
      )}
    </button>
  );
}

// ============================================
// Skeleton Components
// ============================================

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps): React.JSX.Element {
  return (
    <div
      className={`animate-pulse bg-terra-800/50 rounded ${className}`}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({ className = "" }: SkeletonProps): React.JSX.Element {
  return <Skeleton className={`h-4 ${className}`} />;
}

export function SkeletonCard(): React.JSX.Element {
  return (
    <div className="bg-terra-900/50 rounded-xl border border-terra-800 p-6">
      <Skeleton className="h-6 w-24 mb-4" />
      <div className="space-y-3">
        <SkeletonText className="w-full" />
        <SkeletonText className="w-3/4" />
        <SkeletonText className="w-1/2" />
      </div>
    </div>
  );
}

export function SkeletonStats(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-terra-900/50 rounded-xl border border-terra-800 p-6"
        >
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }): React.JSX.Element {
  return (
    <div className="bg-terra-900/50 rounded-xl border border-terra-800 overflow-hidden">
      {/* Header */}
      <div className="border-b border-terra-800 p-4">
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      {/* Rows */}
      <div className="divide-y divide-terra-800">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="p-4">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonList({ items = 4 }: { items?: number }): React.JSX.Element {
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, i) => (
        <div
          key={i}
          className="bg-terra-900/50 rounded-lg border border-terra-800 p-4 flex items-center gap-4"
        >
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-1/3 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20 rounded" />
        </div>
      ))}
    </div>
  );
}

// ============================================
// Content Loading Wrapper
// ============================================

interface ContentLoadingProps {
  isLoading: boolean;
  error?: Error | null;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
  onRetry?: () => void;
}

export function ContentLoading({
  isLoading,
  error,
  skeleton,
  children,
  onRetry,
}: ContentLoadingProps): React.JSX.Element {
  if (isLoading) {
    return <>{skeleton || <PageLoading />}</>;
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h3 className="text-white font-medium mb-2">Failed to load data</h3>
        <p className="text-gray-400 text-sm mb-4">
          {error.message || "Something went wrong. Please try again."}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-terra-500 hover:bg-terra-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

// ============================================
// Transaction Status Component
// ============================================

export type TransactionStatus = "idle" | "pending" | "confirming" | "success" | "error";

interface TransactionStatusProps {
  status: TransactionStatus;
  message?: string;
  txHash?: string;
  onClose?: () => void;
}

export function TransactionStatusBanner({
  status,
  message,
  txHash,
  onClose,
}: TransactionStatusProps): React.JSX.Element | null {
  if (status === "idle") return null;

  const statusConfig = {
    pending: {
      icon: <Spinner size="sm" />,
      title: "Transaction Pending",
      description: message || "Please confirm in your wallet...",
      bgClass: "bg-yellow-500/10 border-yellow-500/20",
      textClass: "text-yellow-500",
    },
    confirming: {
      icon: <Spinner size="sm" />,
      title: "Confirming Transaction",
      description: message || "Waiting for blockchain confirmation...",
      bgClass: "bg-blue-500/10 border-blue-500/20",
      textClass: "text-blue-500",
    },
    success: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      title: "Transaction Successful",
      description: message || "Your transaction has been confirmed.",
      bgClass: "bg-green-500/10 border-green-500/20",
      textClass: "text-green-500",
    },
    error: {
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      title: "Transaction Failed",
      description: message || "Something went wrong. Please try again.",
      bgClass: "bg-red-500/10 border-red-500/20",
      textClass: "text-red-500",
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${config.bgClass} border rounded-xl p-4 mb-4`}>
      <div className="flex items-start gap-3">
        <div className={`${config.textClass} mt-0.5`}>{config.icon}</div>
        <div className="flex-1">
          <h4 className={`${config.textClass} font-medium`}>{config.title}</h4>
          <p className="text-gray-400 text-sm mt-1">{config.description}</p>
          {txHash && (
            <a
              href={`https://explorer.aethelred.network/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-terra-400 hover:text-terra-300 text-sm mt-2 inline-flex items-center gap-1"
            >
              View on Explorer
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
        {onClose && (status === "success" || status === "error") && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div className="text-center py-12 px-4">
      {icon && (
        <div className="w-16 h-16 mx-auto mb-4 bg-terra-800/50 rounded-full flex items-center justify-center text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-white font-medium text-lg mb-2">{title}</h3>
      <p className="text-gray-400 max-w-md mx-auto mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-terra-500 hover:bg-terra-600 text-white rounded-lg transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
