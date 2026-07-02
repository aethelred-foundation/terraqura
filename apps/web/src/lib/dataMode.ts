export type DashboardDataMode = "preview" | "live";

const dashboardMode = process.env.NEXT_PUBLIC_TERRAQURA_DASHBOARD_DATA_MODE;

export function getDashboardDataMode(): DashboardDataMode {
  return dashboardMode === "live" ? "live" : "preview";
}

export function isPreviewDataMode(): boolean {
  return getDashboardDataMode() === "preview";
}

export function getDashboardDataModeLabel(): string {
  return isPreviewDataMode() ? "Platform Preview" : "Live Data Mode";
}
