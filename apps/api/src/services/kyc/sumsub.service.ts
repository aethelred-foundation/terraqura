// TerraQura Sumsub KYC Integration
// Enterprise-grade identity verification

import crypto from "crypto";

import { getApiRuntimeEnv } from "../../lib/runtime-env.js";

export interface SumsubConfig {
  appToken: string;
  secretKey: string;
  baseUrl?: string;
  webhookSecret?: string;
}

export interface ApplicantData {
  externalUserId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  walletAddress: string;
}

export interface ApplicantResponse {
  id: string;
  createdAt: string;
  externalUserId: string;
  info?: {
    firstName?: string;
    lastName?: string;
    country?: string;
  };
  review?: {
    reviewStatus: string;
    reviewResult?: {
      reviewAnswer: string;
      rejectLabels?: string[];
    };
  };
}

export interface AccessTokenResponse {
  token: string;
  userId: string;
}

export interface WebhookPayload {
  applicantId: string;
  externalUserId: string;
  type: string;
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer: string;
    rejectLabels?: string[];
    reviewRejectType?: string;
  };
  createdAt: string;
}

export class SumsubService {
  private appToken: string;
  private secretKey: string;
  private baseUrl: string;
  private webhookSecret?: string;

  constructor(config: SumsubConfig) {
    this.appToken = config.appToken;
    this.secretKey = config.secretKey;
    this.baseUrl = config.baseUrl || "https://api.sumsub.com";
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Generate HMAC signature for API requests
   */
  private generateSignature(
    method: string,
    path: string,
    timestamp: number,
    body?: string
  ): string {
    const data = timestamp + method.toUpperCase() + path + (body || "");
    return crypto
      .createHmac("sha256", this.secretKey)
      .update(data)
      .digest("hex");
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000);
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const signature = this.generateSignature(method, path, timestamp, bodyStr);

    const headers: Record<string, string> = {
      "X-App-Token": this.appToken,
      "X-App-Access-Ts": timestamp.toString(),
      "X-App-Access-Sig": signature,
      "Content-Type": "application/json",
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: bodyStr,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sumsub API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Create or update an applicant
   */
  async createApplicant(data: ApplicantData): Promise<ApplicantResponse> {
    const path = "/resources/applicants?levelName=basic-kyc-level";

    const body = {
      externalUserId: data.externalUserId,
      email: data.email,
      phone: data.phone,
      fixedInfo: {
        firstName: data.firstName,
        lastName: data.lastName,
        country: data.country,
      },
      metadata: [
        {
          key: "walletAddress",
          value: data.walletAddress,
        },
      ],
    };

    return this.request<ApplicantResponse>("POST", path, body);
  }

  /**
   * Get applicant by ID
   */
  async getApplicant(applicantId: string): Promise<ApplicantResponse> {
    const path = `/resources/applicants/${applicantId}`;
    return this.request<ApplicantResponse>("GET", path);
  }

  /**
   * Get applicant by external user ID
   */
  async getApplicantByExternalId(
    externalUserId: string
  ): Promise<ApplicantResponse | null> {
    const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}`;

    try {
      return await this.request<ApplicantResponse>("GET", path);
    } catch (error) {
      // Return null if not found
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Generate access token for WebSDK
   */
  async generateAccessToken(
    externalUserId: string,
    levelName = "basic-kyc-level",
    ttlInSecs = 1200
  ): Promise<AccessTokenResponse> {
    const path = `/resources/accessTokens?userId=${encodeURIComponent(externalUserId)}&levelName=${levelName}&ttlInSecs=${ttlInSecs}`;
    return this.request<AccessTokenResponse>("POST", path);
  }

  /**
   * Get applicant verification status
   */
  async getVerificationStatus(applicantId: string): Promise<{
    status: "pending" | "verified" | "rejected" | "retry";
    rejectLabels?: string[];
    reviewAnswer?: string;
  }> {
    const applicant = await this.getApplicant(applicantId);

    if (!applicant.review) {
      return { status: "pending" };
    }

    const reviewStatus = applicant.review.reviewStatus;
    const reviewResult = applicant.review.reviewResult;

    if (reviewStatus === "completed") {
      if (reviewResult?.reviewAnswer === "GREEN") {
        return { status: "verified" };
      } else if (reviewResult?.reviewAnswer === "RED") {
        return {
          status: "rejected",
          rejectLabels: reviewResult.rejectLabels,
          reviewAnswer: reviewResult.reviewAnswer,
        };
      }
    } else if (reviewStatus === "onHold") {
      return { status: "retry" };
    }

    return { status: "pending" };
  }

  /**
   * Request sanctions screening
   */
  async requestSanctionsCheck(applicantId: string): Promise<{
    hit: boolean;
    matchedLists?: string[];
  }> {
    const path = `/resources/applicants/${applicantId}/checks/sanctions`;

    try {
      const result = await this.request<{
        answer: string;
        matchedData?: Array<{ listName: string }>;
      }>("POST", path);

      return {
        hit: result.answer !== "clear",
        matchedLists: result.matchedData?.map((m) => m.listName),
      };
    } catch (error) {
      // Log but don't fail - sanctions check may not be available
      console.error("Sanctions check error:", error);
      return { hit: false };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.webhookSecret) {
      console.warn("Webhook secret not configured");
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse webhook payload
   */
  parseWebhook(payload: string, signature: string): WebhookPayload | null {
    if (!this.verifyWebhookSignature(payload, signature)) {
      console.error("Invalid webhook signature");
      return null;
    }

    try {
      return JSON.parse(payload) as WebhookPayload;
    } catch (error) {
      console.error("Failed to parse webhook payload:", error);
      return null;
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event: WebhookPayload): Promise<{
    action: "update_status" | "request_resubmission" | "none";
    status?: string;
    rejectLabels?: string[];
  }> {
    switch (event.type) {
      case "applicantReviewed":
        if (event.reviewResult?.reviewAnswer === "GREEN") {
          return {
            action: "update_status",
            status: "verified",
          };
        } else if (event.reviewResult?.reviewAnswer === "RED") {
          return {
            action: "update_status",
            status: "rejected",
            rejectLabels: event.reviewResult.rejectLabels,
          };
        }
        break;

      case "applicantPending":
        return {
          action: "update_status",
          status: "pending",
        };

      case "applicantOnHold":
        return {
          action: "request_resubmission",
          status: "retry",
        };

      case "applicantCreated":
        return {
          action: "update_status",
          status: "created",
        };
    }

    return { action: "none" };
  }
}

// Factory function
export function createSumsubService(): SumsubService | null {
  const env = getApiRuntimeEnv();
  if (env.KYC_PROVIDER !== "sumsub") {
    return null;
  }

  const appToken = env.SUMSUB_APP_TOKEN;
  const secretKey = env.SUMSUB_SECRET_KEY;
  if (!appToken || !secretKey) {
    throw new Error(
      "SUMSUB_APP_TOKEN and SUMSUB_SECRET_KEY must be configured when KYC_PROVIDER=sumsub"
    );
  }

  return new SumsubService({
    appToken,
    secretKey,
    webhookSecret: process.env.SUMSUB_WEBHOOK_SECRET,
  });
}

export default SumsubService;
