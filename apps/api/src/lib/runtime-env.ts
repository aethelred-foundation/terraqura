import { z } from "zod";

const KycProviderSchema = z.enum(["sumsub", "onfido", "disabled"]);

const RawApiRuntimeEnvSchema = z.object({
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL must be configured"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be configured and at least 32 characters"),
  SIWE_DOMAIN: z.string().trim().min(1, "SIWE_DOMAIN must be configured"),
  KYC_PROVIDER: KycProviderSchema.default("sumsub"),
  SUMSUB_APP_TOKEN: z.string().optional(),
  SUMSUB_SECRET_KEY: z.string().optional(),
  ONFIDO_API_TOKEN: z.string().optional(),
});

export type KycProvider = z.infer<typeof KycProviderSchema>;

export interface ApiRuntimeEnv {
  DATABASE_URL: string;
  JWT_SECRET: string;
  SIWE_DOMAIN: string;
  KYC_PROVIDER: KycProvider;
  SUMSUB_APP_TOKEN?: string;
  SUMSUB_SECRET_KEY?: string;
  ONFIDO_API_TOKEN?: string;
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

function parseRawApiRuntimeEnv() {
  const result = RawApiRuntimeEnvSchema.safeParse(process.env);
  if (result.success) {
    return result.data;
  }

  const issues = result.error.issues.map((issue) => issue.message).join("; ");
  throw new Error(`Invalid API runtime environment: ${issues}`);
}

export function getApiRuntimeEnv(): ApiRuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const rawEnv = parseRawApiRuntimeEnv();
  ensurePostgresConnectionString(rawEnv.DATABASE_URL);

  const normalizedSiweDomain = normalizeSiweDomain(rawEnv.SIWE_DOMAIN);

  if (rawEnv.KYC_PROVIDER === "sumsub") {
    if (!rawEnv.SUMSUB_APP_TOKEN || !rawEnv.SUMSUB_SECRET_KEY) {
      throw new Error(
        "SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be configured when KYC_PROVIDER=sumsub"
      );
    }
  }

  if (rawEnv.KYC_PROVIDER === "onfido" && !rawEnv.ONFIDO_API_TOKEN) {
    throw new Error(
      "ONFIDO_API_TOKEN must be configured when KYC_PROVIDER=onfido"
    );
  }

  cachedEnv = {
    DATABASE_URL: rawEnv.DATABASE_URL,
    JWT_SECRET: rawEnv.JWT_SECRET,
    SIWE_DOMAIN: normalizedSiweDomain,
    KYC_PROVIDER: rawEnv.KYC_PROVIDER,
    SUMSUB_APP_TOKEN: rawEnv.SUMSUB_APP_TOKEN,
    SUMSUB_SECRET_KEY: rawEnv.SUMSUB_SECRET_KEY,
    ONFIDO_API_TOKEN: rawEnv.ONFIDO_API_TOKEN,
  };

  return cachedEnv;
}
