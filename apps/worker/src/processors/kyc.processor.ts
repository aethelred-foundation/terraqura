// TerraQura KYC Processor
// Handles async KYC verification with external providers

import crypto from "crypto";

import { Job, Processor } from "bullmq";
import type { KycCheckJobData } from "@terraqura/queue";

import {
  createScopedLogger,
  logReference,
  serializeError,
} from "../lib/logger.js";
import { getWorkerRuntimeEnv } from "../lib/runtime-env.js";

interface KycResult {
  success: boolean;
  status: "verified" | "pending" | "rejected" | "error";
  applicantId: string;
  reviewResult?: {
    reviewAnswer: string;
    rejectLabels?: string[];
    reviewRejectType?: string;
  };
  riskScore?: number;
  sanctionsHit?: boolean;
  error?: string;
}

function deriveRiskScore(status: KycResult["status"]): number {
  switch (status) {
    case "verified":
      return 10;
    case "pending":
      return 50;
    case "rejected":
      return 90;
    case "error":
    default:
      return 100;
  }
}

function deriveSumsubStatus(reviewStatus?: string, reviewAnswer?: string): KycResult["status"] {
  if (reviewStatus === "completed") {
    if (reviewAnswer === "GREEN") {
      return "verified";
    }
    if (reviewAnswer === "RED") {
      return "rejected";
    }
  }
  return "pending";
}

function deriveOnfidoStatus(result?: string): KycResult["status"] {
  if (result === "clear") {
    return "verified";
  }
  if (result === "consider") {
    return "pending";
  }
  return "rejected";
}

function providerHttpError(provider: "Sumsub" | "Onfido", statusCode: number): Error {
  const error = new Error(`${provider} API error: ${statusCode}`);
  error.name = "ProviderHttpError";
  (error as Error & { statusCode: number }).statusCode = statusCode;
  return error;
}

async function sumsubRequest<T>(params: {
  appToken: string;
  secretKey: string;
  baseUrl: string;
  method: "GET" | "POST";
  path: string;
}): Promise<T> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac("sha256", params.secretKey)
    .update(`${timestamp}${params.method}${params.path}`)
    .digest("hex");

  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: params.method,
    headers: {
      "X-App-Token": params.appToken,
      "X-App-Access-Ts": String(timestamp),
      "X-App-Access-Sig": signature,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw providerHttpError("Sumsub", response.status);
  }

  return response.json() as Promise<T>;
}

async function onfidoRequest<T>(params: {
  apiToken: string;
  baseUrl: string;
  path: string;
}): Promise<T> {
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: "GET",
    headers: {
      Authorization: `Token token=${params.apiToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw providerHttpError("Onfido", response.status);
  }

  return response.json() as Promise<T>;
}

export const kycProcessor: Processor<KycCheckJobData, KycResult> = async (
  job: Job<KycCheckJobData>
) => {
  const { userId, walletAddress, applicantId, provider, checkType } = job.data;
  const logger = createScopedLogger("kyc.processor", {
    jobId: job.id,
    provider,
    checkType,
    userRef: logReference(userId, "user"),
    walletRef: logReference(walletAddress, "wallet"),
    applicantRef: logReference(applicantId, "applicant"),
  });
  const workerEnv = getWorkerRuntimeEnv();

  logger.info("Processing KYC check");

  if (workerEnv.KYC_PROVIDER === "disabled") {
    throw new Error("KYC_PROVIDER=disabled; KYC checks cannot be processed");
  }

  if (provider !== workerEnv.KYC_PROVIDER) {
    throw new Error(
      `KYC provider mismatch: job requested ${provider}, configured provider is ${workerEnv.KYC_PROVIDER}`
    );
  }

  try {
    switch (provider) {
      case "sumsub":
        return await processSumsubCheck(job);
      case "onfido":
        return await processOnfidoCheck(job);
      default:
        throw new Error(`Unknown KYC provider: ${provider}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error("KYC check failed", {
      err: serializeError(error),
    });

    return {
      success: false,
      status: "error",
      applicantId,
      error: errorMessage,
    };
  }
};

/**
 * Process Sumsub KYC verification
 */
async function processSumsubCheck(job: Job<KycCheckJobData>): Promise<KycResult> {
  const { userId, walletAddress, applicantId, checkType } = job.data;
  const logger = createScopedLogger("kyc.sumsub", {
    jobId: job.id,
    checkType,
    userRef: logReference(userId, "user"),
    walletRef: logReference(walletAddress, "wallet"),
    applicantRef: logReference(applicantId, "applicant"),
  });
  const workerEnv = getWorkerRuntimeEnv();

  await job.updateProgress(10);
  logger.info("Fetching Sumsub applicant status");

  // Sumsub API configuration
  const sumsubAppToken = workerEnv.SUMSUB_APP_TOKEN;
  const sumsubSecretKey = workerEnv.SUMSUB_SECRET_KEY;
  const SUMSUB_BASE_URL = "https://api.sumsub.com";

  if (!sumsubAppToken || !sumsubSecretKey) {
    throw new Error("SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be configured");
  }

  await job.updateProgress(30);
  logger.info("Using Sumsub provider endpoint", { providerEndpoint: SUMSUB_BASE_URL });
  const applicant = await sumsubRequest<{
    review?: {
      reviewStatus?: string;
      reviewResult?: {
        reviewAnswer?: string;
        rejectLabels?: string[];
        reviewRejectType?: string;
      };
    };
  }>({
    appToken: sumsubAppToken,
    secretKey: sumsubSecretKey,
    baseUrl: SUMSUB_BASE_URL,
    method: "GET",
    path: `/resources/applicants/${encodeURIComponent(applicantId)}`,
  });

  await job.updateProgress(70);

  let sanctionsHit = false;
  try {
    const sanctions = await sumsubRequest<{
      answer?: string;
      matchedData?: Array<{ listName: string }>;
    }>({
      appToken: sumsubAppToken,
      secretKey: sumsubSecretKey,
      baseUrl: SUMSUB_BASE_URL,
      method: "POST",
      path: `/resources/applicants/${encodeURIComponent(applicantId)}/checks/sanctions`,
    });
    sanctionsHit = sanctions.answer !== "clear";
  } catch (error) {
    logger.warn("Sumsub sanctions check failed", {
      err: serializeError(error),
    });
  }

  const reviewResult = applicant.review?.reviewResult;
  const status = deriveSumsubStatus(applicant.review?.reviewStatus, reviewResult?.reviewAnswer);

  await job.updateProgress(100);
  logger.info("Sumsub check completed", {
    status,
    sanctionsHit,
  });

  return {
    success: true,
    status,
    applicantId,
    reviewResult: {
      reviewAnswer: reviewResult?.reviewAnswer || "PENDING",
      rejectLabels: reviewResult?.rejectLabels,
      reviewRejectType: reviewResult?.reviewRejectType,
    },
    riskScore: deriveRiskScore(status),
    sanctionsHit,
  };
}

/**
 * Process Onfido KYC verification
 */
async function processOnfidoCheck(job: Job<KycCheckJobData>): Promise<KycResult> {
  const { userId, walletAddress, applicantId, checkType } = job.data;
  const logger = createScopedLogger("kyc.onfido", {
    jobId: job.id,
    checkType,
    userRef: logReference(userId, "user"),
    walletRef: logReference(walletAddress, "wallet"),
    applicantRef: logReference(applicantId, "applicant"),
  });
  const workerEnv = getWorkerRuntimeEnv();

  await job.updateProgress(10);
  logger.info("Fetching Onfido applicant status");

  const ONFIDO_API_TOKEN = workerEnv.ONFIDO_API_TOKEN;
  const ONFIDO_BASE_URL = "https://api.onfido.com/v3.6";

  if (!ONFIDO_API_TOKEN) {
    throw new Error("ONFIDO_API_TOKEN must be configured");
  }

  await job.updateProgress(30);
  logger.info("Using Onfido provider endpoint", {
    providerEndpoint: ONFIDO_BASE_URL,
  });
  const checksResponse = await onfidoRequest<{
    checks?: Array<{
      result?: string;
      report_ids?: string[];
    }>;
  }>({
    apiToken: ONFIDO_API_TOKEN,
    baseUrl: ONFIDO_BASE_URL,
    path: `/applicants/${encodeURIComponent(applicantId)}/checks?page=1&per_page=1`,
  });

  await job.updateProgress(70);

  const latestCheck = checksResponse.checks?.[0];
  if (!latestCheck) {
    await job.updateProgress(100);
    return {
      success: true,
      status: "pending",
      applicantId,
      reviewResult: {
        reviewAnswer: "pending",
      },
      riskScore: deriveRiskScore("pending"),
      sanctionsHit: false,
    };
  }

  const status = deriveOnfidoStatus(latestCheck.result);
  const sanctionsHit = false;

  await job.updateProgress(100);
  logger.info("Onfido check completed", { status });

  return {
    success: true,
    status,
    applicantId,
    reviewResult: {
      reviewAnswer: latestCheck.result || "pending",
    },
    riskScore: deriveRiskScore(status),
    sanctionsHit,
  };
}

export default kycProcessor;
