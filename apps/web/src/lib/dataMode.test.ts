import { afterEach, describe, expect, it, vi } from "vitest";

describe("dashboard data mode", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("defaults to preview mode", async () => {
    const mod = await import("./dataMode");

    expect(mod.getDashboardDataMode()).toBe("preview");
    expect(mod.isPreviewDataMode()).toBe(true);
    expect(mod.getDashboardDataModeLabel()).toBe("Platform Preview");
  });

  it("enables live mode only with an explicit live value", async () => {
    vi.stubEnv("NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE", "live");
    const mod = await import("./dataMode");

    expect(mod.getDashboardDataMode()).toBe("live");
    expect(mod.isPreviewDataMode()).toBe(false);
    expect(mod.getDashboardDataModeLabel()).toBe("Live Data Mode");
  });

  it("treats unknown values as preview-safe", async () => {
    vi.stubEnv("NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE", "staging");
    const mod = await import("./dataMode");

    expect(mod.getDashboardDataMode()).toBe("preview");
  });
});
