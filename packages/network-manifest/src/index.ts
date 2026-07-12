export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type EvmAddress = `0x${string}`;

export type NetworkKey = "aethelred" | "aethelredTestnet" | "polygonAmoy";

export type DeploymentKey =
  | "aethelredMainnetPending"
  | "aethelredTestnetPending"
  | "polygonAmoyV3Final";

export type ContractAddressKey =
  | "accessControl"
  | "verificationEngine"
  | "carbonCredit"
  | "carbonMarketplace"
  | "gaslessMarketplace"
  | "multisig"
  | "timelock"
  | "circuitBreaker"
  | "riskOracle"
  | "nativeIoTOracle"
  | "sealProofOfPhysics"
  | "carbonRetirement"
  | "retirementCertificate";

export type ContractAddresses = Record<ContractAddressKey, EvmAddress>;

export interface EnvLike {
  readonly [key: string]: string | undefined;
}

export interface NetworkDefinition {
  readonly key: NetworkKey;
  readonly chainId: number;
  readonly name: string;
  readonly displayName: string;
  readonly rpcUrls: readonly [string, ...string[]];
  readonly explorerUrl: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
  readonly environment: "mainnet" | "testnet";
  readonly role: "primary-target" | "legacy-validation";
}

/**
 * Enforcement facts a deployment must attest from LIVE chain reads of the
 * deployed contracts (consultant P0.4/P0.7): the production launch gate
 * requires every flag to be true. A deploy pipeline records these after
 * reading the deployed contract state — never by hand.
 */
export interface DeploymentEnforcement {
  /** CarbonCredit.sealAnchorRequired() === true */
  readonly sealAnchorRequired: boolean;
  /** CarbonCredit.sealEnforcementLocked() === true (one-way lock engaged) */
  readonly sealEnforcementLocked: boolean;
  /** CarbonMarketplace.kycRegistry() !== zero address */
  readonly kycRegistryConfigured: boolean;
  /** CarbonCredit.circuitBreaker() !== zero address */
  readonly circuitBreakerWired: boolean;
  /** CarbonCredit.approvedRetirers(CarbonRetirement) === true */
  readonly retirementWiredAsApprovedRetirer: boolean;
}

export interface DeploymentDefinition {
  readonly key: DeploymentKey;
  readonly network: NetworkKey;
  readonly status:
    | "pending-deployment"
    | "validated-testnet";
  readonly source: string;
  readonly deployedAt: string | null;
  readonly version: string;
  readonly contracts: ContractAddresses;
  readonly implementations: Partial<Record<ContractAddressKey, EvmAddress>>;
  readonly verifiedUrls: Partial<Record<ContractAddressKey, string>>;
  readonly platformFeeBps: number;
  readonly owner: EvmAddress | null;
  readonly provenance: string;
  readonly enforcement: DeploymentEnforcement;
}

export interface PortableNetworkManifest {
  readonly schemaVersion: 1;
  readonly generatedFrom: "@terraqura/network-manifest";
  readonly primaryNetworkKey: typeof PRIMARY_NETWORK_KEY;
  readonly primaryTestnetNetworkKey: typeof PRIMARY_TESTNET_NETWORK_KEY;
  readonly legacyValidationDeploymentKey: typeof LEGACY_VALIDATION_DEPLOYMENT_KEY;
  readonly networks: typeof NETWORKS;
  readonly deployments: typeof DEPLOYMENTS;
  readonly platform: typeof PLATFORM_CONFIG;
}

export const NETWORKS = {
  aethelred: {
    key: "aethelred",
    // Canonical EVM EIP-155 chain ids (source of truth: aethelred repo
    // ecosystem/manifest.json → protocol.evm_chain_id). 7332 is the CONFIRMED
    // live id baked into the x/vm chain config (eth_chainId → 0x1ca4); 7331 is
    // the reserved mainnet id until a production network exists. The earlier
    // 123456/78432 values were never-deployed placeholders.
    chainId: 7331,
    name: "aethelred",
    displayName: "Aethelred Mainnet",
    rpcUrls: ["https://evm-rpc.aethelred.network"],
    explorerUrl: "https://explorer.aethelred.network",
    nativeCurrency: {
      name: "AETHEL",
      symbol: "AETHEL",
      decimals: 18,
    },
    environment: "mainnet",
    role: "primary-target",
  },
  aethelredTestnet: {
    key: "aethelredTestnet",
    // Confirmed live EVM id; a local `aethelredd start --json-rpc.enable`
    // devnet node reports the same id — point AETHELRED_TESTNET_RPC_URL /
    // NEXT_PUBLIC_AETHELRED_TESTNET_RPC_URL at http://127.0.0.1:8545 for it.
    chainId: 7332,
    name: "aethelred-testnet",
    displayName: "Aethelred Testnet",
    rpcUrls: ["https://evm-rpc-testnet.aethelred.network"],
    explorerUrl: "https://explorer-testnet.aethelred.network",
    nativeCurrency: {
      name: "AETHEL",
      symbol: "AETHEL",
      decimals: 18,
    },
    environment: "testnet",
    role: "primary-target",
  },
  polygonAmoy: {
    key: "polygonAmoy",
    chainId: 80002,
    name: "polygon-amoy",
    displayName: "Polygon Amoy Validation",
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    explorerUrl: "https://amoy.polygonscan.com",
    nativeCurrency: {
      name: "MATIC",
      symbol: "MATIC",
      decimals: 18,
    },
    environment: "testnet",
    role: "legacy-validation",
  },
} as const satisfies Record<NetworkKey, NetworkDefinition>;

const EMPTY_CONTRACTS = {
  accessControl: ZERO_ADDRESS,
  verificationEngine: ZERO_ADDRESS,
  carbonCredit: ZERO_ADDRESS,
  carbonMarketplace: ZERO_ADDRESS,
  gaslessMarketplace: ZERO_ADDRESS,
  multisig: ZERO_ADDRESS,
  timelock: ZERO_ADDRESS,
  circuitBreaker: ZERO_ADDRESS,
  riskOracle: ZERO_ADDRESS,
  nativeIoTOracle: ZERO_ADDRESS,
  sealProofOfPhysics: ZERO_ADDRESS,
  carbonRetirement: ZERO_ADDRESS,
  retirementCertificate: ZERO_ADDRESS,
} as const satisfies ContractAddresses;

/** Enforcement attestation for deployments that have not proven anything. */
const UNPROVEN_ENFORCEMENT = {
  sealAnchorRequired: false,
  sealEnforcementLocked: false,
  kycRegistryConfigured: false,
  circuitBreakerWired: false,
  retirementWiredAsApprovedRetirer: false,
} as const satisfies DeploymentEnforcement;

export const CONTRACT_ADDRESS_ENV_KEYS = {
  accessControl: "ACCESS_CONTROL",
  verificationEngine: "VERIFICATION_ENGINE",
  carbonCredit: "CARBON_CREDIT",
  carbonMarketplace: "CARBON_MARKETPLACE",
  gaslessMarketplace: "GASLESS_MARKETPLACE",
  multisig: "MULTISIG",
  timelock: "TIMELOCK",
  circuitBreaker: "CIRCUIT_BREAKER",
  riskOracle: "RISK_ORACLE",
  nativeIoTOracle: "NATIVE_IOT_ORACLE",
  sealProofOfPhysics: "SEAL_PROOF_OF_PHYSICS",
  carbonRetirement: "CARBON_RETIREMENT",
  retirementCertificate: "RETIREMENT_CERTIFICATE",
} as const satisfies Record<ContractAddressKey, string>;

export const DEPLOYMENTS = {
  aethelredMainnetPending: {
    key: "aethelredMainnetPending",
    network: "aethelred",
    status: "pending-deployment",
    source: "pending canonical Aethelred mainnet deployment manifest",
    deployedAt: null,
    version: "pending",
    contracts: EMPTY_CONTRACTS,
    implementations: {},
    verifiedUrls: {},
    platformFeeBps: 250,
    owner: null,
    provenance:
      "Aethelred mainnet is the primary production target. No checked-in deployment manifest exists yet.",
    enforcement: UNPROVEN_ENFORCEMENT,
  },
  aethelredTestnetPending: {
    key: "aethelredTestnetPending",
    network: "aethelredTestnet",
    status: "pending-deployment",
    source: "pending canonical Aethelred testnet deployment manifest",
    deployedAt: null,
    version: "pending",
    contracts: EMPTY_CONTRACTS,
    implementations: {},
    verifiedUrls: {},
    platformFeeBps: 250,
    owner: null,
    provenance:
      "Aethelred testnet is the primary pre-production target. Contract addresses must come from a fresh Aethelred deployment manifest or explicit environment overrides.",
    enforcement: UNPROVEN_ENFORCEMENT,
  },
  polygonAmoyV3Final: {
    key: "polygonAmoyV3Final",
    network: "polygonAmoy",
    status: "validated-testnet",
    source: "apps/contracts/deployments/polygonAmoy-v3-final.json",
    deployedAt: "2026-02-02",
    version: "3.0.0-final",
    contracts: {
      accessControl: "0x55695aAAEC30AB495074c57e85Ae2E1A4866B83b",
      verificationEngine: "0x8dad7E87646e9607Fae225e3A7EAD17ce179dEA8",
      carbonCredit: "0x29B58064fD95b175e5824767d3B18bACFafaF959",
      carbonMarketplace: "0x5a4cb32709AB829E2918F0a914FBa1e0Dab2Fdec",
      gaslessMarketplace: "0x45a65e46e8C1D588702cB659b7d3786476Be0A80",
      multisig: "0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD",
      timelock: "0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354",
      circuitBreaker: "0x24192ecf06aA782F1dF69878413D217d9319e257",
      riskOracle: ZERO_ADDRESS,
      nativeIoTOracle: ZERO_ADDRESS,
      // Aethelred-only: anchors claims via the ISeal precompile (0x0900);
      // structurally absent on the Polygon legacy-validation deployment.
      sealProofOfPhysics: ZERO_ADDRESS,
      // Not part of the checked-in Amoy v3 address set.
      carbonRetirement: ZERO_ADDRESS,
      retirementCertificate: ZERO_ADDRESS,
    },
    implementations: {
      accessControl: "0x7e3bf0EBAF28bcC9A7d96a54Ad6FFEfA0b4Ebc17",
      verificationEngine: "0x2b7881C372f2244020c91c2d8c2421513Cf769c0",
      carbonCredit: "0xBF82A70152CAA15cdD8f451128ccF5a7A7b8155c",
      carbonMarketplace: "0x85b13A91e1DE82a6eE628dc17865bfAED01a49de",
      gaslessMarketplace: "0x6Fbfe3A06a82d3357D21B16bAad92dc14103c45B",
      circuitBreaker: "0x324a72C8A99D27C2d285Feb837Ee4243Fb6ee938",
    },
    verifiedUrls: {
      accessControl:
        "https://amoy.polygonscan.com/address/0x7e3bf0EBAF28bcC9A7d96a54Ad6FFEfA0b4Ebc17#code",
      verificationEngine:
        "https://amoy.polygonscan.com/address/0x2b7881C372f2244020c91c2d8c2421513Cf769c0#code",
      carbonCredit:
        "https://amoy.polygonscan.com/address/0xBF82A70152CAA15cdD8f451128ccF5a7A7b8155c#code",
      carbonMarketplace:
        "https://amoy.polygonscan.com/address/0x85b13A91e1DE82a6eE628dc17865bfAED01a49de#code",
      gaslessMarketplace:
        "https://amoy.polygonscan.com/address/0x6Fbfe3A06a82d3357D21B16bAad92dc14103c45B#code",
      multisig:
        "https://amoy.polygonscan.com/address/0x0805E6ffDE71fd798F3Fe787D1dC907aABA65bAD#code",
      timelock:
        "https://amoy.polygonscan.com/address/0xb8b01581d61Bf2D58B8B8626Ebb7Ab959ccF6354#code",
      circuitBreaker:
        "https://amoy.polygonscan.com/address/0x324a72C8A99D27C2d285Feb837Ee4243Fb6ee938#code",
    },
    platformFeeBps: 250,
    owner: "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc",
    provenance:
      "Legacy validation deployment. These addresses are proven by checked-in Polygon Amoy manifests and must not be described as Aethelred deployments.",
    // The Amoy legacy stack predates seal anchoring, the KYC registry wiring,
    // and the retirement burn authority — truthfully unproven.
    enforcement: UNPROVEN_ENFORCEMENT,
  },
} as const satisfies Record<DeploymentKey, DeploymentDefinition>;

export const PRIMARY_NETWORK_KEY = "aethelred" as const;
export const PRIMARY_TESTNET_NETWORK_KEY = "aethelredTestnet" as const;
export const LEGACY_VALIDATION_DEPLOYMENT_KEY = "polygonAmoyV3Final" as const;
export const LEGACY_VALIDATION_OPT_IN_ENV = "TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT" as const;

export const PLATFORM_CONFIG = {
  platformFeeBps: 250,
  feeRecipient: "0x7F6A87fE3191FFBFa06D37939F3a3a4341159ABc" as EvmAddress,
  BPS_SCALE: 10_000,
} as const;

export function toPortableNetworkManifest(): PortableNetworkManifest {
  return {
    schemaVersion: 1,
    generatedFrom: "@terraqura/network-manifest",
    primaryNetworkKey: PRIMARY_NETWORK_KEY,
    primaryTestnetNetworkKey: PRIMARY_TESTNET_NETWORK_KEY,
    legacyValidationDeploymentKey: LEGACY_VALIDATION_DEPLOYMENT_KEY,
    networks: NETWORKS,
    deployments: DEPLOYMENTS,
    platform: PLATFORM_CONFIG,
  };
}

export function stringifyPortableNetworkManifest(): string {
  return `${JSON.stringify(toPortableNetworkManifest(), null, 2)}\n`;
}

export function isNetworkKey(value: string | undefined): value is NetworkKey {
  return value === "aethelred" || value === "aethelredTestnet" || value === "polygonAmoy";
}

export function isDeploymentKey(value: string | undefined): value is DeploymentKey {
  return (
    value === "aethelredMainnetPending" ||
    value === "aethelredTestnetPending" ||
    value === "polygonAmoyV3Final"
  );
}

export function isEvmAddress(value: string | undefined): value is EvmAddress {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function isZeroAddress(value: string | undefined): boolean {
  return value?.toLowerCase() === ZERO_ADDRESS;
}

export function getNetwork(key: NetworkKey): NetworkDefinition {
  return NETWORKS[key];
}

export function getDeployment(key: DeploymentKey): DeploymentDefinition {
  return DEPLOYMENTS[key];
}

export function isLegacyValidationNetwork(key: NetworkKey): boolean {
  return NETWORKS[key].role === "legacy-validation";
}

export function isLegacyValidationDeployment(key: DeploymentKey): boolean {
  return isLegacyValidationNetwork(DEPLOYMENTS[key].network);
}

export function legacyValidationOptInEnabled(env: EnvLike = {}): boolean {
  return (
    env[LEGACY_VALIDATION_OPT_IN_ENV] === "true" ||
    env.NEXT_PUBLIC_TERRAQURA_ALLOW_LEGACY_VALIDATION_DEPLOYMENT === "true"
  );
}

export function assertRuntimeDeploymentAllowed(
  deploymentKey: DeploymentKey,
  env: EnvLike = {},
): void {
  if (!isLegacyValidationDeployment(deploymentKey)) {
    return;
  }

  if (legacyValidationOptInEnabled(env)) {
    return;
  }

  throw new Error(
    `Deployment "${deploymentKey}" is marked as legacy validation evidence. ` +
      `Set ${LEGACY_VALIDATION_OPT_IN_ENV}=true only for historical validation drills; ` +
      "use an Aethelred deployment for application runtime.",
  );
}

export function assertRuntimeNetworkAllowed(
  networkKey: NetworkKey,
  env: EnvLike = {},
): void {
  if (!isLegacyValidationNetwork(networkKey)) {
    return;
  }

  if (legacyValidationOptInEnabled(env)) {
    return;
  }

  throw new Error(
    `Network "${networkKey}" is marked as legacy validation evidence. ` +
      `Set ${LEGACY_VALIDATION_OPT_IN_ENV}=true only for historical validation drills; ` +
      "use Aethelred for application runtime.",
  );
}

export function getActiveNetworkKey(env: EnvLike = {}): NetworkKey {
  const configured = env.TERRAQURA_NETWORK ?? env.NEXT_PUBLIC_TERRAQURA_NETWORK;
  if (isNetworkKey(configured)) {
    assertRuntimeNetworkAllowed(configured, env);
    return configured;
  }

  const useTestnet =
    env.NEXT_PUBLIC_USE_TESTNET === "true" ||
    env.USE_TESTNET === "true" ||
    env.NODE_ENV === "development" ||
    env.NODE_ENV === "test";
  return useTestnet ? PRIMARY_TESTNET_NETWORK_KEY : PRIMARY_NETWORK_KEY;
}

export function getActiveDeploymentKey(env: EnvLike = {}): DeploymentKey {
  const configured = env.TERRAQURA_DEPLOYMENT ?? env.NEXT_PUBLIC_TERRAQURA_DEPLOYMENT;
  if (isDeploymentKey(configured)) {
    assertRuntimeDeploymentAllowed(configured, env);
    return configured;
  }

  const networkKey = getActiveNetworkKey(env);
  if (networkKey === "aethelred") {
    return "aethelredMainnetPending";
  }

  if (networkKey === "aethelredTestnet") {
    return "aethelredTestnetPending";
  }

  return LEGACY_VALIDATION_DEPLOYMENT_KEY;
}

export function getActiveNetwork(env: EnvLike = {}): NetworkDefinition {
  return getNetwork(getActiveNetworkKey(env));
}

export function getActiveDeployment(env: EnvLike = {}): DeploymentDefinition {
  return getDeployment(getActiveDeploymentKey(env));
}

export function getDeploymentContractAddresses(deploymentKey: DeploymentKey): ContractAddresses {
  return DEPLOYMENTS[deploymentKey].contracts;
}

export function getVerifiedImplementationLinks(
  deploymentKey: DeploymentKey,
): Partial<Record<ContractAddressKey, string>> {
  return DEPLOYMENTS[deploymentKey].verifiedUrls;
}

export function withContractAddressOverrides(
  baseAddresses: ContractAddresses,
  env: EnvLike = {},
  prefix = "TERRAQURA_CONTRACT_",
): ContractAddresses {
  return (Object.keys(CONTRACT_ADDRESS_ENV_KEYS) as ContractAddressKey[]).reduce(
    (addresses, key) => {
      const envName = `${prefix}${CONTRACT_ADDRESS_ENV_KEYS[key]}`;
      const override = env[envName];

      return {
        ...addresses,
        [key]: isEvmAddress(override) ? override : addresses[key],
      };
    },
    { ...baseAddresses },
  );
}

export function requireContractAddress(
  addresses: ContractAddresses,
  key: ContractAddressKey,
  deploymentKey: DeploymentKey,
): EvmAddress {
  const address = addresses[key];
  if (isZeroAddress(address)) {
    throw new Error(
      `Contract address "${key}" is not configured for deployment "${deploymentKey}". ` +
        "Select a deployed manifest with TERRAQURA_DEPLOYMENT or provide a TERRAQURA_CONTRACT_* override.",
    );
  }

  return address;
}

export function validateDeploymentManifest(): string[] {
  const errors: string[] = [];
  const chainIds = new Map<number, NetworkKey>();

  for (const [key, network] of Object.entries(NETWORKS) as Array<[NetworkKey, NetworkDefinition]>) {
    const existing = chainIds.get(network.chainId);
    if (existing) {
      errors.push(`Network "${key}" reuses chain ID ${network.chainId} from "${existing}".`);
    }
    chainIds.set(network.chainId, key);

    if (!network.rpcUrls.length) {
      errors.push(`Network "${key}" must define at least one RPC URL.`);
    }
  }

  for (const [key, deployment] of Object.entries(DEPLOYMENTS) as Array<
    [DeploymentKey, DeploymentDefinition]
  >) {
    if (!NETWORKS[deployment.network]) {
      errors.push(`Deployment "${key}" references unknown network "${deployment.network}".`);
    }

    for (const [contractKey, address] of Object.entries(deployment.contracts) as Array<
      [ContractAddressKey, EvmAddress]
    >) {
      if (!isEvmAddress(address)) {
        errors.push(`Deployment "${key}" has invalid address for "${contractKey}".`);
      }

      if (
        deployment.status === "validated-testnet" &&
        contractKey !== "nativeIoTOracle" &&
        contractKey !== "riskOracle" &&
        contractKey !== "sealProofOfPhysics" && // Aethelred-only, absent on legacy Polygon
        contractKey !== "carbonRetirement" && // not in the checked-in Amoy v3 address set
        contractKey !== "retirementCertificate" && // not in the checked-in Amoy v3 address set
        isZeroAddress(address)
      ) {
        errors.push(`Validated deployment "${key}" has zero address for "${contractKey}".`);
      }
    }
  }

  // 7332 is the confirmed live Aethelred EVM chain id (eth_chainId → 0x1ca4);
  // guard against accidental drift back to a placeholder.
  if ((NETWORKS.aethelredTestnet.chainId as number) !== 7332) {
    errors.push("Aethelred testnet chain ID must remain 7332.");
  }
  if ((NETWORKS.aethelred.chainId as number) !== 7331) {
    errors.push("Aethelred mainnet chain ID must remain 7331.");
  }

  return errors;
}
