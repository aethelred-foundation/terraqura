import type { FastifyReply } from "fastify";

export type AuthUserType = "operator" | "admin" | "auditor";
export type AuthKycStatus = "pending" | "approved" | "rejected";

interface AuthUserClaims {
  address?: string;
  userType?: AuthUserType;
  kycStatus?: AuthKycStatus;
}

export interface AuthContext {
  address: string | null;
  userType: AuthUserType;
  kycStatus: AuthKycStatus;
}

export function getAuthContext(request: { user?: unknown }): AuthContext {
  const user = request.user as AuthUserClaims | undefined;

  return {
    address: typeof user?.address === "string" ? user.address.toLowerCase() : null,
    userType: user?.userType ?? "operator",
    kycStatus: user?.kycStatus ?? "pending",
  };
}

export function getAuthenticatedAddress(request: { user?: unknown }): string | null {
  return getAuthContext(request).address;
}

export function isAdmin(request: { user?: unknown }): boolean {
  return getAuthContext(request).userType === "admin";
}

export function ensureApprovedKyc(
  request: { user?: unknown },
  reply: FastifyReply,
  options?: {
    allowAdminBypass?: boolean;
    message?: string;
  }
): boolean {
  const { allowAdminBypass = true, message = "KYC approval is required for this action" } =
    options ?? {};
  const authContext = getAuthContext(request);

  if (allowAdminBypass && authContext.userType === "admin") {
    return true;
  }

  if (authContext.kycStatus === "approved") {
    return true;
  }

  reply.status(403).send({
    success: false,
    error: message,
  });
  return false;
}
