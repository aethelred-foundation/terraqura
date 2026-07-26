"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  Circle,
  Database,
  ExternalLink,
  Factory,
  FileCheck2,
  Fingerprint,
  Gauge,
  Leaf,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

import {
  DAppFooter,
  StatusBadge,
  ToastContainer,
  TopNav,
} from "@/components/dapp/SharedComponents";
import { SumsubWidget } from "@/components/kyc/SumsubWidget";
import { useApp } from "@/contexts/AppContext";
import { useKycStatus } from "@/hooks/useKycStatus";
import { useOperatorSession } from "@/hooks/useOperatorSession";
import { CarbonCreditABI, CarbonMarketplaceABI } from "@/lib/abis";
import { CHAIN_ID, CONTRACTS } from "@/lib/contracts";
import { TERRAQURA_API_URL, terraquraApi } from "@/lib/terraquraApi";

interface DacUnit {
  id: string;
  unitId?: string;
  name: string;
  status: "pending" | "active" | "suspended" | "decommissioned";
  latitude: number;
  longitude: number;
  countryCode: string;
  capacityTonnesPerYear: number;
  technologyType?: string;
  gridIntensityGco2PerKwh?: number | null;
  createdAt?: string;
  whitelistTxHash?: string | null;
}

interface Credit {
  id: string;
  tokenId: string;
  dacUnitId: string;
  co2CapturedKg: number;
  creditsIssued: number;
  escrowedAmount: number;
  retiredAmount: number;
  verificationStatus: string;
  isRetired: boolean;
  mintTxHash: string | null;
  currentOwnerWallet: string | null;
}

interface MarketplaceListing {
  id: string;
  listingId: string;
  sellerWallet: string;
  tokenId: string;
  creditId: string;
  dacUnitId: string;
  amount: number;
  remainingAmount: number;
  pricePerUnit: string;
  minPurchaseAmount: number;
  status: "active" | "sold" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string | null;
  txHash: string;
  explorerUrl?: string;
}

interface SensorSummary {
  totalCo2CapturedKg: number;
  totalEnergyConsumedKwh: number;
  avgPurityPercentage: number;
  kwhPerTonne: number;
  efficiencyRating: string;
  readingCount: number;
  anomalyCount: number;
}

interface VerificationRun {
  id: string;
  dacUnitId: string;
  status: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED";
  requestedAt: string;
  completedAt: string | null;
  sourceDataHash: string;
  creditsToMint: number | null;
  readingCount: number;
  totalCo2CapturedKg: number;
  totalEnergyKwh: number;
  efficiencyFactor: number | null;
}

interface VerificationResult extends VerificationRun {
  avgPurity: number | null;
  sourceCheck: { status: string; message: string };
  logicCheck: {
    status: string;
    kwhPerTonne: number;
    efficiencyFactor: number;
    message: string;
  };
  mintCheck: { status: string; message: string };
}

interface TransactionReceiptState {
  label: string;
  hash: string;
  explorerUrl?: string;
  blockNumber?: number;
}

const LIFECYCLE = [
  {
    id: "project",
    label: "Project",
    description: "Register facility and baseline",
    icon: Factory,
  },
  {
    id: "mrv",
    label: "MRV evidence",
    description: "Ingest measured capture and energy",
    icon: Radio,
  },
  {
    id: "verify",
    label: "Verify",
    description: "Run source, physics, and replay checks",
    icon: ShieldCheck,
  },
  {
    id: "issue",
    label: "Issue",
    description: "Mint verified units on Aethelred",
    icon: Fingerprint,
  },
  {
    id: "market",
    label: "Market",
    description: "Transfer or list verified inventory",
    icon: Activity,
  },
  {
    id: "retirement",
    label: "Retire",
    description: "Wallet-sign the permanent burn",
    icon: Leaf,
  },
] as const;

const fieldClass =
  "mt-1.5 w-full border border-white/10 bg-[#08100f] px-3 py-2.5 text-sm text-white outline-none transition focus:border-emerald-400/60";
const labelClass =
  "block text-[11px] font-medium uppercase tracking-[0.14em] text-white/45";

function dateTimeLocal(hoursAgo = 0): string {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function shortHash(value?: string | null): string {
  if (!value) return "—";
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

function tonnesFromUnits(units: number): string {
  return (units / 1000).toLocaleString(undefined, {
    maximumFractionDigits: 3,
  });
}

function Panel({
  title,
  eyebrow,
  children,
  action,
  id,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <section
      id={id}
      className="border border-white/[0.08] bg-[#050b0a] p-5 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-emerald-400/70">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  type = "button",
  tone = "primary",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  tone?: "primary" | "secondary";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "primary"
          ? "bg-emerald-400 text-[#03100c] hover:bg-emerald-300"
          : "border border-white/15 bg-white/[0.03] text-white/75 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function OperationGate({
  connected,
  authenticated,
  kycStatus,
  loading,
  onConnect,
  onSignIn,
  onStartKyc,
}: {
  connected: boolean;
  authenticated: boolean;
  kycStatus?: string;
  loading: boolean;
  onConnect?: () => void;
  onSignIn: () => void;
  onStartKyc: () => void;
}) {
  if (!connected) {
    return (
      <div className="border border-amber-300/20 bg-amber-300/[0.05] p-4">
        <div className="flex items-start gap-3">
          <WalletCards className="mt-0.5 h-5 w-5 text-amber-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              Connect Aethelred Wallet to operate
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              Public registry data remains visible. Mutations require the
              project operator&apos;s wallet.
            </p>
          </div>
          <ActionButton onClick={onConnect} tone="secondary">
            Connect
          </ActionButton>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-cyan-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              Sign in with the connected wallet
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              SIWE binds API mutations to the same wallet that owns the carbon
              project.
            </p>
          </div>
          <ActionButton disabled={loading} onClick={onSignIn}>
            {loading ? "Waiting for signature…" : "Sign in"}
          </ActionButton>
        </div>
      </div>
    );
  }

  if (kycStatus !== "approved") {
    return (
      <div className="border border-amber-300/20 bg-amber-300/[0.05] p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-300" />
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              Operator identity review: {kycStatus || "pending"}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/50">
              The production API blocks registration, verification, issuance,
              and retirement until the connected operator passes KYC.
            </p>
          </div>
          <ActionButton onClick={onStartKyc}>Continue review</ActionButton>
        </div>
      </div>
    );
  }

  return null;
}

export function TerraQuraWorkbench() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const { openConnectModal, addNotification } = useApp();
  const operator = useOperatorSession();
  const kyc = useKycStatus(operator.token);
  const [showKyc, setShowKyc] = useState(false);

  const [projects, setProjects] = useState<DacUnit[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [projectDetail, setProjectDetail] = useState<DacUnit | null>(null);
  const [summary, setSummary] = useState<SensorSummary | null>(null);
  const [verifications, setVerifications] = useState<VerificationRun[]>([]);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceiptState | null>(null);
  const [sensorCredentialIssued, setSensorCredentialIssued] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    countryCode: "AE",
    capacityTonnesPerYear: "",
    technologyType: "Direct air capture",
    gridIntensityGco2PerKwh: "",
  });
  const [sensorForm, setSensorForm] = useState({
    apiKey: "",
    sensorId: "",
    timestamp: dateTimeLocal(),
    co2CaptureRateKgHour: "",
    energyConsumptionKwh: "",
    co2PurityPercentage: "",
    measurementDurationSeconds: "3600",
  });
  const [verificationForm, setVerificationForm] = useState({
    startTime: dateTimeLocal(24),
    endTime: dateTimeLocal(-1),
  });
  const [metadataCid, setMetadataCid] = useState("");
  const [listingForm, setListingForm] = useState({
    creditId: "",
    amount: "",
    priceAeth: "",
    minPurchaseAmount: "1",
    durationDays: "30",
  });
  const [purchaseForm, setPurchaseForm] = useState({
    listingId: "",
    amount: "",
  });
  const [retirementForm, setRetirementForm] = useState({
    creditId: "",
    amount: "",
    reason: "",
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const projectCredits = useMemo(
    () =>
      credits.filter(
        (credit) =>
          credit.dacUnitId === selectedProjectId ||
          (!credit.dacUnitId && selectedProjectId === ""),
      ),
    [credits, selectedProjectId],
  );
  const latestVerification = verifications[0] ?? null;
  const selectedListingCredit =
    projectCredits.find((credit) => credit.id === listingForm.creditId) ??
    projectCredits.find(
      (credit) =>
        credit.creditsIssued > 0 &&
        credit.currentOwnerWallet?.toLowerCase() === address?.toLowerCase(),
    ) ??
    null;
  const projectListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          listing.dacUnitId === selectedProjectId &&
          listing.status === "active",
      ),
    [listings, selectedProjectId],
  );
  const selectedPurchaseListing =
    projectListings.find((listing) => listing.id === purchaseForm.listingId) ??
    projectListings.find(
      (listing) =>
        listing.sellerWallet.toLowerCase() !== address?.toLowerCase(),
    ) ??
    null;
  const selectedRetirementCredit =
    projectCredits.find((credit) => credit.id === retirementForm.creditId) ??
    projectCredits.find(
      (credit) =>
        !credit.isRetired &&
        credit.creditsIssued > 0 &&
        credit.currentOwnerWallet?.toLowerCase() === address?.toLowerCase(),
    ) ??
    null;

  const currentStage = useMemo(() => {
    if (!selectedProject) return 0;
    if (!summary?.readingCount) return 1;
    if (!latestVerification || latestVerification.status !== "PASSED") return 2;
    if (projectCredits.length === 0) return 3;
    if (projectCredits.some((credit) => credit.retiredAmount > 0)) return 5;
    if (projectListings.length > 0) return 4;
    return 4;
  }, [
    latestVerification,
    projectCredits,
    projectListings.length,
    selectedProject,
    summary,
  ]);

  const loadPortfolio = useCallback(async () => {
    setPageError(null);
    try {
      const [projectData, creditData, listingData] = await Promise.all([
        terraquraApi<DacUnit[]>("/v1/dac-units"),
        terraquraApi<Credit[]>("/v1/credits"),
        terraquraApi<MarketplaceListing[]>("/v1/marketplace/listings"),
      ]);
      setProjects(projectData);
      setCredits(creditData);
      setListings(listingData);
      setSelectedProjectId((current) => current || projectData[0]?.id || "");
    } catch (cause) {
      setPageError(
        cause instanceof Error
          ? cause.message
          : "Could not load the TerraQura registry",
      );
    }
  }, []);

  const loadProject = useCallback(async (projectId: string) => {
    if (!projectId) {
      setProjectDetail(null);
      setSummary(null);
      setVerifications([]);
      setVerificationResult(null);
      return;
    }
    try {
      const [detail, sensorSummary, verificationData] = await Promise.all([
        terraquraApi<DacUnit>(`/v1/dac-units/${projectId}`),
        terraquraApi<SensorSummary>(`/v1/sensors/${projectId}/summary`),
        terraquraApi<VerificationRun[]>(
          `/v1/verification?dacUnitId=${encodeURIComponent(projectId)}`,
        ),
      ]);
      setProjectDetail(detail);
      setSummary(sensorSummary);
      setVerifications(verificationData);
      if (verificationData[0]) {
        const result = await terraquraApi<VerificationResult>(
          `/v1/verification/${verificationData[0].id}/result`,
        );
        setVerificationResult(result);
      } else {
        setVerificationResult(null);
      }
    } catch (cause) {
      setPageError(
        cause instanceof Error
          ? cause.message
          : "Project data could not be loaded",
      );
    }
  }, []);

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    void loadProject(selectedProjectId);
  }, [loadProject, selectedProjectId]);

  useEffect(() => {
    if (selectedListingCredit && !listingForm.creditId) {
      setListingForm((current) => ({
        ...current,
        creditId: selectedListingCredit.id,
        amount: String(selectedListingCredit.creditsIssued),
      }));
    }
  }, [listingForm.creditId, selectedListingCredit]);

  useEffect(() => {
    if (selectedPurchaseListing && !purchaseForm.listingId) {
      setPurchaseForm({
        listingId: selectedPurchaseListing.id,
        amount: String(selectedPurchaseListing.minPurchaseAmount),
      });
    }
  }, [purchaseForm.listingId, selectedPurchaseListing]);

  useEffect(() => {
    if (selectedRetirementCredit && !retirementForm.creditId) {
      setRetirementForm((current) => ({
        ...current,
        creditId: selectedRetirementCredit.id,
        amount: String(selectedRetirementCredit.creditsIssued),
      }));
    }
  }, [retirementForm.creditId, selectedRetirementCredit]);

  const requireOperator = useCallback(() => {
    if (!isConnected) {
      openConnectModal?.();
      throw new Error("Connect Aethelred Wallet before continuing");
    }
    if (!operator.token || !operator.session) {
      throw new Error("Sign in with the connected wallet before continuing");
    }
    if (operator.session.kycStatus !== "approved") {
      throw new Error("Approved operator KYC is required for this operation");
    }
    return operator.token;
  }, [isConnected, openConnectModal, operator.session, operator.token]);

  const runOperation = useCallback(
    async (name: string, operation: () => Promise<void>) => {
      setBusy(name);
      setPageError(null);
      setReceipt(null);
      try {
        await operation();
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : `${name} failed`;
        setPageError(message);
        addNotification({
          type: "error",
          title: `${name} failed`,
          message,
        });
      } finally {
        setBusy(null);
      }
    },
    [addNotification],
  );

  const registerProject = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Project registration", async () => {
      const token = requireOperator();
      const created = await terraquraApi<{
        id: string;
        unitId: string;
        status: DacUnit["status"];
      }>("/v1/dac-units", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: projectForm.name,
          latitude: Number(projectForm.latitude),
          longitude: Number(projectForm.longitude),
          countryCode: projectForm.countryCode.toUpperCase(),
          capacityTonnesPerYear: Number(projectForm.capacityTonnesPerYear),
          technologyType: projectForm.technologyType,
          gridIntensityGco2PerKwh: Number(projectForm.gridIntensityGco2PerKwh),
        }),
      });
      await loadPortfolio();
      setSelectedProjectId(created.id);
      addNotification({
        type: "success",
        title: "Project registered",
        message:
          "The facility is awaiting administrator whitelist confirmation on Aethelred.",
      });
    });
  };

  const submitEvidence = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("MRV evidence submission", async () => {
      if (!selectedProjectId) {
        throw new Error("Select a project first");
      }
      if (!sensorForm.apiKey) {
        throw new Error("Enter the provisioned sensor API key");
      }
      const result = await terraquraApi<{
        dataHash: string;
        isAnomaly: boolean;
        anomalyReason: string | null;
        timestamp: string;
      }>("/v1/sensors/readings", {
        method: "POST",
        headers: { "X-Sensor-API-Key": sensorForm.apiKey },
        body: JSON.stringify({
          sensorId: sensorForm.sensorId,
          timestamp: new Date(sensorForm.timestamp).toISOString(),
          co2CaptureRateKgHour: Number(sensorForm.co2CaptureRateKgHour),
          energyConsumptionKwh: Number(sensorForm.energyConsumptionKwh),
          co2PurityPercentage: Number(sensorForm.co2PurityPercentage),
          measurementDurationSeconds: Number(
            sensorForm.measurementDurationSeconds,
          ),
        }),
      });
      setReceipt({ label: "MRV evidence hash", hash: result.dataHash });
      await loadProject(selectedProjectId);
      addNotification({
        type: result.isAnomaly ? "warning" : "success",
        title: result.isAnomaly
          ? "Evidence accepted with anomaly"
          : "Evidence accepted",
        message: result.isAnomaly
          ? result.anomalyReason || "Review required"
          : "The immutable source hash is ready for verification.",
      });
    });
  };

  const provisionSensorCredential = async () => {
    await runOperation("Sensor credential provisioning", async () => {
      const token = requireOperator();
      if (!selectedProjectId) {
        throw new Error("Select a registered project first");
      }
      const credential = await terraquraApi<{ key: string }>("/v1/api-keys", {
        method: "POST",
        token,
        body: JSON.stringify({
          name: `${selectedProject?.name || selectedProjectId} telemetry`,
          type: "sensor",
          dacUnitId: selectedProjectId,
          expiresInDays: 365,
        }),
      });
      setSensorForm((current) => ({ ...current, apiKey: credential.key }));
      setSensorCredentialIssued(true);
      addNotification({
        type: "success",
        title: "Sensor credential provisioned",
        message: "Store it securely; the full credential is shown only once.",
      });
    });
  };

  const whitelistProject = async () => {
    await runOperation("Project whitelist", async () => {
      const token = requireOperator();
      if (!selectedProjectId || operator.session?.userType !== "admin") {
        throw new Error("A configured administrator wallet is required");
      }
      const result = await terraquraApi<{ txHash: string }>(
        `/v1/dac-units/${selectedProjectId}/whitelist`,
        { method: "POST", token },
      );
      setReceipt({
        label: "Project whitelisted on Aethelred",
        hash: result.txHash,
      });
      await loadPortfolio();
      await loadProject(selectedProjectId);
    });
  };

  const initiateVerification = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Proof-of-Physics verification", async () => {
      const token = requireOperator();
      if (!selectedProjectId) {
        throw new Error("Select a project first");
      }
      const run = await terraquraApi<{
        verificationId: string;
        status: VerificationRun["status"];
        estimatedCompletion: string;
      }>("/v1/verification/initiate", {
        method: "POST",
        token,
        body: JSON.stringify({
          dacUnitId: selectedProjectId,
          startTime: new Date(verificationForm.startTime).toISOString(),
          endTime: new Date(verificationForm.endTime).toISOString(),
        }),
      });
      const result = await terraquraApi<VerificationResult>(
        `/v1/verification/${run.verificationId}/result`,
      );
      setVerificationResult(result);
      setReceipt({
        label: "Verification source commitment",
        hash: result.sourceDataHash,
      });
      await loadProject(selectedProjectId);
      addNotification({
        type: result.status === "PASSED" ? "success" : "error",
        title:
          result.status === "PASSED"
            ? "Verification passed"
            : "Verification failed",
        message: `${result.readingCount} readings · ${result.logicCheck.kwhPerTonne.toFixed(1)} kWh/tCO₂`,
      });
    });
  };

  const issueCredits = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Credit issuance", async () => {
      const token = requireOperator();
      if (!address) {
        throw new Error("Connected wallet address is unavailable");
      }
      if (!latestVerification || latestVerification.status !== "PASSED") {
        throw new Error("A passed verification is required before issuance");
      }
      if (!metadataCid.trim()) {
        throw new Error("Pin the evidence metadata and enter its IPFS CID");
      }
      const minted = await terraquraApi<{
        creditId: string;
        tokenId: string;
        txHash: string;
        creditsIssued: number;
        explorerUrl: string;
      }>("/v1/credits/mint", {
        method: "POST",
        token,
        body: JSON.stringify({
          verificationId: latestVerification.id,
          recipientWallet: address,
          ipfsMetadataCid: metadataCid.trim(),
        }),
      });
      setReceipt({
        label: `Issued ${tonnesFromUnits(minted.creditsIssued)} tCO₂e`,
        hash: minted.txHash,
        explorerUrl: minted.explorerUrl,
      });
      await loadPortfolio();
      await loadProject(selectedProjectId);
      addNotification({
        type: "success",
        title: "Carbon units issued on Aethelred",
        message: `Token ${shortHash(minted.tokenId)} is owned by the connected wallet.`,
      });
    });
  };

  const createListing = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Marketplace listing", async () => {
      const token = requireOperator();
      if (!address || !publicClient || !selectedListingCredit) {
        throw new Error("Select an owned credit and connect its owner wallet");
      }
      if (
        selectedListingCredit.currentOwnerWallet?.toLowerCase() !==
        address.toLowerCase()
      ) {
        throw new Error("The connected wallet does not own this credit");
      }

      const amount = Number(listingForm.amount);
      const minPurchaseAmount = Number(listingForm.minPurchaseAmount);
      const durationDays = Number(listingForm.durationDays);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Listing amount must be a positive whole unit");
      }
      if (amount > selectedListingCredit.creditsIssued) {
        throw new Error("Listing amount exceeds the wallet balance");
      }
      if (
        !Number.isSafeInteger(minPurchaseAmount) ||
        minPurchaseAmount <= 0 ||
        minPurchaseAmount > amount
      ) {
        throw new Error("Minimum purchase must be within the listing amount");
      }
      if (
        !Number.isSafeInteger(durationDays) ||
        durationDays < 0 ||
        durationDays > 365
      ) {
        throw new Error("Listing duration must be between 0 and 365 days");
      }

      const pricePerUnit = parseEther(listingForm.priceAeth);
      if (pricePerUnit <= 0n) {
        throw new Error("Price per unit must be greater than zero");
      }
      const approved = await publicClient.readContract({
        address: CONTRACTS.carbonCredit,
        abi: CarbonCreditABI,
        functionName: "isApprovedForAll",
        args: [address, CONTRACTS.carbonMarketplace],
      });
      if (!approved) {
        const approvalHash = await writeContractAsync({
          address: CONTRACTS.carbonCredit,
          abi: CarbonCreditABI,
          functionName: "setApprovalForAll",
          args: [CONTRACTS.carbonMarketplace, true],
          chainId: CHAIN_ID,
        });
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
          confirmations: 1,
        });
        if (approvalReceipt.status !== "success") {
          throw new Error("Marketplace approval reverted on-chain");
        }
      }

      const txHash = await writeContractAsync({
        address: CONTRACTS.carbonMarketplace,
        abi: CarbonMarketplaceABI,
        functionName: "createListing",
        args: [
          BigInt(selectedListingCredit.tokenId),
          BigInt(amount),
          pricePerUnit,
          BigInt(minPurchaseAmount),
          BigInt(durationDays * 86_400),
        ],
        chainId: CHAIN_ID,
      });
      const chainReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (chainReceipt.status !== "success") {
        throw new Error("Marketplace listing reverted on-chain");
      }

      const listing = await terraquraApi<MarketplaceListing>(
        "/v1/marketplace/listings",
        {
          method: "POST",
          token,
          body: JSON.stringify({
            tokenId: BigInt(selectedListingCredit.tokenId).toString(),
            amount,
            pricePerUnit: pricePerUnit.toString(),
            minPurchaseAmount,
            durationDays,
            txHash,
          }),
        },
      );
      setReceipt({
        label: `Listed ${tonnesFromUnits(amount)} tCO₂e`,
        hash: listing.txHash,
        explorerUrl: listing.explorerUrl,
        blockNumber: chainReceipt.blockNumber
          ? Number(chainReceipt.blockNumber)
          : undefined,
      });
      setListingForm((current) => ({
        ...current,
        creditId: "",
        amount: "",
      }));
      await loadPortfolio();
      addNotification({
        type: "success",
        title: "Inventory listed",
        message: `${tonnesFromUnits(amount)} tCO₂e is in contract escrow.`,
      });
    });
  };

  const purchaseListing = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Marketplace purchase", async () => {
      const token = requireOperator();
      if (!address || !publicClient || !selectedPurchaseListing) {
        throw new Error("Select a listing and connect the buyer wallet");
      }
      if (
        selectedPurchaseListing.sellerWallet.toLowerCase() ===
        address.toLowerCase()
      ) {
        throw new Error("The seller cannot purchase their own listing");
      }
      const amount = Number(purchaseForm.amount);
      if (
        !Number.isSafeInteger(amount) ||
        amount < selectedPurchaseListing.minPurchaseAmount ||
        amount > selectedPurchaseListing.remainingAmount
      ) {
        throw new Error("Purchase amount is outside the listing limits");
      }
      const totalPrice =
        BigInt(selectedPurchaseListing.pricePerUnit) * BigInt(amount);
      const txHash = await writeContractAsync({
        address: CONTRACTS.carbonMarketplace,
        abi: CarbonMarketplaceABI,
        functionName: "purchase",
        args: [BigInt(selectedPurchaseListing.listingId), BigInt(amount)],
        value: totalPrice,
        chainId: CHAIN_ID,
      });
      const chainReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (chainReceipt.status !== "success") {
        throw new Error("Marketplace purchase reverted on-chain");
      }
      const purchase = await terraquraApi<{
        txHash: string;
        explorerUrl?: string;
      }>(`/v1/marketplace/listings/${selectedPurchaseListing.id}/purchase`, {
        method: "POST",
        token,
        body: JSON.stringify({ amount, txHash }),
      });
      setReceipt({
        label: `Purchased ${tonnesFromUnits(amount)} tCO₂e`,
        hash: purchase.txHash,
        explorerUrl: purchase.explorerUrl,
        blockNumber: chainReceipt.blockNumber
          ? Number(chainReceipt.blockNumber)
          : undefined,
      });
      setPurchaseForm({ listingId: "", amount: "" });
      await loadPortfolio();
      addNotification({
        type: "success",
        title: "Purchase finalized",
        message: "The acquired units are now indexed to the buyer wallet.",
      });
    });
  };

  const cancelListing = async (listing: MarketplaceListing) => {
    await runOperation("Listing cancellation", async () => {
      const token = requireOperator();
      if (!address || !publicClient) {
        throw new Error("Connect the listing owner wallet");
      }
      if (listing.sellerWallet.toLowerCase() !== address.toLowerCase()) {
        throw new Error("Only the listing seller can cancel it");
      }
      const txHash = await writeContractAsync({
        address: CONTRACTS.carbonMarketplace,
        abi: CarbonMarketplaceABI,
        functionName: "cancelListing",
        args: [BigInt(listing.listingId)],
        chainId: CHAIN_ID,
      });
      const chainReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (chainReceipt.status !== "success") {
        throw new Error("Listing cancellation reverted on-chain");
      }
      const cancelled = await terraquraApi<MarketplaceListing>(
        `/v1/marketplace/listings/${listing.id}/cancel`,
        {
          method: "POST",
          token,
          body: JSON.stringify({ txHash }),
        },
      );
      setReceipt({
        label: `Cancelled listing ${cancelled.listingId}`,
        hash: txHash,
        blockNumber: chainReceipt.blockNumber
          ? Number(chainReceipt.blockNumber)
          : undefined,
      });
      await loadPortfolio();
      addNotification({
        type: "success",
        title: "Listing cancelled",
        message: "Unsold inventory returned to the seller wallet.",
      });
    });
  };

  const retireCredit = async (event: React.FormEvent) => {
    event.preventDefault();
    await runOperation("Credit retirement", async () => {
      const token = requireOperator();
      if (!publicClient || !selectedRetirementCredit || !address) {
        throw new Error("Select an owned credit and connect its owner wallet");
      }
      if (
        selectedRetirementCredit.currentOwnerWallet?.toLowerCase() !==
        address.toLowerCase()
      ) {
        throw new Error("The connected wallet does not own this credit");
      }

      const amount = Number(retirementForm.amount);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error("Retirement amount must be a positive whole unit");
      }
      if (amount > selectedRetirementCredit.creditsIssued) {
        throw new Error("Retirement amount exceeds the wallet balance");
      }
      if (!retirementForm.reason.trim()) {
        throw new Error("A retirement purpose is required for the audit trail");
      }

      const txHash = await writeContractAsync({
        address: CONTRACTS.carbonCredit,
        abi: CarbonCreditABI,
        functionName: "retireCredits",
        args: [
          BigInt(selectedRetirementCredit.tokenId),
          BigInt(amount),
          retirementForm.reason.trim(),
        ],
        chainId: CHAIN_ID,
      });
      const chainReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (chainReceipt.status !== "success") {
        throw new Error("The wallet-signed retirement reverted on-chain");
      }

      const finalized = await terraquraApi<{
        creditId: string;
        amountRetired: number;
        remainingAmount: number;
        txHash: string;
        blockNumber: number;
        retiredAt: string;
        certificateUrl: string;
      }>(`/v1/credits/${selectedRetirementCredit.id}/retire`, {
        method: "POST",
        token,
        body: JSON.stringify({
          amount,
          reason: retirementForm.reason.trim(),
          txHash,
        }),
      });
      setReceipt({
        label: `Retired ${tonnesFromUnits(finalized.amountRetired)} tCO₂e`,
        hash: finalized.txHash,
        blockNumber: finalized.blockNumber,
      });
      await loadPortfolio();
      await loadProject(selectedProjectId);
      addNotification({
        type: "success",
        title: "Retirement finalized",
        message:
          finalized.remainingAmount === 0
            ? "The credit balance was permanently burned."
            : `${tonnesFromUnits(finalized.remainingAmount)} tCO₂e remains.`,
      });
    });
  };

  const totalIssued = credits.reduce(
    (sum, credit) =>
      sum +
      credit.creditsIssued +
      (credit.escrowedAmount ?? 0) +
      credit.retiredAmount,
    0,
  );
  const totalRetired = credits.reduce(
    (sum, credit) => sum + credit.retiredAmount,
    0,
  );
  const mutationAllowed =
    operator.isAuthenticated && operator.session?.kycStatus === "approved";
  const overviewMetrics: Array<{
    label: string;
    value: string;
    icon: LucideIcon;
  }> = [
    {
      label: "Registered projects",
      value: projects.length.toLocaleString(),
      icon: Factory,
    },
    {
      label: "Active facilities",
      value: projects
        .filter((project) => project.status === "active")
        .length.toLocaleString(),
      icon: Radio,
    },
    {
      label: "Verified issuance",
      value: `${tonnesFromUnits(totalIssued)} tCO₂e`,
      icon: Fingerprint,
    },
    {
      label: "Permanently retired",
      value: `${tonnesFromUnits(totalRetired)} tCO₂e`,
      icon: Leaf,
    },
  ];

  return (
    <div className="min-h-screen bg-[#020605] text-white">
      <TopNav />
      <ToastContainer />

      <main className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-5 border-b border-white/[0.08] pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-emerald-400/75">
              <span className="h-2 w-2 bg-emerald-400" />
              Carbon operations workbench
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">
              From measured removal to an auditable on-chain retirement
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/50">
              Operate the complete Direct Air Capture credit lifecycle against
              TerraQura&apos;s configured API and Aethelred contracts. Every
              state shown below is loaded from the registry, sensor store,
              verification engine, or chain receipt.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/35">
              API {TERRAQURA_API_URL.replace(/^https?:\/\//, "")}
            </span>
            <ActionButton
              tone="secondary"
              disabled={busy !== null}
              onClick={() => {
                void loadPortfolio();
                void loadProject(selectedProjectId);
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </ActionButton>
          </div>
        </div>

        {pageError && (
          <div className="mb-5 flex items-start gap-3 border border-red-400/25 bg-red-400/[0.06] p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-100">
                Operation requires attention
              </p>
              <p className="mt-1 text-xs leading-5 text-red-100/60">
                {pageError}
              </p>
              {pageError.includes("KYC") && (
                <p className="mt-2 text-xs text-white/40">
                  This is a real production gate; TerraQura does not bypass
                  operator identity controls for controlled testnet operations.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPageError(null)}
              className="text-xs text-white/40 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 border border-white/[0.08] sm:grid-cols-4">
          {overviewMetrics.map(({ label, value, icon: Icon }, index) => (
            <div
              key={label}
              className={`p-4 sm:p-5 ${
                index < 3 ? "border-r border-white/[0.08]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/35">
                  {label}
                </p>
                <Icon className="h-4 w-4 text-emerald-400/60" />
              </div>
              <p className="mt-2 font-mono text-xl text-white">{value}</p>
            </div>
          ))}
        </div>

        <OperationGate
          connected={isConnected}
          authenticated={operator.isAuthenticated}
          kycStatus={operator.session?.kycStatus}
          loading={operator.isLoading}
          onConnect={openConnectModal}
          onSignIn={() => {
            void operator.signIn().catch((cause) => {
              setPageError(
                cause instanceof Error
                  ? cause.message
                  : "Wallet sign-in failed",
              );
            });
          }}
          onStartKyc={() => {
            setPageError(null);
            setShowKyc(true);
            const action =
              kyc.status.state === "not_started" ||
              kyc.status.state === "unavailable"
                ? kyc.initiateKyc()
                : kyc.refreshToken().then(() => undefined);
            void action.catch((cause) => {
              setPageError(
                cause instanceof Error
                  ? cause.message
                  : "Identity review could not be opened",
              );
            });
          }}
        />

        {showKyc && operator.token && (
          <div className="mt-6 border border-white/[0.08] bg-[#050b0a] p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">
                  Operator identity review
                </p>
                <p className="mt-1 text-xs text-white/45">
                  Complete the hosted verification, then sign in again to issue
                  a session with updated compliance claims.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowKyc(false)}
                className="text-xs text-white/45 hover:text-white"
              >
                Close
              </button>
            </div>
            {kyc.status.accessToken ? (
              <SumsubWidget
                accessToken={kyc.status.accessToken}
                onTokenExpired={kyc.refreshToken}
                onComplete={() => {
                  void kyc.refetch();
                  operator.signOut();
                  setShowKyc(false);
                }}
                onError={(error) => setPageError(error.message)}
              />
            ) : (
              <p className="text-sm text-white/50">
                {kyc.error || "Preparing the secure identity review…"}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <div className="border border-white/[0.08] bg-[#050b0a]">
              <div className="border-b border-white/[0.08] p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                  Lifecycle status
                </p>
                <p className="mt-1 text-sm font-medium text-white/80">
                  {selectedProject?.name || "Select a project"}
                </p>
              </div>
              <ol>
                {LIFECYCLE.map((stage, index) => {
                  const Icon = stage.icon;
                  const complete = index < currentStage;
                  const active = index === currentStage;
                  return (
                    <li
                      key={stage.id}
                      className="relative grid grid-cols-[28px_1fr] gap-3 px-4 py-3"
                    >
                      {index < LIFECYCLE.length - 1 && (
                        <span
                          className={`absolute left-[27px] top-9 h-[calc(100%-18px)] w-px ${
                            complete ? "bg-emerald-400/50" : "bg-white/10"
                          }`}
                        />
                      )}
                      <span
                        className={`relative z-10 flex h-7 w-7 items-center justify-center border ${
                          complete
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
                            : active
                              ? "border-emerald-300 bg-emerald-300 text-[#04100c]"
                              : "border-white/10 bg-[#050b0a] text-white/25"
                        }`}
                      >
                        {complete ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div>
                        <p
                          className={`text-sm ${
                            active
                              ? "font-semibold text-white"
                              : "text-white/65"
                          }`}
                        >
                          {stage.label}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-4 text-white/35">
                          {stage.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            <div className="border border-white/[0.08] bg-[#050b0a] p-4">
              <label className={labelClass} htmlFor="project-select">
                Active record
              </label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value);
                  setRetirementForm((current) => ({
                    ...current,
                    creditId: "",
                    amount: "",
                  }));
                }}
                className={fieldClass}
              >
                <option value="">No project selected</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {project.status}
                  </option>
                ))}
              </select>

              {projectDetail && (
                <dl className="mt-4 space-y-3 border-t border-white/[0.07] pt-4 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/35">Registry status</dt>
                    <dd>
                      <StatusBadge status={projectDetail.status} />
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/35">Technology</dt>
                    <dd className="text-right text-white/65">
                      {projectDetail.technologyType || "DAC"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/35">Location</dt>
                    <dd className="font-mono text-white/65">
                      {projectDetail.latitude.toFixed(3)},{" "}
                      {projectDetail.longitude.toFixed(3)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/35">Grid intensity</dt>
                    <dd className="font-mono text-white/65">
                      {projectDetail.gridIntensityGco2PerKwh ?? "—"} gCO₂/kWh
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <Panel
              id="project"
              eyebrow="01 · Project boundary"
              title="Register the removal facility and its emissions baseline"
              action={
                selectedProject && (
                  <StatusBadge status={selectedProject.status} />
                )
              }
            >
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <form
                  onSubmit={registerProject}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className={`${labelClass} sm:col-span-2`}>
                    Facility name
                    <input
                      value={projectForm.name}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          name: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Latitude
                    <input
                      type="number"
                      step="0.000001"
                      min="-90"
                      max="90"
                      value={projectForm.latitude}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          latitude: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Longitude
                    <input
                      type="number"
                      step="0.000001"
                      min="-180"
                      max="180"
                      value={projectForm.longitude}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          longitude: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Country code
                    <input
                      maxLength={2}
                      value={projectForm.countryCode}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          countryCode: event.target.value.toUpperCase(),
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Annual capacity (tCO₂)
                    <input
                      type="number"
                      min="1"
                      value={projectForm.capacityTonnesPerYear}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          capacityTonnesPerYear: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Technology
                    <select
                      value={projectForm.technologyType}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          technologyType: event.target.value,
                        }))
                      }
                      className={fieldClass}
                    >
                      <option>Direct air capture</option>
                      <option>Point-source capture</option>
                      <option>Mineralization</option>
                    </select>
                  </label>
                  <label className={labelClass}>
                    Grid intensity (gCO₂/kWh)
                    <input
                      type="number"
                      min="0"
                      value={projectForm.gridIntensityGco2PerKwh}
                      onChange={(event) =>
                        setProjectForm((form) => ({
                          ...form,
                          gridIntensityGco2PerKwh: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <ActionButton
                      type="submit"
                      disabled={!mutationAllowed || busy !== null}
                    >
                      <Factory className="h-4 w-4" />
                      Register project
                    </ActionButton>
                  </div>
                </form>

                <div className="border-l-2 border-emerald-400/30 bg-emerald-400/[0.035] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Control point
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/65">
                    Registration creates a durable project record tied to the
                    authenticated operator. An administrator then whitelists its
                    bytes32 unit ID on the VerificationEngine contract.
                  </p>
                  <div className="mt-5 space-y-3 text-xs text-white/45">
                    {[
                      "Geospatial boundary captured",
                      "Annual capacity declared",
                      "Grid emissions factor required",
                      "On-chain whitelist before verification",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2">
                        <Circle className="h-2.5 w-2.5 fill-emerald-400/50 text-emerald-400/50" />
                        {item}
                      </div>
                    ))}
                  </div>
                  {operator.session?.userType === "admin" &&
                    projectDetail?.status === "pending" && (
                      <div className="mt-5">
                        <ActionButton
                          disabled={busy !== null}
                          onClick={() => void whitelistProject()}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Whitelist on Aethelred
                        </ActionButton>
                      </div>
                    )}
                </div>
              </div>
            </Panel>

            <Panel
              id="mrv"
              eyebrow="02 · Measurement, reporting, verification"
              title="Submit authenticated sensor evidence"
              action={
                summary ? (
                  <span className="font-mono text-xs text-white/45">
                    {summary.readingCount} accepted readings
                  </span>
                ) : null
              }
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
                <form
                  onSubmit={submitEvidence}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className={`${labelClass} sm:col-span-2`}>
                    Provisioned sensor API key
                    <input
                      type={sensorCredentialIssued ? "text" : "password"}
                      autoComplete="off"
                      value={sensorForm.apiKey}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          apiKey: event.target.value,
                        }))
                      }
                      placeholder="Issued to this facility by the TerraQura operator"
                      required
                      className={fieldClass}
                    />
                    <span className="mt-2 flex flex-wrap items-center gap-3">
                      <ActionButton
                        tone="secondary"
                        disabled={
                          !mutationAllowed ||
                          !selectedProjectId ||
                          busy !== null
                        }
                        onClick={() => void provisionSensorCredential()}
                      >
                        Provision credential
                      </ActionButton>
                      {sensorCredentialIssued && (
                        <span className="text-xs text-amber-200/70">
                          Copy this credential now; it cannot be retrieved
                          later.
                        </span>
                      )}
                    </span>
                  </label>
                  <label className={labelClass}>
                    Sensor ID
                    <input
                      value={sensorForm.sensorId}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          sensorId: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Measured at
                    <input
                      type="datetime-local"
                      value={sensorForm.timestamp}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          timestamp: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    CO₂ captured (kg/h)
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={sensorForm.co2CaptureRateKgHour}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          co2CaptureRateKgHour: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Energy consumed (kWh)
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={sensorForm.energyConsumptionKwh}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          energyConsumptionKwh: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    CO₂ purity (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={sensorForm.co2PurityPercentage}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          co2PurityPercentage: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Measurement interval (seconds)
                    <input
                      type="number"
                      min="1"
                      max="86400"
                      step="1"
                      value={sensorForm.measurementDurationSeconds}
                      onChange={(event) =>
                        setSensorForm((form) => ({
                          ...form,
                          measurementDurationSeconds: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <div className="flex items-end">
                    <ActionButton
                      type="submit"
                      disabled={!selectedProjectId || busy !== null}
                    >
                      <Database className="h-4 w-4" />
                      Commit evidence
                    </ActionButton>
                  </div>
                </form>

                <div className="border border-white/[0.08] bg-[#08100f]">
                  <div className="border-b border-white/[0.07] px-4 py-3">
                    <p className="text-xs font-medium text-white/70">
                      Live MRV window
                    </p>
                  </div>
                  <dl className="grid grid-cols-2">
                    {[
                      [
                        "Captured",
                        `${summary?.totalCo2CapturedKg.toLocaleString() ?? "0"} kg`,
                      ],
                      [
                        "Energy",
                        `${summary?.totalEnergyConsumedKwh.toLocaleString() ?? "0"} kWh`,
                      ],
                      [
                        "Efficiency",
                        summary?.kwhPerTonne
                          ? `${summary.kwhPerTonne.toFixed(1)} kWh/t`
                          : "—",
                      ],
                      [
                        "Purity",
                        summary?.avgPurityPercentage
                          ? `${summary.avgPurityPercentage.toFixed(1)}%`
                          : "—",
                      ],
                      [
                        "Anomalies",
                        summary?.anomalyCount.toLocaleString() ?? "0",
                      ],
                      ["Rating", summary?.efficiencyRating ?? "N/A"],
                    ].map(([label, value], index) => (
                      <div
                        key={label}
                        className={`p-4 ${
                          index % 2 === 0 ? "border-r border-white/[0.07]" : ""
                        } ${index < 4 ? "border-b border-white/[0.07]" : ""}`}
                      >
                        <dt className="text-[10px] uppercase tracking-wider text-white/30">
                          {label}
                        </dt>
                        <dd className="mt-1 font-mono text-sm text-white/75">
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </Panel>

            <Panel
              id="verify"
              eyebrow="03 · Proof-of-Physics"
              title="Verify source integrity, thermodynamics, and uniqueness"
              action={
                latestVerification ? (
                  <StatusBadge status={latestVerification.status} />
                ) : null
              }
            >
              <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <form onSubmit={initiateVerification} className="space-y-4">
                  <label className={labelClass}>
                    Capture window starts
                    <input
                      type="datetime-local"
                      value={verificationForm.startTime}
                      onChange={(event) =>
                        setVerificationForm((form) => ({
                          ...form,
                          startTime: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Capture window ends
                    <input
                      type="datetime-local"
                      value={verificationForm.endTime}
                      onChange={(event) =>
                        setVerificationForm((form) => ({
                          ...form,
                          endTime: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <ActionButton
                    type="submit"
                    disabled={
                      !mutationAllowed ||
                      projectDetail?.status !== "active" ||
                      busy !== null
                    }
                  >
                    <Gauge className="h-4 w-4" />
                    Run verification
                  </ActionButton>
                  {projectDetail && projectDetail.status !== "active" && (
                    <p className="text-xs leading-5 text-amber-200/60">
                      The administrator must confirm the facility whitelist
                      transaction before verification can run.
                    </p>
                  )}
                </form>

                <div className="grid gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
                  {[
                    {
                      label: "Source",
                      status: verificationResult?.sourceCheck.status,
                      message:
                        verificationResult?.sourceCheck.message ||
                        "Awaiting an eligible evidence window",
                    },
                    {
                      label: "Logic",
                      status: verificationResult?.logicCheck.status,
                      message:
                        verificationResult?.logicCheck.message ||
                        "200–600 kWh per captured tonne; ≥90% purity",
                    },
                    {
                      label: "Mint",
                      status: verificationResult?.mintCheck.status,
                      message:
                        verificationResult?.mintCheck.message ||
                        "Rejects previously used source commitments",
                    },
                  ].map((check) => {
                    const passed = check.status === "PASSED";
                    const failed = check.status === "FAILED";
                    return (
                      <div key={check.label} className="bg-[#07100e] p-4">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">
                            {check.label}
                          </p>
                          {passed ? (
                            <Check className="h-4 w-4 text-emerald-300" />
                          ) : failed ? (
                            <AlertTriangle className="h-4 w-4 text-red-300" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 text-white/20" />
                          )}
                        </div>
                        <p className="mt-5 text-xs leading-5 text-white/40">
                          {check.message}
                        </p>
                      </div>
                    );
                  })}
                  {verificationResult && (
                    <div className="bg-[#06120f] p-4 sm:col-span-3">
                      <div className="grid gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30">
                            Readings
                          </p>
                          <p className="mt-1 font-mono text-sm">
                            {verificationResult.readingCount}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30">
                            kWh/tCO₂
                          </p>
                          <p className="mt-1 font-mono text-sm">
                            {verificationResult.logicCheck.kwhPerTonne.toFixed(
                              2,
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30">
                            Efficiency factor
                          </p>
                          <p className="mt-1 font-mono text-sm">
                            {(
                              verificationResult.logicCheck.efficiencyFactor /
                              100
                            ).toFixed(2)}
                            %
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-white/30">
                            Issuable
                          </p>
                          <p className="mt-1 font-mono text-sm text-emerald-300">
                            {tonnesFromUnits(
                              verificationResult.creditsToMint ?? 0,
                            )}{" "}
                            tCO₂e
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Panel>

            <Panel
              id="issue"
              eyebrow="04 · Registry issuance"
              title="Anchor the verified removal as carbon units"
              action={
                projectCredits[0]?.mintTxHash ? (
                  <span className="font-mono text-xs text-emerald-300">
                    {shortHash(projectCredits[0].mintTxHash)}
                  </span>
                ) : null
              }
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
                <form onSubmit={issueCredits} className="space-y-4">
                  <label className={labelClass}>
                    IPFS metadata CID
                    <input
                      value={metadataCid}
                      onChange={(event) => setMetadataCid(event.target.value)}
                      placeholder="bafy… or Qm…"
                      required
                      className={fieldClass}
                    />
                  </label>
                  <p className="text-xs leading-5 text-white/40">
                    The metadata object should contain methodology, capture
                    interval, device calibration, source commitment, and
                    verification result. TerraQura stores its CID in the token
                    metadata.
                  </p>
                  <ActionButton
                    type="submit"
                    disabled={
                      !mutationAllowed ||
                      latestVerification?.status !== "PASSED" ||
                      projectCredits.length > 0 ||
                      busy !== null
                    }
                  >
                    <Fingerprint className="h-4 w-4" />
                    Issue verified units
                  </ActionButton>
                </form>

                <div className="overflow-x-auto border border-white/[0.08]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.08] bg-white/[0.025] text-[10px] uppercase tracking-[0.13em] text-white/35">
                      <tr>
                        <th className="px-3 py-3 font-medium">Token</th>
                        <th className="px-3 py-3 font-medium">Available</th>
                        <th className="px-3 py-3 font-medium">Escrow</th>
                        <th className="px-3 py-3 font-medium">Retired</th>
                        <th className="px-3 py-3 font-medium">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectCredits.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-3 py-8 text-center text-white/30"
                          >
                            No on-chain issuance for this project
                          </td>
                        </tr>
                      ) : (
                        projectCredits.map((credit) => (
                          <tr
                            key={credit.id}
                            className="border-b border-white/[0.05] last:border-0"
                          >
                            <td className="px-3 py-3 font-mono text-white/65">
                              {shortHash(credit.tokenId)}
                            </td>
                            <td className="px-3 py-3 font-mono text-white/65">
                              {tonnesFromUnits(credit.creditsIssued)} t
                            </td>
                            <td className="px-3 py-3 font-mono text-amber-200/70">
                              {tonnesFromUnits(credit.escrowedAmount ?? 0)} t
                            </td>
                            <td className="px-3 py-3 font-mono text-white/65">
                              {tonnesFromUnits(credit.retiredAmount)} t
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge status={credit.verificationStatus} />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel
              id="market"
              eyebrow="05 · Contract marketplace"
              title="List and acquire verified removal inventory"
              action={
                <span className="font-mono text-xs text-white/40">
                  {projectListings.length} active
                </span>
              }
            >
              <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-6">
                  <form
                    onSubmit={createListing}
                    className="border border-white/[0.08] p-4"
                  >
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                      Sell owned inventory
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={`${labelClass} sm:col-span-2`}>
                        Owned credit
                        <select
                          value={
                            listingForm.creditId ||
                            selectedListingCredit?.id ||
                            ""
                          }
                          onChange={(event) => {
                            const credit = projectCredits.find(
                              (candidate) =>
                                candidate.id === event.target.value,
                            );
                            setListingForm((form) => ({
                              ...form,
                              creditId: event.target.value,
                              amount: credit
                                ? String(credit.creditsIssued)
                                : "",
                            }));
                          }}
                          className={fieldClass}
                        >
                          <option value="">Select inventory</option>
                          {projectCredits
                            .filter(
                              (credit) =>
                                credit.creditsIssued > 0 &&
                                credit.currentOwnerWallet?.toLowerCase() ===
                                  address?.toLowerCase(),
                            )
                            .map((credit) => (
                              <option key={credit.id} value={credit.id}>
                                {shortHash(credit.tokenId)} ·{" "}
                                {tonnesFromUnits(credit.creditsIssued)} tCO₂e
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Amount (kgCO₂ units)
                        <input
                          type="number"
                          min="1"
                          step="1"
                          max={selectedListingCredit?.creditsIssued}
                          value={listingForm.amount}
                          onChange={(event) =>
                            setListingForm((form) => ({
                              ...form,
                              amount: event.target.value,
                            }))
                          }
                          required
                          className={fieldClass}
                        />
                      </label>
                      <label className={labelClass}>
                        AETH per unit
                        <input
                          type="number"
                          min="0.000000000000000001"
                          step="0.000000000000000001"
                          value={listingForm.priceAeth}
                          onChange={(event) =>
                            setListingForm((form) => ({
                              ...form,
                              priceAeth: event.target.value,
                            }))
                          }
                          required
                          className={fieldClass}
                        />
                      </label>
                      <label className={labelClass}>
                        Minimum purchase
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={listingForm.minPurchaseAmount}
                          onChange={(event) =>
                            setListingForm((form) => ({
                              ...form,
                              minPurchaseAmount: event.target.value,
                            }))
                          }
                          required
                          className={fieldClass}
                        />
                      </label>
                      <label className={labelClass}>
                        Duration (days)
                        <input
                          type="number"
                          min="0"
                          max="365"
                          step="1"
                          value={listingForm.durationDays}
                          onChange={(event) =>
                            setListingForm((form) => ({
                              ...form,
                              durationDays: event.target.value,
                            }))
                          }
                          required
                          className={fieldClass}
                        />
                      </label>
                    </div>
                    <div className="mt-4">
                      <ActionButton
                        type="submit"
                        disabled={
                          !mutationAllowed ||
                          !selectedListingCredit ||
                          busy !== null
                        }
                      >
                        <LockKeyhole className="h-4 w-4" />
                        Approve escrow and list
                      </ActionButton>
                    </div>
                  </form>

                  <form
                    onSubmit={purchaseListing}
                    className="border border-white/[0.08] p-4"
                  >
                    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                      Buy listed inventory
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className={`${labelClass} sm:col-span-2`}>
                        Active listing
                        <select
                          value={
                            purchaseForm.listingId ||
                            selectedPurchaseListing?.id ||
                            ""
                          }
                          onChange={(event) => {
                            const listing = projectListings.find(
                              (candidate) =>
                                candidate.id === event.target.value,
                            );
                            setPurchaseForm({
                              listingId: event.target.value,
                              amount: listing
                                ? String(listing.minPurchaseAmount)
                                : "",
                            });
                          }}
                          className={fieldClass}
                        >
                          <option value="">Select listing</option>
                          {projectListings
                            .filter(
                              (listing) =>
                                listing.sellerWallet.toLowerCase() !==
                                address?.toLowerCase(),
                            )
                            .map((listing) => (
                              <option key={listing.id} value={listing.id}>
                                #{listing.listingId} ·{" "}
                                {tonnesFromUnits(listing.remainingAmount)} t ·{" "}
                                {formatEther(BigInt(listing.pricePerUnit))} AETH
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Amount (kgCO₂ units)
                        <input
                          type="number"
                          min={selectedPurchaseListing?.minPurchaseAmount ?? 1}
                          max={selectedPurchaseListing?.remainingAmount}
                          step="1"
                          value={purchaseForm.amount}
                          onChange={(event) =>
                            setPurchaseForm((form) => ({
                              ...form,
                              amount: event.target.value,
                            }))
                          }
                          required
                          className={fieldClass}
                        />
                      </label>
                      <div className="border border-white/[0.07] bg-white/[0.025] p-3">
                        <p className="text-[10px] uppercase tracking-[0.13em] text-white/35">
                          Wallet payment
                        </p>
                        <p className="mt-2 font-mono text-sm text-cyan-200">
                          {selectedPurchaseListing && purchaseForm.amount
                            ? formatEther(
                                BigInt(selectedPurchaseListing.pricePerUnit) *
                                  BigInt(Number(purchaseForm.amount || "0")),
                              )
                            : "0"}{" "}
                          AETH
                        </p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ActionButton
                        type="submit"
                        disabled={
                          !mutationAllowed ||
                          !selectedPurchaseListing ||
                          busy !== null
                        }
                      >
                        <WalletCards className="h-4 w-4" />
                        Sign purchase
                      </ActionButton>
                    </div>
                  </form>
                </div>

                <div className="overflow-x-auto border border-white/[0.08]">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.08] bg-white/[0.025] text-[10px] uppercase tracking-[0.13em] text-white/35">
                      <tr>
                        <th className="px-3 py-3 font-medium">Listing</th>
                        <th className="px-3 py-3 font-medium">Seller</th>
                        <th className="px-3 py-3 font-medium">Remaining</th>
                        <th className="px-3 py-3 font-medium">Price / unit</th>
                        <th className="px-3 py-3 font-medium">Expiry</th>
                        <th className="px-3 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectListings.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-10 text-center text-white/30"
                          >
                            No confirmed active listings for this project
                          </td>
                        </tr>
                      ) : (
                        projectListings.map((listing) => (
                          <tr
                            key={listing.id}
                            className="border-b border-white/[0.05] last:border-0"
                          >
                            <td className="px-3 py-3 font-mono text-white/65">
                              #{listing.listingId}
                            </td>
                            <td className="px-3 py-3 font-mono text-white/50">
                              {shortHash(listing.sellerWallet)}
                            </td>
                            <td className="px-3 py-3 font-mono text-white/65">
                              {tonnesFromUnits(listing.remainingAmount)} t
                            </td>
                            <td className="px-3 py-3 font-mono text-emerald-300">
                              {formatEther(BigInt(listing.pricePerUnit))} AETH
                            </td>
                            <td className="px-3 py-3 text-white/45">
                              {listing.expiresAt
                                ? new Date(
                                    listing.expiresAt,
                                  ).toLocaleDateString()
                                : "Open"}
                            </td>
                            <td className="px-3 py-3">
                              {listing.sellerWallet.toLowerCase() ===
                              address?.toLowerCase() ? (
                                <button
                                  type="button"
                                  onClick={() => void cancelListing(listing)}
                                  disabled={busy !== null}
                                  className="text-xs font-semibold text-amber-200 hover:text-amber-100 disabled:opacity-40"
                                >
                                  Cancel
                                </button>
                              ) : listing.explorerUrl ? (
                                <a
                                  href={listing.explorerUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-300 hover:text-emerald-200"
                                >
                                  Receipt
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </Panel>

            <Panel
              id="retirement"
              eyebrow="06 · Claims and retirement"
              title="Permanently retire units with the owner wallet"
            >
              <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
                <form
                  onSubmit={retireCredit}
                  className="grid gap-4 sm:grid-cols-2"
                >
                  <label className={`${labelClass} sm:col-span-2`}>
                    Owned credit
                    <select
                      value={
                        retirementForm.creditId ||
                        selectedRetirementCredit?.id ||
                        ""
                      }
                      onChange={(event) => {
                        const credit = projectCredits.find(
                          (candidate) => candidate.id === event.target.value,
                        );
                        setRetirementForm((form) => ({
                          ...form,
                          creditId: event.target.value,
                          amount: credit ? String(credit.creditsIssued) : "",
                        }));
                      }}
                      className={fieldClass}
                    >
                      <option value="">Select inventory</option>
                      {projectCredits
                        .filter(
                          (credit) =>
                            credit.creditsIssued > 0 &&
                            credit.currentOwnerWallet?.toLowerCase() ===
                              address?.toLowerCase(),
                        )
                        .map((credit) => (
                          <option key={credit.id} value={credit.id}>
                            {shortHash(credit.tokenId)} ·{" "}
                            {tonnesFromUnits(credit.creditsIssued)} tCO₂e
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className={labelClass}>
                    Amount (kgCO₂ units)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      max={selectedRetirementCredit?.creditsIssued}
                      value={retirementForm.amount}
                      onChange={(event) =>
                        setRetirementForm((form) => ({
                          ...form,
                          amount: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Retirement purpose
                    <input
                      value={retirementForm.reason}
                      onChange={(event) =>
                        setRetirementForm((form) => ({
                          ...form,
                          reason: event.target.value,
                        }))
                      }
                      required
                      className={fieldClass}
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <ActionButton
                      type="submit"
                      disabled={
                        !mutationAllowed ||
                        !selectedRetirementCredit ||
                        busy !== null
                      }
                    >
                      <Leaf className="h-4 w-4" />
                      Sign and retire on-chain
                    </ActionButton>
                  </div>
                </form>

                <div className="border-l-2 border-cyan-300/30 bg-cyan-300/[0.035] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    No server-side burn
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    The connected owner calls{" "}
                    <code className="font-mono text-cyan-200">
                      retireCredits
                    </code>{" "}
                    directly. The API updates its registry only after it
                    verifies the confirmed contract, signer, token, amount,
                    reason, and emitted event.
                  </p>
                </div>
              </div>
            </Panel>

            {receipt && (
              <div className="border border-emerald-300/25 bg-emerald-300/[0.05] p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 text-emerald-300" />
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {receipt.label}
                      </p>
                      <p className="mt-1 break-all font-mono text-xs text-white/50">
                        {receipt.hash}
                      </p>
                      {receipt.blockNumber !== undefined && (
                        <p className="mt-2 text-xs text-white/35">
                          Confirmed in block{" "}
                          {receipt.blockNumber.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  {receipt.explorerUrl && (
                    <a
                      href={receipt.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-300 hover:text-emerald-200"
                    >
                      Open chain receipt
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-px border border-white/[0.08] bg-white/[0.08] sm:grid-cols-3">
              <div className="bg-[#050b0a] p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Investor view
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Trace capital to measured removal, issued inventory, and
                  retirement outcomes.
                </p>
              </div>
              <div className="bg-[#050b0a] p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Regulator view
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Inspect project controls, source commitments, physics checks,
                  and claim finality.
                </p>
              </div>
              <div className="bg-[#050b0a] p-5">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Developer view
                </p>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Reproduce every operation through{" "}
                  <a
                    href={`${TERRAQURA_API_URL}/docs`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-300 hover:text-emerald-200"
                  >
                    OpenAPI
                  </a>{" "}
                  and verified contract receipts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <DAppFooter />
    </div>
  );
}
