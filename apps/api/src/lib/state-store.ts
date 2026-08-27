import { PoolClient } from "pg";

import { ensureDatabaseSchema } from "./database-schema.js";
import { databasePool } from "./database.js";

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

export async function readState<T>(
  storeKey: string,
  defaultState: T,
): Promise<T> {
  await ensureDatabaseSchema();
  const client = await databasePool.connect();

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
  mutator: (state: T) => Promise<R> | R,
): Promise<R> {
  await ensureDatabaseSchema();
  const client = await databasePool.connect();

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
    const mutatorResult = await mutator(mutableState);

    await client.query(
      `
        UPDATE api_state_store
        SET payload = $2::jsonb, updated_at = NOW()
        WHERE store_key = $1
      `,
      [storeKey, JSON.stringify(mutableState)],
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

export async function mutateStatePair<TFirst, TSecond, R>(
  first: {
    storeKey: string;
    defaultState: TFirst;
  },
  second: {
    storeKey: string;
    defaultState: TSecond;
  },
  mutator: (firstState: TFirst, secondState: TSecond) => Promise<R> | R,
): Promise<R> {
  if (first.storeKey === second.storeKey) {
    throw new Error("State pair keys must be distinct");
  }

  await ensureDatabaseSchema();
  const client = await databasePool.connect();

  try {
    await client.query("BEGIN");

    const ordered = [
      { ...first, position: "first" as const },
      { ...second, position: "second" as const },
    ].sort((left, right) => left.storeKey.localeCompare(right.storeKey));

    for (const entry of ordered) {
      await ensureStoreRow(client, entry.storeKey, entry.defaultState);
    }

    const loaded = new Map<string, unknown>();
    for (const entry of ordered) {
      const result = await client.query<{ payload: unknown }>(
        `
          SELECT payload
          FROM api_state_store
          WHERE store_key = $1
          FOR UPDATE
        `,
        [entry.storeKey],
      );
      loaded.set(
        entry.storeKey,
        structuredClone(result.rows[0]?.payload ?? entry.defaultState),
      );
    }

    const firstState = loaded.get(first.storeKey) as TFirst;
    const secondState = loaded.get(second.storeKey) as TSecond;
    const mutatorResult = await mutator(firstState, secondState);

    await client.query(
      `
        UPDATE api_state_store
        SET payload = $2::jsonb, updated_at = NOW()
        WHERE store_key = $1
      `,
      [first.storeKey, JSON.stringify(firstState)],
    );
    await client.query(
      `
        UPDATE api_state_store
        SET payload = $2::jsonb, updated_at = NOW()
        WHERE store_key = $1
      `,
      [second.storeKey, JSON.stringify(secondState)],
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
