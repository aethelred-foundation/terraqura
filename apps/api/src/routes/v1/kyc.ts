// TerraQura KYC Routes
// Enterprise-grade identity verification endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import {
  bearerAuthRateLimit,
  verifyBearerAuth,
} from "../../lib/bearer-auth.js";
import { getApiRuntimeEnv } from "../../lib/runtime-env.js";
import { syncComplianceStatusOnChain } from "../../services/blockchain/contracts.js";
import { createSumsubService } from "../../services/kyc/sumsub.service.js";

interface InitiateKycBody {
  walletAddress: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
}

interface WebhookBody {
  applicantId: string;
  externalUserId: string;
  type: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer: string;
    rejectLabels?: string[];
  };
}

function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

function getAuthenticatedWalletAddress(request: FastifyRequest): string | null {
  const user = request.user as { address?: string } | undefined;
  if (!user?.address) {
    return null;
  }

  return normalizeWalletAddress(user.address);
}

function ensureWalletOwnership(
  request: FastifyRequest,
  reply: FastifyReply,
  walletAddress: string,
): string | null {
  const authenticatedWallet = getAuthenticatedWalletAddress(request);

  if (!authenticatedWallet) {
    reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing authenticated wallet",
      },
    });
    return null;
  }

  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  if (authenticatedWallet !== normalizedWalletAddress) {
    reply.status(403).send({
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Wallet does not match authenticated identity",
      },
    });
    return null;
  }

  return normalizedWalletAddress;
}

export async function kycRoutes(fastify: FastifyInstance) {
  const runtimeEnv = getApiRuntimeEnv();
  const sumsubService = createSumsubService();
  const kycUnavailableMessage =
    runtimeEnv.KYC_PROVIDER === "sumsub"
      ? "KYC service is not configured"
      : `KYC endpoints require KYC_PROVIDER=sumsub; current value is ${runtimeEnv.KYC_PROVIDER}`;
  // ============================================
  // INITIATE KYC
  // ============================================

  fastify.post<{ Body: InitiateKycBody }>(
    "/initiate",
    {
      schema: {
        description: "Initiate KYC verification for a user",
        tags: ["KYC"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["walletAddress"],
          properties: {
            walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
            email: { type: "string", format: "email" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            country: { type: "string", minLength: 2, maxLength: 2 },
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
                  applicantId: { type: "string" },
                  accessToken: { type: "string" },
                  expiresAt: { type: "string" },
                  status: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { walletAddress, email, firstName, lastName, country } =
        request.body;
      const authorizedWallet = ensureWalletOwnership(
        request,
        reply,
        walletAddress,
      );
      if (!authorizedWallet) {
        return;
      }

      if (!sumsubService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "KYC_NOT_CONFIGURED",
            message: kycUnavailableMessage,
          },
        });
      }

      try {
        // Check if applicant already exists
        let applicant =
          await sumsubService.getApplicantByExternalId(authorizedWallet);

        if (!applicant) {
          // Create new applicant
          applicant = await sumsubService.createApplicant({
            externalUserId: authorizedWallet,
            walletAddress: authorizedWallet,
            email,
            firstName,
            lastName,
            country,
          });
        }

        // Generate access token for WebSDK
        const tokenResponse =
          await sumsubService.generateAccessToken(authorizedWallet);

        return {
          success: true,
          data: {
            applicantId: applicant.id,
            accessToken: tokenResponse.token,
            expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(), // 20 minutes
            status: applicant.review?.reviewStatus || "pending",
          },
        };
      } catch (error) {
        fastify.log.error(error, "KYC initiation failed");
        return reply.status(500).send({
          success: false,
          error: {
            code: "KYC_INITIATION_FAILED",
            message: "Failed to initiate KYC verification",
          },
        });
      }
    },
  );

  // ============================================
  // GET KYC STATUS
  // ============================================

  fastify.get<{ Params: { walletAddress: string } }>(
    "/status/:walletAddress",
    {
      schema: {
        description: "Get KYC verification status for a wallet",
        tags: ["KYC"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["walletAddress"],
          properties: {
            walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
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
                  status: { type: "string" },
                  verified: { type: "boolean" },
                  applicantId: { type: "string" },
                  rejectLabels: { type: "array", items: { type: "string" } },
                  sanctionsCleared: { type: "boolean" },
                  verifiedAt: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(
        request,
        reply,
        walletAddress,
      );
      if (!authorizedWallet) {
        return;
      }

      if (!sumsubService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "KYC_NOT_CONFIGURED",
            message: kycUnavailableMessage,
          },
        });
      }

      try {
        // Get applicant
        const applicant =
          await sumsubService.getApplicantByExternalId(authorizedWallet);

        if (!applicant) {
          return {
            success: true,
            data: {
              status: "not_started",
              verified: false,
            },
          };
        }

        // Get verification status
        const verificationStatus = await sumsubService.getVerificationStatus(
          applicant.id,
        );

        let sanctionsCleared = false;
        if (verificationStatus.status === "verified") {
          const sanctions = await sumsubService.requestSanctionsCheck(
            applicant.id,
          );
          sanctionsCleared = !sanctions.hit;
        }

        return {
          success: true,
          data: {
            status:
              verificationStatus.status === "verified" && !sanctionsCleared
                ? "rejected"
                : verificationStatus.status,
            verified:
              verificationStatus.status === "verified" && sanctionsCleared,
            applicantId: applicant.id,
            rejectLabels: verificationStatus.rejectLabels,
            sanctionsCleared,
            verifiedAt:
              verificationStatus.status === "verified"
                ? applicant.createdAt
                : undefined,
          },
        };
      } catch (error) {
        fastify.log.error(error, "Failed to get KYC status");
        return reply.status(500).send({
          success: false,
          error: {
            code: "KYC_STATUS_FAILED",
            message: "Failed to retrieve KYC status",
          },
        });
      }
    },
  );

  // ============================================
  // REFRESH KYC TOKEN
  // ============================================

  fastify.post<{ Params: { walletAddress: string } }>(
    "/refresh-token/:walletAddress",
    {
      schema: {
        description: "Refresh access token for KYC WebSDK",
        tags: ["KYC"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["walletAddress"],
          properties: {
            walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
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
                  accessToken: { type: "string" },
                  expiresAt: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(
        request,
        reply,
        walletAddress,
      );
      if (!authorizedWallet) {
        return;
      }

      if (!sumsubService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "KYC_NOT_CONFIGURED",
            message: kycUnavailableMessage,
          },
        });
      }

      try {
        const tokenResponse =
          await sumsubService.generateAccessToken(authorizedWallet);

        return {
          success: true,
          data: {
            accessToken: tokenResponse.token,
            expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
          },
        };
      } catch (error) {
        fastify.log.error(error, "Failed to refresh KYC token");
        return reply.status(500).send({
          success: false,
          error: {
            code: "TOKEN_REFRESH_FAILED",
            message: "Failed to refresh access token",
          },
        });
      }
    },
  );

  // ============================================
  // WEBHOOK HANDLER
  // ============================================

  fastify.post<{ Body: WebhookBody }>(
    "/webhook/sumsub",
    {
      preHandler: fastify.rateLimit({
        max: 30,
        timeWindow: "1 minute",
      }),
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
      schema: {
        description: "Sumsub webhook handler",
        tags: ["KYC"],
        body: {
          type: "object",
          properties: {
            applicantId: { type: "string" },
            externalUserId: { type: "string" },
            type: { type: "string" },
            reviewStatus: { type: "string" },
            reviewResult: {
              type: "object",
              properties: {
                reviewAnswer: { type: "string" },
                rejectLabels: { type: "array", items: { type: "string" } },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!sumsubService) {
        return reply.status(503).send({ error: kycUnavailableMessage });
      }

      const signature = request.headers["x-payload-digest"] as string;
      const rawBody = (
        request as typeof request & { rawBody?: Buffer }
      ).rawBody?.toString("utf8");
      if (!rawBody) {
        fastify.log.error("Raw webhook body is unavailable");
        return reply
          .status(503)
          .send({ error: "Webhook validation unavailable" });
      }

      // Verify webhook signature
      if (!sumsubService.verifyWebhookSignature(rawBody, signature || "")) {
        fastify.log.warn("Invalid webhook signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }

      try {
        const event = request.body;
        fastify.log.info({ event }, "Received Sumsub webhook");

        // Handle the webhook event
        const result = await sumsubService.handleWebhook({
          applicantId: event.applicantId,
          externalUserId: event.externalUserId,
          type: event.type,
          reviewStatus: event.reviewStatus,
          reviewResult: event.reviewResult,
          createdAt: new Date().toISOString(),
        });

        if (result.action === "update_status" && result.status) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(event.externalUserId)) {
            throw new Error("Webhook external user ID is not a wallet address");
          }

          let status: "pending" | "verified" | "rejected" =
            result.status === "verified"
              ? "verified"
              : result.status === "rejected"
                ? "rejected"
                : "pending";
          let sanctionsCleared = false;
          if (status === "verified") {
            const sanctions = await sumsubService.requestSanctionsCheck(
              event.applicantId,
            );
            sanctionsCleared = !sanctions.hit;
            if (!sanctionsCleared) {
              status = "rejected";
            }
          }

          await syncComplianceStatusOnChain({
            wallet: event.externalUserId,
            status,
            provider: "sumsub",
            applicantId: event.applicantId,
            sanctionsCleared,
          });
        }

        return { success: true, action: result.action };
      } catch (error) {
        fastify.log.error(error, "Webhook processing failed");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    },
  );

  // ============================================
  // REQUEST SANCTIONS CHECK
  // ============================================

  fastify.post<{ Params: { walletAddress: string } }>(
    "/sanctions-check/:walletAddress",
    {
      schema: {
        description: "Request sanctions screening for a wallet",
        tags: ["KYC"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["walletAddress"],
          properties: {
            walletAddress: { type: "string", pattern: "^0x[a-fA-F0-9]{40}$" },
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
                  cleared: { type: "boolean" },
                  matchedLists: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(
        request,
        reply,
        walletAddress,
      );
      if (!authorizedWallet) {
        return;
      }

      if (!sumsubService) {
        return reply.status(503).send({
          success: false,
          error: {
            code: "KYC_NOT_CONFIGURED",
            message: kycUnavailableMessage,
          },
        });
      }

      try {
        // Get applicant
        const applicant =
          await sumsubService.getApplicantByExternalId(authorizedWallet);

        if (!applicant) {
          return reply.status(404).send({
            success: false,
            error: {
              code: "APPLICANT_NOT_FOUND",
              message: "No KYC record found for this wallet",
            },
          });
        }

        // Request sanctions check
        const result = await sumsubService.requestSanctionsCheck(applicant.id);

        return {
          success: true,
          data: {
            cleared: !result.hit,
            matchedLists: result.matchedLists || [],
          },
        };
      } catch (error) {
        fastify.log.error(error, "Sanctions check failed");
        return reply.status(500).send({
          success: false,
          error: {
            code: "SANCTIONS_CHECK_FAILED",
            message: "Failed to perform sanctions check",
          },
        });
      }
    },
  );
}

export default kycRoutes;
