/**
 * TerraQura Stats Card Component
 *
 * Enterprise-grade statistics display with:
 * - Loading states with skeleton animation
 * - Trend indicators
 * - Interactive tooltips
 * - Real-time updates
 */

"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  status?: "success" | "warning" | "error" | "neutral";
  isLoading?: boolean;
  className?: string;
  onClick?: () => void;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  status = "neutral",
  isLoading = false,
  className,
  onClick,
}: StatsCardProps) {
  const isInteractive = typeof onClick === "function";

  const statusColors = {
    success: "border-green-500/30 bg-green-500/5",
    warning: "border-yellow-500/30 bg-yellow-500/5",
    error: "border-red-500/30 bg-red-500/5",
    neutral: "border-terra-700/50 bg-terra-900/50",
  };

  const trendColors = {
    up: "text-green-400",
    down: "text-red-400",
    neutral: "text-gray-400",
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    ),
    neutral: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          "rounded-xl border p-6 animate-pulse",
          statusColors.neutral,
          className
        )}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-3 flex-1">
            <div className="h-4 bg-terra-700/50 rounded w-24" />
            <div className="h-8 bg-terra-700/50 rounded w-32" />
            <div className="h-3 bg-terra-700/30 rounded w-20" />
          </div>
          <div className="w-12 h-12 bg-terra-700/50 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border p-6 transition-all duration-200",
        statusColors[status],
        isInteractive && "cursor-pointer hover:border-terra-500/50 hover:shadow-lg hover:shadow-terra-500/10",
        className
      )}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-terra-300">{title}</p>
          <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  trendColors[trend.direction]
                )}
              >
                {trendIcons[trend.direction]}
                {trend.value}%
                {trend.label && (
                  <span className="text-gray-500 font-normal">{trend.label}</span>
                )}
              </span>
            )}
            {subtitle && !trend && (
              <span className="text-sm text-gray-400">{subtitle}</span>
            )}
          </div>
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center",
            status === "success" && "bg-green-500/20 text-green-400",
            status === "warning" && "bg-yellow-500/20 text-yellow-400",
            status === "error" && "bg-red-500/20 text-red-400",
            status === "neutral" && "bg-terra-500/20 text-terra-400"
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/**
 * Mini stats for inline display
 */
interface MiniStatProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  status?: "success" | "warning" | "error" | "neutral";
}

export function MiniStat({ label, value, icon, status = "neutral" }: MiniStatProps) {
  const dotColors = {
    success: "bg-green-500",
    warning: "bg-yellow-500",
    error: "bg-red-500",
    neutral: "bg-gray-500",
  };

  return (
    <div className="flex items-center gap-2">
      {icon ? (
        <span className="text-terra-400">{icon}</span>
      ) : (
        <span className={cn("w-2 h-2 rounded-full", dotColors[status])} />
      )}
      <span className="text-sm text-gray-400">{label}:</span>
      <span className="text-sm font-medium text-white">{value}</span>
    </div>
  );
}

export default StatsCard;
