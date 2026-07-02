// TerraQura Minting Processor
// Handles async carbon credit minting from verified batches

import { Job, Processor } from "bullmq";
import { ethers } from "ethers";
import type { MintingJobData } from "@terraqura/queue";

import { createScopedLogger, serializeError } from "../lib/logger.js";

// Contract ABI (minimal for minting)
const CARBON_CREDIT_ABI = [
  "function mintFromVerification(address to, uint256 co2Amount, uint256 energyUsed, bytes32 dataHash, string calldata ipfsCid) external returns (uint256)",
  "event CreditMinted(uint256 indexed tokenId, address indexed to, uint256 amount, bytes32 dataHash)",
];

const VERIFICATION_ENGINE_ABI = [
  "function submitVerification(bytes32 batchId, bytes32 dataHash, uint256 co2Amount, uint256 efficiencyFactor) external",
  "function getVerificationStatus(bytes32 batchId) external view returns (uint8 status, bool passed)",
];

interface MintingResult {
  success: boolean;
  tokenId?: string;
  txHash?: string;
  gasUsed?: string;
  error?: string;
}

type VerificationEngineContract = ethers.Contract & {
  getVerificationStatus: (batchId: string) => Promise<[bigint, boolean]>;
};

type MintFromVerificationFn = ((
  to: string,
  co2Amount: bigint,
  energyUsed: bigint,
  dataHash: string,
  ipfsCid: string,
  overrides?: {
    gasLimit?: bigint;
    maxFeePerGas?: bigint;
    maxPriorityFeePerGas?: bigint;
  }
) => Promise<ethers.ContractTransactionResponse>) & {
  estimateGas: (
    to: string,
    co2Amount: bigint,
    energyUsed: bigint,
    dataHash: string,
    ipfsCid: string
  ) => Promise<bigint>;
};

type CarbonCreditContract = ethers.Contract & {
  mintFromVerification: MintFromVerificationFn;
};

export const mintingProcessor: Processor<MintingJobData, MintingResult> = async (
  job: Job<MintingJobData>
) => {
  const {
    verificationBatchId,
    dacUnitId,
    operatorAddress,
    co2Captured,
    efficiencyFactor,
    dataHash,
    merkleRoot,
    ipfsCid,
  } = job.data;
  const logger = createScopedLogger("minting.processor", {
    jobId: job.id,
    verificationBatchId,
    dacUnitId,
  });

  logger.info("Starting minting job", {
    merkleRoot: merkleRoot ?? null,
  });

  try {
    // Initialize provider and wallet
    const provider = new ethers.JsonRpcProvider(
      process.env.AETHELRED_RPC_URL || "https://rpc-testnet.aethelred.network"
    );

    const wallet = new ethers.Wallet(process.env.MINTER_PRIVATE_KEY!, provider);

    // Contract addresses from environment
    const carbonCreditAddress = process.env.CARBON_CREDIT_CONTRACT!;
    const verificationEngineAddress = process.env.VERIFICATION_ENGINE_CONTRACT!;

    // Initialize contracts
    const carbonCredit = new ethers.Contract(
      carbonCreditAddress,
      CARBON_CREDIT_ABI,
      wallet
    ) as CarbonCreditContract;

    const verificationEngine = new ethers.Contract(
      verificationEngineAddress,
      VERIFICATION_ENGINE_ABI,
      wallet
    ) as VerificationEngineContract;

    // Progress: Check verification status
    await job.updateProgress(10);
    logger.info("Checking verification status");

    // Convert batch ID to bytes32
    const batchIdBytes = ethers.id(verificationBatchId);

    // Check if verification passed
    const [status, passed] = await verificationEngine.getVerificationStatus(batchIdBytes);

    if (!passed) {
      throw new Error(`Verification not passed for batch ${verificationBatchId}. Status: ${status}`);
    }

    await job.updateProgress(30);
    logger.info("Verification passed, preparing mint transaction", {
      verificationStatus: status.toString(),
    });

    // Convert data hash to bytes32
    const dataHashBytes = ethers.id(dataHash);

    // Calculate CO2 amount in wei (18 decimals)
    const co2AmountWei = ethers.parseUnits(co2Captured.toString(), 18);
    const energyUsedWei = ethers.parseUnits(
      (co2Captured * efficiencyFactor).toString(),
      18
    );

    // Estimate gas
    await job.updateProgress(50);
    logger.info("Estimating gas for mint transaction");

    const gasEstimate = await carbonCredit.mintFromVerification.estimateGas(
      operatorAddress,
      co2AmountWei,
      energyUsedWei,
      dataHashBytes,
      ipfsCid || ""
    );

    // Add 20% buffer to gas estimate
    const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

    // Get current gas price with priority fee
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits("50", "gwei");
    const maxPriorityFeePerGas =
      feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");

    await job.updateProgress(70);
    logger.info("Sending mint transaction", {
      gasLimit: gasLimit.toString(),
    });

    // Send mint transaction
    const tx = await carbonCredit.mintFromVerification(
      operatorAddress,
      co2AmountWei,
      energyUsedWei,
      dataHashBytes,
      ipfsCid || "",
      {
        gasLimit,
        maxFeePerGas,
        maxPriorityFeePerGas,
      }
    );

    await job.updateProgress(85);
    logger.info("Mint transaction sent, waiting for confirmation", {
      txHash: tx.hash,
    });

    // Wait for confirmation (2 blocks for Aethelred)
    const receipt = await tx.wait(2);

    if (!receipt || receipt.status !== 1) {
      throw new Error(`Transaction reverted: ${tx.hash}`);
    }

    // Parse the CreditMinted event
    const mintEvent = receipt.logs
      .map((log) => {
        try {
          return carbonCredit.interface.parseLog(log as ethers.Log);
        } catch {
          return null;
        }
      })
      .find((event) => event?.name === "CreditMinted");

    const tokenId = mintEvent?.args?.[0]?.toString() || "unknown";

    await job.updateProgress(100);
    logger.info("Successfully minted token", {
      tokenId,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
    });

    return {
      success: true,
      tokenId,
      txHash: tx.hash,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Determine if error is retryable
    const isRetryable =
      errorMessage.includes("nonce") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("network") ||
      errorMessage.includes("rate limit");

    logger.error("Minting job failed", {
      err: serializeError(error),
      retryable: isRetryable,
    });

    if (!isRetryable) {
      // Don't retry for non-recoverable errors
      throw new Error(`Non-retryable error: ${errorMessage}`);
    }

    throw error; // Will be retried based on job config
  }
};

export default mintingProcessor;
