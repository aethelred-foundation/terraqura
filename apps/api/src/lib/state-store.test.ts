import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  clientQuery: vi.fn(),
  connect: vi.fn(),
  poolEnd: vi.fn(),
  release: vi.fn(),
  recordDomainEvent: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: mocks.poolQuery,
    connect: mocks.connect,
    end: mocks.poolEnd,
  })),
}));

vi.mock("@terraqura/database/domain", () => ({
  recordDomainEvent: mocks.recordDomainEvent,
}));

vi.mock("./runtime-env.js", () => ({
  getApiRuntimeEnv: () => ({
    DATABASE_URL: "postgres://test:test@localhost:5432/terraqura_test",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters-long",
    SIWE_DOMAIN: "localhost",
    KYC_PROVIDER: "disabled" as const,
  }),
}));

function setupDatabaseMock(selectPayload: unknown = { count: 1 }): void {
  mocks.poolQuery.mockResolvedValue({ rows: [], rowCount: 1 });
  mocks.connect.mockResolvedValue({
    query: mocks.clientQuery,
    release: mocks.release,
  });
  mocks.recordDomainEvent.mockResolvedValue({
    id: "event-1",
    eventType: "api_state_store.mutated",
    aggregateType: "api_state_store",
    aggregateId: "test-store",
    occurredAt: new Date("2026-06-24T00:00:00.000Z"),
  });
  mocks.poolEnd.mockResolvedValue(undefined);

  mocks.clientQuery.mockImplementation(async (sql: unknown) => {
    const text = String(sql);
    if (text.includes("SELECT payload")) {
      return {
        rows: [{ payload: structuredClone(selectPayload) }],
        rowCount: 1,
      };
    }
    return { rows: [], rowCount: 1 };
  });
}

async function loadStateStore() {
  vi.resetModules();
  return import("./state-store.js");
}

describe("state-store domain event integration", () => {
  beforeEach(() => {
    setupDatabaseMock();
    delete process.env.TERRAQURA_DOMAIN_EVENTS_ENABLED;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.TERRAQURA_DOMAIN_EVENTS_ENABLED;
  });

  it("commits state mutations and records hash-only domain evidence", async () => {
    const { mutateState } = await loadStateStore();

    const result = await mutateState("test-store", { count: 0 }, (state) => {
      state.count += 1;
      return state.count;
    });

    expect(result).toBe(2);

    const updateCall = mocks.clientQuery.mock.calls.find(([sql]) =>
      String(sql).includes("UPDATE api_state_store"),
    );
    expect(updateCall?.[1]).toEqual([
      "test-store",
      JSON.stringify({ count: 2 }),
    ]);

    expect(mocks.recordDomainEvent).toHaveBeenCalledTimes(1);
    const [, eventInput] = mocks.recordDomainEvent.mock.calls[0];
    const serialized = JSON.stringify({ count: 2 });
    expect(eventInput).toMatchObject({
      eventType: "api_state_store.mutated",
      aggregateType: "api_state_store",
      aggregateId: "test-store",
      payload: {
        storeKey: "test-store",
        payloadSha256: createHash("sha256").update(serialized).digest("hex"),
        payloadBytes: Buffer.byteLength(serialized),
        compatibilityLayer: true,
      },
    });
    expect(eventInput.payload).not.toHaveProperty("count");

    const commitCall = mocks.clientQuery.mock.calls.find(
      ([sql]) => String(sql) === "COMMIT",
    );
    expect(commitCall).toBeDefined();
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("persists typed domain events before compatibility-layer mutation evidence", async () => {
    const { mutateState } = await loadStateStore();

    await mutateState("credits:v1", { credits: {} }, (state, context) => {
      state.credits = { cred_1: { creditsIssued: 100 } };
      context.recordDomainEvent({
        eventType: "carbon_credit.minted",
        aggregateType: "carbon_credit",
        aggregateId: "cred_1",
        chainId: 7332,
        txHash: "0x1234",
        payload: {
          creditId: "cred_1",
          tokenId: "0x01",
          creditsIssued: 100,
        },
      });
    });

    expect(mocks.recordDomainEvent).toHaveBeenCalledTimes(2);
    expect(mocks.recordDomainEvent.mock.calls[0]?.[1]).toMatchObject({
      eventType: "carbon_credit.minted",
      aggregateType: "carbon_credit",
      aggregateId: "cred_1",
      chainId: 7332,
      txHash: "0x1234",
      payload: {
        creditId: "cred_1",
        tokenId: "0x01",
        creditsIssued: 100,
      },
    });
    expect(mocks.recordDomainEvent.mock.calls[1]?.[1]).toMatchObject({
      eventType: "api_state_store.mutated",
      aggregateType: "api_state_store",
      aggregateId: "credits:v1",
    });
  });

  it("rolls back and skips domain evidence when a mutation fails", async () => {
    const { mutateState } = await loadStateStore();

    await expect(
      mutateState("test-store", { count: 0 }, () => {
        throw new Error("mutation failed");
      }),
    ).rejects.toThrow("mutation failed");

    expect(mocks.recordDomainEvent).not.toHaveBeenCalled();
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) => String(sql) === "COMMIT"),
    ).toBe(false);
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) => String(sql) === "ROLLBACK"),
    ).toBe(true);
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("can explicitly disable compatibility-layer domain events", async () => {
    process.env.TERRAQURA_DOMAIN_EVENTS_ENABLED = "false";
    const { mutateState } = await loadStateStore();

    await mutateState("test-store", { count: 0 }, (state, context) => {
      state.count += 1;
      context.recordDomainEvent({
        eventType: "test.event",
        aggregateType: "test",
        aggregateId: "test-store",
        payload: {},
      });
    });

    expect(mocks.recordDomainEvent).not.toHaveBeenCalled();
    expect(
      mocks.clientQuery.mock.calls.some(([sql]) => String(sql) === "COMMIT"),
    ).toBe(true);
  });

  it("closes the backing Postgres pool for API shutdown", async () => {
    const { closeStateStore } = await loadStateStore();

    await closeStateStore();
    await closeStateStore();

    expect(mocks.poolEnd).toHaveBeenCalledTimes(1);
  });
});
