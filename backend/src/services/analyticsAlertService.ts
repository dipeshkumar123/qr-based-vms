import { analyticsReliabilityConfig, notificationConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import { getIngestHealth } from "./analyticsService.js";
import { sendEmailNotification, sendSMSNotification } from "./notificationService.js";

type AlertSeverity = "ok" | "degraded";

type ReliabilityAlertState = {
  monitoringEnabled: boolean;
  active: boolean;
  severity: AlertSeverity;
  degradedChecks: number;
  healthyChecks: number;
  alertsSent: number;
  suppressedByCooldown: number;
  lastAlertAt?: string;
  lastRecoveryAt?: string;
  lastReason?: string;
  lastEvaluationAt?: string;
};

const alertState: ReliabilityAlertState = {
  monitoringEnabled: analyticsReliabilityConfig.enabled,
  active: false,
  severity: "ok",
  degradedChecks: 0,
  healthyChecks: 0,
  alertsSent: 0,
  suppressedByCooldown: 0,
};

let monitorTimer: NodeJS.Timeout | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function buildDegradeReason(health: ReturnType<typeof getIngestHealth>): string {
  const reasons: string[] = [];
  if (health.breakerOpen) {
    reasons.push("breaker_open");
  }
  if ((health.memoryBufferedEvents || 0) >= analyticsReliabilityConfig.bufferAlertThreshold) {
    reasons.push("buffer_high");
  }
  if ((health.consecutiveDbFailures || 0) >= analyticsReliabilityConfig.failureAlertThreshold) {
    reasons.push("db_failures_high");
  }
  if (reasons.length === 0) {
    reasons.push("degraded_signal");
  }
  return reasons.join(",");
}

async function sendDegradedAlert(reason: string, health: ReturnType<typeof getIngestHealth>): Promise<void> {
  const adminEmail = notificationConfig.adminEmail;
  const adminPhone = notificationConfig.adminPhone;
  const stamp = nowIso();

  const subject = "II-VMS Analytics Ingestion Degraded";
  const message = [
    "Analytics ingestion entered a degraded state.",
    `Time: ${stamp}`,
    `Reason: ${reason}`,
    `Breaker open: ${health.breakerOpen}`,
    `Buffered events: ${health.memoryBufferedEvents}`,
    `Consecutive DB failures: ${health.consecutiveDbFailures}`,
    `DB insert failures: ${health.dbInsertFailures}`,
    `Fallback count: ${health.memoryFallbackCount}`,
  ].join("\n");

  if (adminEmail) {
    await sendEmailNotification(adminEmail, subject, `<pre>${message}</pre>`);
  }
  if (adminPhone && notificationConfig.enableSmsAlerts) {
    await sendSMSNotification(adminPhone, `II-VMS degraded: ${reason}. buffered=${health.memoryBufferedEvents}`);
  }

  if (!adminEmail && !(adminPhone && notificationConfig.enableSmsAlerts)) {
    logger.warn({ reason, health }, "Analytics degraded alert not sent: admin notification channels not configured");
  }
}

async function sendRecoveryAlert(health: ReturnType<typeof getIngestHealth>): Promise<void> {
  const adminEmail = notificationConfig.adminEmail;
  const adminPhone = notificationConfig.adminPhone;
  const stamp = nowIso();

  const subject = "II-VMS Analytics Ingestion Recovered";
  const message = [
    "Analytics ingestion recovered to healthy state.",
    `Time: ${stamp}`,
    `Buffered events: ${health.memoryBufferedEvents}`,
    `Consecutive DB failures: ${health.consecutiveDbFailures}`,
    `Recovered flush count: ${health.memoryFlushRecovered}`,
  ].join("\n");

  if (adminEmail) {
    await sendEmailNotification(adminEmail, subject, `<pre>${message}</pre>`);
  }
  if (adminPhone && notificationConfig.enableSmsAlerts) {
    await sendSMSNotification(adminPhone, "II-VMS analytics recovered and ingestion is healthy.");
  }
}

async function evaluateReliabilityState(): Promise<void> {
  if (!analyticsReliabilityConfig.enabled) {
    return;
  }

  const health = getIngestHealth();
  const reason = buildDegradeReason(health);
  const degraded =
    health.breakerOpen ||
    (health.memoryBufferedEvents || 0) >= analyticsReliabilityConfig.bufferAlertThreshold ||
    (health.consecutiveDbFailures || 0) >= analyticsReliabilityConfig.failureAlertThreshold;

  alertState.lastEvaluationAt = nowIso();

  if (degraded) {
    alertState.severity = "degraded";
    alertState.degradedChecks += 1;
    alertState.healthyChecks = 0;
    alertState.lastReason = reason;

    const meetsAlertThreshold = alertState.degradedChecks >= Math.max(1, analyticsReliabilityConfig.degradedChecksToAlert);
    if (!meetsAlertThreshold) {
      return;
    }

    const nowMs = Date.now();
    const lastAlertMs = alertState.lastAlertAt ? Date.parse(alertState.lastAlertAt) : 0;
    const cooldownElapsed = !lastAlertMs || nowMs - lastAlertMs >= analyticsReliabilityConfig.alertCooldownMs;

    if (!alertState.active || cooldownElapsed) {
      await sendDegradedAlert(reason, health);
      alertState.active = true;
      alertState.alertsSent += 1;
      alertState.lastAlertAt = nowIso();
      logger.warn({ reason, health }, "Analytics ingestion degraded alert emitted");
    } else {
      alertState.suppressedByCooldown += 1;
    }
    return;
  }

  alertState.severity = "ok";
  alertState.degradedChecks = 0;
  alertState.healthyChecks += 1;

  const meetsRecoveryThreshold = alertState.healthyChecks >= Math.max(1, analyticsReliabilityConfig.healthyChecksToRecover);
  if (alertState.active && meetsRecoveryThreshold) {
    await sendRecoveryAlert(health);
    alertState.active = false;
    alertState.lastRecoveryAt = nowIso();
    logger.info({ health }, "Analytics ingestion recovery alert emitted");
  }
}

export function startAnalyticsReliabilityMonitor(): void {
  if (!analyticsReliabilityConfig.enabled) {
    logger.info("Analytics reliability monitor disabled by config");
    return;
  }
  if (monitorTimer) {
    return;
  }

  const interval = Math.max(3000, analyticsReliabilityConfig.pollIntervalMs);
  monitorTimer = setInterval(() => {
    void evaluateReliabilityState().catch((err) => {
      logger.error({ err }, "Analytics reliability monitor evaluation failed");
    });
  }, interval);
  monitorTimer.unref?.();

  logger.info({ pollIntervalMs: interval }, "Analytics reliability monitor started");
}

export function stopAnalyticsReliabilityMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    logger.info("Analytics reliability monitor stopped");
  }
}

export function getAnalyticsReliabilityAlertState(): ReliabilityAlertState {
  return { ...alertState, monitoringEnabled: analyticsReliabilityConfig.enabled };
}
