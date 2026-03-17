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
  worker.on("completed", (job, result) => {
    console.log(`[${queueName}] Job ${job.id} completed:`, result);
  });

  worker.on("failed", (job, error) => {
    console.error(`[${queueName}] Job ${job?.id} failed:`, error.message);
  });

  worker.on("error", (error) => {
    console.error(`[${queueName}] Worker error:`, error.message);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[${queueName}] Job ${jobId} stalled`);
  });

  workers.push(worker);
  console.log(`[Worker] Started worker for queue: ${queueName}`);

  return worker;
}

async function startWorkers(): Promise<void> {
  console.log(`
  ╔════════════════════════════════════════════════════════╗
  ║                                                        ║
  ║   TerraQura Worker Service                             ║
  ║   Enterprise-Grade Job Processing                      ║
  ║                                                        ║
  ╠════════════════════════════════════════════════════════╣
  ║                                                        ║
  ║   Starting workers with concurrency: ${CONCURRENCY}                 ║
  ║   KYC provider: ${workerEnv.KYC_PROVIDER}                                        ║
  ║   Environment: ${process.env.NODE_ENV || "development"}                             ║
  ║                                                        ║
  ╚════════════════════════════════════════════════════════╝
  `);

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
      console.log("[Worker] KYC worker disabled via KYC_PROVIDER=disabled");
    }

    console.log(`[Worker] All workers started successfully`);
    console.log(`[Worker] Processing queues:`);
    console.log(`  - ${QUEUE_NAMES.MINTING}`);
    console.log(`  - ${QUEUE_NAMES.VERIFICATION}`);
    if (workerEnv.KYC_PROVIDER !== "disabled") {
      console.log(`  - ${QUEUE_NAMES.KYC_CHECK}`);
    }
  } catch (error) {
    console.error("[Worker] Failed to start workers:", error);
    throw error;
  }
}

async function gracefulShutdown(signal: string): Promise<void> {
  console.log(`[Worker] Received ${signal}, shutting down gracefully...`);

  // Close all workers
  const closePromises = workers.map(async (worker) => {
    await worker.close();
    console.log(`[Worker] Closed worker for ${worker.name}`);
  });

  await Promise.all(closePromises);

  // Close Redis connections
  await closeConnections();

  console.log("[Worker] Shutdown complete");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Worker] Uncaught exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Worker] Unhandled rejection at:", promise, "reason:", reason);
});

// Start the workers
startWorkers().catch((error) => {
  console.error("[Worker] Fatal error:", error);
  process.exit(1);
});
