import { afterEach, describe, expect, it, vi } from "vitest";

const requiredEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://terraqura:test@postgres:5432/terraqura",
  DATABASE_SSL_MODE: "disable",
  JWT_SECRET: "test-jwt-secret-with-at-least-32-characters",
  SIWE_DOMAIN: "terraqura.example",
  ADMIN_WALLETS: "0x1111111111111111111111111111111111111111",
  AUDITOR_WALLETS: "",
  CHAIN_ID: "7332",
  AETHELRED_RPC_URL: "https://rpc.terraqura.example",
  AETHELRED_EXPLORER_URL: "https://explorer.terraqura.example",
  ACCESS_CONTROL_ADDRESS: "0x1111111111111111111111111111111111111111",
  VERIFICATION_ENGINE_ADDRESS: "0x2222222222222222222222222222222222222222",
  CARBON_CREDIT_ADDRESS: "0x3333333333333333333333333333333333333333",
  CARBON_MARKETPLACE_ADDRESS: "0x4444444444444444444444444444444444444444",
  CIRCUIT_BREAKER_ADDRESS: "0x5555555555555555555555555555555555555555",
  OPERATOR_SIGNER_KEY_FILE: "/run/secrets/terraqura_operator_signer",
  KYC_PROVIDER: "sumsub",
  SUMSUB_APP_TOKEN: "test-token",
  SUMSUB_SECRET_KEY: "test-secret",
  SUMSUB_WEBHOOK_SECRET: "test-webhook-secret-with-at-least-32-characters",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API runtime environment", () => {
  it("normalizes disabled optional integrations to undefined", async () => {
    for (const [name, value] of Object.entries(requiredEnvironment)) {
      vi.stubEnv(name, value);
    }
    vi.stubEnv("FORWARDER_CONTRACT", "");
    vi.stubEnv("RELAYER_SIGNER_KEY_FILE", "");
    vi.stubEnv("RELAYER_PRIVATE_KEY", "");
    vi.stubEnv("AETHEL_USD_PRICE", "");
    vi.stubEnv("PRIVATE_KEY", "");

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    const environment = getApiRuntimeEnv();

    expect(environment.FORWARDER_CONTRACT).toBeUndefined();
    expect(environment.RELAYER_SIGNER_KEY_FILE).toBeUndefined();
    expect(environment.RELAYER_PRIVATE_KEY).toBeUndefined();
    expect(environment.AETHEL_USD_PRICE).toBeUndefined();
    expect(environment.PRIVATE_KEY).toBeUndefined();
  });
});
