import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import type { BaseContract, ContractFactory } from "ethers";
import { artifacts, ethers, network, upgrades } from "hardhat";

import {
  assertCheckpointCompatible,
  CANDIDATE_CONTRACTS,
  CANDIDATE_NAME,
  CandidateConfiguration,
  CandidateContractKey,
  createCheckpoint,
  DeploymentCheckpoint,
  DeploymentPart,
  readCheckpoint,
  writeCheckpoint,
} from "./lib/deployment-checkpoint";
import { assertSupportedRuntime } from "./lib/runtime-preflight";

type RequestedPhase = "preflight" | "bootstrap" | "finalize" | "verify";

const ARTIFACTS: Record<CandidateContractKey, string> = {
  accessControl: "TerraQuraAccessControl",
  circuitBreaker: "CircuitBreaker",
  verificationEngine: "VerificationEngine",
  carbonCredit: "CarbonCredit",
  carbonMarketplace: "CarbonMarketplace",
};

const ZERO_CODE = "0x";

function requiredAddress(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a non-zero address`);
  }
  return ethers.getAddress(value);
}

function requiredHttpsUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be configured`);
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} must be an HTTPS URL`);
  }
  return value.replace(/\/+$/, "");
}

function requestedPhase(): RequestedPhase {
  const value = process.env.TERRAQURA_DEPLOY_PHASE?.trim();
  if (
    value !== "preflight" &&
    value !== "bootstrap" &&
    value !== "finalize" &&
    value !== "verify"
  ) {
    throw new Error(
      "TERRAQURA_DEPLOY_PHASE must be preflight, bootstrap, finalize, or verify",
    );
  }
  return value;
}

function currentSourceCommit(): string {
  const current = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
  }).trim();
  const expected = process.env.TERRAQURA_SOURCE_COMMIT?.trim();
  if (!expected || !/^[a-fA-F0-9]{40}$/.test(expected)) {
    throw new Error(
      "TERRAQURA_SOURCE_COMMIT must contain the reviewed immutable 40-character commit SHA",
    );
  }
  if (current.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(
      `Detached source mismatch: expected ${expected}, checked out ${current}`,
    );
  }
  const checkoutChanges = execFileSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  }).trim();
  if (checkoutChanges) {
    throw new Error(
      "Source checkout contains modified or untracked files; deployment is blocked",
    );
  }
  return current.toLowerCase();
}

function assertSignerKeyFile(): void {
  if (process.env.PRIVATE_KEY?.trim()) {
    throw new Error(
      "PRIVATE_KEY is not accepted by the deployment ceremony; use DEPLOYER_SIGNER_KEY_FILE",
    );
  }
  const signerKeyFile = process.env.DEPLOYER_SIGNER_KEY_FILE?.trim();
  if (!signerKeyFile) {
    throw new Error("DEPLOYER_SIGNER_KEY_FILE must be configured");
  }
  const signerFileStat = statSync(signerKeyFile);
  if (!signerFileStat.isFile() || (signerFileStat.mode & 0o077) !== 0) {
    throw new Error(
      "DEPLOYER_SIGNER_KEY_FILE must be a regular file without group or world permissions",
    );
  }
}

async function confirmed(
  transaction: Promise<{ wait: () => Promise<unknown> }>,
): Promise<void> {
  await (await transaction).wait();
}

async function loadConfiguration(): Promise<{
  configuration: CandidateConfiguration;
  checkpointPath: string;
}> {
  assertSupportedRuntime({
    repositoryRoot: resolve(__dirname, "../../.."),
  });
  assertSignerKeyFile();
  if (network.name !== "aethelredTestnet") {
    throw new Error("This ceremony only supports the aethelredTestnet network");
  }

  requiredHttpsUrl("AETHELRED_TESTNET_RPC_URL");
  const sourceCommit = currentSourceCommit();
  const protocolOwner = requiredAddress("PROTOCOL_OWNER_ADDRESS");
  const feeRecipient = requiredAddress("FEE_RECIPIENT_ADDRESS");
  const operatorSigner = requiredAddress("OPERATOR_SIGNER_ADDRESS");
  const metadataBaseUri = requiredHttpsUrl("METADATA_BASE_URI");
  const rawPlatformFeeBps = process.env.PLATFORM_FEE_BPS || "250";
  const platformFeeBps = Number(rawPlatformFeeBps);
  if (
    !/^\d+$/.test(rawPlatformFeeBps) ||
    !Number.isSafeInteger(platformFeeBps) ||
    platformFeeBps < 0 ||
    platformFeeBps > 500
  ) {
    throw new Error("PLATFORM_FEE_BPS must be between 0 and 500");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "Deployment signer is not configured; mount DEPLOYER_SIGNER_KEY_FILE",
    );
  }
  const deployerAddress = ethers.getAddress(await deployer.getAddress());
  if (protocolOwner === deployerAddress) {
    throw new Error(
      "PROTOCOL_OWNER_ADDRESS must be independent of the deployment signer",
    );
  }
  if (operatorSigner === deployerAddress) {
    throw new Error(
      "OPERATOR_SIGNER_ADDRESS must be independent of the deployment signer",
    );
  }

  const chain = await ethers.provider.getNetwork();
  const rawExpectedChainId = process.env.AETHELRED_TESTNET_CHAIN_ID || "7332";
  const expectedChainId = Number(rawExpectedChainId);
  if (
    !/^\d+$/.test(rawExpectedChainId) ||
    !Number.isSafeInteger(expectedChainId) ||
    expectedChainId <= 0 ||
    chain.chainId !== BigInt(expectedChainId)
  ) {
    throw new Error(
      `RPC chain mismatch: expected ${expectedChainId}, received ${chain.chainId}`,
    );
  }
  if ((await ethers.provider.getBalance(deployerAddress)) === 0n) {
    throw new Error("Deployment signer has no AETH for transaction fees");
  }

  const configuration: CandidateConfiguration = {
    network: "aethelredTestnet",
    chainId: expectedChainId,
    sourceCommit,
    deployer: deployerAddress,
    protocolOwner,
    feeRecipient,
    operatorSigner,
    metadataBaseUri,
    platformFeeBps,
  };
  const configuredCheckpointPath =
    process.env.TERRAQURA_DEPLOYMENT_CHECKPOINT?.trim();
  if (!configuredCheckpointPath) {
    throw new Error("TERRAQURA_DEPLOYMENT_CHECKPOINT must be configured");
  }
  const checkpointPath = resolve(configuredCheckpointPath);

  return { configuration, checkpointPath };
}

async function validateImplementations(): Promise<
  Record<CandidateContractKey, ContractFactory>
> {
  const factories = Object.fromEntries(
    await Promise.all(
      CANDIDATE_CONTRACTS.map(async (key) => {
        const factory = await ethers.getContractFactory(ARTIFACTS[key]);
        await upgrades.validateImplementation(factory, { kind: "uups" });
        return [key, factory] as const;
      }),
    ),
  ) as Record<CandidateContractKey, ContractFactory>;
  await ethers.getContractFactory("ERC1967Proxy");
  return factories;
}

function loadOrCreateCheckpoint(
  path: string,
  configuration: CandidateConfiguration,
): DeploymentCheckpoint {
  const existingCheckpoint = readCheckpoint(path);
  const checkpoint =
    existingCheckpoint ?? createCheckpoint(configuration, ARTIFACTS);
  assertCheckpointCompatible(checkpoint, configuration);
  if (!existingCheckpoint) {
    writeCheckpoint(path, checkpoint);
  }
  return checkpoint;
}

function artifactFor(key: CandidateContractKey, part: DeploymentPart): string {
  return part === "implementation" ? ARTIFACTS[key] : "ERC1967Proxy";
}

async function requireExpectedCode(
  address: string,
  label: string,
  artifactName: string,
): Promise<void> {
  const code = await ethers.provider.getCode(address);
  if (code === ZERO_CODE) {
    throw new Error(`${label} has no code at ${address}`);
  }
  const artifact = await artifacts.readArtifact(artifactName);
  if (ethers.keccak256(code) !== ethers.keccak256(artifact.deployedBytecode)) {
    throw new Error(
      `${label} runtime bytecode does not match ${artifactName} at ${address}`,
    );
  }
}

async function recoverPendingDeployment(
  checkpointPath: string,
  checkpoint: DeploymentCheckpoint,
): Promise<void> {
  const pending = checkpoint.pending;
  if (!pending) {
    return;
  }

  const code = await ethers.provider.getCode(pending.expectedAddress);
  if (code !== ZERO_CODE) {
    await requireExpectedCode(
      pending.expectedAddress,
      `${pending.contract} ${pending.part}`,
      artifactFor(pending.contract, pending.part),
    );
    const contract = checkpoint.contracts[pending.contract];
    contract[pending.part] = pending.expectedAddress;
    if (pending.transactionHash) {
      if (pending.part === "implementation") {
        contract.implementationTransactionHash = pending.transactionHash;
      } else {
        contract.proxyTransactionHash = pending.transactionHash;
      }
    }
    checkpoint.pending = undefined;
    writeCheckpoint(checkpointPath, checkpoint);
    return;
  }

  if (pending.transactionHash) {
    const receipt = await ethers.provider.getTransactionReceipt(
      pending.transactionHash,
    );
    if (!receipt) {
      throw new Error(
        `Deployment transaction ${pending.transactionHash} is still pending or unavailable; do not redeploy`,
      );
    }
    if (receipt.status === 0) {
      checkpoint.pending = undefined;
      writeCheckpoint(checkpointPath, checkpoint);
      return;
    }
    throw new Error(
      `Transaction ${pending.transactionHash} succeeded but ${pending.expectedAddress} has no code; manual reconciliation is required`,
    );
  }

  const currentNonce = await ethers.provider.getTransactionCount(
    checkpoint.configuration.deployer,
    "pending",
  );
  if (currentNonce > pending.nonce) {
    throw new Error(
      `Signer nonce advanced beyond reserved nonce ${pending.nonce}, but ${pending.expectedAddress} has no code; manual reconciliation is required`,
    );
  }
  if (currentNonce < pending.nonce) {
    throw new Error(
      `Signer nonce ${currentNonce} is behind reserved nonce ${pending.nonce}; RPC state is inconsistent`,
    );
  }
}

async function deployPart(
  checkpointPath: string,
  checkpoint: DeploymentCheckpoint,
  key: CandidateContractKey,
  part: DeploymentPart,
  factory: ContractFactory,
  constructorArguments: unknown[],
): Promise<string> {
  await recoverPendingDeployment(checkpointPath, checkpoint);
  const state = checkpoint.contracts[key];
  const existing = state[part];
  if (existing) {
    await requireExpectedCode(
      existing,
      `${key} ${part}`,
      artifactFor(key, part),
    );
    return existing;
  }

  let pending = checkpoint.pending;
  if (!pending) {
    const nonce = await ethers.provider.getTransactionCount(
      checkpoint.configuration.deployer,
      "pending",
    );
    pending = {
      contract: key,
      part,
      nonce,
      expectedAddress: ethers.getCreateAddress({
        from: checkpoint.configuration.deployer,
        nonce,
      }),
    };
    checkpoint.pending = pending;
    writeCheckpoint(checkpointPath, checkpoint);
  }
  if (pending.contract !== key || pending.part !== part) {
    throw new Error(
      `Checkpoint has unresolved ${pending.contract} ${pending.part}; refusing a second deployment`,
    );
  }

  const contract = (await factory.deploy(...constructorArguments, {
    nonce: pending.nonce,
  })) as BaseContract;
  const transaction = contract.deploymentTransaction();
  if (!transaction) {
    throw new Error(`No deployment transaction returned for ${key} ${part}`);
  }
  const predictedAddress = await contract.getAddress();
  if (
    ethers.getAddress(predictedAddress) !==
    ethers.getAddress(pending.expectedAddress)
  ) {
    throw new Error(
      `Predicted ${key} ${part} address changed; refusing to continue`,
    );
  }

  pending.transactionHash = transaction.hash;
  writeCheckpoint(checkpointPath, checkpoint);
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`${key} ${part} deployment failed: ${transaction.hash}`);
  }
  await requireExpectedCode(
    pending.expectedAddress,
    `${key} ${part}`,
    artifactFor(key, part),
  );

  state[part] = pending.expectedAddress;
  if (part === "implementation") {
    state.implementationTransactionHash = transaction.hash;
  } else {
    state.proxyTransactionHash = transaction.hash;
  }
  checkpoint.pending = undefined;
  writeCheckpoint(checkpointPath, checkpoint);
  return pending.expectedAddress;
}

async function deployProxy(
  checkpointPath: string,
  checkpoint: DeploymentCheckpoint,
  key: CandidateContractKey,
  implementationFactory: ContractFactory,
  initializerArguments: unknown[],
): Promise<string> {
  const implementation = await deployPart(
    checkpointPath,
    checkpoint,
    key,
    "implementation",
    implementationFactory,
    [],
  );
  const initializerData = implementationFactory.interface.encodeFunctionData(
    "initialize",
    initializerArguments,
  );
  const proxyFactory = await ethers.getContractFactory("ERC1967Proxy");
  const proxy = await deployPart(
    checkpointPath,
    checkpoint,
    key,
    "proxy",
    proxyFactory,
    [implementation, initializerData],
  );
  const onChainImplementation =
    await upgrades.erc1967.getImplementationAddress(proxy);
  if (
    ethers.getAddress(onChainImplementation) !==
    ethers.getAddress(implementation)
  ) {
    throw new Error(`${key} proxy implementation does not match checkpoint`);
  }
  return proxy;
}

function requireProxy(
  checkpoint: DeploymentCheckpoint,
  key: CandidateContractKey,
): string {
  const proxy = checkpoint.contracts[key].proxy;
  if (!proxy) {
    throw new Error(`${key} proxy is missing from the checkpoint`);
  }
  return proxy;
}

async function bootstrap(
  checkpointPath: string,
  checkpoint: DeploymentCheckpoint,
  factories: Record<CandidateContractKey, ContractFactory>,
): Promise<void> {
  if (process.env.CONFIRM_TESTNET_DEPLOY !== "true") {
    throw new Error(
      "Bootstrap is transaction-bearing; set CONFIRM_TESTNET_DEPLOY=true only after the preflight record is approved",
    );
  }
  if (process.env.CONFIRM_TESTNET_FINALIZE === "true") {
    throw new Error(
      "CONFIRM_TESTNET_FINALIZE must remain false during bootstrap",
    );
  }

  const deployer = checkpoint.configuration.deployer;
  const accessControl = await deployProxy(
    checkpointPath,
    checkpoint,
    "accessControl",
    factories.accessControl,
    [deployer],
  );
  const circuitBreaker = await deployProxy(
    checkpointPath,
    checkpoint,
    "circuitBreaker",
    factories.circuitBreaker,
    [deployer],
  );
  const verificationEngine = await deployProxy(
    checkpointPath,
    checkpoint,
    "verificationEngine",
    factories.verificationEngine,
    [accessControl, ethers.ZeroAddress],
  );
  const carbonCredit = await deployProxy(
    checkpointPath,
    checkpoint,
    "carbonCredit",
    factories.carbonCredit,
    [verificationEngine, checkpoint.configuration.metadataBaseUri, deployer],
  );
  await deployProxy(
    checkpointPath,
    checkpoint,
    "carbonMarketplace",
    factories.carbonMarketplace,
    [
      carbonCredit,
      checkpoint.configuration.feeRecipient,
      checkpoint.configuration.platformFeeBps,
      deployer,
    ],
  );

  await verifyProxyCode(checkpoint);
  writeCheckpoint(checkpointPath, checkpoint);
}

async function sendWhen(
  desired: () => Promise<boolean>,
  transaction: () => Promise<{ wait: () => Promise<unknown> }>,
): Promise<void> {
  if (!(await desired())) {
    await confirmed(transaction());
  }
}

async function finalize(
  checkpointPath: string,
  checkpoint: DeploymentCheckpoint,
): Promise<void> {
  if (process.env.CONFIRM_TESTNET_FINALIZE !== "true") {
    throw new Error(
      "Finalize is transaction-bearing; set CONFIRM_TESTNET_FINALIZE=true only after the bootstrap checkpoint is independently reviewed",
    );
  }
  if (process.env.CONFIRM_TESTNET_DEPLOY === "true") {
    throw new Error("CONFIRM_TESTNET_DEPLOY must remain false during finalize");
  }
  await verifyProxyCode(checkpoint);

  const accessControl = await ethers.getContractAt(
    "TerraQuraAccessControl",
    requireProxy(checkpoint, "accessControl"),
  );
  const circuitBreaker = await ethers.getContractAt(
    "CircuitBreaker",
    requireProxy(checkpoint, "circuitBreaker"),
  );
  const verificationEngine = await ethers.getContractAt(
    "VerificationEngine",
    requireProxy(checkpoint, "verificationEngine"),
  );
  const carbonCredit = await ethers.getContractAt(
    "CarbonCredit",
    requireProxy(checkpoint, "carbonCredit"),
  );
  const marketplace = await ethers.getContractAt(
    "CarbonMarketplace",
    requireProxy(checkpoint, "carbonMarketplace"),
  );

  const { deployer, protocolOwner, operatorSigner } = checkpoint.configuration;
  const circuitBreakerAddress = await circuitBreaker.getAddress();
  const accessControlAddress = await accessControl.getAddress();
  const carbonCreditAddress = await carbonCredit.getAddress();

  await sendWhen(
    async () =>
      ethers.getAddress(await verificationEngine.carbonCreditContract()) ===
      ethers.getAddress(carbonCreditAddress),
    () => verificationEngine.setCarbonCreditContract(carbonCreditAddress),
  );
  await sendWhen(
    async () =>
      ethers.getAddress(await verificationEngine.circuitBreaker()) ===
      ethers.getAddress(circuitBreakerAddress),
    () => verificationEngine.setCircuitBreaker(circuitBreakerAddress),
  );
  await sendWhen(
    async () =>
      ethers.getAddress(await carbonCredit.circuitBreaker()) ===
      ethers.getAddress(circuitBreakerAddress),
    () => carbonCredit.setCircuitBreaker(circuitBreakerAddress),
  );
  await sendWhen(
    () => carbonCredit.approvedMinters(operatorSigner),
    () => carbonCredit.setMinter(operatorSigner, true),
  );
  await sendWhen(
    async () =>
      ethers.getAddress(await marketplace.circuitBreaker()) ===
      ethers.getAddress(circuitBreakerAddress),
    () => marketplace.setCircuitBreaker(circuitBreakerAddress),
  );
  await sendWhen(
    async () =>
      ethers.getAddress(await marketplace.kycRegistry()) ===
      ethers.getAddress(accessControlAddress),
    () => marketplace.setKycRegistry(accessControlAddress),
  );
  await sendWhen(
    () => marketplace.kycRequired(),
    () => marketplace.setKycRequired(true),
  );

  for (const address of [
    await verificationEngine.getAddress(),
    carbonCreditAddress,
    await marketplace.getAddress(),
  ]) {
    await sendWhen(
      () => circuitBreaker.monitoredContractLookup(address),
      () => circuitBreaker.registerContract(address),
    );
  }
  await sendWhen(
    () => circuitBreaker.isPauser(protocolOwner),
    () => circuitBreaker.addPauser(protocolOwner),
  );

  const privilegedRoles = [
    await accessControl.DEFAULT_ADMIN_ROLE(),
    await accessControl.ADMIN_ROLE(),
    await accessControl.UPGRADER_ROLE(),
    await accessControl.PAUSER_ROLE(),
  ];
  for (const role of privilegedRoles) {
    await sendWhen(
      () => accessControl.hasRole(role, protocolOwner),
      () => accessControl.grantRole(role, protocolOwner),
    );
  }
  for (const role of [
    await accessControl.OPERATOR_ROLE(),
    await accessControl.MINTER_ROLE(),
    await accessControl.COMPLIANCE_ROLE(),
  ]) {
    await sendWhen(
      () => accessControl.hasRole(role, operatorSigner),
      () => accessControl.grantRole(role, operatorSigner),
    );
  }

  for (const contract of [verificationEngine, carbonCredit, marketplace]) {
    await sendWhen(
      async () =>
        ethers.getAddress(await contract.owner()) ===
        ethers.getAddress(protocolOwner),
      () => contract.transferOwnership(protocolOwner),
    );
  }
  await sendWhen(
    async () => !(await circuitBreaker.isPauser(deployer)),
    () => circuitBreaker.removePauser(deployer),
  );
  await sendWhen(
    async () =>
      ethers.getAddress(await circuitBreaker.owner()) ===
      ethers.getAddress(protocolOwner),
    () => circuitBreaker.transferOwnership(protocolOwner),
  );

  for (const role of [
    await accessControl.UPGRADER_ROLE(),
    await accessControl.PAUSER_ROLE(),
    await accessControl.ADMIN_ROLE(),
  ]) {
    await sendWhen(
      async () => !(await accessControl.hasRole(role, deployer)),
      () => accessControl.revokeRole(role, deployer),
    );
  }
  const defaultAdminRole = await accessControl.DEFAULT_ADMIN_ROLE();
  await sendWhen(
    async () => !(await accessControl.hasRole(defaultAdminRole, deployer)),
    () => accessControl.revokeRole(defaultAdminRole, deployer),
  );

  checkpoint.phase = "finalized";
  await verifyFinalizedConfiguration(checkpoint);
  writeCheckpoint(checkpointPath, checkpoint);
  writeManifest(checkpoint, checkpointPath);
}

async function verifyProxyCode(
  checkpoint: DeploymentCheckpoint,
): Promise<void> {
  for (const key of CANDIDATE_CONTRACTS) {
    const state = checkpoint.contracts[key];
    if (!state.implementation || !state.proxy) {
      throw new Error(`${key} bootstrap is incomplete`);
    }
    await requireExpectedCode(
      state.implementation,
      `${key} implementation`,
      ARTIFACTS[key],
    );
    await requireExpectedCode(state.proxy, `${key} proxy`, "ERC1967Proxy");
    const onChainImplementation =
      await upgrades.erc1967.getImplementationAddress(state.proxy);
    if (
      ethers.getAddress(onChainImplementation) !==
      ethers.getAddress(state.implementation)
    ) {
      throw new Error(`${key} implementation slot does not match checkpoint`);
    }
  }
}

async function verifyFinalizedConfiguration(
  checkpoint: DeploymentCheckpoint,
): Promise<void> {
  await verifyProxyCode(checkpoint);
  const accessControl = await ethers.getContractAt(
    "TerraQuraAccessControl",
    requireProxy(checkpoint, "accessControl"),
  );
  const circuitBreaker = await ethers.getContractAt(
    "CircuitBreaker",
    requireProxy(checkpoint, "circuitBreaker"),
  );
  const verificationEngine = await ethers.getContractAt(
    "VerificationEngine",
    requireProxy(checkpoint, "verificationEngine"),
  );
  const carbonCredit = await ethers.getContractAt(
    "CarbonCredit",
    requireProxy(checkpoint, "carbonCredit"),
  );
  const marketplace = await ethers.getContractAt(
    "CarbonMarketplace",
    requireProxy(checkpoint, "carbonMarketplace"),
  );

  const {
    deployer,
    protocolOwner,
    operatorSigner,
    feeRecipient,
    platformFeeBps,
  } = checkpoint.configuration;
  const expectedOwners = [
    await verificationEngine.owner(),
    await carbonCredit.owner(),
    await marketplace.owner(),
    await circuitBreaker.owner(),
  ];
  if (
    expectedOwners.some(
      (owner) => ethers.getAddress(owner) !== ethers.getAddress(protocolOwner),
    )
  ) {
    throw new Error("One or more contract owners were not transferred");
  }
  if (
    ethers.getAddress(await verificationEngine.carbonCreditContract()) !==
      ethers.getAddress(await carbonCredit.getAddress()) ||
    ethers.getAddress(await verificationEngine.accessControl()) !==
      ethers.getAddress(await accessControl.getAddress()) ||
    ethers.getAddress(await verificationEngine.circuitBreaker()) !==
      ethers.getAddress(await circuitBreaker.getAddress()) ||
    ethers.getAddress(await carbonCredit.verificationEngine()) !==
      ethers.getAddress(await verificationEngine.getAddress()) ||
    ethers.getAddress(await carbonCredit.circuitBreaker()) !==
      ethers.getAddress(await circuitBreaker.getAddress()) ||
    ethers.getAddress(await marketplace.carbonCredit()) !==
      ethers.getAddress(await carbonCredit.getAddress()) ||
    ethers.getAddress(await marketplace.circuitBreaker()) !==
      ethers.getAddress(await circuitBreaker.getAddress()) ||
    ethers.getAddress(await marketplace.kycRegistry()) !==
      ethers.getAddress(await accessControl.getAddress()) ||
    !(await marketplace.kycRequired()) ||
    !(await carbonCredit.approvedMinters(operatorSigner)) ||
    ethers.getAddress(await marketplace.feeRecipient()) !==
      ethers.getAddress(feeRecipient) ||
    Number(await marketplace.platformFeeBps()) !== platformFeeBps
  ) {
    throw new Error("Core contract wiring does not match the checkpoint");
  }

  for (const address of [
    await verificationEngine.getAddress(),
    await carbonCredit.getAddress(),
    await marketplace.getAddress(),
  ]) {
    if (!(await circuitBreaker.monitoredContractLookup(address))) {
      throw new Error(`Circuit breaker does not monitor ${address}`);
    }
  }
  if (!(await circuitBreaker.isPauser(protocolOwner))) {
    throw new Error("Protocol owner is not a circuit-breaker pauser");
  }
  if (await circuitBreaker.isPauser(deployer)) {
    throw new Error("Deployment signer remains a circuit-breaker pauser");
  }

  for (const role of [
    await accessControl.DEFAULT_ADMIN_ROLE(),
    await accessControl.ADMIN_ROLE(),
    await accessControl.UPGRADER_ROLE(),
    await accessControl.PAUSER_ROLE(),
  ]) {
    if (!(await accessControl.hasRole(role, protocolOwner))) {
      throw new Error("Protocol owner is missing a privileged role");
    }
    if (await accessControl.hasRole(role, deployer)) {
      throw new Error("Deployment signer retains a privileged role");
    }
  }
  for (const role of [
    await accessControl.OPERATOR_ROLE(),
    await accessControl.MINTER_ROLE(),
    await accessControl.COMPLIANCE_ROLE(),
  ]) {
    if (!(await accessControl.hasRole(role, operatorSigner))) {
      throw new Error("Operator signer is missing an operational role");
    }
  }
}

function writeManifest(
  checkpoint: DeploymentCheckpoint,
  checkpointPath: string,
): void {
  const manifest = {
    schemaVersion: 1,
    candidate: CANDIDATE_NAME,
    sourceCommit: checkpoint.configuration.sourceCommit,
    network: checkpoint.configuration.network,
    chainId: checkpoint.configuration.chainId,
    finalizedAt: new Date().toISOString(),
    deployedBy: checkpoint.configuration.deployer,
    protocolOwner: checkpoint.configuration.protocolOwner,
    operatorSigner: checkpoint.configuration.operatorSigner,
    contracts: Object.fromEntries(
      CANDIDATE_CONTRACTS.map((key) => [
        key,
        {
          proxy: checkpoint.contracts[key].proxy,
          implementation: checkpoint.contracts[key].implementation,
          proxyTransactionHash: checkpoint.contracts[key].proxyTransactionHash,
          implementationTransactionHash:
            checkpoint.contracts[key].implementationTransactionHash,
        },
      ]),
    ),
    configuration: {
      feeRecipient: checkpoint.configuration.feeRecipient,
      platformFeeBps: checkpoint.configuration.platformFeeBps,
      metadataBaseUri: checkpoint.configuration.metadataBaseUri,
      kycRequired: true,
    },
    checkpointSha256: createHash("sha256")
      .update(readFileSync(checkpointPath))
      .digest("hex"),
  };
  const manifestPath = resolve(
    dirname(checkpointPath),
    `aethelred-testnet-${checkpoint.configuration.chainId}.manifest.json`,
  );
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function main(): Promise<void> {
  const phase = requestedPhase();
  const { configuration, checkpointPath } = await loadConfiguration();
  const factories = await validateImplementations();
  const checkpoint = loadOrCreateCheckpoint(checkpointPath, configuration);

  if (phase === "preflight") {
    await recoverPendingDeployment(checkpointPath, checkpoint);
    return;
  }

  const lockPath = `${checkpointPath}.lock`;
  mkdirSync(dirname(lockPath), { recursive: true });
  let lockDescriptor: number | undefined;
  try {
    lockDescriptor = openSync(lockPath, "wx", 0o600);
  } catch {
    throw new Error(
      `Deployment lock already exists at ${lockPath}; confirm no ceremony is running before removing a stale lock`,
    );
  }

  try {
    if (phase === "bootstrap") {
      await bootstrap(checkpointPath, checkpoint, factories);
      return;
    }
    if (phase === "finalize") {
      await finalize(checkpointPath, checkpoint);
      return;
    }
    if (checkpoint.phase !== "finalized") {
      throw new Error("Checkpoint is not finalized");
    }
    await verifyFinalizedConfiguration(checkpoint);
  } finally {
    if (lockDescriptor !== undefined) {
      closeSync(lockDescriptor);
    }
    unlinkSync(lockPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
