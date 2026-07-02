// TerraQura Alerting System
// Enterprise-grade alerting with multiple channels

import { randomUUID } from "node:crypto";

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertChannel = "slack" | "pagerduty" | "email" | "webhook";

export interface AlertEmailTransport {
  send(alert: Alert, config: NonNullable<AlertConfig["email"]>): Promise<void>;
}

export interface AlertDeliveryResult {
  channel: AlertChannel;
  status: "sent" | "skipped" | "failed";
  target?: string;
  reason?: string;
  error?: string;
}

export interface AlertDeliveryReport {
  alert: Alert;
  rateLimited: boolean;
  results: AlertDeliveryResult[];
  sentCount: number;
  failedCount: number;
  skippedCount: number;
}

export interface AlertConfig {
  slack?: {
    webhookUrl: string;
    channels: Record<string, string>; // name -> channel
  };
  pagerduty?: {
    routingKey: string;
    serviceId: string;
  };
  email?: {
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
    from: string;
    recipients: Record<string, string[]>; // group -> emails
  };
  emailTransport?: AlertEmailTransport;
  webhooks?: Record<string, string>; // name -> url
}

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  source: string;
  channels: AlertChannel[];
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

function createAlertId(now: number): string {
  return `alert-${now}-${randomUUID()}`;
}

function serializeAlertError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function postJson(
  url: string,
  body: unknown,
  target: string,
): Promise<AlertDeliveryResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        channel: "webhook",
        status: "failed",
        target,
        reason: `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return {
      channel: "webhook",
      status: "sent",
      target,
    };
  } catch (error) {
    return {
      channel: "webhook",
      status: "failed",
      target,
      error: serializeAlertError(error),
    };
  }
}

export class AlertingService {
  private config: AlertConfig;
  private alertHistory: Alert[] = [];
  private rateLimits: Map<string, number> = new Map();

  constructor(config: AlertConfig) {
    this.config = config;
  }

  /**
   * Send an alert to configured channels
   */
  async sendAlert(
    title: string,
    message: string,
    severity: AlertSeverity,
    source: string,
    channels: AlertChannel[],
    metadata?: Record<string, unknown>
  ): Promise<AlertDeliveryReport> {
    // Rate limiting - max 1 alert per source per minute
    const rateLimitKey = `${source}:${title}`;
    const lastAlert = this.rateLimits.get(rateLimitKey);
    const now = Date.now();

    const alert: Alert = {
      id: createAlertId(now),
      title,
      message,
      severity,
      source,
      channels,
      metadata,
      timestamp: new Date(now),
    };

    if (lastAlert && now - lastAlert < 60000) {
      return this.createDeliveryReport(alert, true, [
        {
          channel: "webhook",
          status: "skipped",
          reason: `Alert rate limited: ${rateLimitKey}`,
        },
      ]);
    }

    this.rateLimits.set(rateLimitKey, now);

    // Store in history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Send to channels
    const promises: Array<Promise<AlertDeliveryResult | AlertDeliveryResult[]>> = [];

    for (const channel of channels) {
      switch (channel) {
        case "slack":
          promises.push(this.sendSlackAlert(alert));
          break;
        case "pagerduty":
          promises.push(this.sendPagerDutyAlert(alert));
          break;
        case "email":
          promises.push(this.sendEmailAlert(alert));
          break;
        case "webhook":
          promises.push(this.sendWebhookAlert(alert));
          break;
      }
    }

    const settled = await Promise.allSettled(promises);
    const results = settled.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return Array.isArray(result.value) ? result.value : [result.value];
      }

      return [{
        channel: channels[index] ?? "webhook",
        status: "failed",
        error: serializeAlertError(result.reason),
      } satisfies AlertDeliveryResult];
    });

    return this.createDeliveryReport(alert, false, results);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert): Promise<AlertDeliveryResult> {
    if (!this.config.slack) {
      return {
        channel: "slack",
        status: "skipped",
        reason: "Slack not configured for alerting",
      };
    }

    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const payload = {
      attachments: [
        {
          color,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `${emoji} ${alert.title}`,
              },
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Severity:*\n${alert.severity.toUpperCase()}`,
                },
                {
                  type: "mrkdwn",
                  text: `*Source:*\n${alert.source}`,
                },
              ],
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: alert.message,
              },
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Alert ID:* ${alert.id} | *Time:* ${alert.timestamp.toISOString()}`,
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await postJson(this.config.slack.webhookUrl, payload, "slack");
    return { ...result, channel: "slack" };
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: Alert): Promise<AlertDeliveryResult> {
    if (!this.config.pagerduty) {
      return {
        channel: "pagerduty",
        status: "skipped",
        reason: "PagerDuty not configured for alerting",
      };
    }

    // Only send critical/high to PagerDuty
    if (alert.severity !== "critical" && alert.severity !== "high") {
      return {
        channel: "pagerduty",
        status: "skipped",
        reason: "PagerDuty only receives critical/high alerts",
      };
    }

    const payload = {
      routing_key: this.config.pagerduty.routingKey,
      event_action: "trigger",
      dedup_key: alert.id,
      payload: {
        summary: `[TerraQura ${alert.severity.toUpperCase()}] ${alert.title}`,
        source: alert.source,
        severity: alert.severity === "critical" ? "critical" : "error",
        timestamp: alert.timestamp.toISOString(),
        custom_details: {
          message: alert.message,
          ...alert.metadata,
        },
      },
    };

    const result = await postJson(
      "https://events.pagerduty.com/v2/enqueue",
      payload,
      this.config.pagerduty.serviceId || "pagerduty",
    );
    return { ...result, channel: "pagerduty" };
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<AlertDeliveryResult> {
    if (!this.config.email) {
      return {
        channel: "email",
        status: "skipped",
        reason: "Email not configured for alerting",
      };
    }

    if (!this.config.emailTransport) {
      return {
        channel: "email",
        status: "failed",
        target: this.config.email.smtpHost,
        reason: "Email transport not configured; provide AlertConfig.emailTransport",
      };
    }

    try {
      await this.config.emailTransport.send(alert, this.config.email);
      return {
        channel: "email",
        status: "sent",
        target: this.config.email.smtpHost,
      };
    } catch (error) {
      return {
        channel: "email",
        status: "failed",
        target: this.config.email.smtpHost,
        error: serializeAlertError(error),
      };
    }
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<AlertDeliveryResult[]> {
    if (!this.config.webhooks) {
      return [{
        channel: "webhook",
        status: "skipped",
        reason: "Webhooks not configured for alerting",
      }];
    }

    return Promise.all(
      Object.entries(this.config.webhooks).map(async ([name, url]) => {
        const result = await postJson(
          url,
          {
            ...alert,
            webhookName: name,
          },
          name,
        );
        return { ...result, channel: "webhook" };
      }),
    );
  }

  private createDeliveryReport(
    alert: Alert,
    rateLimited: boolean,
    results: AlertDeliveryResult[],
  ): AlertDeliveryReport {
    return {
      alert,
      rateLimited,
      results,
      sentCount: results.filter((result) => result.status === "sent").length,
      failedCount: results.filter((result) => result.status === "failed").length,
      skippedCount: results.filter((result) => result.status === "skipped").length,
    };
  }

  /**
   * Get color for severity
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "#dc3545"; // Red
      case "high":
        return "#fd7e14"; // Orange
      case "medium":
        return "#ffc107"; // Yellow
      case "low":
        return "#17a2b8"; // Blue
    }
  }

  /**
   * Get emoji for severity
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case "critical":
        return "🚨";
      case "high":
        return "⚠️";
      case "medium":
        return "📢";
      case "low":
        return "ℹ️";
    }
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(count = 50): Alert[] {
    return this.alertHistory.slice(-count);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.alertHistory.filter((a) => a.severity === severity);
  }
}

// ============================================
// PREDEFINED ALERT TEMPLATES
// ============================================

export const AlertTemplates = {
  // Critical
  contractPaused: (contract: string, pauser: string) => ({
    title: `Contract Paused: ${contract}`,
    message: `The ${contract} contract has been paused by ${pauser}. All operations are halted.`,
    severity: "critical" as AlertSeverity,
    channels: ["slack", "pagerduty", "email"] as AlertChannel[],
  }),

  ownershipTransferred: (contract: string, newOwner: string) => ({
    title: `Ownership Transferred: ${contract}`,
    message: `Ownership of ${contract} has been transferred to ${newOwner}. Verify this was authorized.`,
    severity: "critical" as AlertSeverity,
    channels: ["slack", "pagerduty", "email"] as AlertChannel[],
  }),

  // High
  largeTransaction: (type: string, amount: string, txHash: string) => ({
    title: `Large ${type} Transaction`,
    message: `A large ${type} of ${amount} has been detected. Transaction: ${txHash}`,
    severity: "high" as AlertSeverity,
    channels: ["slack", "email"] as AlertChannel[],
  }),

  verificationFailed: (batchId: string, reason: string) => ({
    title: "Verification Failed",
    message: `Verification batch ${batchId} failed: ${reason}`,
    severity: "high" as AlertSeverity,
    channels: ["slack"] as AlertChannel[],
  }),

  // Medium
  kycExpiring: (count: number) => ({
    title: "KYC Expiring Soon",
    message: `${count} users have KYC expiring within 30 days. Review and notify users.`,
    severity: "medium" as AlertSeverity,
    channels: ["slack", "email"] as AlertChannel[],
  }),

  anomalySpike: (dacUnit: string, count: number) => ({
    title: "Sensor Anomaly Spike",
    message: `${count} anomalies detected in DAC unit ${dacUnit} in the last hour.`,
    severity: "medium" as AlertSeverity,
    channels: ["slack"] as AlertChannel[],
  }),

  // Low
  systemHealthCheck: (status: string) => ({
    title: "System Health Check",
    message: `Daily health check completed. Status: ${status}`,
    severity: "low" as AlertSeverity,
    channels: ["slack"] as AlertChannel[],
  }),
};

// Factory function
let alertingService: AlertingService | null = null;

export function getAlertingService(): AlertingService {
  if (!alertingService) {
    alertingService = new AlertingService({
      slack: process.env.SLACK_WEBHOOK_URL
        ? {
            webhookUrl: process.env.SLACK_WEBHOOK_URL,
            channels: {
              critical: "#terraqura-critical",
              alerts: "#terraqura-alerts",
              compliance: "#terraqura-compliance",
            },
          }
        : undefined,
      pagerduty: process.env.PAGERDUTY_ROUTING_KEY
        ? {
            routingKey: process.env.PAGERDUTY_ROUTING_KEY,
            serviceId: process.env.PAGERDUTY_SERVICE_ID || "",
          }
        : undefined,
    });
  }

  return alertingService;
}

export default AlertingService;
