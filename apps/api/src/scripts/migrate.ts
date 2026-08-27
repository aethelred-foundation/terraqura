import { ensureDatabaseSchema } from "../lib/database-schema.js";
import { closeDatabasePool } from "../lib/database.js";

async function migrate(): Promise<void> {
  try {
    await ensureDatabaseSchema();
    process.stdout.write("TerraQura database schema is ready.\n");
  } finally {
    await closeDatabasePool();
  }
}

void migrate().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`TerraQura database migration failed: ${message}\n`);
  process.exitCode = 1;
});
