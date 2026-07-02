import { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import {
  recordDomainEvent as persistDomainEvent,
  type DomainEventInput,
} from "@terraqura/database/domain";

import { getApiRuntimeEnv } from "./runtime-env.js";

const connectionString = getApiRuntimeEnv().DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: 8,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
});

let initializationPromise: Promise<void> | null = null;
let closePromise: Promise<void> | null = null;

export interface StateMutationContext {
  recordDomainEvent(input: DomainEventInput): void;
}

type StateMutator<T, R> = (
  state: T,
  context: StateMutationContext,
) => Promise<R> | R;

async function ensureStateTable(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = pool
      .query(
        `
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

        CREATE TABLE IF NOT EXISTS api_state_store (
          store_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS domain_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type TEXT NOT NULL,
          event_version INTEGER NOT NULL DEFAULT 1,
          aggregate_type TEXT NOT NULL,
          aggregate_id TEXT NOT NULL,
          tenant_id UUID,
          chain_id INTEGER,
          tx_hash TEXT,
          payload JSONB NOT NULL,
          causation_id UUID,
          correlation_id UUID,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate
          ON domain_events (aggregate_type, aggregate_id, occurred_at DESC);
      `,
      )
      .then(() => undefined);
  }

  await initializationPromise;
}

async function ensureStoreRow<T>(
  client: PoolClient,
  storeKey: string,
  defaultState: T,
) {
  await client.query(
    `
      INSERT INTO api_state_store (store_key, payload)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (store_key) DO NOTHING
    `,
    [storeKey, JSON.stringify(defaultState)],
  );
}

function statePayloadFingerprint(payload: unknown): {
  payloadSha256: string;
  payloadBytes: number;
} {
  const serialized = JSON.stringify(payload);
  return {
    payloadSha256: createHash("sha256").update(serialized).digest("hex"),
    payloadBytes: Buffer.byteLength(serialized),
  };
}

async function recordStateStoreMutation<T>(
  client: PoolClient,
  storeKey: string,
  payload: T,
  typedDomainEvents: DomainEventInput[],
): Promise<void> {
  if (process.env.TERRAQURA_DOMAIN_EVENTS_ENABLED === "false") {
    return;
  }

  for (const event of typedDomainEvents) {
    await persistDomainEvent(client, event);
  }

  const fingerprint = statePayloadFingerprint(payload);
  await persistDomainEvent(client, {
    eventType: "api_state_store.mutated",
    aggregateType: "api_state_store",
    aggregateId: storeKey,
    payload: {
      storeKey,
      ...fingerprint,
      compatibilityLayer: true,
    },
  });
}

export async function readState<T>(
  storeKey: string,
  defaultState: T,
): Promise<T> {
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
      [storeKey],
    );

    return result.rows[0]?.payload ?? structuredClone(defaultState);
  } finally {
    client.release();
  }
}

export async function mutateState<T, R>(
  storeKey: string,
  defaultState: T,
  mutator: StateMutator<T, R>,
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
      [storeKey],
    );

    const currentState =
      result.rows[0]?.payload ?? structuredClone(defaultState);
    const mutableState = structuredClone(currentState);
    const typedDomainEvents: DomainEventInput[] = [];
    const mutationContext: StateMutationContext = {
      recordDomainEvent(input) {
        typedDomainEvents.push(input);
      },
    };
    const mutatorResult = await mutator(mutableState, mutationContext);

    await client.query(
      `
        UPDATE api_state_store
        SET payload = $2::jsonb, updated_at = NOW()
        WHERE store_key = $1
      `,
      [storeKey, JSON.stringify(mutableState)],
    );
    await recordStateStoreMutation(
      client,
      storeKey,
      mutableState,
      typedDomainEvents,
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

export async function closeStateStore(): Promise<void> {
  if (!closePromise) {
    closePromise = pool.end();
  }
  await closePromise;
}
