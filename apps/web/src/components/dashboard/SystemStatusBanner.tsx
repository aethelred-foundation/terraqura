/**
 * TerraQura System Status Banner
 *
 * Real-time system health indicator with:
 * - Circuit breaker status
 * - Emergency level alerts
 * - Animated status indicators
 * - Auto-refresh
 */

"use client";

import { cn } from "@/lib/utils";
import { useSystemStatus } from "@/hooks/useContractData";
import { useEffect, useState } from "react";

interface SystemStatusBannerProps {
  compact?: boolean;
  className?: string;
}

export function SystemStatusBanner({ compact = false, className }: SystemStatusBannerProps) {
  const { status, isLoading, error, refetch } = useSystemStatus();
  const [pulse, setPulse] = useState(false);

  // Pulse animation on status change
  useEffect(() => {
    if (status) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [status]);

  if (isLoading) {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="flex items-center gap-3 bg-terra-900/50 border border-terra-700/50 rounded-lg px-4 py-2">
          <div className="w-3 h-3 rounded-full bg-terra-700" />
          <div className="h-4 bg-terra-700 rounded w-32" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2",
          className
        )}
      >
        <div className="w-3 h-3 rounded-full bg-red-500" />
        <span className="text-sm text-red-300">Unable to fetch system status</span>
        <button
          onClick={() => refetch()}
          className="text-xs text-red-400 hover:text-red-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!status) return null;

  // Determine status level
  const getStatusConfig = () => {
    if (status.globalPause) {
      return {
        bg: "bg-red-900/20 border-red-500/30",
        dot: "bg-red-500",
        text: "text-red-300",
        label: "SYSTEM PAUSED",
        description: "All operations halted by circuit breaker",
      };
    }

    switch (status.emergencyLevel) {
      case 2: // Critical
        return {
          bg: "bg-orange-900/20 border-orange-500/30",
          dot: "bg-orange-500",
          text: "text-orange-300",
          label: "ELEVATED ALERT",
          description: "System operating with elevated monitoring",
        };
      case 1: // Warning
        return {
          bg: "bg-yellow-900/20 border-yellow-500/30",
          dot: "bg-yellow-500",
          text: "text-yellow-300",
          label: "CAUTION",
          description: "Minor anomalies detected",
        };
      default: // Normal
        return {
          bg: "bg-green-900/20 border-green-500/30",
          dot: "bg-green-500",
          text: "text-green-300",
          label: "OPERATIONAL",
          description: "All systems functioning normally",
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full border",
          config.bg,
          className
        )}
      >
        <div
          className={cn(
            "w-2 h-2 rounded-full",
            config.dot,
            pulse && "animate-ping"
          )}
        />
        <span className={cn("text-xs font-medium", config.text)}>
          {config.label}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between border rounded-lg px-4 py-3",
        config.bg,
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className={cn("w-3 h-3 rounded-full", config.dot)} />
          {status.isOperational && (
            <div
              className={cn(
                "absolute inset-0 w-3 h-3 rounded-full animate-ping opacity-75",
                config.dot
              )}
            />
          )}
        </div>
        <div>
          <p className={cn("text-sm font-semibold", config.text)}>
            System Status: {config.label}
          </p>
          <p className="text-xs text-gray-400">{config.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
          <span>{status.monitoredContractsCount} Contracts Monitored</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            Last check:{" "}
            {status.lastUpdated.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

export default SystemStatusBanner;
