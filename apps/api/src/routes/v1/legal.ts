import {
  TERRAQURA_TERMS_HASH,
  TERRAQURA_TERMS_VERSION,
  buildTermsAcceptanceMessage,
} from "@terraqura/types";
import { getAddress, verifyMessage } from "ethers";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { mutateState, readState } from "../../lib/state-store.js";

const ACCEPTANCE_WINDOW_MS = 10 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 60 * 1000;
const STORE_KEY = "legal-terms-acceptances:v1";

interface StoredAcceptance {
  walletAddress: string;
  version: string;
  termsHash: string;
  signature: string;
  message: string;
  acceptedAt: string;
  recordedAt: string;
}

interface LegalAcceptanceState {
  acceptances: Record<string, StoredAcceptance>;
}

const EMPTY_STATE: LegalAcceptanceState = { acceptances: {} };

const AcceptanceBodySchema = z.object({
  walletAddress: z.string().trim(),
  signature: z.string().regex(/^0x[0-9a-fA-F]+$/),
  message: z.string().min(1).max(2_000),
  version: z.literal(TERRAQURA_TERMS_VERSION),
  termsHash: z.literal(TERRAQURA_TERMS_HASH),
  acceptedAt: z.string().datetime({ offset: true }),
});

const AcceptanceParamsSchema = z.object({
  walletAddress: z.string().trim(),
});

function normalizeWalletAddress(walletAddress: string): string {
  return getAddress(walletAddress).toLowerCase();
}

function validateAcceptanceTimestamp(acceptedAt: string): void {
  const acceptedAtMs = Date.parse(acceptedAt);
  const now = Date.now();
  if (
    !Number.isFinite(acceptedAtMs) ||
    acceptedAtMs < now - ACCEPTANCE_WINDOW_MS ||
    acceptedAtMs > now + FUTURE_CLOCK_SKEW_MS
  ) {
    throw new Error("Terms acceptance timestamp is outside the allowed window");
  }
}

export async function legalRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  fastify.get(
    "/acceptance/:walletAddress",
    {
      schema: {
        tags: ["Legal"],
        summary: "Check the current terms acceptance for a wallet",
        params: {
          type: "object",
          required: ["walletAddress"],
          properties: {
            walletAddress: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = AcceptanceParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_WALLET", message: "Invalid wallet address" },
        });
      }

      let walletAddress: string;
      try {
        walletAddress = normalizeWalletAddress(parsed.data.walletAddress);
      } catch {
        return reply.status(400).send({
          success: false,
          error: { code: "INVALID_WALLET", message: "Invalid wallet address" },
        });
      }

      const state = await readState(STORE_KEY, EMPTY_STATE);
      const acceptance = state.acceptances[walletAddress];
      const accepted =
        acceptance?.version === TERRAQURA_TERMS_VERSION &&
        acceptance.termsHash === TERRAQURA_TERMS_HASH;

      return {
        success: true,
        data: {
          accepted,
          version: TERRAQURA_TERMS_VERSION,
          termsHash: TERRAQURA_TERMS_HASH,
          acceptedAt: accepted ? acceptance.acceptedAt : null,
        },
      };
    },
  );

  fastify.post(
    "/accept-terms",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        tags: ["Legal"],
        summary: "Record a wallet-signed acceptance of the current terms",
        body: {
          type: "object",
          required: [
            "walletAddress",
            "signature",
            "message",
            "version",
            "termsHash",
            "acceptedAt",
          ],
          properties: {
            walletAddress: { type: "string" },
            signature: { type: "string" },
            message: { type: "string" },
            version: { type: "string" },
            termsHash: { type: "string" },
            acceptedAt: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = AcceptanceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_ACCEPTANCE",
            message: "Terms acceptance payload is invalid",
          },
        });
      }

      let walletAddress: string;
      try {
        walletAddress = normalizeWalletAddress(parsed.data.walletAddress);
        validateAcceptanceTimestamp(parsed.data.acceptedAt);
      } catch (error) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "INVALID_ACCEPTANCE",
            message:
              error instanceof Error
                ? error.message
                : "Terms acceptance payload is invalid",
          },
        });
      }

      const expectedMessage = buildTermsAcceptanceMessage(
        parsed.data.walletAddress,
        parsed.data.acceptedAt,
      );
      if (parsed.data.message !== expectedMessage) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "MESSAGE_MISMATCH",
            message:
              "Signed terms message does not match the submitted acceptance",
          },
        });
      }

      let recoveredAddress: string;
      try {
        recoveredAddress = normalizeWalletAddress(
          verifyMessage(parsed.data.message, parsed.data.signature),
        );
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: "INVALID_SIGNATURE",
            message: "Terms acceptance signature is invalid",
          },
        });
      }

      if (recoveredAddress !== walletAddress) {
        return reply.status(401).send({
          success: false,
          error: {
            code: "SIGNER_MISMATCH",
            message: "Terms acceptance was not signed by the submitted wallet",
          },
        });
      }

      const storedAcceptance: StoredAcceptance = {
        walletAddress,
        version: parsed.data.version,
        termsHash: parsed.data.termsHash,
        signature: parsed.data.signature,
        message: parsed.data.message,
        acceptedAt: parsed.data.acceptedAt,
        recordedAt: new Date().toISOString(),
      };

      await mutateState(STORE_KEY, EMPTY_STATE, (state) => {
        state.acceptances[walletAddress] = storedAcceptance;
      });

      return reply.status(201).send({
        success: true,
        data: {
          accepted: true,
          walletAddress,
          version: storedAcceptance.version,
          termsHash: storedAcceptance.termsHash,
          acceptedAt: storedAcceptance.acceptedAt,
        },
      });
    },
  );
}
