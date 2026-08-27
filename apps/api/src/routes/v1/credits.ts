import { randomUUID } from "node:crypto";

import {
  CreditStatus,
  DACStatus,
  ProvenanceEvent,
  VerificationStatus,
} from "@terraqura/types";
import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { z } from "zod";

import {
  ensureApprovedKyc,
  getAuthenticatedAddress,
  isAdmin,
} from "../../lib/auth-context.js";
import {
  bearerAuthRateLimit,
  verifyBearerAuth,
} from "../../lib/bearer-auth.js";
import {
  CREDITS_STORE_KEY,
  DEFAULT_CREDITS_STATE,
  type StoredCredit,
} from "../../lib/carbon-state.js";
import { mutateState, readState } from "../../lib/state-store.js";
import {
  getExplorerTxLink,
  mintVerifiedCreditsOnChain,
  verifyRetirementOnChain,
} from "../../services/blockchain/contracts.js";

const IpfsCidSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^ipfs:\/\//i, ""))
  .refine(
    (value) =>
      /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(value) ||
      /^b[a-z2-7]{20,}$/.test(value),
    "ipfsMetadataCid must be a valid CIDv0 or base32 CIDv1",
  );

const MintCreditsSchema = z.object({
  verificationId: z.string().min(1),
  recipientWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  ipfsMetadataCid: IpfsCidSchema,
  arweaveTxId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
});

const RetireCreditsSchema = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(500),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

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
      avgPurity?: number | null;
      completedAt: string | null;
    }
  >;
}

interface StoredDacUnit {
  id: string;
  unitId: string;
  operatorWallet: string;
  status: DACStatus;
  latitude: number;
  longitude: number;
  gridIntensityGco2PerKwh: number | null;
}

interface DacUnitsState {
  units: Record<string, StoredDacUnit>;
}

const VERIFICATIONS_STORE_KEY = "verification:v1";
const DEFAULT_VERIFICATIONS_STATE: VerificationsState = {
  verifications: {},
};
const DAC_UNITS_STORE_KEY = "dac-units:v1";
const DEFAULT_DAC_UNITS_STATE: DacUnitsState = {
  units: {},
};

function normalizeIpfsMetadataUri(value: string): string {
  return value.startsWith("ipfs://") ? value : `ipfs://${value}`;
}

export async function creditsRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
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
                    dacUnitId: { type: "string" },
                    co2CapturedKg: { type: "number" },
                    creditsIssued: { type: "number" },
                    escrowedAmount: { type: "number" },
                    retiredAmount: { type: "number" },
                    verificationStatus: { type: "string" },
                    isRetired: { type: "boolean" },
                    mintTxHash: { type: "string", nullable: true },
                    currentOwnerWallet: { type: "string", nullable: true },
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
        credits = credits.filter(
          (credit) => credit.currentOwnerId === query.ownerId,
        );
      }

      if (query.status) {
        credits = credits.filter(
          (credit) => credit.verificationStatus === query.status,
        );
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
          dacUnitId: credit.dacUnitId,
          co2CapturedKg: credit.co2CapturedKg,
          creditsIssued: credit.creditsIssued,
          escrowedAmount: credit.escrowedAmount ?? 0,
          retiredAmount: credit.retiredAmount,
          verificationStatus: credit.verificationStatus,
          isRetired: credit.isRetired,
          mintTxHash: credit.mintTxHash,
          currentOwnerWallet: credit.currentOwnerWallet,
        })),
        pagination: {
          total,
          limit,
          offset,
        },
      };
    },
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Credits"],
        summary: "Get credit details",
        description:
          "Returns detailed information about a carbon credit with provenance",
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
                  escrowedAmount: { type: "number" },
                  initialCreditsIssued: { type: "number" },
                  retiredAmount: { type: "number" },
                  efficiencyFactor: { type: "number" },
                  verificationStatus: { type: "string" },
                  sourceDataHash: { type: "string" },
                  mintTxHash: { type: "string", nullable: true },
                  ipfsMetadataCid: { type: "string", nullable: true },
                  currentOwnerWallet: { type: "string", nullable: true },
                  isRetired: { type: "boolean" },
                  retiredAt: { type: "string", nullable: true },
                  retirementReason: { type: "string", nullable: true },
                  retirementTxHash: { type: "string", nullable: true },
                  retirementTxHashes: {
                    type: "array",
                    items: { type: "string" },
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

      return {
        success: true,
        data: {
          ...credit,
          captureStartTime: credit.captureStartTime,
          captureEndTime: credit.captureEndTime,
        },
      };
    },
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
            creditsIssued:
              credit.initialCreditsIssued ??
              credit.creditsIssued + credit.retiredAmount,
          },
        },
      ];

      if ((credit.isRetired || credit.retiredAmount > 0) && credit.retiredAt) {
        timeline.push({
          type: "RETIRED",
          timestamp: new Date(credit.retiredAt),
          txHash: credit.retirementTxHash ?? null,
          details: {
            reason: credit.retirementReason,
            amount: credit.retiredAmount,
          },
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
    },
  );

  fastify.post(
    "/mint",
    {
      schema: {
        tags: ["Credits"],
        summary: "Mint verified credits",
        description:
          "Mint carbon credits to the blockchain after successful verification",
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
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          503: {
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

      if (
        !ensureApprovedKyc(request, reply, {
          message: "Approved KYC is required before minting credits",
        })
      ) {
        return;
      }

      const callerIsAdmin = isAdmin(request);
      const recipientWallet = body.recipientWallet.toLowerCase();
      if (!callerIsAdmin && recipientWallet !== callerWallet) {
        return reply.status(403).send({
          success: false,
          error: "Recipient wallet must match authenticated wallet",
        });
      }

      const verificationsState = await readState(
        VERIFICATIONS_STORE_KEY,
        DEFAULT_VERIFICATIONS_STATE,
      );
      const verification =
        verificationsState.verifications[body.verificationId];
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
      const dacUnitsState = await readState(
        DAC_UNITS_STORE_KEY,
        DEFAULT_DAC_UNITS_STATE,
      );
      const dacUnit = dacUnitsState.units[verification.dacUnitId];
      if (!dacUnit) {
        return reply.status(404).send({
          success: false,
          error: "DAC unit not found for verification",
        });
      }

      if (dacUnit.status !== DACStatus.ACTIVE) {
        return reply.status(409).send({
          success: false,
          error: "DAC unit must be active before minting credits",
        });
      }

      if (
        !callerIsAdmin &&
        dacUnit.operatorWallet.toLowerCase() !== callerWallet
      ) {
        return reply.status(403).send({
          success: false,
          error: "Only the DAC operator or an admin can mint credits",
        });
      }

      if (dacUnit.gridIntensityGco2PerKwh === null) {
        return reply.status(409).send({
          success: false,
          error: "DAC unit is missing verified grid intensity configuration",
        });
      }

      const avgPurity = Math.round(verification.avgPurity ?? 0);
      if (avgPurity <= 0 || avgPurity > 100) {
        return reply.status(409).send({
          success: false,
          error: "Verification is missing a valid average purity value",
        });
      }

      const reservationId = `pending:${randomUUID()}`;
      const reserved = await mutateState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE,
        async (state) => {
          if (state.verificationToCredit[body.verificationId]) {
            return false;
          }

          state.verificationToCredit[body.verificationId] = reservationId;
          return true;
        },
      );

      if (!reserved) {
        return reply.status(409).send({
          success: false,
          error: "Verification is already minted",
        });
      }

      let onChainMint: { txHash: string; tokenId: string; amount: number };
      try {
        onChainMint = await mintVerifiedCreditsOnChain({
          recipient: recipientWallet,
          dacUnitId: dacUnit.unitId ?? verification.dacUnitId,
          sourceDataHash: verification.sourceDataHash,
          captureTimestamp: Math.floor(
            new Date(verification.endTime).getTime() / 1000,
          ),
          co2AmountKg: Math.round(verification.totalCo2CapturedKg),
          energyConsumedKwh: Math.round(verification.totalEnergyKwh),
          latitude: Math.round(dacUnit.latitude),
          longitude: Math.round(dacUnit.longitude),
          purityPercentage: avgPurity,
          gridIntensityGco2PerKwh: dacUnit.gridIntensityGco2PerKwh,
          metadataUri: normalizeIpfsMetadataUri(body.ipfsMetadataCid),
          arweaveBackupTxId: body.arweaveTxId || null,
        });
      } catch (error) {
        request.log.error(
          { err: error, verificationId: verification.id },
          "Failed to mint credits on-chain",
        );
        await mutateState(
          CREDITS_STORE_KEY,
          DEFAULT_CREDITS_STATE,
          async (state) => {
            if (
              state.verificationToCredit[body.verificationId] === reservationId
            ) {
              delete state.verificationToCredit[body.verificationId];
            }
          },
        );

        return reply.status(503).send({
          success: false,
          error: "On-chain credit minting is unavailable",
        });
      }

      const mintedCredit = await mutateState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE,
        async (state) => {
          if (
            state.verificationToCredit[body.verificationId] !== reservationId
          ) {
            return null;
          }

          const nowIso = new Date().toISOString();
          const id = `cred_${randomUUID()}`;
          const credits = new Map(Object.entries(state.credits));

          const credit: StoredCredit = {
            id,
            tokenId: onChainMint.tokenId,
            verificationId: body.verificationId,
            dacUnitId: verification.dacUnitId,
            captureStartTime: verification.startTime,
            captureEndTime: verification.endTime,
            co2CapturedKg: verification.totalCo2CapturedKg,
            energyConsumedKwh: verification.totalEnergyKwh,
            creditsIssued: onChainMint.amount,
            escrowedAmount: 0,
            initialCreditsIssued: onChainMint.amount,
            retiredAmount: 0,
            sourceDataHash: verification.sourceDataHash,
            verificationStatus: CreditStatus.MINTED,
            efficiencyFactor: verification.efficiencyFactor ?? 10000,
            mintTxHash: onChainMint.txHash,
            ipfsMetadataCid: normalizeIpfsMetadataUri(body.ipfsMetadataCid),
            arweaveTxId: body.arweaveTxId || null,
            currentOwnerId: `user_${recipientWallet.slice(2, 10)}`,
            currentOwnerWallet: recipientWallet,
            isRetired: false,
            retiredAt: null,
            retirementReason: null,
            retirementTxHash: null,
            retirementTxHashes: [],
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          credits.set(id, credit);
          state.credits = Object.fromEntries(credits);
          state.verificationToCredit[body.verificationId] = id;
          return credit;
        },
      );

      if (!mintedCredit) {
        request.log.error(
          { verificationId: body.verificationId, txHash: onChainMint.txHash },
          "Credit minted on-chain but local state finalization failed",
        );
        return reply.status(500).send({
          success: false,
          error:
            "Credit was minted on-chain but local state synchronization failed",
        });
      }

      return reply.status(201).send({
        success: true,
        data: {
          creditId: mintedCredit.id,
          tokenId: mintedCredit.tokenId,
          txHash: mintedCredit.mintTxHash,
          creditsIssued: mintedCredit.creditsIssued,
          explorerUrl: getExplorerTxLink(mintedCredit.mintTxHash ?? ""),
        },
      });
    },
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
          required: ["amount", "reason", "txHash"],
          properties: {
            amount: { type: "integer" },
            reason: { type: "string" },
            txHash: { type: "string" },
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
                  remainingAmount: { type: "number" },
                  txHash: { type: "string" },
                  blockNumber: { type: "number" },
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
          409: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
          503: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
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

      if (
        !ensureApprovedKyc(request, reply, {
          message: "Approved KYC is required before retiring credits",
        })
      ) {
        return;
      }

      const creditsState = await readState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE,
      );
      const credit = new Map(Object.entries(creditsState.credits)).get(
        params.id,
      );
      if (!credit) {
        return reply.status(404).send({
          success: false,
          error: "Credit not found",
        });
      }

      if (credit.isRetired) {
        return reply.status(400).send({
          success: false,
          error: "Credit already retired",
        });
      }

      const ownedByCaller =
        credit.currentOwnerWallet?.toLowerCase() === callerWallet;
      if (!ownedByCaller) {
        return reply.status(403).send({
          success: false,
          error: "Only the credit owner can retire credits",
        });
      }

      if (body.amount > credit.creditsIssued) {
        return reply.status(400).send({
          success: false,
          error: "Retire amount exceeds available credit balance",
        });
      }

      const submittedTxHash = body.txHash.toLowerCase();
      const previouslyFinalizedHashes = new Set(
        [
          ...(credit.retirementTxHashes ?? []),
          ...(credit.retirementTxHash ? [credit.retirementTxHash] : []),
        ].map((txHash) => txHash.toLowerCase()),
      );
      if (previouslyFinalizedHashes.has(submittedTxHash)) {
        return reply.status(409).send({
          success: false,
          error: "Retirement transaction has already been finalized",
        });
      }

      let confirmedRetirement: { txHash: string; blockNumber: number };
      try {
        confirmedRetirement = await verifyRetirementOnChain({
          txHash: body.txHash,
          tokenId: credit.tokenId,
          retiree: callerWallet,
          amount: body.amount,
          reason: body.reason,
        });
      } catch (error) {
        request.log.warn(
          { err: error, creditId: credit.id, txHash: body.txHash },
          "Wallet-signed retirement could not be verified",
        );
        return reply.status(409).send({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Retirement transaction could not be verified",
        });
      }

      const retiredAt = new Date().toISOString();
      const updatedCredit = await mutateState(
        CREDITS_STORE_KEY,
        DEFAULT_CREDITS_STATE,
        async (state) => {
          const credits = new Map(Object.entries(state.credits));
          const stored = credits.get(params.id);
          if (!stored) {
            return null;
          }

          const knownRetirementHashes =
            stored.retirementTxHashes ??
            (stored.retirementTxHash ? [stored.retirementTxHash] : []);
          const finalizedHashes = new Set(
            knownRetirementHashes.map((txHash) => txHash.toLowerCase()),
          );
          if (finalizedHashes.has(confirmedRetirement.txHash.toLowerCase())) {
            return null;
          }
          if (body.amount > stored.creditsIssued) {
            return null;
          }

          stored.creditsIssued -= body.amount;
          stored.retiredAmount += body.amount;
          stored.isRetired =
            stored.creditsIssued === 0 && (stored.escrowedAmount ?? 0) === 0;
          stored.verificationStatus = stored.isRetired
            ? CreditStatus.RETIRED
            : CreditStatus.MINTED;
          stored.retiredAt = retiredAt;
          stored.retirementReason = body.reason;
          stored.retirementTxHashes = [
            ...knownRetirementHashes,
            confirmedRetirement.txHash,
          ];
          stored.retirementTxHash = confirmedRetirement.txHash;
          stored.updatedAt = retiredAt;
          credits.set(params.id, stored);
          state.credits = Object.fromEntries(credits);
          return stored;
        },
      );

      if (!updatedCredit) {
        return reply.status(409).send({
          success: false,
          error: "Credit balance changed before retirement was finalized",
        });
      }

      return {
        success: true,
        data: {
          creditId: updatedCredit.id,
          amountRetired: body.amount,
          remainingAmount: updatedCredit.creditsIssued,
          txHash: confirmedRetirement.txHash,
          blockNumber: confirmedRetirement.blockNumber,
          retiredAt,
          certificateUrl: `/v1/credits/${updatedCredit.id}/provenance`,
        },
      };
    },
  );
}
