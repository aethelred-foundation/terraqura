import {
  TERRAQURA_TERMS_HASH,
  TERRAQURA_TERMS_VERSION,
  buildTermsAcceptanceMessage,
} from "@terraqura/types";
import { Wallet } from "ethers";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestServer, resetStateStore } from "../../../test/helpers.js";

describe("legal acceptance routes", () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = await createTestServer();
  });

  beforeEach(() => {
    resetStateStore();
  });

  afterAll(async () => {
    await server?.close();
  });

  async function createAcceptance(
    wallet: Wallet,
    acceptedAt = new Date().toISOString(),
  ) {
    const message = buildTermsAcceptanceMessage(wallet.address, acceptedAt);
    return {
      walletAddress: wallet.address,
      signature: await wallet.signMessage(message),
      message,
      version: TERRAQURA_TERMS_VERSION,
      termsHash: TERRAQURA_TERMS_HASH,
      acceptedAt,
    };
  }

  it("records and returns a wallet-signed acceptance", async () => {
    const wallet = Wallet.createRandom();
    const acceptance = await createAcceptance(wallet);

    const response = await server.inject({
      method: "POST",
      url: "/v1/legal/accept-terms",
      payload: acceptance,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      success: true,
      data: {
        accepted: true,
        walletAddress: wallet.address.toLowerCase(),
        version: TERRAQURA_TERMS_VERSION,
        termsHash: TERRAQURA_TERMS_HASH,
      },
    });

    const status = await server.inject({
      method: "GET",
      url: `/v1/legal/acceptance/${wallet.address}`,
    });
    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({
      success: true,
      data: {
        accepted: true,
        version: TERRAQURA_TERMS_VERSION,
        termsHash: TERRAQURA_TERMS_HASH,
        acceptedAt: acceptance.acceptedAt,
      },
    });
  });

  it("rejects an acceptance signed by a different wallet", async () => {
    const submittedWallet = Wallet.createRandom();
    const signingWallet = Wallet.createRandom();
    const acceptedAt = new Date().toISOString();
    const message = buildTermsAcceptanceMessage(
      submittedWallet.address,
      acceptedAt,
    );

    const response = await server.inject({
      method: "POST",
      url: "/v1/legal/accept-terms",
      payload: {
        walletAddress: submittedWallet.address,
        signature: await signingWallet.signMessage(message),
        message,
        version: TERRAQURA_TERMS_VERSION,
        termsHash: TERRAQURA_TERMS_HASH,
        acceptedAt,
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: "SIGNER_MISMATCH" },
    });
  });

  it("rejects stale and altered acceptance messages", async () => {
    const wallet = Wallet.createRandom();
    const staleAcceptance = await createAcceptance(
      wallet,
      new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    );

    const staleResponse = await server.inject({
      method: "POST",
      url: "/v1/legal/accept-terms",
      payload: staleAcceptance,
    });
    expect(staleResponse.statusCode).toBe(400);

    const currentAcceptance = await createAcceptance(wallet);
    const alteredResponse = await server.inject({
      method: "POST",
      url: "/v1/legal/accept-terms",
      payload: {
        ...currentAcceptance,
        message: `${currentAcceptance.message}\nAltered`,
      },
    });
    expect(alteredResponse.statusCode).toBe(400);
    expect(alteredResponse.json()).toMatchObject({
      success: false,
      error: { code: "MESSAGE_MISMATCH" },
    });
  });
});
