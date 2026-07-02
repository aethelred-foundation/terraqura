// TerraQura Worker Service
// Enterprise-grade async job processing

import { Worker, Job } from "bullmq";
import {
  getSubscriberConnection,
  closeConnections,
  QUEUE_NAMES,
  type MintingJobData,
  type VerificationJobData,
  type KycCheckJobData,
} from "@terraqura/queue";

import { mintingProcessor } from "./processors/minting.processor.js";
import { verificationProcessor } from "./processors/verification.processor.js";
import { kycProcessor } from "./processors/kyc.processor.js";
import { getWorkerRuntimeEnv } from "./lib/runtime-env.js";
import { serializeError, workerLogger } from "./lib/logger.js";

// Worker configuration
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || "5", 10);
const workerEnv = getWorkerRuntimeEnv();
const LIMITER = {
  max: 10, // Max jobs per interval
  duration: 1000, // Interval in ms
};

// Active workers
const workers: Worker[] = [];

async function createWorker<T, R>(
  queueName: string,
  processor: (job: Job<T>) => Promise<R>,
  options?: { concurrency?: number; limiter?: typeof LIMITER }
): Promise<Worker<T, R>> {
  const connection = getSubscriberConnection();

  const worker = new Worker<T, R>(queueName, processor, {
    connection,
    concurrency: options?.concurrency || CONCURRENCY,
    limiter: options?.limiter || LIMITER,
  });

  // Event handlers
  worker.on("completed", (job, _result) => {
    workerLogger.info({ queueName, jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    workerLogger.error(
      { queueName, jobId: job?.id, err: serializeError(error) },
      "Job failed"
    );
  });

  worker.on("error", (error) => {
    workerLogger.error(
      { queueName, err: serializeError(error) },
      "Worker error"
    );
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn({ queueName, jobId }, "Job stalled");
  });

  workers.push(worker);
  workerLogger.info({ queueName }, "Started worker for queue");

  return worker;
}

async function startWorkers(): Promise<void> {
  const networkLabel = workerEnv.ACTIVE_NETWORK
    ? `${workerEnv.ACTIVE_NETWORK.displayName} (${workerEnv.ACTIVE_NETWORK.chainId})`
    : "not resolved";
  const deploymentLabel = workerEnv.TERRAQURA_DEPLOYMENT ?? "not resolved";

  workerLogger.info(
    {
      concurrency: CONCURRENCY,
      kycProvider: workerEnv.KYC_PROVIDER,
      network: networkLabel,
      deployment: deploymentLabel,
      environment: process.env.NODE_ENV || "development",
    },
    "Starting TerraQura worker service"
  );

  try {
    // Start Minting Worker
    await createWorker<MintingJobData, any>(
      QUEUE_NAMES.MINTING,
      mintingProcessor,
      {
        concurrency: 2, // Lower concurrency for blockchain operations
        limiter: { max: 5, duration: 10000 }, // Rate limit blockchain calls
      }
    );

    // Start Verification Worker
    await createWorker<VerificationJobData, any>(
      QUEUE_NAMES.VERIFICATION,
      verificationProcessor,
      {
        concurrency: 5,
      }
    );

    if (workerEnv.KYC_PROVIDER !== "disabled") {
      // Start KYC Worker
      await createWorker<KycCheckJobData, any>(
        QUEUE_NAMES.KYC_CHECK,
        kycProcessor,
        {
          concurrency: 3,
          limiter: { max: 10, duration: 60000 }, // External API rate limits
        }
      );
    } else {
      workerLogger.warn(
        { kycProvider: workerEnv.KYC_PROVIDER },
        "KYC worker disabled by runtime configuration"
      );
    }

    workerLogger.info(
      {
        queues: workers.map((worker) => worker.name),
      },
      "All workers started successfully"
    );
  } catch (error) {
    workerLogger.error(
      { err: serializeError(error) },
      "Failed to start workers"
    );
    throw error;
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  workerLogger.info({ signal }, "Received shutdown signal");

  // Close all workers
  const closePromises = workers.map(async (worker) => {
    await worker.close();
    workerLogger.info({ queueName: worker.name }, "Closed worker");
  });

  await Promise.all(closePromises);

  // Close Redis connections
  await closeConnections();

  workerLogger.info("Shutdown complete");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  workerLogger.fatal(
    { err: serializeError(error) },
    "Uncaught exception"
  );
  void gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, _promise) => {
  workerLogger.error(
    { err: serializeError(reason) },
    "Unhandled promise rejection"
  );
});

// Start the workers
startWorkers().catch((error) => {
  workerLogger.fatal({ err: serializeError(error) }, "Fatal worker startup error");
  process.exit(1);
});
