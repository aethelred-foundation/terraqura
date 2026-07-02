// TerraQura Gasless Transaction Relayer
// Enables meta-transactions via OpenZeppelin Defender

import { getActiveDeployment, getNetwork } from "@terraqura/network-manifest";
import { ethers } from "ethers";

import {
  createScopedLogger,
  logReference,
  serializeError,
} from "../../lib/logger.js";

// ERC-2771 ForwardRequest type
interface ForwardRequest {
  from: string;
  to: string;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: number;
  data: string;
}

interface RelayerConfig {
  forwarderAddress: string;
  defenderApiKey?: string;
  defenderApiSecret?: string;
  defenderRelayHandler?: DefenderRelayHandler;
  privateKey?: string;
  rpcUrl: string;
  chainId: number;
  mode?: RelayMode;
}

interface RelayResult {
  success: boolean;
  txHash?: string;
  error?: string;
  mode?: RelayMode;
}

export type RelayMode = "direct" | "defender";

export interface DefenderRelayHandlerInput {
  forwarderAddress: string;
  request: ForwardRequest;
  signature: string;
  chainId: number;
}

export interface DefenderRelayHandler {
  relay(input: DefenderRelayHandlerInput): Promise<RelayResult>;
}

type ForwardRequestTuple = [
  string,
  string,
  bigint,
  bigint,
  bigint,
  number,
  string,
];

type ForwarderContract = ethers.Contract & {
  nonces: (owner: string) => Promise<bigint>;
  verify: (request: ForwardRequestTuple, signature: string) => Promise<boolean>;
  execute: (
    request: ForwardRequestTuple,
    signature: string,
    overrides?: { gasLimit?: bigint }
  ) => Promise<ethers.ContractTransactionResponse>;
};

function toTuple(request: ForwardRequest): ForwardRequestTuple {
  return [
    request.from,
    request.to,
    request.value,
    request.gas,
    request.nonce,
    request.deadline,
    request.data,
  ];
}

// Forwarder ABI (minimal)
const FORWARDER_ABI = [
  "function nonces(address owner) view returns (uint256)",
  "function verify(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint48 deadline, bytes data) request, bytes signature) view returns (bool)",
  "function execute(tuple(address from, address to, uint256 value, uint256 gas, uint256 nonce, uint48 deadline, bytes data) request, bytes signature) payable returns (bool, bytes)",
];

// EIP-712 types for ForwardRequest
const EIP712_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
};

const gaslessLogger = createScopedLogger("gasless.relayer");

export class GaslessRelayer {
  private config: RelayerConfig;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private forwarder: ForwarderContract;
  private mode: RelayMode;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.mode = config.mode ?? (
      config.defenderApiKey && config.defenderApiSecret ? "defender" : "direct"
    );
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);

    // Initialize signer (use Defender Relayer in production)
    if (config.privateKey) {
      this.signer = new ethers.Wallet(config.privateKey, this.provider);
    }

    this.forwarder = new ethers.Contract(
      config.forwarderAddress,
      FORWARDER_ABI,
      this.signer || this.provider
    ) as ForwarderContract;
  }

  /**
   * Get current nonce for a user
   */
  async getNonce(userAddress: string): Promise<bigint> {
    return await this.forwarder.nonces(userAddress);
  }

  /**
   * Build a forward request for signing
   */
  async buildForwardRequest(
    from: string,
    to: string,
    data: string,
    gasLimit?: bigint
  ): Promise<{ request: ForwardRequest; domain: object }> {
    const nonce = await this.getNonce(from);

    // Deadline: 1 hour from now
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Estimate gas if not provided
    let gas = gasLimit;
    if (!gas) {
      try {
        const estimate = await this.provider.estimateGas({
          from: this.config.forwarderAddress,
          to,
          data,
        });
        gas = (estimate * BigInt(120)) / BigInt(100); // Add 20% buffer
      } catch {
        gas = BigInt(500000); // Default gas limit
      }
    }

    const request: ForwardRequest = {
      from,
      to,
      value: BigInt(0),
      gas,
      nonce,
      deadline,
      data,
    };

    const domain = {
      name: "TerraQuraForwarder",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.forwarderAddress,
    };

    return { request, domain };
  }

  /**
   * Verify a signed forward request
   */
  async verifyRequest(
    request: ForwardRequest,
    signature: string
  ): Promise<boolean> {
    try {
      return await this.forwarder.verify(
        toTuple(request),
        signature
      );
    } catch (error) {
      gaslessLogger.warn(
        {
          fromRef: logReference(request.from, "wallet"),
          targetRef: logReference(request.to, "target"),
          err: serializeError(error),
        },
        "Forward request verification failed"
      );
      return false;
    }
  }

  /**
   * Execute a signed forward request (relay the transaction)
   */
  async relay(
    request: ForwardRequest,
    signature: string
  ): Promise<RelayResult> {
    if (!this.signer) {
      return {
        success: false,
        error: "Relayer not configured with signing capability",
        mode: "direct",
      };
    }

    // Verify the request first
    const isValid = await this.verifyRequest(request, signature);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid signature or request",
        mode: "direct",
      };
    }

    try {
      // Check deadline
      if (request.deadline < Math.floor(Date.now() / 1000)) {
        return {
          success: false,
          error: "Request has expired",
          mode: "direct",
        };
      }

      // Execute via forwarder
      const tx = await this.forwarder.execute(
        toTuple(request),
        signature,
        {
          gasLimit: request.gas + BigInt(50000), // Extra for forwarder overhead
        }
      );

      const receipt = await tx.wait();

      if (!receipt || receipt.status !== 1) {
        return {
          success: false,
          error: "Transaction reverted",
          txHash: tx.hash,
          mode: "direct",
        };
      }

      return {
        success: true,
        txHash: tx.hash,
        mode: "direct",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        mode: "direct",
      };
    }
  }

  /**
   * Relay via an explicitly configured Defender transport.
   */
  async relayViaDefender(
    request: ForwardRequest,
    signature: string
  ): Promise<RelayResult> {
    if (!this.config.defenderApiKey || !this.config.defenderApiSecret) {
      return {
        success: false,
        error: "Defender credentials not configured",
        mode: "defender",
      };
    }

    if (!this.config.defenderRelayHandler) {
      return {
        success: false,
        error: "Defender relay handler not configured; direct relay fallback is disabled",
        mode: "defender",
      };
    }

    try {
      const result = await this.config.defenderRelayHandler.relay({
        forwarderAddress: this.config.forwarderAddress,
        request,
        signature,
        chainId: this.config.chainId,
      });
      return { ...result, mode: "defender" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Defender relay failed",
        mode: "defender",
      };
    }
  }

  getRelayMode(): RelayMode {
    return this.mode;
  }

  hasSigningCapability(): boolean {
    return this.signer !== null;
  }

  hasDefenderCredentials(): boolean {
    return Boolean(this.config.defenderApiKey && this.config.defenderApiSecret);
  }

  /**
   * Get EIP-712 domain for client-side signing
   */
  getSigningDomain() {
    return {
      name: "TerraQuraForwarder",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.forwarderAddress,
    };
  }

  /**
   * Get EIP-712 types for client-side signing
   */
  getSigningTypes() {
    return EIP712_TYPES;
  }
}

// Factory function
let relayer: GaslessRelayer | null = null;

function shouldWarnRelayerNotConfigured(): boolean {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}

function resolveRelayMode(): RelayMode {
  const configured = process.env.GASLESS_RELAYER_MODE;
  if (configured === "direct" || configured === "defender") {
    return configured;
  }

  return process.env.DEFENDER_RELAYER_API_KEY && process.env.DEFENDER_RELAYER_API_SECRET
    ? "defender"
    : "direct";
}

export function getGaslessRelayer(): GaslessRelayer | null {
  if (!relayer) {
    const forwarderAddress = process.env.FORWARDER_CONTRACT;
    const deployment = getActiveDeployment(process.env);
    const network = getNetwork(deployment.network);
    const scopedRpcUrl =
      network.key === "polygonAmoy"
        ? process.env.POLYGON_AMOY_RPC_URL ?? process.env.POLYGON_RPC_URL
        : network.key === "aethelredTestnet"
          ? process.env.AETHELRED_TESTNET_RPC_URL ?? process.env.AETHELRED_RPC_URL
          : process.env.AETHELRED_RPC_URL;
    const rpcUrl = process.env.TERRAQURA_RPC_URL ?? scopedRpcUrl ?? network.rpcUrls[0];

    if (!forwarderAddress || !rpcUrl) {
      if (shouldWarnRelayerNotConfigured()) {
        gaslessLogger.warn(
          {
            hasForwarderAddress: Boolean(forwarderAddress),
            hasRpcUrl: Boolean(rpcUrl),
            networkKey: network.key,
            deploymentKey: deployment.key,
          },
          "Gasless relayer not configured"
        );
      }
      return null;
    }

    relayer = new GaslessRelayer({
      forwarderAddress,
      rpcUrl,
      chainId: parseInt(process.env.CHAIN_ID || String(network.chainId), 10),
      mode: resolveRelayMode(),
      privateKey: process.env.RELAYER_PRIVATE_KEY,
      defenderApiKey: process.env.DEFENDER_RELAYER_API_KEY,
      defenderApiSecret: process.env.DEFENDER_RELAYER_API_SECRET,
    });
  }

  return relayer;
}

export default GaslessRelayer;
