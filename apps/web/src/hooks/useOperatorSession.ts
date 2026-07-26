"use client";

import { useCallback, useEffect, useState } from "react";
import { SiweMessage } from "siwe";
import { useAccount, useChainId, useSignMessage } from "wagmi";

import {
  clearOperatorToken,
  getOperatorToken,
  setOperatorToken,
  terraquraApi,
} from "@/lib/terraquraApi";

export interface OperatorSession {
  id: string;
  address: string;
  userType: "operator" | "admin" | "auditor";
  kycStatus: "pending" | "approved" | "rejected";
}

interface VerifyResponse {
  success: boolean;
  token: string;
  user: {
    address: string;
    chainId: number;
  };
}

interface SessionResponse {
  authenticated: boolean;
  user: OperatorSession | null;
}

export function useOperatorSession() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = useCallback(
    async (candidateToken?: string | null) => {
      const currentToken =
        candidateToken ?? (address ? getOperatorToken(address) : null);
      if (!currentToken) {
        setToken(null);
        setSession(null);
        return null;
      }

      try {
        const result = await terraquraApi<SessionResponse>("/v1/auth/session", {
          token: currentToken,
        });
        if (!result.authenticated || !result.user) {
          throw new Error("Operator session is no longer valid");
        }
        setToken(currentToken);
        setSession(result.user);
        return result.user;
      } catch {
        if (address) {
          clearOperatorToken(address);
        }
        setToken(null);
        setSession(null);
        return null;
      }
    },
    [address],
  );

  useEffect(() => {
    if (!isConnected || !address) {
      setToken(null);
      setSession(null);
      return;
    }
    void refreshSession();
  }, [address, isConnected, refreshSession]);

  const signIn = useCallback(async () => {
    if (!address || !isConnected) {
      throw new Error("Connect a wallet before signing in");
    }

    setIsLoading(true);
    setError(null);
    try {
      const nonceResponse = await terraquraApi<{
        nonce: string;
        expiresAt: string;
      }>("/v1/auth/nonce");
      const siweMessage = new SiweMessage({
        domain: window.location.host,
        address,
        statement:
          "Authenticate this wallet to operate TerraQura carbon projects.",
        uri: window.location.origin,
        version: "1",
        chainId,
        nonce: nonceResponse.nonce,
        issuedAt: new Date().toISOString(),
        expirationTime: nonceResponse.expiresAt,
      });
      const message = siweMessage.prepareMessage();
      const signature = await signMessageAsync({ message });
      const verified = await terraquraApi<VerifyResponse>("/v1/auth/verify", {
        method: "POST",
        body: JSON.stringify({ message, signature }),
      });

      setOperatorToken(address, verified.token);
      setToken(verified.token);
      await refreshSession(verified.token);
      return verified.token;
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Wallet sign-in failed";
      setError(message);
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId, isConnected, refreshSession, signMessageAsync]);

  const signOut = useCallback(() => {
    if (address) {
      clearOperatorToken(address);
    }
    setToken(null);
    setSession(null);
    setError(null);
  }, [address]);

  return {
    token,
    session,
    isAuthenticated: Boolean(token && session),
    isLoading,
    error,
    signIn,
    signOut,
    refreshSession,
  };
}
