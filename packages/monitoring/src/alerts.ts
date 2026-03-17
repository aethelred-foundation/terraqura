// TerraQura Alerting System
// Enterprise-grade alerting with multiple channels

export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertChannel = "slack" | "pagerduty" | "email" | "webhook";

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
  ): Promise<void> {
    // Rate limiting - max 1 alert per source per minute
    const rateLimitKey = `${source}:${title}`;
    const lastAlert = this.rateLimits.get(rateLimitKey);
    const now = Date.now();

    if (lastAlert && now - lastAlert < 60000) {
      console.log(`Alert rate limited: ${rateLimitKey}`);
      return;
    }

    this.rateLimits.set(rateLimitKey, now);

    const alert: Alert = {
      id: `alert-${now}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      message,
      severity,
      source,
      channels,
      metadata,
      timestamp: new Date(),
    };

    // Store in history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Send to channels
    const promises: Promise<void>[] = [];

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

    await Promise.allSettled(promises);
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert): Promise<void> {
    if (!this.config.slack) {
      console.warn("Slack not configured for alerting");
      return;
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

    try {
      await fetch(this.config.slack.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send Slack alert:", error);
    }
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: Alert): Promise<void> {
    if (!this.config.pagerduty) {
      console.warn("PagerDuty not configured for alerting");
      return;
    }

    // Only send critical/high to PagerDuty
    if (alert.severity !== "critical" && alert.severity !== "high") {
      return;
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

    try {
      await fetch("https://events.pagerduty.com/v2/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to send PagerDuty alert:", error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert): Promise<void> {
    if (!this.config.email) {
      console.warn("Email not configured for alerting");
      return;
    }

    // In production, use nodemailer or similar
    console.log("Email alert would be sent:", {
      to: this.config.email.recipients,
      subject: `[TerraQura ${alert.severity.toUpperCase()}] ${alert.title}`,
      body: alert.message,
    });
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(alert: Alert): Promise<void> {
    if (!this.config.webhooks) {
      return;
    }

    for (const [name, url] of Object.entries(this.config.webhooks)) {
      try {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...alert,
            webhookName: name,
          }),
        });
      } catch (error) {
        console.error(`Failed to send webhook alert to ${name}:`, error);
      }
    }
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
