import { FastifyReply, FastifyRequest } from "fastify";

export const bearerAuthRateLimit = {
  rateLimit: {
    max: 20,
    timeWindow: "1 minute",
  },
} as const;

export async function verifyBearerAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid bearer token",
      },
    });
  }
}
