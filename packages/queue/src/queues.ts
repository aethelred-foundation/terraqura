// TerraQura Job Queues
// Enterprise-grade async job processing with BullMQ

import { Queue, QueueEvents, JobsOptions } from "bullmq";
import { getPublisherConnection } from "./connection.js";

// ============================================
// QUEUE NAMES
// ============================================

export const QUEUE_NAMES = {
  // Blockchain Operations
  MINTING: "terraqura:minting",
  VERIFICATION: "terraqura:verification",
  RETIREMENT: "terraqura:retirement",

  // Marketplace
  MARKETPLACE_SYNC: "terraqura:marketplace-sync",
  LISTING_EXPIRY: "terraqura:listing-expiry",

  // IoT Processing
  SENSOR_BATCH: "terraqura:sensor-batch",
  ANOMALY_DETECTION: "terraqura:anomaly-detection",

  // Notifications
  NOTIFICATIONS: "terraqura:notifications",

  // Compliance
  KYC_CHECK: "terraqura:kyc-check",
  SANCTIONS_SCREENING: "terraqura:sanctions-screening",

  // Data Sync
  GRAPH_SYNC: "terraqura:graph-sync",
  IPFS_UPLOAD: "terraqura:ipfs-upload",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ============================================
// JOB DATA TYPES
// ============================================

export interface MintingJobData {
  verificationBatchId: string;
  dacUnitId: string;
  operatorAddress: string;
  co2Captured: number; // tonnes
  efficiencyFactor: number; // kWh/tonne
  dataHash: string;
  merkleRoot?: string;
  ipfsCid?: string;
  retryCount?: number;
}

export interface VerificationJobData {
  batchId: string;
  dacUnitId: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  phase: "source" | "logic" | "mint";
}

export interface RetirementJobData {
  tokenId: string;
  ownerAddress: string;
  amount: number;
  reason: string;
  beneficiary?: string;
}

export interface MarketplaceSyncJobData {
  eventType: "listing" | "purchase" | "offer";
  eventId: string;
  txHash: string;
  blockNumber: number;
}

export interface SensorBatchJobData {
  dacUnitId: string;
  readings: Array<{
    sensorId: string;
    sensorType: string;
    value: number;
    unit: string;
    timestamp: string;
    rawDataHash: string;
  }>;
  batchHash: string;
}

export interface KycCheckJobData {
  userId: string;
  walletAddress: string;
  applicantId: string;
  provider: "sumsub" | "onfido";
  checkType: "initial" | "refresh" | "enhanced";
}

export interface NotificationJobData {
  type: "email" | "webhook" | "push";
  userId?: string;
  recipient: string;
  template: string;
  data: Record<string, unknown>;
}

export interface IpfsUploadJobData {
  contentType: "verification_bundle" | "sensor_data" | "metadata";
  content: string | Buffer;
  metadata: Record<string, unknown>;
  pin: boolean;
}

// ============================================
// QUEUE FACTORY
// ============================================

const queues = new Map<string, Queue>();
const queueEvents = new Map<string, QueueEvents>();

export function getQueue<T = unknown>(name: QueueName): Queue<T> {
  if (!queues.has(name)) {
    const connection = getPublisherConnection();
    const queue = new Queue<T>(name, {
      connection,
      defaultJobOptions: getDefaultJobOptions(name),
    });
    queues.set(name, queue);
  }

  return queues.get(name) as Queue<T>;
}

export function getQueueEvents(name: QueueName): QueueEvents {
  if (!queueEvents.has(name)) {
    const connection = getPublisherConnection();
    const events = new QueueEvents(name, { connection });
    queueEvents.set(name, events);
  }

  return queueEvents.get(name)!;
}

function getDefaultJobOptions(name: QueueName): JobsOptions {
  const baseOptions: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  };

  // Queue-specific overrides
  switch (name) {
    case QUEUE_NAMES.MINTING:
      return {
        ...baseOptions,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000, // Longer delay for blockchain operations
        },
        priority: 1, // High priority
      };

    case QUEUE_NAMES.VERIFICATION:
      return {
        ...baseOptions,
        attempts: 3,
        priority: 2,
      };

    case QUEUE_NAMES.SENSOR_BATCH:
      return {
        ...baseOptions,
        attempts: 2,
        backoff: {
          type: "fixed",
          delay: 500,
        },
        priority: 3, // Process quickly
      };

    case QUEUE_NAMES.KYC_CHECK:
      return {
        ...baseOptions,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 10000, // External API, longer delay
        },
      };

    case QUEUE_NAMES.NOTIFICATIONS:
      return {
        ...baseOptions,
        attempts: 5,
        priority: 5, // Lower priority
      };

    default:
      return baseOptions;
  }
}

// ============================================
// QUEUE HELPERS
// ============================================

/**
 * Add a minting job to the queue
 */
export async function addMintingJob(data: MintingJobData, options?: JobsOptions) {
  const queue = getQueue<MintingJobData>(QUEUE_NAMES.MINTING);
  return queue.add(`mint-${data.verificationBatchId}`, data, {
    ...options,
    jobId: `mint-${data.verificationBatchId}`,
  });
}

/**
 * Add a verification job to the queue
 */
export async function addVerificationJob(data: VerificationJobData, options?: JobsOptions) {
  const queue = getQueue<VerificationJobData>(QUEUE_NAMES.VERIFICATION);
  return queue.add(`verify-${data.batchId}-${data.phase}`, data, {
    ...options,
    jobId: `verify-${data.batchId}-${data.phase}`,
  });
}

/**
 * Add sensor batch processing job
 */
export async function addSensorBatchJob(data: SensorBatchJobData, options?: JobsOptions) {
  const queue = getQueue<SensorBatchJobData>(QUEUE_NAMES.SENSOR_BATCH);
  return queue.add(`sensor-${data.batchHash}`, data, options);
}

/**
 * Add KYC check job
 */
export async function addKycCheckJob(data: KycCheckJobData, options?: JobsOptions) {
  const queue = getQueue<KycCheckJobData>(QUEUE_NAMES.KYC_CHECK);
  return queue.add(`kyc-${data.userId}`, data, {
    ...options,
    jobId: `kyc-${data.userId}-${data.checkType}`,
  });
}

/**
 * Add notification job
 */
export async function addNotificationJob(data: NotificationJobData, options?: JobsOptions) {
  const queue = getQueue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS);
  return queue.add(`notify-${Date.now()}`, data, options);
}

/**
 * Add IPFS upload job
 */
export async function addIpfsUploadJob(data: IpfsUploadJobData, options?: JobsOptions) {
  const queue = getQueue<IpfsUploadJobData>(QUEUE_NAMES.IPFS_UPLOAD);
  return queue.add(`ipfs-${Date.now()}`, data, options);
}

// ============================================
// QUEUE MONITORING
// ============================================

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export async function getQueueStats(name: QueueName): Promise<QueueStats> {
  const queue = getQueue(name);
  const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.isPaused(),
  ]);

  return {
    name,
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: isPaused,
  };
}

export async function getAllQueueStats(): Promise<QueueStats[]> {
  const stats = await Promise.all(
    Object.values(QUEUE_NAMES).map((name) => getQueueStats(name))
  );
  return stats;
}

// ============================================
// CLEANUP
// ============================================

export async function closeAllQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  for (const queue of queues.values()) {
    closePromises.push(queue.close());
  }

  for (const events of queueEvents.values()) {
    closePromises.push(events.close());
  }

  await Promise.all(closePromises);
  queues.clear();
  queueEvents.clear();
}
