import {
  resolvePublicTestnetRpcPolicy,
  type PublicTestnetRpcPolicy,
} from "@terraqura/types";
import { z } from "zod";

const KycProviderSchema = z.enum(["sumsub", "disabled"]);
const DatabaseSslModeSchema = z.enum(["disable", "require", "verify-full"]);
const DeploymentProfileSchema = z.enum([
  "production",
  "public-testnet-evaluation",
]);
const AddressSchema = z
  .string()
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    "Contract address must be a 20-byte hex address",
  )
  .refine(
    (value) =>
      value.toLowerCase() !== "0x0000000000000000000000000000000000000000",
    "Contract address cannot be the zero address",
  );
const HttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "Production network endpoints must use HTTPS",
  });

function emptyToUndefined(value: unknown): unknown {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

const OptionalAddressSchema = z.preprocess(
  emptyToUndefined,
  AddressSchema.optional(),
);
const OptionalSecretFileSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);
const OptionalPrivateKeySchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
);
const OptionalWebhookSecretSchema = z.preprocess(
  emptyToUndefined,
  z.string().min(32).optional(),
);
const OptionalPositivePriceSchema = z.preprocess(
  emptyToUndefined,
  z.coerce.number().finite().positive().optional(),
);
const OptionalStringSchema = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const RawApiRuntimeEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  TERRAQURA_DEPLOYMENT_PROFILE: DeploymentProfileSchema.optional(),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL must be configured"),
  DATABASE_SSL_MODE: DatabaseSslModeSchema.default("require"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be configured and at least 32 characters"),
  SIWE_DOMAIN: z.string().trim().min(1, "SIWE_DOMAIN must be configured"),
  ADMIN_WALLETS: z.string().default(""),
  AUDITOR_WALLETS: z.string().default(""),
  CHAIN_ID: z.coerce.number().int().positive(),
  AETHELRED_RPC_URL: z.string().url(),
  AETHELRED_EXPLORER_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  ALLOW_INSECURE_TESTNET_RPC: OptionalStringSchema,
  AETHELRED_NETWORK_ANCHOR_BLOCK: OptionalStringSchema,
  AETHELRED_NETWORK_ANCHOR_HASH: OptionalStringSchema,
  ACCESS_CONTROL_ADDRESS: AddressSchema,
  VERIFICATION_ENGINE_ADDRESS: AddressSchema,
  CARBON_CREDIT_ADDRESS: AddressSchema,
  CARBON_MARKETPLACE_ADDRESS: AddressSchema,
  CIRCUIT_BREAKER_ADDRESS: AddressSchema,
  OPERATOR_SIGNER_KEY_FILE: OptionalSecretFileSchema,
  PRIVATE_KEY: OptionalPrivateKeySchema,
  FORWARDER_CONTRACT: OptionalAddressSchema,
  RELAYER_SIGNER_KEY_FILE: OptionalSecretFileSchema,
  RELAYER_PRIVATE_KEY: OptionalPrivateKeySchema,
  AETHEL_USD_PRICE: OptionalPositivePriceSchema,
  KYC_PROVIDER: KycProviderSchema.default("sumsub"),
  SUMSUB_APP_TOKEN: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  SUMSUB_WEBHOOK_SECRET: OptionalWebhookSecretSchema,
});

export type KycProvider = z.infer<typeof KycProviderSchema>;

export interface ApiRuntimeEnv {
  NODE_ENV: "development" | "test" | "production";
  TERRAQURA_DEPLOYMENT_PROFILE:
    | "development"
    | "production"
    | "public-testnet-evaluation";
  DATABASE_URL: string;
  DATABASE_SSL_MODE: z.infer<typeof DatabaseSslModeSchema>;
  JWT_SECRET: string;
  SIWE_DOMAIN: string;
  ADMIN_WALLETS: string[];
  AUDITOR_WALLETS: string[];
  CHAIN_ID: number;
  AETHELRED_RPC_URL: string;
  AETHELRED_EXPLORER_URL: string;
  RPC_TRANSPORT: PublicTestnetRpcPolicy["transport"];
  AETHELRED_NETWORK_ANCHOR_BLOCK?: number;
  AETHELRED_NETWORK_ANCHOR_HASH?: string;
  ACCESS_CONTROL_ADDRESS: string;
  VERIFICATION_ENGINE_ADDRESS: string;
  CARBON_CREDIT_ADDRESS: string;
  CARBON_MARKETPLACE_ADDRESS: string;
  CIRCUIT_BREAKER_ADDRESS: string;
  OPERATOR_SIGNER_KEY_FILE?: string;
  PRIVATE_KEY?: string;
  FORWARDER_CONTRACT?: string;
  RELAYER_SIGNER_KEY_FILE?: string;
  RELAYER_PRIVATE_KEY?: string;
  AETHEL_USD_PRICE?: number;
  KYC_PROVIDER: KycProvider;
  SUMSUB_APP_TOKEN?: string;
  SUMSUB_SECRET_KEY?: string;
  SUMSUB_WEBHOOK_SECRET?: string;
}

let cachedEnv: ApiRuntimeEnv | null = null;

function normalizeSiweDomain(rawDomain: string): string {
  const trimmed = rawDomain.trim();

  if (trimmed.includes("://")) {
    const parsed = new URL(trimmed);
    return parsed.host.toLowerCase();
  }

  return trimmed.toLowerCase();
}

function ensurePostgresConnectionString(databaseUrl: string): void {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }
}

function parseWalletList(value: string, name: string): string[] {
  const wallets = value
    .split(",")
    .map((wallet) => wallet.trim().toLowerCase())
    .filter(Boolean);
  for (const wallet of wallets) {
    AddressSchema.parse(wallet);
  }
  if (name === "ADMIN_WALLETS" && wallets.length === 0) {
    throw new Error(
      "ADMIN_WALLETS must contain at least one governance wallet",
    );
  }
  return [...new Set(wallets)];
}

function isPrivateDatabaseHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "postgres" ||
    hostname.endsWith(".internal")
  );
}

function parseRawApiRuntimeEnv() {
  const result = RawApiRuntimeEnvSchema.safeParse(process.env);
  if (result.success) {
    return result.data;
  }

  /*
   * Report WHICH variables failed, and how.
   *
   * This previously joined `issue.message` alone, so ten problems rendered as
   * "Required; Required; Required; Expected number, received nan; ..." — a
   * string that says something is wrong ten times and never once says what.
   * `issue.path` holds the variable name and was being discarded.
   *
   * Missing and malformed are separated because the remedies differ: one needs
   * a value supplied, the other needs an existing value corrected.
   */
  const missing: string[] = [];
  const invalid: string[] = [];
  for (const issue of result.error.issues) {
    const name = issue.path.join(".") || "(root)";
    if (issue.code === "invalid_type" && issue.received === "undefined") {
      missing.push(name);
    } else {
      const actual =
        name in process.env
          ? ` (received ${JSON.stringify(process.env[name])})`
          : "";
      invalid.push(`${name}: ${issue.message}${actual}`);
    }
  }

  const lines = ["Invalid API runtime environment."];
  if (missing.length > 0) {
    lines.push(
      "",
      `  Not set (${missing.length}):`,
      ...missing.map((name) => `    ${name}`),
    );
  }
  if (invalid.length > 0) {
    lines.push(
      "",
      `  Set but not usable (${invalid.length}):`,
      ...invalid.map((entry) => `    ${entry}`),
    );
  }
  lines.push(
    "",
    "  These are read from the process environment. Supply them via the",
    "  API's env file or your process manager before starting.",
  );
  throw new Error(lines.join("\n"));
}

export function getApiRuntimeEnv(): ApiRuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const rawEnv = parseRawApiRuntimeEnv();
  ensurePostgresConnectionString(rawEnv.DATABASE_URL);

  const deploymentProfile =
    rawEnv.NODE_ENV === "production"
      ? (rawEnv.TERRAQURA_DEPLOYMENT_PROFILE ?? "production")
      : "development";
  if (
    rawEnv.TERRAQURA_DEPLOYMENT_PROFILE === "public-testnet-evaluation" &&
    rawEnv.NODE_ENV !== "production"
  ) {
    throw new Error(
      "TERRAQURA_DEPLOYMENT_PROFILE=public-testnet-evaluation requires NODE_ENV=production",
    );
  }

  const normalizedSiweDomain = normalizeSiweDomain(rawEnv.SIWE_DOMAIN);
  const databaseHost = new URL(rawEnv.DATABASE_URL).hostname;
  const rpcPolicy = resolvePublicTestnetRpcPolicy({
    production: rawEnv.NODE_ENV === "production",
    publicTestnetEvaluation: deploymentProfile === "public-testnet-evaluation",
    rpcUrl: rawEnv.AETHELRED_RPC_URL,
    chainId: rawEnv.CHAIN_ID,
    acknowledgement: rawEnv.ALLOW_INSECURE_TESTNET_RPC,
    anchorBlock: rawEnv.AETHELRED_NETWORK_ANCHOR_BLOCK,
    anchorHash: rawEnv.AETHELRED_NETWORK_ANCHOR_HASH,
  });

  if (
    rawEnv.NODE_ENV === "production" &&
    rawEnv.DATABASE_SSL_MODE === "disable" &&
    !isPrivateDatabaseHost(databaseHost)
  ) {
    throw new Error(
      "DATABASE_SSL_MODE=disable is allowed only for a private in-stack database",
    );
  }

  if (rawEnv.NODE_ENV === "production") {
    if (deploymentProfile === "production" && !rawEnv.AETHELRED_EXPLORER_URL) {
      throw new Error(
        "AETHELRED_EXPLORER_URL must be configured for the production profile",
      );
    }
    if (rawEnv.AETHELRED_EXPLORER_URL) {
      HttpsUrlSchema.parse(rawEnv.AETHELRED_EXPLORER_URL);
    }

    if (rawEnv.PRIVATE_KEY) {
      throw new Error(
        "PRIVATE_KEY is not accepted in production; mount OPERATOR_SIGNER_KEY_FILE as a runtime secret",
      );
    }
    if (!rawEnv.OPERATOR_SIGNER_KEY_FILE) {
      throw new Error(
        "OPERATOR_SIGNER_KEY_FILE must be configured in production",
      );
    }
    if (rawEnv.RELAYER_PRIVATE_KEY) {
      throw new Error(
        "RELAYER_PRIVATE_KEY is not accepted in production; mount RELAYER_SIGNER_KEY_FILE as a runtime secret",
      );
    }
    if (rawEnv.FORWARDER_CONTRACT && !rawEnv.RELAYER_SIGNER_KEY_FILE) {
      throw new Error(
        "RELAYER_SIGNER_KEY_FILE is required when the gasless forwarder is enabled in production",
      );
    }
    if (!rawEnv.ADMIN_WALLETS.trim()) {
      throw new Error("ADMIN_WALLETS must be configured in production");
    }
    if (
      deploymentProfile === "production" &&
      rawEnv.KYC_PROVIDER === "disabled"
    ) {
      throw new Error("KYC_PROVIDER cannot be disabled in production");
    }
  }

  if (rawEnv.KYC_PROVIDER === "sumsub") {
    if (
      !rawEnv.SUMSUB_APP_TOKEN ||
      !rawEnv.SUMSUB_SECRET_KEY ||
      !rawEnv.SUMSUB_WEBHOOK_SECRET
    ) {
      throw new Error(
        "SUMSUB_APP_TOKEN, SUMSUB_SECRET_KEY, and SUMSUB_WEBHOOK_SECRET must be configured when KYC_PROVIDER=sumsub",
      );
    }
  }

  cachedEnv = {
    NODE_ENV: rawEnv.NODE_ENV,
    TERRAQURA_DEPLOYMENT_PROFILE: deploymentProfile,
    DATABASE_URL: rawEnv.DATABASE_URL,
    DATABASE_SSL_MODE: rawEnv.DATABASE_SSL_MODE,
    JWT_SECRET: rawEnv.JWT_SECRET,
    SIWE_DOMAIN: normalizedSiweDomain,
    ADMIN_WALLETS:
      rawEnv.NODE_ENV === "production" || rawEnv.ADMIN_WALLETS.trim()
        ? parseWalletList(rawEnv.ADMIN_WALLETS, "ADMIN_WALLETS")
        : [],
    AUDITOR_WALLETS: rawEnv.AUDITOR_WALLETS.trim()
      ? parseWalletList(rawEnv.AUDITOR_WALLETS, "AUDITOR_WALLETS")
      : [],
    CHAIN_ID: rawEnv.CHAIN_ID,
    AETHELRED_RPC_URL: rawEnv.AETHELRED_RPC_URL,
    AETHELRED_EXPLORER_URL:
      rawEnv.AETHELRED_EXPLORER_URL?.replace(/\/+$/, "") ?? "",
    RPC_TRANSPORT: rpcPolicy.transport,
    AETHELRED_NETWORK_ANCHOR_BLOCK: rpcPolicy.anchor?.blockNumber,
    AETHELRED_NETWORK_ANCHOR_HASH: rpcPolicy.anchor?.blockHash,
    ACCESS_CONTROL_ADDRESS: rawEnv.ACCESS_CONTROL_ADDRESS,
    VERIFICATION_ENGINE_ADDRESS: rawEnv.VERIFICATION_ENGINE_ADDRESS,
    CARBON_CREDIT_ADDRESS: rawEnv.CARBON_CREDIT_ADDRESS,
    CARBON_MARKETPLACE_ADDRESS: rawEnv.CARBON_MARKETPLACE_ADDRESS,
    CIRCUIT_BREAKER_ADDRESS: rawEnv.CIRCUIT_BREAKER_ADDRESS,
    OPERATOR_SIGNER_KEY_FILE: rawEnv.OPERATOR_SIGNER_KEY_FILE,
    PRIVATE_KEY: rawEnv.PRIVATE_KEY,
    FORWARDER_CONTRACT: rawEnv.FORWARDER_CONTRACT,
    RELAYER_SIGNER_KEY_FILE: rawEnv.RELAYER_SIGNER_KEY_FILE,
    RELAYER_PRIVATE_KEY: rawEnv.RELAYER_PRIVATE_KEY,
    AETHEL_USD_PRICE: rawEnv.AETHEL_USD_PRICE,
    KYC_PROVIDER: rawEnv.KYC_PROVIDER,
    SUMSUB_APP_TOKEN: rawEnv.SUMSUB_APP_TOKEN,
    SUMSUB_SECRET_KEY: rawEnv.SUMSUB_SECRET_KEY,
    SUMSUB_WEBHOOK_SECRET: rawEnv.SUMSUB_WEBHOOK_SECRET,
  };

  return cachedEnv;
}
