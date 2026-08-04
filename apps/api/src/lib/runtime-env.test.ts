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

function stubEnvironment(overrides: Record<string, string> = {}): void {
  for (const [name, value] of Object.entries({
    ...requiredEnvironment,
    ...overrides,
  })) {
    vi.stubEnv(name, value);
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("API runtime environment", () => {
  it("normalizes disabled optional integrations to undefined", async () => {
    stubEnvironment();
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
    expect(environment.RPC_TRANSPORT).toBe("https");
  });

  it("accepts only the anchored evaluation profile for production HTTP RPC", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
      AETHELRED_RPC_URL: "http://54.165.44.130:8545",
      ALLOW_INSECURE_TESTNET_RPC: "acknowledge-evaluation-only-plaintext-rpc",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
      AETHELRED_NETWORK_ANCHOR_HASH:
        "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    const environment = getApiRuntimeEnv();

    expect(environment.RPC_TRANSPORT).toBe("evaluation-http");
    expect(environment.AETHELRED_NETWORK_ANCHOR_BLOCK).toBe(450000);
  });

  it("rejects plaintext RPC in the production profile", async () => {
    stubEnvironment({
      AETHELRED_RPC_URL: "http://54.165.44.130:8545",
      ALLOW_INSECURE_TESTNET_RPC: "acknowledge-evaluation-only-plaintext-rpc",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
      AETHELRED_NETWORK_ANCHOR_HASH:
        "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "only for the explicit public-testnet evaluation profile",
    );
  });

  it("restricts the evaluation profile to anchored public-testnet identity even over HTTPS", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
      CHAIN_ID: "1",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
      AETHELRED_NETWORK_ANCHOR_HASH:
        "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "public-testnet evaluation profile is restricted to chain ID 7332",
    );
  });

  it("requires an anchor for the evaluation profile even over HTTPS", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "public-testnet evaluation profile requires AETHELRED_NETWORK_ANCHOR_BLOCK",
    );
  });

  it("rejects production HTTP RPC without the exact acknowledgement", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
      AETHELRED_RPC_URL: "http://54.165.44.130:8545",
      ALLOW_INSECURE_TESTNET_RPC: "true",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
      AETHELRED_NETWORK_ANCHOR_HASH:
        "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "acknowledge-evaluation-only-plaintext-rpc",
    );
  });

  it("rejects production HTTP RPC without an anchor", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
      AETHELRED_RPC_URL: "http://54.165.44.130:8545",
      ALLOW_INSECURE_TESTNET_RPC: "acknowledge-evaluation-only-plaintext-rpc",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "",
      AETHELRED_NETWORK_ANCHOR_HASH: "",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "requires AETHELRED_NETWORK_ANCHOR_BLOCK",
    );
  });

  it("allows the explicit evaluation profile to disable KYC and omit an explorer", async () => {
    stubEnvironment({
      TERRAQURA_DEPLOYMENT_PROFILE: "public-testnet-evaluation",
      AETHELRED_RPC_URL: "http://54.165.44.130:8545",
      AETHELRED_EXPLORER_URL: "",
      ALLOW_INSECURE_TESTNET_RPC: "acknowledge-evaluation-only-plaintext-rpc",
      AETHELRED_NETWORK_ANCHOR_BLOCK: "450000",
      AETHELRED_NETWORK_ANCHOR_HASH:
        "0x1057a62d12eed50d8740fcf51be0cd784db9a4f8f98c9312eee8b8bc7e543ddc",
      KYC_PROVIDER: "disabled",
      SUMSUB_APP_TOKEN: "",
      SUMSUB_SECRET_KEY: "",
      SUMSUB_WEBHOOK_SECRET: "",
    });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    const environment = getApiRuntimeEnv();

    expect(environment.TERRAQURA_DEPLOYMENT_PROFILE).toBe(
      "public-testnet-evaluation",
    );
    expect(environment.KYC_PROVIDER).toBe("disabled");
    expect(environment.AETHELRED_EXPLORER_URL).toBe("");
  });

  it("keeps disabled KYC forbidden in the production profile", async () => {
    stubEnvironment({ KYC_PROVIDER: "disabled" });

    const { getApiRuntimeEnv } = await import("./runtime-env.js");
    expect(() => getApiRuntimeEnv()).toThrow(
      "KYC_PROVIDER cannot be disabled in production",
    );
  });
});
