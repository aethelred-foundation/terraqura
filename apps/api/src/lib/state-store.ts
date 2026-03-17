import { Pool, PoolClient } from "pg";

import { getApiRuntimeEnv } from "./runtime-env.js";

const connectionString = getApiRuntimeEnv().DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: 8,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

let initializationPromise: Promise<void> | null = null;

async function ensureStateTable(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = pool
      .query(`
        CREATE TABLE IF NOT EXISTS api_state_store (
          store_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)
      .then(() => undefined);
  }

  await initializationPromise;
}

async function ensureStoreRow<T>(client: PoolClient, storeKey: string, defaultState: T) {
  await client.query(
    `
      INSERT INTO api_state_store (store_key, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (store_key) DO NOTHING
    `,
    [storeKey, JSON.stringify(defaultState)]
  );
}

export async function readState<T>(storeKey: string, defaultState: T): Promise<T> {
  await ensureStateTable();
  const client = await pool.connect();

  try {
    await ensureStoreRow(client, storeKey, defaultState);
    const result = await client.query<{ payload: T }>(
      `
        SELECT payload
        FROM api_state_store
        WHERE store_key = $1
      `,
      [storeKey]
    );

    return result.rows[0]?.payload ?? structuredClone(defaultState);
  } finally {
    client.release();
  }
}

export async function mutateState<T, R>(
  storeKey: string,
  defaultState: T,
  mutator: (state: T) => Promise<R> | R
): Promise<R> {
  await ensureStateTable();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureStoreRow(client, storeKey, defaultState);

    const result = await client.query<{ payload: T }>(
      `
        SELECT payload
        FROM api_state_store
        WHERE store_key = $1
        FOR UPDATE
      `,
      [storeKey]
    );

    const currentState = result.rows[0]?.payload ?? structuredClone(defaultState);
    const mutableState = structuredClone(currentState);
    const mutatorResult = await mutator(mutableState);

    await client.query(
      `
        UPDATE api_state_store
        SET payload = $2::jsonb, updated_at = NOW()
        WHERE store_key = $1
      `,
      [storeKey, JSON.stringify(mutableState)]
    );

    await client.query("COMMIT");
    return mutatorResult;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
