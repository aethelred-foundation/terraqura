/**
 * TerraQura Real-time Activity Feed
 *
 * Live event stream with:
 * - Credit minting events
 * - Marketplace transactions
 * - Verification completions
 * - Emergency alerts
 */

"use client";

import { cn, shortenAddress, formatCO2 } from "@/lib/utils";
import {
  useWatchCreditMints,
  useWatchMarketplaceSales,
  useWatchEmergencyEvents,
} from "@/hooks/useContractData";
import { getExplorerTxUrl, ACTIVE_NETWORK } from "@/lib/wagmi";
import { useState, useCallback, useRef, useEffect } from "react";
import { formatEther } from "viem";

interface ActivityItem {
  id: string;
  type: "mint" | "sale" | "emergency" | "verification";
  title: string;
  description: string;
  timestamp: Date;
  txHash?: string;
  status: "success" | "warning" | "error" | "info";
  metadata?: Record<string, string | number>;
}

interface RealtimeActivityFeedProps {
  maxItems?: number;
  className?: string;
}

export function RealtimeActivityFeed({
  maxItems = 50,
  className,
}: RealtimeActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const addActivity = useCallback(
    (activity: Omit<ActivityItem, "id" | "timestamp">) => {
      if (isPaused) return;

      setActivities((prev) => {
        const newActivity: ActivityItem = {
          ...activity,
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          timestamp: new Date(),
        };
        const updated = [newActivity, ...prev].slice(0, maxItems);
        return updated;
      });
    },
    [isPaused, maxItems]
  );

  // Watch for credit mints
  useWatchCreditMints((log) => {
    const args = log.args as {
      tokenId?: bigint;
      recipient?: string;
      dacId?: string;
      co2AmountKg?: bigint;
      efficiencyScore?: bigint;
    };

    addActivity({
      type: "mint",
      title: "Carbon Credit Minted",
      description: `Token #${args.tokenId?.toString() || "?"} minted to ${
        args.recipient ? shortenAddress(args.recipient, 4) : "unknown"
      }`,
      txHash: log.transactionHash,
      status: "success",
      metadata: {
        tokenId: args.tokenId?.toString() || "0",
        co2Amount: args.co2AmountKg ? formatCO2(Number(args.co2AmountKg)) : "?",
        efficiency: args.efficiencyScore?.toString() || "?",
      },
    });
  });

  // Watch for marketplace sales
  useWatchMarketplaceSales((log) => {
    const args = log.args as {
      listingId?: bigint;
      buyer?: string;
      amount?: bigint;
      totalPrice?: bigint;
    };

    addActivity({
      type: "sale",
      title: "Marketplace Sale",
      description: `${args.amount?.toString() || "?"} credits sold for ${
        args.totalPrice ? formatEther(args.totalPrice) : "?"
      } POL`,
      txHash: log.transactionHash,
      status: "success",
      metadata: {
        listingId: args.listingId?.toString() || "?",
        buyer: args.buyer ? shortenAddress(args.buyer, 4) : "unknown",
        amount: args.amount?.toString() || "?",
      },
    });
  });

  // Watch for emergency events
  useWatchEmergencyEvents((log) => {
    const args = log.args as {
      activator?: string;
      reason?: string;
    };

    addActivity({
      type: "emergency",
      title: "⚠️ EMERGENCY PAUSE ACTIVATED",
      description: args.reason || "System paused by authorized pauser",
      txHash: log.transactionHash,
      status: "error",
      metadata: {
        activator: args.activator ? shortenAddress(args.activator, 4) : "unknown",
      },
    });
  });

  // Add demo activities on mount (for presentation purposes)
  useEffect(() => {
    const demoActivities: Omit<ActivityItem, "id" | "timestamp">[] = [
      {
        type: "mint",
        title: "Carbon Credit Minted",
        description: "Token #1 minted to 0x7F6A...9ABc",
        status: "success",
        metadata: {
          tokenId: "1",
          co2Amount: "100 kg",
          efficiency: "95",
        },
      },
      {
        type: "verification",
        title: "DAC Unit Verified",
        description: "Proof-of-Physics validation complete",
        status: "info",
        metadata: {
          dacId: "DAC-001",
          location: "Dubai, UAE",
        },
      },
    ];

    // Only add demo data if no real activities
    setTimeout(() => {
      setActivities((prev) => {
        if (prev.length === 0) {
          return demoActivities.map((a, i) => ({
            ...a,
            id: `demo-${i}`,
            timestamp: new Date(Date.now() - i * 60000),
          }));
        }
        return prev;
      });
    }, 2000);
  }, []);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    const icons = {
      mint: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      sale: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      emergency: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      ),
      verification: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    };
    return icons[type];
  };

  const getStatusColors = (status: ActivityItem["status"]) => {
    const colors = {
      success: "bg-green-500/20 text-green-400 border-green-500/30",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      error: "bg-red-500/20 text-red-400 border-red-500/30",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    };
    return colors[status];
  };

  const formatTimeAgo = (date: Date): string => {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping" />
          </div>
          <h2 className="text-lg font-semibold text-white">Live Activity</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={cn(
              "text-xs px-3 py-1 rounded-full transition-colors",
              isPaused
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-terra-700/50 text-gray-400 hover:text-white"
            )}
          >
            {isPaused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => setActivities([])}
            className="text-xs px-3 py-1 rounded-full bg-terra-700/50 text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-terra-700 scrollbar-track-transparent"
      >
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <svg
              className="w-12 h-12 mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <p className="text-sm">Waiting for blockchain events...</p>
            <p className="text-xs text-gray-600">
              Activities will appear here in real-time
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                "rounded-lg border p-3 transition-all duration-300 animate-in fade-in slide-in-from-top-2",
                getStatusColors(activity.status)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {activity.description}
                  </p>
                  {activity.metadata && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(activity.metadata).map(([key, value]) => (
                        <span
                          key={key}
                          className="text-xs px-2 py-0.5 rounded bg-black/20"
                        >
                          {key}: {value}
                        </span>
                      ))}
                    </div>
                  )}
                  {activity.txHash && (
                    <a
                      href={getExplorerTxUrl(activity.txHash, ACTIVE_NETWORK.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-terra-400 hover:text-terra-300"
                    >
                      View transaction
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                        />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-4 border-t border-terra-700/50 flex items-center justify-between text-xs text-gray-500">
        <span>{activities.length} events captured</span>
        <span>Chain: {ACTIVE_NETWORK.name}</span>
      </div>
    </div>
  );
}

export default RealtimeActivityFeed;
