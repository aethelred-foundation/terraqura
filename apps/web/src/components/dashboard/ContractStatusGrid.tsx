/**
 * TerraQura Contract Status Grid
 *
 * Real-time contract health monitoring with:
 * - Individual contract status indicators
 * - Aethelred Explorer deep links
 * - Role-based access indicators
 * - Transaction history links
 */

"use client";

import { cn } from "@/lib/utils";
import { CONTRACTS, VERIFIED_IMPLEMENTATIONS } from "@/lib/contracts";
import { useContractOperational } from "@/hooks/useContractData";
import { getExplorerAddressUrl, ACTIVE_NETWORK } from "@/lib/wagmi";
import { type Address } from "viem";

interface ContractInfo {
  name: string;
  address: Address;
  description: string;
  type: "core" | "governance" | "security" | "gasless";
  verifiedUrl?: string;
}

const CONTRACTS_INFO: ContractInfo[] = [
  {
    name: "Carbon Credit",
    address: CONTRACTS.carbonCredit as Address,
    description: "ERC-1155 token for verified carbon credits",
    type: "core",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.carbonCredit,
  },
  {
    name: "Marketplace",
    address: CONTRACTS.carbonMarketplace as Address,
    description: "P2P trading platform for carbon credits",
    type: "core",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.carbonMarketplace,
  },
  {
    name: "Verification Engine",
    address: CONTRACTS.verificationEngine as Address,
    description: "Proof-of-Physics verification system",
    type: "core",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.verificationEngine,
  },
  {
    name: "Access Control",
    address: CONTRACTS.accessControl as Address,
    description: "Role-based permissions management",
    type: "core",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.accessControl,
  },
  {
    name: "Multisig",
    address: CONTRACTS.multisig as Address,
    description: "2-of-3 multi-signature wallet",
    type: "governance",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.multisig,
  },
  {
    name: "Timelock",
    address: CONTRACTS.timelock as Address,
    description: "Time-delayed execution controller",
    type: "governance",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.timelock,
  },
  {
    name: "Circuit Breaker",
    address: CONTRACTS.circuitBreaker as Address,
    description: "Emergency pause mechanism",
    type: "security",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.circuitBreaker,
  },
  {
    name: "Gasless Marketplace",
    address: CONTRACTS.gaslessMarketplace as Address,
    description: "Meta-transaction enabled trading",
    type: "gasless",
    verifiedUrl: VERIFIED_IMPLEMENTATIONS.gaslessMarketplace,
  },
];

function ContractCard({ contract }: { contract: ContractInfo }) {
  const { isOperational, isLoading, error } = useContractOperational(
    contract.address
  );

  const typeColors = {
    core: "border-terra-500/30 bg-terra-500/5",
    governance: "border-purple-500/30 bg-purple-500/5",
    security: "border-yellow-500/30 bg-yellow-500/5",
    gasless: "border-blue-500/30 bg-blue-500/5",
  };

  const typeBadgeColors = {
    core: "bg-terra-500/20 text-terra-400",
    governance: "bg-purple-500/20 text-purple-400",
    security: "bg-yellow-500/20 text-yellow-400",
    gasless: "bg-blue-500/20 text-blue-400",
  };

  const getStatusIndicator = () => {
    if (isLoading) {
      return (
        <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse" />
      );
    }
    if (error) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />;
    }
    if (isOperational === false) {
      return <div className="w-2 h-2 rounded-full bg-red-500" />;
    }
    return (
      <div className="relative">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-50" />
      </div>
    );
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all duration-200 hover:border-opacity-60 hover:shadow-lg",
        typeColors[contract.type]
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {getStatusIndicator()}
          <h3 className="font-semibold text-white">{contract.name}</h3>
        </div>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full",
            typeBadgeColors[contract.type]
          )}
        >
          {contract.type}
        </span>
      </div>

      <p className="text-sm text-gray-400 mb-3">{contract.description}</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Address</span>
          <a
            href={getExplorerAddressUrl(contract.address, ACTIVE_NETWORK.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-terra-400 hover:text-terra-300 flex items-center gap-1"
          >
            {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
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
        </div>

        {contract.verifiedUrl && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Source Code</span>
            <a
              href={contract.verifiedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 flex items-center gap-1"
            >
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
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Verified
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

interface ContractStatusGridProps {
  className?: string;
  filter?: "all" | "core" | "governance" | "security" | "gasless";
}

export function ContractStatusGrid({
  className,
  filter = "all",
}: ContractStatusGridProps) {
  const filteredContracts =
    filter === "all"
      ? CONTRACTS_INFO
      : CONTRACTS_INFO.filter((c) => c.type === filter);

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Smart Contracts</h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" /> Operational
          </span>
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" /> Paused
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredContracts.map((contract) => (
          <ContractCard key={contract.address} contract={contract} />
        ))}
      </div>
    </div>
  );
}

export default ContractStatusGrid;
