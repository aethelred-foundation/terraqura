"use client";

// TerraQura Legal Gate
// Wraps components requiring terms acceptance

import { ReactNode, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { TermsModal, useTermsAccepted } from "./TermsModal";

interface LegalGateProps {
  children: ReactNode;
  requireTerms?: boolean;
}

export function LegalGate({ children, requireTerms = true }: LegalGateProps) {
  const { isConnected, address } = useAccount();
  const { accepted, loading } = useTermsAccepted();
  const [showTerms, setShowTerms] = useState(false);

  // Show terms modal when connected and terms not accepted
  useEffect(() => {
    if (isConnected && !loading && !accepted && requireTerms) {
      setShowTerms(true);
    }
  }, [isConnected, loading, accepted, requireTerms]);

  const handleAccept = async (signature: string) => {
    // Send to backend to store
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/legal/accept-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          signature,
          version: "1.0.0",
        }),
      });
    } catch (error) {
      console.error("Failed to store terms acceptance:", error);
    }

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
      {(!isConnected || accepted) ? children : null}
    </>
  );
}

export default LegalGate;
