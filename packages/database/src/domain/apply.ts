import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, "schema.sql");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be configured to apply the TerraQura domain schema");
}

const pool = new Pool({ connectionString });

try {
  const schema = await readFile(schemaPath, "utf8");
  await pool.query(schema);
  console.log("TerraQura domain schema applied successfully.");
} finally {
  await pool.end();
}
