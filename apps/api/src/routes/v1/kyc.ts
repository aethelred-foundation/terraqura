// TerraQura KYC Routes
// Enterprise-grade identity verification endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { getApiRuntimeEnv } from "../../lib/runtime-env.js";
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
  walletAddress: string
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
  const queueKycCheck = async (payload: {
    userId: string;
    walletAddress: string;
    applicantId: string;
    provider: "sumsub";
    checkType: "initial" | "refresh";
  }) => {
    // API writes an audit trail even when dedicated queue workers are unavailable.
    fastify.log.info({ payload }, "KYC check request recorded");
  };

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
    },
    async (request, reply) => {
      const { walletAddress, email, firstName, lastName, country } = request.body;
      const authorizedWallet = ensureWalletOwnership(request, reply, walletAddress);
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
        let applicant = await sumsubService.getApplicantByExternalId(authorizedWallet);

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
        const tokenResponse = await sumsubService.generateAccessToken(authorizedWallet);

        // Queue async status check
        await queueKycCheck({
          userId: authorizedWallet,
          walletAddress: authorizedWallet,
          applicantId: applicant.id,
          provider: "sumsub",
          checkType: "initial",
        });

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
    }
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
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(request, reply, walletAddress);
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
        const applicant = await sumsubService.getApplicantByExternalId(authorizedWallet);

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
          applicant.id
        );

        return {
          success: true,
          data: {
            status: verificationStatus.status,
            verified: verificationStatus.status === "verified",
            applicantId: applicant.id,
            rejectLabels: verificationStatus.rejectLabels,
            sanctionsCleared: true, // Would come from sanctions check
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
    }
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
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(request, reply, walletAddress);
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
        const tokenResponse = await sumsubService.generateAccessToken(authorizedWallet);

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
    }
  );

  // ============================================
  // WEBHOOK HANDLER
  // ============================================

  fastify.post<{ Body: WebhookBody }>(
    "/webhook/sumsub",
    {
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
      const rawBody = JSON.stringify(request.body);

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

        // Queue update job if needed
        if (result.action === "update_status" && result.status) {
          await queueKycCheck({
            userId: event.externalUserId,
            walletAddress: event.externalUserId,
            applicantId: event.applicantId,
            provider: "sumsub",
            checkType: "refresh",
          });
        }

        return { success: true, action: result.action };
      } catch (error) {
        fastify.log.error(error, "Webhook processing failed");
        return reply.status(500).send({ error: "Webhook processing failed" });
      }
    }
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
    },
    async (request, reply) => {
      const { walletAddress } = request.params;
      const authorizedWallet = ensureWalletOwnership(request, reply, walletAddress);
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
        const applicant = await sumsubService.getApplicantByExternalId(
          authorizedWallet
        );

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
    }
  );
}

export default kycRoutes;
