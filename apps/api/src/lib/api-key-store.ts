import { scryptSync, timingSafeEqual } from "node:crypto";

import { mutateState, readState } from "./state-store.js";

export type ApiKeyType = "sensor";

export interface StoredApiKey {
  id: string;
  walletAddress: string;
  dacUnitId: string | null;
  name: string;
  type: ApiKeyType;
  description: string | null;
  keyHash: string;
  keySalt: string;
  keyPrefix: string;
  permissions: string[];
  isActive: boolean;
  expiresAt: string | null;
  lastUsedAt: string | null;
  totalRequests: number;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeysState {
  keys: Record<string, StoredApiKey>;
}

export const API_KEYS_STORE_KEY = "api-keys:v2";
export const DEFAULT_API_KEYS_STATE: ApiKeysState = { keys: {} };

export function hashApiKey(key: string, salt: string): string {
  return scryptSync(key, salt, 64).toString("hex");
}

export async function authenticateSensorApiKey(
  rawKey: string,
): Promise<{ keyId: string; dacUnitId: string } | null> {
  const prefix = rawKey.slice(0, 8);
  const state = await readState(API_KEYS_STORE_KEY, DEFAULT_API_KEYS_STATE);
  const candidates = Object.values(state.keys).filter(
    (key) =>
      key.type === "sensor" &&
      key.isActive &&
      key.dacUnitId &&
      key.permissions.includes("sensors:write") &&
      key.keyPrefix === prefix &&
      (!key.expiresAt || Date.now() < new Date(key.expiresAt).getTime()),
  );
  let candidate: StoredApiKey | undefined;
  for (const possible of candidates) {
    const actual = Buffer.from(hashApiKey(rawKey, possible.keySalt), "hex");
    const expected = Buffer.from(possible.keyHash, "hex");
    if (
      actual.length === expected.length &&
      timingSafeEqual(actual, expected)
    ) {
      candidate = possible;
    }
  }
  if (!candidate?.dacUnitId) return null;
  const authenticated = candidate;
  const dacUnitId = candidate.dacUnitId;

  const now = new Date().toISOString();
  await mutateState(
    API_KEYS_STORE_KEY,
    DEFAULT_API_KEYS_STATE,
    async (current) => {
      const stored = current.keys[authenticated.id];
      if (stored) {
        stored.lastUsedAt = now;
        stored.totalRequests += 1;
        stored.updatedAt = now;
      }
    },
  );
  return {
    keyId: authenticated.id,
    dacUnitId,
  };
}
