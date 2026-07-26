import { readFileSync } from "node:fs";

import { ethers } from "ethers";

import { getApiRuntimeEnv } from "../../lib/runtime-env.js";

export interface WhitelistDacUnitParams {
  unitId: string;
  operator: string;
}

export interface MintVerifiedCreditsParams {
  recipient: string;
  dacUnitId: string;
  sourceDataHash: string;
  captureTimestamp: number;
  co2AmountKg: number;
  energyConsumedKwh: number;
  latitude: number;
  longitude: number;
  purityPercentage: number;
  gridIntensityGco2PerKwh: number;
  metadataUri: string;
  arweaveBackupTxId?: string | null;
}

export interface VerifyRetirementParams {
  txHash: string;
  tokenId: string;
  retiree: string;
  amount: number;
  reason: string;
}

export interface VerifyListingParams {
  txHash: string;
  seller: string;
  tokenId: string;
  amount: number;
  pricePerUnit: string;
  minPurchaseAmount: number;
  durationSeconds: number;
}

export interface VerifyPurchaseParams {
  txHash: string;
  buyer: string;
  listingId: string;
  tokenId: string;
  amount: number;
  totalPrice: string;
}

export interface VerifyListingCancellationParams {
  txHash: string;
  seller: string;
  listingId: string;
}

export interface SyncComplianceStatusParams {
  wallet: string;
  status: "pending" | "verified" | "rejected";
  provider: string;
  applicantId: string;
  sanctionsCleared: boolean;
}

const ABIS = {
  accessControl: [
    "function updateComplianceStatus(address account, uint8 status, string provider, bytes32 applicantIdHash, bool sanctionsCleared) external",
  ],
  carbonCredit: [
    "function balanceOf(address account, uint256 id) view returns (uint256)",
    "function uri(uint256 tokenId) view returns (string)",
    "function mintVerifiedCredits(address recipient, bytes32 dacId, bytes32 dataHash, uint256 captureTimestamp, uint256 co2AmountKg, uint256 energyConsumedKwh, int256 latitude, int256 longitude, uint8 purityPercentage, uint256 gridIntensityGCO2PerKwh, string metadataUri, string arweaveBackup) external returns (uint256)",
    "function retireCredits(uint256 tokenId, uint256 amount, string reason) external",
    "event CreditMinted(uint256 indexed tokenId, bytes32 indexed dacUnitId, address indexed operator, uint256 creditsIssued, bytes32 sourceDataHash)",
    "event CreditRetired(uint256 indexed tokenId, address indexed retiredBy, uint256 amount, string retirementReason)",
  ],
  carbonMarketplace: [
    "function createListing(uint256 tokenId, uint256 amount, uint256 pricePerUnit, uint256 minPurchaseAmount, uint256 duration) external returns (uint256)",
    "function purchase(uint256 listingId, uint256 amount) external payable",
    "function cancelListing(uint256 listingId) external",
    "function getListing(uint256 listingId) view returns (tuple(uint256 listingId,address seller,uint256 tokenId,uint256 amount,uint256 pricePerUnit,uint256 minPurchaseAmount,bool isActive,uint256 createdAt,uint256 expiresAt))",
    "event ListingCreated(uint256 indexed listingId, address indexed seller, uint256 indexed tokenId, uint256 amount, uint256 pricePerUnit)",
    "event ListingCancelled(uint256 indexed listingId, address indexed seller)",
    "event Purchase(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 tokenId, uint256 amount, uint256 totalPrice, uint256 platformFee)",
  ],
  verificationEngine: [
    "function isWhitelisted(bytes32 dacUnitId) view returns (bool)",
    "function getOperator(bytes32 dacUnitId) view returns (address)",
    "function whitelistDacUnit(bytes32 unitId, address operator) external",
  ],
  circuitBreaker: [
    "function getStatus() view returns (bool isGloballyPaused, uint8 currentLevel, uint256 monitoredCount)",
  ],
} as const;

function getContracts() {
  const env = getApiRuntimeEnv();
  return {
    accessControl: env.ACCESS_CONTROL_ADDRESS,
    verificationEngine: env.VERIFICATION_ENGINE_ADDRESS,
    carbonCredit: env.CARBON_CREDIT_ADDRESS,
    carbonMarketplace: env.CARBON_MARKETPLACE_ADDRESS,
    circuitBreaker: env.CIRCUIT_BREAKER_ADDRESS,
  } as const;
}

function getNetwork() {
  const env = getApiRuntimeEnv();
  return {
    chainId: env.CHAIN_ID,
    name: "Aethelred Testnet",
    rpcUrl: env.AETHELRED_RPC_URL,
    explorerUrl: env.AETHELRED_EXPLORER_URL,
  } as const;
}

let provider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const network = getNetwork();
    provider = new ethers.JsonRpcProvider(
      network.rpcUrl,
      {
        chainId: network.chainId,
        name: network.name,
      },
      {
        staticNetwork: true,
      },
    );
  }
  return provider;
}

function getCarbonCreditContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
) {
  return new ethers.Contract(
    getContracts().carbonCredit,
    ABIS.carbonCredit,
    signerOrProvider || getProvider(),
  );
}

function getAccessControlContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
) {
  return new ethers.Contract(
    getContracts().accessControl,
    ABIS.accessControl,
    signerOrProvider || getProvider(),
  );
}

function getMarketplaceContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
) {
  return new ethers.Contract(
    getContracts().carbonMarketplace,
    ABIS.carbonMarketplace,
    signerOrProvider || getProvider(),
  );
}

function getVerificationEngineContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
) {
  return new ethers.Contract(
    getContracts().verificationEngine,
    ABIS.verificationEngine,
    signerOrProvider || getProvider(),
  );
}

function getCircuitBreakerContract(
  signerOrProvider?: ethers.Signer | ethers.Provider,
) {
  return new ethers.Contract(
    getContracts().circuitBreaker,
    ABIS.circuitBreaker,
    signerOrProvider || getProvider(),
  );
}

function loadOperatorPrivateKey(): string {
  const env = getApiRuntimeEnv();
  if (env.NODE_ENV === "production") {
    if (!env.OPERATOR_SIGNER_KEY_FILE) {
      throw new Error("Production operator signer secret is not configured");
    }
    const privateKey = readFileSync(
      env.OPERATOR_SIGNER_KEY_FILE,
      "utf8",
    ).trim();
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
      throw new Error("Operator signer secret is not a valid private key");
    }
    return privateKey;
  }

  if (!env.PRIVATE_KEY) {
    throw new Error("Development operator signer is not configured");
  }
  return env.PRIVATE_KEY;
}

function getSigner(): ethers.Wallet {
  return new ethers.Wallet(loadOperatorPrivateKey(), getProvider());
}

function assertSuccessfulReceipt(
  receipt: ethers.TransactionReceipt | null,
  operation: string,
): ethers.TransactionReceipt {
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${operation} transaction was not confirmed on-chain`);
  }
  return receipt;
}

async function assertConfiguredNetwork(): Promise<void> {
  const expectedChainId = BigInt(getNetwork().chainId);
  const actualNetwork = await getProvider().getNetwork();
  if (actualNetwork.chainId !== expectedChainId) {
    throw new Error(
      `RPC chain mismatch: expected ${expectedChainId}, received ${actualNetwork.chainId}`,
    );
  }
}

async function getConfirmedTransaction(
  txHash: string,
  expectedContract: string,
  expectedSigner?: string,
): Promise<{
  transaction: ethers.TransactionResponse;
  receipt: ethers.TransactionReceipt;
}> {
  await assertConfiguredNetwork();
  const chainProvider = getProvider();
  const [transaction, receipt] = await Promise.all([
    chainProvider.getTransaction(txHash),
    chainProvider.getTransactionReceipt(txHash),
  ]);

  if (!transaction || !receipt || receipt.status !== 1) {
    throw new Error("Transaction is missing, pending, or reverted");
  }
  if (transaction.to?.toLowerCase() !== expectedContract.toLowerCase()) {
    throw new Error(
      "Transaction target does not match the configured contract",
    );
  }
  if (
    expectedSigner &&
    transaction.from.toLowerCase() !== expectedSigner.toLowerCase()
  ) {
    throw new Error(
      "Transaction signer does not match the authenticated wallet",
    );
  }

  return { transaction, receipt };
}

export async function isSystemOperational(): Promise<boolean> {
  try {
    await assertConfiguredNetwork();
    const contract = getCircuitBreakerContract() as ethers.Contract & {
      getStatus: () => Promise<[boolean, number, bigint]>;
    };
    const status = await contract.getStatus();
    return !status[0];
  } catch (error) {
    console.error("System status check failed:", error);
    return false;
  }
}

async function assertSystemOperationalOrThrow(): Promise<void> {
  if (!(await isSystemOperational())) {
    throw new Error("Circuit breaker is active or unavailable");
  }
}

export async function whitelistDacUnitOnChain(
  params: WhitelistDacUnitParams,
): Promise<{ txHash: string }> {
  await assertSystemOperationalOrThrow();

  const contract = getVerificationEngineContract(
    getSigner(),
  ) as ethers.Contract & {
    whitelistDacUnit: (
      unitId: string,
      operator: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  };
  const tx = await contract.whitelistDacUnit(params.unitId, params.operator);
  const receipt = assertSuccessfulReceipt(
    await tx.wait(),
    "DAC unit whitelist",
  );
  return { txHash: receipt.hash };
}

export async function syncComplianceStatusOnChain(
  params: SyncComplianceStatusParams,
): Promise<{ txHash: string }> {
  await assertConfiguredNetwork();
  const statusCode = {
    pending: 1,
    verified: 2,
    rejected: 3,
  }[params.status];
  const contract = getAccessControlContract(getSigner()) as ethers.Contract & {
    updateComplianceStatus: (
      wallet: string,
      status: number,
      provider: string,
      applicantIdHash: string,
      sanctionsCleared: boolean,
    ) => Promise<ethers.ContractTransactionResponse>;
  };
  const tx = await contract.updateComplianceStatus(
    params.wallet,
    statusCode,
    params.provider,
    ethers.id(params.applicantId),
    params.sanctionsCleared,
  );
  const receipt = assertSuccessfulReceipt(
    await tx.wait(),
    "Compliance status synchronization",
  );
  return { txHash: receipt.hash };
}

export async function mintVerifiedCreditsOnChain(
  params: MintVerifiedCreditsParams,
): Promise<{ txHash: string; tokenId: string; amount: number }> {
  await assertSystemOperationalOrThrow();

  const contract = getCarbonCreditContract(getSigner()) as ethers.Contract & {
    mintVerifiedCredits: (
      recipient: string,
      dacUnitId: string,
      sourceDataHash: string,
      captureTimestamp: number,
      co2AmountKg: number,
      energyConsumedKwh: number,
      latitude: number,
      longitude: number,
      purityPercentage: number,
      gridIntensityGco2PerKwh: number,
      metadataUri: string,
      arweaveBackupTxId: string,
    ) => Promise<ethers.ContractTransactionResponse>;
  };
  const tx = await contract.mintVerifiedCredits(
    params.recipient,
    params.dacUnitId,
    params.sourceDataHash,
    params.captureTimestamp,
    params.co2AmountKg,
    params.energyConsumedKwh,
    params.latitude,
    params.longitude,
    params.purityPercentage,
    params.gridIntensityGco2PerKwh,
    params.metadataUri,
    params.arweaveBackupTxId || "",
  );
  const receipt = assertSuccessfulReceipt(
    await tx.wait(),
    "Carbon credit mint",
  );

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "CreditMinted" &&
        String(parsed.args.dacUnitId).toLowerCase() ===
          params.dacUnitId.toLowerCase() &&
        String(parsed.args.operator).toLowerCase() ===
          params.recipient.toLowerCase() &&
        String(parsed.args.sourceDataHash).toLowerCase() ===
          params.sourceDataHash.toLowerCase()
      ) {
        const amount = Number(parsed.args.creditsIssued);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new Error("Mint event contains an invalid operator amount");
        }
        return {
          txHash: receipt.hash,
          tokenId: ethers.toBeHex(parsed.args.tokenId, 32),
          amount,
        };
      }
    } catch {
      // Ignore logs emitted by other contracts in the same receipt.
    }
  }
  throw new Error("Mint transaction confirmed without a CreditMinted event");
}

export async function verifyRetirementOnChain(
  params: VerifyRetirementParams,
): Promise<{ txHash: string; blockNumber: number }> {
  const { receipt } = await getConfirmedTransaction(
    params.txHash,
    getContracts().carbonCredit,
    params.retiree,
  );
  const contract = getCarbonCreditContract();
  const matchedEvent = receipt.logs.some((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return (
        parsed?.name === "CreditRetired" &&
        BigInt(parsed.args.tokenId) === BigInt(params.tokenId) &&
        String(parsed.args.retiredBy).toLowerCase() ===
          params.retiree.toLowerCase() &&
        BigInt(parsed.args.amount) === BigInt(params.amount) &&
        String(parsed.args.retirementReason) === params.reason
      );
    } catch {
      return false;
    }
  });

  if (!matchedEvent) {
    throw new Error(
      "Confirmed transaction does not contain the expected retirement event",
    );
  }
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

export async function verifyListingOnChain(
  params: VerifyListingParams,
): Promise<{ txHash: string; blockNumber: number; listingId: string }> {
  const { transaction, receipt } = await getConfirmedTransaction(
    params.txHash,
    getContracts().carbonMarketplace,
    params.seller,
  );
  const contract = getMarketplaceContract();
  const call = contract.interface.parseTransaction({
    data: transaction.data,
    value: transaction.value,
  });
  if (
    call?.name !== "createListing" ||
    BigInt(call.args.tokenId) !== BigInt(params.tokenId) ||
    BigInt(call.args.amount) !== BigInt(params.amount) ||
    BigInt(call.args.pricePerUnit) !== BigInt(params.pricePerUnit) ||
    BigInt(call.args.minPurchaseAmount) !== BigInt(params.minPurchaseAmount) ||
    BigInt(call.args.duration) !== BigInt(params.durationSeconds)
  ) {
    throw new Error(
      "Transaction calldata does not match the requested listing",
    );
  }

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "ListingCreated" &&
        String(parsed.args.seller).toLowerCase() ===
          params.seller.toLowerCase() &&
        BigInt(parsed.args.tokenId) === BigInt(params.tokenId) &&
        BigInt(parsed.args.amount) === BigInt(params.amount) &&
        BigInt(parsed.args.pricePerUnit) === BigInt(params.pricePerUnit)
      ) {
        return {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          listingId: BigInt(parsed.args.listingId).toString(),
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error(
    "Confirmed transaction does not contain the expected listing event",
  );
}

export async function verifyPurchaseOnChain(
  params: VerifyPurchaseParams,
): Promise<{
  txHash: string;
  blockNumber: number;
  seller: string;
  platformFee: string;
}> {
  const { transaction, receipt } = await getConfirmedTransaction(
    params.txHash,
    getContracts().carbonMarketplace,
    params.buyer,
  );
  const contract = getMarketplaceContract();
  const call = contract.interface.parseTransaction({
    data: transaction.data,
    value: transaction.value,
  });
  if (
    call?.name !== "purchase" ||
    BigInt(call.args.listingId) !== BigInt(params.listingId) ||
    BigInt(call.args.amount) !== BigInt(params.amount) ||
    transaction.value !== BigInt(params.totalPrice)
  ) {
    throw new Error(
      "Transaction calldata does not match the requested purchase",
    );
  }

  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (
        parsed?.name === "Purchase" &&
        BigInt(parsed.args.listingId) === BigInt(params.listingId) &&
        String(parsed.args.buyer).toLowerCase() ===
          params.buyer.toLowerCase() &&
        BigInt(parsed.args.tokenId) === BigInt(params.tokenId) &&
        BigInt(parsed.args.amount) === BigInt(params.amount) &&
        BigInt(parsed.args.totalPrice) === BigInt(params.totalPrice)
      ) {
        return {
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          seller: String(parsed.args.seller).toLowerCase(),
          platformFee: BigInt(parsed.args.platformFee).toString(),
        };
      }
    } catch {
      // Ignore unrelated logs.
    }
  }
  throw new Error(
    "Confirmed transaction does not contain the expected purchase event",
  );
}

export async function verifyListingCancellationOnChain(
  params: VerifyListingCancellationParams,
): Promise<{ txHash: string; blockNumber: number }> {
  const { transaction, receipt } = await getConfirmedTransaction(
    params.txHash,
    getContracts().carbonMarketplace,
    params.seller,
  );
  const contract = getMarketplaceContract();
  const call = contract.interface.parseTransaction({
    data: transaction.data,
    value: transaction.value,
  });
  if (
    call?.name !== "cancelListing" ||
    BigInt(call.args.listingId) !== BigInt(params.listingId)
  ) {
    throw new Error(
      "Transaction calldata does not match the requested cancellation",
    );
  }
  const matchedEvent = receipt.logs.some((log) => {
    try {
      const parsed = contract.interface.parseLog(log);
      return (
        parsed?.name === "ListingCancelled" &&
        BigInt(parsed.args.listingId) === BigInt(params.listingId) &&
        String(parsed.args.seller).toLowerCase() === params.seller.toLowerCase()
      );
    } catch {
      return false;
    }
  });

  if (!matchedEvent) {
    throw new Error(
      "Confirmed transaction does not contain the expected cancellation event",
    );
  }
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

export function getExplorerTxLink(txHash: string): string {
  return `${getNetwork().explorerUrl}/tx/${txHash}`;
}

export function getExplorerAddressLink(address: string): string {
  return `${getNetwork().explorerUrl}/address/${address}`;
}
