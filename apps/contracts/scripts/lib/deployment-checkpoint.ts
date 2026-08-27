import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

export const CANDIDATE_NAME = "terraqura-public-testnet-five-proxy-v1";

export const CANDIDATE_CONTRACTS = [
  "accessControl",
  "circuitBreaker",
  "verificationEngine",
  "carbonCredit",
  "carbonMarketplace",
] as const;

export type CandidateContractKey = (typeof CANDIDATE_CONTRACTS)[number];
export type DeploymentPart = "implementation" | "proxy";
export type CeremonyPhase = "bootstrap" | "finalized";

export interface CandidateConfiguration {
  network: "aethelredTestnet";
  chainId: number;
  sourceCommit: string;
  deployer: string;
  protocolOwner: string;
  feeRecipient: string;
  operatorSigner: string;
  metadataBaseUri: string;
  platformFeeBps: number;
}

export interface ContractDeploymentState {
  artifact: string;
  implementation?: string;
  implementationTransactionHash?: string;
  proxy?: string;
  proxyTransactionHash?: string;
}

export interface PendingDeployment {
  contract: CandidateContractKey;
  part: DeploymentPart;
  nonce: number;
  expectedAddress: string;
  transactionHash?: string;
}

export interface DeploymentCheckpoint {
  schemaVersion: 1;
  candidate: typeof CANDIDATE_NAME;
  configurationDigest: string;
  configuration: CandidateConfiguration;
  phase: CeremonyPhase;
  createdAt: string;
  updatedAt: string;
  contracts: Record<CandidateContractKey, ContractDeploymentState>;
  pending?: PendingDeployment;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    );
  }
  return value;
}

export function configurationDigest(
  configuration: CandidateConfiguration,
): string {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(configuration)))
    .digest("hex");
}

export function defaultCheckpointPath(chainId: number): string {
  return resolve("deployments", `aethelred-testnet-${chainId}.checkpoint.json`);
}

export function createCheckpoint(
  configuration: CandidateConfiguration,
  artifacts: Record<CandidateContractKey, string>,
  now = new Date().toISOString(),
): DeploymentCheckpoint {
  return {
    schemaVersion: 1,
    candidate: CANDIDATE_NAME,
    configurationDigest: configurationDigest(configuration),
    configuration,
    phase: "bootstrap",
    createdAt: now,
    updatedAt: now,
    contracts: Object.fromEntries(
      CANDIDATE_CONTRACTS.map((key) => [
        key,
        {
          artifact: artifacts[key],
        },
      ]),
    ) as Record<CandidateContractKey, ContractDeploymentState>,
  };
}

export function assertCheckpointCompatible(
  checkpoint: DeploymentCheckpoint,
  configuration: CandidateConfiguration,
): void {
  if (
    checkpoint.schemaVersion !== 1 ||
    checkpoint.candidate !== CANDIDATE_NAME
  ) {
    throw new Error(
      "Checkpoint is not a supported TerraQura deployment record",
    );
  }

  const expectedDigest = configurationDigest(configuration);
  if (
    checkpoint.configurationDigest !== expectedDigest ||
    configurationDigest(checkpoint.configuration) !== expectedDigest
  ) {
    throw new Error(
      "Checkpoint configuration does not match this source commit, network, signer, or deployment parameters",
    );
  }
}

export function readCheckpoint(path: string): DeploymentCheckpoint | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as DeploymentCheckpoint;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }
    throw error;
  }
}

export function writeCheckpoint(
  path: string,
  checkpoint: DeploymentCheckpoint,
  now = new Date().toISOString(),
): void {
  checkpoint.updatedAt = now;
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(checkpoint, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
  chmodSync(path, 0o600);
}
