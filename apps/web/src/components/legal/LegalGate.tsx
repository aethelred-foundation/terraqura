"use client";

// TerraQura Legal Gate
// Wraps components requiring terms acceptance

import { TermsAcceptancePayload } from "@terraqura/types";
import { ReactNode, useState, useEffect } from "react";
import { useAccount } from "wagmi";

import { terraquraApi } from "@/lib/terraquraApi";

import { TermsModal, useTermsAccepted } from "./TermsModal";

interface LegalGateProps {
  children: ReactNode;
  requireTerms?: boolean;
}

export function LegalGate({ children, requireTerms = true }: LegalGateProps) {
  const { isConnected, address } = useAccount();
  const { accepted, loading } = useTermsAccepted();
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedThisSession, setAcceptedThisSession] = useState(false);

  // Show terms modal when connected and terms not accepted
  useEffect(() => {
    if (isConnected && !loading && !accepted && requireTerms) {
      setShowTerms(true);
    }
  }, [isConnected, loading, accepted, requireTerms]);

  const handleAccept = async (acceptance: TermsAcceptancePayload) => {
    if (
      !address ||
      acceptance.walletAddress.toLowerCase() !== address.toLowerCase()
    ) {
      throw new Error(
        "Connected wallet changed before terms acceptance completed",
      );
    }

    await terraquraApi("/v1/legal/accept-terms", {
      method: "POST",
      body: JSON.stringify(acceptance),
    });
    setAcceptedThisSession(true);
    setShowTerms(false);
  };

  const handleDecline = () => {
    setShowTerms(false);
    // Could redirect or show message
  };

  if (!requireTerms) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <TermsModal
        isOpen={showTerms}
        onAccept={handleAccept}
        onDecline={handleDecline}
      />
      {!isConnected || accepted || acceptedThisSession ? children : null}
    </>
  );
}

export default LegalGate;
