import { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { generateNonce, SiweMessage } from "siwe";
import { z } from "zod";

import {
  bearerAuthRateLimit,
  verifyBearerAuth,
} from "../../lib/bearer-auth.js";
import { ensureDatabaseSchema } from "../../lib/database-schema.js";
import { databasePool } from "../../lib/database.js";
import { getApiRuntimeEnv } from "../../lib/runtime-env.js";
import { createSumsubService } from "../../services/kyc/sumsub.service.js";

const NONCE_TTL_MS = 10 * 60 * 1000;
const runtimeEnv = getApiRuntimeEnv();
const expectedSiweDomain = runtimeEnv.SIWE_DOMAIN;

async function createStoredNonce(
  nonce: string,
  expiresAt: Date,
): Promise<void> {
  await ensureDatabaseSchema();
  await databasePool.query(
    `
      INSERT INTO siwe_nonces (nonce, expires_at)
      VALUES ($1, $2)
    `,
    [nonce, expiresAt.toISOString()],
  );
}

async function consumeStoredNonce(
  nonce: string,
): Promise<"valid" | "invalid_or_expired"> {
  await ensureDatabaseSchema();
  const result = await databasePool.query(
    `
      DELETE FROM siwe_nonces
      WHERE nonce = $1
        AND expires_at > NOW()
    `,
    [nonce],
  );
  return result.rowCount === 1 ? "valid" : "invalid_or_expired";
}

const VerifyRequestSchema = z.object({
  message: z.string(),
  signature: z.string(),
});

type UserType = "operator" | "admin" | "auditor";

interface AuthTokenPayload {
  sub: string;
  address: string;
  chainId: number;
  userType: UserType;
  kycStatus: "pending" | "approved" | "rejected";
}

function resolveUserType(walletAddress: string): UserType {
  const normalized = walletAddress.toLowerCase();
  if (runtimeEnv.ADMIN_WALLETS.includes(normalized)) return "admin";
  if (runtimeEnv.AUDITOR_WALLETS.includes(normalized)) return "auditor";
  return "operator";
}

function readTokenPayload(request: FastifyRequest): AuthTokenPayload | null {
  const user = request.user as Partial<AuthTokenPayload> | undefined;
  if (
    !user ||
    typeof user.address !== "string" ||
    typeof user.chainId !== "number"
  ) {
    return null;
  }

  const normalizedAddress = user.address.toLowerCase();
  return {
    sub: user.sub || normalizedAddress,
    address: normalizedAddress,
    chainId: user.chainId,
    userType: user.userType || "operator",
    kycStatus: user.kycStatus || "pending",
  };
}

async function resolveKycStatus(
  walletAddress: string,
): Promise<AuthTokenPayload["kycStatus"]> {
  if (runtimeEnv.KYC_PROVIDER !== "sumsub") {
    return "pending";
  }

  const sumsubService = createSumsubService();
  if (!sumsubService) {
    return "pending";
  }

  try {
    const applicant =
      await sumsubService.getApplicantByExternalId(walletAddress);
    if (!applicant) {
      return "pending";
    }

    const verificationStatus = await sumsubService.getVerificationStatus(
      applicant.id,
    );
    if (verificationStatus.status === "verified") {
      const sanctions = await sumsubService.requestSanctionsCheck(applicant.id);
      return sanctions.hit ? "rejected" : "approved";
    }
    if (verificationStatus.status === "rejected") {
      return "rejected";
    }

    return "pending";
  } catch (error) {
    console.warn(
      "Failed to resolve KYC status during auth verification",
      error,
    );
    return "pending";
  }
}

export async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
) {
  /**
   * Get nonce for SIWE (Sign-In with Ethereum)
   */
  fastify.get(
    "/nonce",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get nonce for SIWE",
        description: "Returns a nonce for Sign-In with Ethereum authentication",
        response: {
          200: {
            type: "object",
            properties: {
              nonce: { type: "string" },
              expiresAt: { type: "string" },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const nonce = generateNonce();
      const expiresAt = new Date(Date.now() + NONCE_TTL_MS);
      await createStoredNonce(nonce, expiresAt);

      return {
        nonce,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  /**
   * Verify SIWE signature
   */
  fastify.post(
    "/verify",
    {
      preHandler: fastify.rateLimit({
        max: 10,
        timeWindow: "1 minute",
      }),
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
      schema: {
        tags: ["Auth"],
        summary: "Verify SIWE signature",
        description:
          "Verifies a Sign-In with Ethereum signature and returns a JWT",
        body: {
          type: "object",
          required: ["message", "signature"],
          properties: {
            message: { type: "string" },
            signature: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              token: { type: "string" },
              user: {
                type: "object",
                properties: {
                  address: { type: "string" },
                  chainId: { type: "number" },
                },
              },
            },
          },
          401: {
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
      try {
        const body = VerifyRequestSchema.parse(request.body);
        const { message, signature } = body;

        // Parse and verify the SIWE message
        const siweMessage = new SiweMessage(message);
        const { data: verifiedMessage } = await siweMessage.verify({
          signature,
        });

        if (verifiedMessage.domain.toLowerCase() !== expectedSiweDomain) {
          return reply.status(401).send({
            success: false,
            error: "Invalid SIWE domain",
          });
        }

        const nonceStatus = await consumeStoredNonce(verifiedMessage.nonce);
        if (nonceStatus !== "valid") {
          return reply.status(401).send({
            success: false,
            error: "Invalid or expired nonce",
          });
        }

        const normalizedAddress = verifiedMessage.address.toLowerCase();
        const kycStatus = await resolveKycStatus(normalizedAddress);
        const tokenPayload: AuthTokenPayload = {
          sub: normalizedAddress,
          address: normalizedAddress,
          chainId: verifiedMessage.chainId,
          userType: resolveUserType(normalizedAddress),
          kycStatus,
        };
        const token = fastify.jwt.sign(tokenPayload);

        return {
          success: true,
          token,
          user: {
            address: normalizedAddress,
            chainId: verifiedMessage.chainId,
          },
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(401).send({
          success: false,
          error: "Invalid signature",
        });
      }
    },
  );

  /**
   * Get current session
   */
  fastify.get(
    "/session",
    {
      schema: {
        tags: ["Auth"],
        summary: "Get current session",
        description: "Returns the current user session if authenticated",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              authenticated: { type: "boolean" },
              user: {
                type: "object",
                nullable: true,
                properties: {
                  id: { type: "string" },
                  address: { type: "string" },
                  userType: { type: "string" },
                  kycStatus: { type: "string" },
                },
              },
            },
          },
        },
      },
      config: bearerAuthRateLimit,
      preHandler: verifyBearerAuth,
    },
    async (request, _reply) => {
      const tokenPayload = readTokenPayload(request);

      if (!tokenPayload) {
        return {
          authenticated: false,
          user: null,
        };
      }

      return {
        authenticated: true,
        user: {
          id: `user_${tokenPayload.address.slice(2, 10)}`,
          address: tokenPayload.address,
          userType: tokenPayload.userType,
          kycStatus: tokenPayload.kycStatus,
        },
      };
    },
  );
}
