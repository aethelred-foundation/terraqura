import { randomBytes } from "crypto";

import { CreditStatus, ProvenanceEvent, VerificationStatus } from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import { bearerAuthRateLimit, verifyBearerAuth } from "../../lib/bearer-auth.js";
import { mutateState, readState } from "../../lib/state-store.js";

const MintCreditsSchema = z.object({
  verificationId: z.string().min(1),
  recipientWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ipfsMetadataCid: z.string().min(1),
  arweaveTxId: z.string().optional(),
});

const RetireCreditsSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
});

interface StoredCredit {
  id: string;
  tokenId: string;
  verificationId: string;
  dacUnitId: string;
  captureStartTime: string;
  captureEndTime: string;
  co2CapturedKg: number;
  energyConsumedKwh: number;
  creditsIssued: number;
  initialCreditsIssued: number;
  retiredAmount: number;
  sourceDataHash: string;
  verificationStatus: CreditStatus;
  efficiencyFactor: number;
  mintTxHash: string | null;
  ipfsMetadataCid: string | null;
  arweaveTxId: string | null;
  currentOwnerId: string | null;
  currentOwnerWallet: string | null;
  isRetired: boolean;
  retiredAt: string | null;
  retirementReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CreditsState {
  credits: Record<string, StoredCredit>;
  verificationToCredit: Record<string, string>;
  nextTokenId: number;
}

interface VerificationsState {
  verifications: Record<
    string,
    {
      id: string;
      dacUnitId: string;
      startTime: string;
      endTime: string;
      status: VerificationStatus;
      sourceDataHash: string;
      efficiencyFactor: number | null;
      creditsToMint: number | null;
      totalCo2CapturedKg: number;
      totalEnergyKwh: number;
      completedAt: string | null;
    }
  >;
}

const CREDITS_STORE_KEY = "credits:v1";
const DEFAULT_CREDITS_STATE: CreditsState = {
  credits: {},
  verificationToCredit: {},
  nextTokenId: 1,
};
const VERIFICATIONS_STORE_KEY = "verification:v1";
const DEFAULT_VERIFICATIONS_STATE: VerificationsState = {
  verifications: {},
};

function getAuthenticatedAddress(request: { user?: unknown }): string | null {
  const user = request.user as { address?: string } | undefined;
  return typeof user?.address === "string" ? user.address.toLowerCase() : null;
}

function isAdmin(request: { user?: unknown }): boolean {
  const user = request.user as { userType?: string } | undefined;
  return user?.userType === "admin";
}

function generateTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function numberToTokenId(value: number): string {
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
}

export async function creditsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions
) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Credits"],
        summary: "List carbon credits",
        description: "Returns a list of carbon credits with filtering options",
        querystring: {
          type: "object",
          properties: {
            ownerId: { type: "string" },
            status: {
              type: "string",
              enum: ["pending", "verified", "minted", "retired"],
            },
            limit: { type: "integer", default: 50 },
            offset: { type: "integer", default: 0 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    tokenId: { type: "string" },
                    co2CapturedKg: { type: "number" },
                    creditsIssued: { type: "number" },
                    verificationStatus: { type: "string" },
                    isRetired: { type: "boolean" },
                    mintTxHash: { type: "string", nullable: true },
                  },
                },
              },
              pagination: {
                type: "object",
                properties: {
                  total: { type: "integer" },
                  limit: { type: "integer" },
                  offset: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
    async (request, _reply) => {
      const query = request.query as {
        ownerId?: string;
        status?: string;
        limit?: number;
        offset?: number;
      };

      const state = await readState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE);
      let credits = Object.values(state.credits);

      if (query.ownerId) {
        credits = credits.filter((credit) => credit.currentOwnerId === query.ownerId);
      }

      if (query.status) {
        credits = credits.filter((credit) => credit.verificationStatus === query.status);
      }

      const total = credits.length;
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      credits = credits.slice(offset, offset + limit);

      return {
        success: true,
        data: credits.map((credit) => ({
          id: credit.id,
          tokenId: credit.tokenId,
          co2CapturedKg: credit.co2CapturedKg,
          creditsIssued: credit.creditsIssued,
          verificationStatus: credit.verificationStatus,
          isRetired: credit.isRetired,
          mintTxHash: credit.mintTxHash,
        })),
        pagination: {
          total,
          limit,
          offset,
        },
      };
    }
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Credits"],
        summary: "Get credit details",
        description: "Returns detailed information about a carbon credit with provenance",
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  tokenId: { type: "string" },
                  dacUnitId: { type: "string" },
                  captureStartTime: { type: "string" },
                  captureEndTime: { type: "string" },
                  co2CapturedKg: { type: "number" },
                  energyConsumedKwh: { type: "number" },
                  creditsIssued: { type: "number" },
                  efficiencyFactor: { type: "number" },
                  verificationStatus: { type: "string" },
                  sourceDataHash: { type: "string" },
                  mintTxHash: { type: "string", nullable: true },
                  ipfsMetadataCid: { type: "string", nullable: true },
                  currentOwnerWallet: { type: "string", nullable: true },
                  isRetired: { type: "boolean" },
                  retirementReason: { type: "string", nullable: true },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const state = await readState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE);
      const credits = new Map(Object.entries(state.credits));
      const credit = credits.get(params.id);

      if (!credit) {
        return reply.status(404).send({
          success: false,
          error: "Credit not found",
        });
      }

      return {
        success: true,
        data: {
          ...credit,
          captureStartTime: credit.captureStartTime,
          captureEndTime: credit.captureEndTime,
        },
      };
    }
  );

  fastify.get(
    "/:id/provenance",
    {
      schema: {
        tags: ["Credits"],
        summary: "Get credit provenance",
        description: "Returns the full provenance timeline for a carbon credit",
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  creditId: { type: "string" },
                  timeline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string" },
                        timestamp: { type: "string" },
                        txHash: { type: "string", nullable: true },
                        details: { type: "object" },
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const state = await readState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE);
      const credits = new Map(Object.entries(state.credits));
      const credit = credits.get(params.id);

      if (!credit) {
        return reply.status(404).send({
          success: false,
          error: "Credit not found",
        });
      }

      const timeline: ProvenanceEvent[] = [
        {
          type: "CAPTURE_STARTED",
          timestamp: new Date(credit.captureStartTime),
          txHash: null,
          details: { dacUnitId: credit.dacUnitId },
        },
        {
          type: "CAPTURE_COMPLETED",
          timestamp: new Date(credit.captureEndTime),
          txHash: null,
          details: {
            co2CapturedKg: credit.co2CapturedKg,
            energyConsumedKwh: credit.energyConsumedKwh,
          },
        },
        {
          type: "MINTED",
          timestamp: new Date(credit.createdAt),
          txHash: credit.mintTxHash,
          details: {
            tokenId: credit.tokenId,
            creditsIssued: credit.creditsIssued,
          },
        },
      ];

      if (credit.isRetired && credit.retiredAt) {
        timeline.push({
          type: "RETIRED",
          timestamp: new Date(credit.retiredAt),
          txHash: null,
          details: { reason: credit.retirementReason },
        });
      }

      return {
        success: true,
        data: {
          creditId: credit.id,
          timeline: timeline.map((event) => ({
            type: event.type,
            timestamp: event.timestamp.toISOString(),
            txHash: event.txHash,
            details: event.details,
          })),
        },
      };
    }
  );

  fastify.post(
    "/mint",
    {
      schema: {
        tags: ["Credits"],
        summary: "Mint verified credits",
        description: "Mint carbon credits to the blockchain after successful verification",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["verificationId", "recipientWallet", "ipfsMetadataCid"],
          properties: {
            verificationId: { type: "string" },
            recipientWallet: { type: "string" },
            ipfsMetadataCid: { type: "string" },
            arweaveTxId: { type: "string" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  creditId: { type: "string" },
                  tokenId: { type: "string" },
                  txHash: { type: "string" },
                  creditsIssued: { type: "number" },
                  explorerUrl: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          409: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const body = MintCreditsSchema.parse(request.body);
      const callerWallet = getAuthenticatedAddress(request);
      if (!callerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const recipientWallet = body.recipientWallet.toLowerCase();
      if (!isAdmin(request) && recipientWallet !== callerWallet) {
        return reply.status(403).send({
          success: false,
          error: "Recipient wallet must match authenticated wallet",
        });
      }

      const verificationsState = await readState(
        VERIFICATIONS_STORE_KEY,
        DEFAULT_VERIFICATIONS_STATE
      );
      const verification = verificationsState.verifications[body.verificationId];
      if (!verification) {
        return reply.status(404).send({
          success: false,
          error: "Verification not found",
        });
      }

      if (verification.status !== VerificationStatus.PASSED) {
        return reply.status(400).send({
          success: false,
          error: "Verification must pass before minting",
        });
      }

      if (!verification.creditsToMint || verification.creditsToMint <= 0) {
        return reply.status(400).send({
          success: false,
          error: "Verification does not have mintable credits",
        });
      }
      const creditsToMint = verification.creditsToMint;

      const mintedCredit = await mutateState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE,
        async (state) => {
          const verificationToCredit = new Map(Object.entries(state.verificationToCredit));
          if (verificationToCredit.has(body.verificationId)) {
            return null;
          }

          const nowIso = new Date().toISOString();
          const id = `cred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const tokenId = numberToTokenId(state.nextTokenId);
          state.nextTokenId += 1;
          const txHash = generateTxHash();
          const credits = new Map(Object.entries(state.credits));

          const credit: StoredCredit = {
            id,
            tokenId,
            verificationId: body.verificationId,
            dacUnitId: verification.dacUnitId,
            captureStartTime: verification.startTime,
            captureEndTime: verification.endTime,
            co2CapturedKg: verification.totalCo2CapturedKg,
            energyConsumedKwh: verification.totalEnergyKwh,
            creditsIssued: creditsToMint,
            initialCreditsIssued: creditsToMint,
            retiredAmount: 0,
            sourceDataHash: verification.sourceDataHash,
            verificationStatus: CreditStatus.MINTED,
            efficiencyFactor: verification.efficiencyFactor ?? 10000,
            mintTxHash: txHash,
            ipfsMetadataCid: body.ipfsMetadataCid,
            arweaveTxId: body.arweaveTxId || null,
            currentOwnerId: `user_${recipientWallet.slice(2, 10)}`,
            currentOwnerWallet: recipientWallet,
            isRetired: false,
            retiredAt: null,
            retirementReason: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          credits.set(id, credit);
          verificationToCredit.set(body.verificationId, id);
          state.credits = Object.fromEntries(credits);
          state.verificationToCredit = Object.fromEntries(verificationToCredit);
          return credit;
        }
      );

      if (!mintedCredit) {
        return reply.status(409).send({
          success: false,
          error: "Verification is already minted",
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          creditId: mintedCredit.id,
          tokenId: mintedCredit.tokenId,
          txHash: mintedCredit.mintTxHash,
          creditsIssued: mintedCredit.creditsIssued,
          explorerUrl: `https://explorer.aethelred.network/tx/${mintedCredit.mintTxHash}`,
        },
      });
    }
  );

  fastify.post(
    "/:id/retire",
    {
      schema: {
        tags: ["Credits"],
        summary: "Retire carbon credits",
        description: "Permanently retire carbon credits for carbon offset",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          required: ["amount", "reason"],
          properties: {
            amount: { type: "number" },
            reason: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  creditId: { type: "string" },
                  amountRetired: { type: "number" },
                  txHash: { type: "string" },
                  retiredAt: { type: "string" },
                  certificateUrl: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          403: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = RetireCreditsSchema.parse(request.body);
      const callerWallet = getAuthenticatedAddress(request);
      if (!callerWallet) {
        return reply.status(401).send({
          success: false,
          error: "Missing authenticated wallet",
        });
      }

      const result = await mutateState(CREDITS_STORE_KEY, DEFAULT_CREDITS_STATE, async (state) => {
        const credits = new Map(Object.entries(state.credits));
        const credit = credits.get(params.id);
        if (!credit) {
          return { kind: "not_found" as const };
        }

        if (credit.isRetired) {
          return { kind: "already_retired" as const };
        }

        const ownedByCaller = credit.currentOwnerWallet?.toLowerCase() === callerWallet;
        if (!ownedByCaller && !isAdmin(request)) {
          return { kind: "forbidden" as const };
        }

        if (body.amount > credit.creditsIssued) {
          return { kind: "amount_too_large" as const };
        }

        const nowIso = new Date().toISOString();
        const txHash = generateTxHash();
        const remaining = credit.creditsIssued - body.amount;

        credit.creditsIssued = remaining;
        credit.retiredAmount += body.amount;
        credit.updatedAt = nowIso;
        if (remaining === 0) {
          credit.isRetired = true;
          credit.retiredAt = nowIso;
          credit.retirementReason = body.reason;
          credit.verificationStatus = CreditStatus.RETIRED;
        }

        credits.set(params.id, credit);
        state.credits = Object.fromEntries(credits);
        return {
          kind: "success" as const,
          credit,
          txHash,
          retiredAt: nowIso,
        };
      });

      if (result.kind === "not_found") {
        return reply.status(404).send({
          success: false,
          error: "Credit not found",
        });
      }

      if (result.kind === "already_retired") {
        return reply.status(400).send({
          success: false,
          error: "Credit already retired",
        });
      }

      if (result.kind === "forbidden") {
        return reply.status(403).send({
          success: false,
          error: "Only the credit owner or an admin can retire credits",
        });
      }

      if (result.kind === "amount_too_large") {
        return reply.status(400).send({
          success: false,
          error: "Retire amount exceeds available credit balance",
        });
      }

      return {
        success: true,
        data: {
          creditId: result.credit.id,
          amountRetired: body.amount,
          txHash: result.txHash,
          retiredAt: result.retiredAt,
          certificateUrl: `https://terraqura.io/certificates/${result.credit.id}`,
        },
      };
    }
  );
}
