// TerraQura KYC Status Hook
// Manages KYC state and verification flow

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";

export type KycState =
  | "disconnected"
  | "checking"
  | "not_started"
  | "in_progress"
  | "pending_review"
  | "verified"
  | "rejected"
  | "expired";

export interface KycStatus {
  state: KycState;
  applicantId?: string;
  accessToken?: string;
  tokenExpiresAt?: Date;
  rejectLabels?: string[];
  verifiedAt?: Date;
  expiresAt?: Date;
}

export interface UseKycStatusReturn {
  status: KycStatus;
  isLoading: boolean;
  error: string | null;
  initiateKyc: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  refetch: () => Promise<void>;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useKycStatus(): UseKycStatusReturn {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<KycStatus>({ state: "disconnected" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch KYC status from API
  const fetchStatus = useCallback(async () => {
    if (!address) {
      setStatus({ state: "disconnected" });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/kyc/status/${address}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to fetch KYC status");
      }

      const { status: apiStatus, verified, applicantId, rejectLabels, verifiedAt } = data.data;

      let state: KycState;
      if (verified) {
        state = "verified";
      } else if (apiStatus === "not_started") {
        state = "not_started";
      } else if (apiStatus === "pending") {
        state = "pending_review";
      } else if (apiStatus === "rejected") {
        state = "rejected";
      } else if (apiStatus === "expired") {
        state = "expired";
      } else {
        state = "in_progress";
      }

      setStatus({
        state,
        applicantId,
        rejectLabels,
        verifiedAt: verifiedAt ? new Date(verifiedAt) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus({ state: "not_started" });
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Initiate KYC verification
  const initiateKyc = useCallback(async () => {
    if (!address) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/kyc/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to initiate KYC");
      }

      setStatus((prev) => ({
        ...prev,
        state: "in_progress",
        applicantId: data.data.applicantId,
        accessToken: data.data.accessToken,
        tokenExpiresAt: new Date(data.data.expiresAt),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  // Refresh access token
  const refreshToken = useCallback(async (): Promise<string | null> => {
    if (!address) return null;

    try {
      const response = await fetch(`${API_URL}/v1/kyc/refresh-token/${address}`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || "Failed to refresh token");
      }

      const { accessToken, expiresAt } = data.data;

      setStatus((prev) => ({
        ...prev,
        accessToken,
        tokenExpiresAt: new Date(expiresAt),
      }));

      return accessToken;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      return null;
    }
  }, [address]);

  // Auto-fetch status when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      setStatus({ state: "checking" });
      fetchStatus();
    } else {
      setStatus({ state: "disconnected" });
    }
  }, [isConnected, address, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    initiateKyc,
    refreshToken,
    refetch: fetchStatus,
  };
}

export default useKycStatus;
