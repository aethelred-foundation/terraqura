// TerraQura Gasless Transaction Relayer
// Enables meta-transactions via OpenZeppelin Defender

import { ethers } from "ethers";

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
  privateKey?: string;
  rpcUrl: string;
  chainId: number;
}

interface RelayResult {
  success: boolean;
  txHash?: string;
  error?: string;
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

export class GaslessRelayer {
  private config: RelayerConfig;
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet | null = null;
  private forwarder: ForwarderContract;

  constructor(config: RelayerConfig) {
    this.config = config;
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
      console.error("Request verification failed:", error);
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
      };
    }

    // Verify the request first
    const isValid = await this.verifyRequest(request, signature);
    if (!isValid) {
      return {
        success: false,
        error: "Invalid signature or request",
      };
    }

    try {
      // Check deadline
      if (request.deadline < Math.floor(Date.now() / 1000)) {
        return {
          success: false,
          error: "Request has expired",
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
        };
      }

      return {
        success: true,
        txHash: tx.hash,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Relay via OpenZeppelin Defender (production)
   */
  async relayViaDefender(
    request: ForwardRequest,
    signature: string
  ): Promise<RelayResult> {
    if (!this.config.defenderApiKey || !this.config.defenderApiSecret) {
      return {
        success: false,
        error: "Defender credentials not configured",
      };
    }

    try {
      // In production, use @openzeppelin/defender-sdk
      // const { Defender } = require("@openzeppelin/defender-sdk");
      // const client = new Defender({
      //   apiKey: this.config.defenderApiKey,
      //   apiSecret: this.config.defenderApiSecret,
      // });
      //
      // const tx = await client.relaySigner.sendTransaction({
      //   to: this.config.forwarderAddress,
      //   data: this.forwarder.interface.encodeFunctionData("execute", [
      //     [request.from, request.to, request.value, request.gas, request.nonce, request.deadline, request.data],
      //     signature,
      //   ]),
      //   speed: "fast",
      // });

      // Fallback to direct relay for now
      return this.relay(request, signature);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Defender relay failed",
      };
    }
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

export function getGaslessRelayer(): GaslessRelayer | null {
  if (!relayer) {
    const forwarderAddress = process.env.FORWARDER_CONTRACT;
    const rpcUrl = process.env.AETHELRED_RPC_URL;

    if (!forwarderAddress || !rpcUrl) {
      console.warn("Gasless relayer not configured");
      return null;
    }

    relayer = new GaslessRelayer({
      forwarderAddress,
      rpcUrl,
      chainId: parseInt(process.env.CHAIN_ID || "78432", 10),
      privateKey: process.env.RELAYER_PRIVATE_KEY,
      defenderApiKey: process.env.DEFENDER_RELAYER_API_KEY,
      defenderApiSecret: process.env.DEFENDER_RELAYER_API_SECRET,
    });
  }

  return relayer;
}

export default GaslessRelayer;
