import { Pool } from "pg";

import { getApiRuntimeEnv } from "./runtime-env.js";

const env = getApiRuntimeEnv();

export const databasePool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl:
    env.DATABASE_SSL_MODE === "disable"
      ? false
      : {
          rejectUnauthorized: env.DATABASE_SSL_MODE === "verify-full",
        },
  max: 12,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

export async function closeDatabasePool(): Promise<void> {
  await databasePool.end();
}
