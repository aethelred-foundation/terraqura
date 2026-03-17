"use client";

// TerraQura Compliance Gate
// KYC verification flow for regulatory compliance

import { ReactNode, useState } from "react";
import { useAccount } from "wagmi";
import { useKycStatus } from "@/hooks/useKycStatus";
import { SumsubWidget } from "./SumsubWidget";
import { ConnectButton } from "@rainbow-me/rainbowkit";

interface ComplianceGateProps {
  children: ReactNode;
  fallback?: ReactNode;
  requireKyc?: boolean;
}

export function ComplianceGate({
  children,
  fallback,
  requireKyc = true,
}: ComplianceGateProps) {
  const { isConnected } = useAccount();
  const { status, isLoading, error, initiateKyc, refreshToken, refetch } = useKycStatus();
  const [showWidget, setShowWidget] = useState(false);

  // If KYC not required, just render children
  if (!requireKyc) {
    return <>{children}</>;
  }

  // Not connected - show connect wallet
  if (!isConnected) {
    return (
      <ComplianceCard
        icon="wallet"
        title="Connect Your Wallet"
        description="Connect your wallet to access the TerraQura platform."
      >
        <div className="mt-6">
          <ConnectButton />
        </div>
      </ComplianceCard>
    );
  }

  // Loading state
  if (isLoading || status.state === "checking") {
    return (
      <ComplianceCard
        icon="loading"
        title="Checking Verification Status"
        description="Please wait while we verify your identity status..."
      >
        <div className="mt-6 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      </ComplianceCard>
    );
  }

  // Handle different KYC states
  switch (status.state) {
    case "verified":
      return <>{children}</>;

    case "not_started":
      return (
        <ComplianceCard
          icon="shield"
          title="Identity Verification Required"
          description="To comply with ADGM regulations and access the carbon credit marketplace, you need to complete identity verification."
        >
          <div className="mt-6 space-y-4">
            <div className="rounded-lg bg-gray-800/50 p-4">
              <h4 className="font-medium text-gray-200">What you'll need:</h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-400">
                <li>• Valid government-issued ID (passport, driver's license)</li>
                <li>• A device with a camera for selfie verification</li>
                <li>• Approximately 3-5 minutes to complete</li>
              </ul>
            </div>

            <button
              onClick={initiateKyc}
              disabled={isLoading}
              className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
            >
              {isLoading ? "Initializing..." : "Start Verification"}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-center text-sm text-red-400">{error}</p>
          )}
        </ComplianceCard>
      );

    case "in_progress":
      if (showWidget && status.accessToken) {
        return (
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Identity Verification</h2>
              <button
                onClick={() => setShowWidget(false)}
                className="text-sm text-gray-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <SumsubWidget
              accessToken={status.accessToken}
              onComplete={() => {
                setShowWidget(false);
                refetch();
              }}
              onError={(err) => console.error("Sumsub error:", err)}
              onTokenExpired={refreshToken}
            />

            <p className="mt-4 text-center text-xs text-gray-500">
              Your data is processed securely in compliance with GDPR and ADGM regulations.
            </p>
          </div>
        );
      }

      return (
        <ComplianceCard
          icon="id-card"
          title="Complete Your Verification"
          description="Your verification is in progress. Please complete the remaining steps."
        >
          <div className="mt-6">
            <button
              onClick={() => {
                if (!status.accessToken) {
                  initiateKyc().then(() => setShowWidget(true));
                } else {
                  setShowWidget(true);
                }
              }}
              className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Continue Verification
            </button>
          </div>
        </ComplianceCard>
      );

    case "pending_review":
      return (
        <ComplianceCard
          icon="clock"
          title="Verification Pending Review"
          description="Your documents have been submitted and are being reviewed by our compliance team."
        >
          <div className="mt-6 rounded-lg bg-amber-900/20 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 h-5 w-5 text-amber-400">
                <ClockIcon />
              </div>
              <div>
                <p className="font-medium text-amber-200">Review in Progress</p>
                <p className="mt-1 text-sm text-amber-300/70">
                  This typically takes 1-24 hours. You'll receive an email notification once complete.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={refetch}
            className="mt-4 w-full rounded-lg border border-gray-600 px-6 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
          >
            Check Status
          </button>
        </ComplianceCard>
      );

    case "rejected":
      return (
        <ComplianceCard
          icon="x-circle"
          title="Verification Unsuccessful"
          description="We were unable to verify your identity based on the documents provided."
        >
          <div className="mt-6 rounded-lg bg-red-900/20 p-4">
            <p className="font-medium text-red-200">Reason for rejection:</p>
            {status.rejectLabels && status.rejectLabels.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-red-300/70">
                {status.rejectLabels.map((label, i) => (
                  <li key={i}>• {formatRejectLabel(label)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-red-300/70">
                Please contact support for more information.
              </p>
            )}
          </div>

          <button
            onClick={initiateKyc}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            Try Again
          </button>
        </ComplianceCard>
      );

    case "expired":
      return (
        <ComplianceCard
          icon="refresh"
          title="Verification Expired"
          description="Your identity verification has expired and needs to be renewed."
        >
          <div className="mt-6">
            <button
              onClick={initiateKyc}
              className="w-full rounded-lg bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              Renew Verification
            </button>
          </div>
        </ComplianceCard>
      );

    default:
      return fallback || null;
  }
}

// Compliance Card Component
function ComplianceCard({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border border-gray-700 bg-gray-900/80 p-8 backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-800">
            <IconComponent name={icon} />
          </div>

          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-2 text-gray-400">{description}</p>

          {children}
        </div>
      </div>
    </div>
  );
}

// Icon Component
function IconComponent({ name }: { name: string }) {
  const iconClass = "h-8 w-8 text-emerald-400";

  switch (name) {
    case "wallet":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
        </svg>
      );
    case "shield":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      );
    case "id-card":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
        </svg>
      );
    case "clock":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "x-circle":
      return (
        <svg className="h-8 w-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case "refresh":
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      );
    case "loading":
      return (
        <svg className={`${iconClass} animate-spin`} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    default:
      return null;
  }
}

function ClockIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// Format reject labels for display
function formatRejectLabel(label: string): string {
  const labels: Record<string, string> = {
    DOCUMENT_DAMAGED: "Document appears damaged or illegible",
    DOCUMENT_EXPIRED: "Document has expired",
    DOCUMENT_MISSING_PART: "Part of the document is missing or cut off",
    FORGERY: "Document appears to be forged or altered",
    SELFIE_MISMATCH: "Face doesn't match the document photo",
    UNSATISFACTORY_PHOTOS: "Photo quality is too low",
    SPAM: "Submission flagged as spam",
    NOT_DOCUMENT: "Uploaded file is not a valid document",
    FRONT_SIDE_MISSING: "Front side of document is missing",
    BACK_SIDE_MISSING: "Back side of document is missing",
  };

  return labels[label] || label.replace(/_/g, " ").toLowerCase();
}

export default ComplianceGate;
