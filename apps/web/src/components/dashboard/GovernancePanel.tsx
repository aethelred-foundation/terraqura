/**
 * TerraQura Governance Panel
 *
 * Enterprise governance overview with:
 * - Multisig status and signers
 * - Timelock configuration
 * - Pending transaction queue
 * - Role management overview
 */

"use client";

import { cn, shortenAddress } from "@/lib/utils";
import { useGovernanceStats, useHasRole } from "@/hooks/useContractData";
import { getExplorerAddressUrl, ACTIVE_NETWORK } from "@/lib/wagmi";
import { useAccount } from "wagmi";

interface GovernancePanelProps {
  className?: string;
}

export function GovernancePanel({ className }: GovernancePanelProps) {
  const { stats, isLoading, error } = useGovernanceStats();
  const { address } = useAccount();

  // Check current user's roles
  const { hasRole: isAdmin } = useHasRole(address, "DEFAULT_ADMIN");
  const { hasRole: isMinter } = useHasRole(address, "MINTER");
  const { hasRole: isOperator } = useHasRole(address, "OPERATOR");
  const { hasRole: isPauser } = useHasRole(address, "PAUSER");

  if (isLoading) {
    return (
      <div className={cn("animate-pulse space-y-4", className)}>
        <div className="h-6 bg-terra-700/50 rounded w-48" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-32 bg-terra-700/30 rounded-lg" />
          <div className="h-32 bg-terra-700/30 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className={cn("rounded-lg border border-red-500/30 bg-red-900/20 p-4", className)}>
        <p className="text-red-300 text-sm">Failed to load governance data</p>
      </div>
    );
  }

  const formatDelay = (seconds: bigint): string => {
    const totalSeconds = Number(seconds);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    if (totalSeconds < 3600) return `${Math.floor(totalSeconds / 60)}m`;
    if (totalSeconds < 86400) return `${Math.floor(totalSeconds / 3600)}h`;
    return `${Math.floor(totalSeconds / 86400)}d`;
  };

  const userRoles = [
    { name: "Admin", has: isAdmin },
    { name: "Minter", has: isMinter },
    { name: "Operator", has: isOperator },
    { name: "Pauser", has: isPauser },
  ].filter((r) => r.has);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Governance</h2>
        {address && userRoles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Your Roles:</span>
            {userRoles.map((role) => (
              <span
                key={role.name}
                className="text-xs px-2 py-0.5 rounded-full bg-terra-500/20 text-terra-400"
              >
                {role.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Multisig Card */}
        <div className="rounded-lg border border-purple-500/30 bg-purple-900/10 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Multisig Wallet</h3>
                <p className="text-xs text-gray-400">
                  {stats.multisigThreshold.toString()}-of-
                  {stats.multisigSigners.length} required
                </p>
              </div>
            </div>
            <span className="text-2xl font-bold text-purple-400">
              {stats.pendingTransactions.toString()}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Authorized Signers
            </p>
            <div className="space-y-1">
              {stats.multisigSigners.map((signer, index) => (
                <a
                  key={signer}
                  href={getExplorerAddressUrl(signer, ACTIVE_NETWORK.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
                >
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs text-purple-400">
                    {index + 1}
                  </span>
                  <code className="font-mono text-xs">
                    {shortenAddress(signer, 6)}
                  </code>
                  {signer.toLowerCase() === address?.toLowerCase() && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                      You
                    </span>
                  )}
                </a>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-purple-500/20">
            <p className="text-xs text-gray-400">
              Pending Transactions: {stats.pendingTransactions.toString()}
            </p>
          </div>
        </div>

        {/* Timelock Card */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-900/10 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-white">Timelock Controller</h3>
                <p className="text-xs text-gray-400">Delay-protected execution</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-blue-400">
              {formatDelay(stats.timelockDelay)}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-blue-500/20">
              <span className="text-sm text-gray-400">Minimum Delay</span>
              <span className="text-sm font-medium text-white">
                {formatDelay(stats.timelockDelay)} ({stats.timelockDelay.toString()}s)
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-blue-500/20">
              <span className="text-sm text-gray-400">Proposer</span>
              <span className="text-sm font-medium text-white">Multisig Only</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-400">Executor</span>
              <span className="text-sm font-medium text-white">Anyone</span>
            </div>
          </div>

          <div className="pt-2 border-t border-blue-500/20">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg
                className="w-4 h-4 text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                All admin operations require{" "}
                {formatDelay(stats.timelockDelay)} delay
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Role Definitions */}
      <div className="rounded-lg border border-terra-700/50 bg-terra-900/30 p-4">
        <h3 className="font-medium text-white mb-3">Platform Roles</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              name: "Admin",
              desc: "Full system control",
              color: "text-red-400 bg-red-500/20",
            },
            {
              name: "Minter",
              desc: "Can mint credits",
              color: "text-green-400 bg-green-500/20",
            },
            {
              name: "Operator",
              desc: "DAC operations",
              color: "text-blue-400 bg-blue-500/20",
            },
            {
              name: "Pauser",
              desc: "Emergency pause",
              color: "text-yellow-400 bg-yellow-500/20",
            },
          ].map((role) => (
            <div
              key={role.name}
              className="flex items-center gap-2 p-2 rounded bg-terra-800/50"
            >
              <span
                className={cn("text-xs px-2 py-0.5 rounded-full", role.color)}
              >
                {role.name}
              </span>
              <span className="text-xs text-gray-400">{role.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GovernancePanel;
