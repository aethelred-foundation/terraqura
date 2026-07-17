import { Info } from "lucide-react";
import { getDashboardDataMode, getDashboardDataModeLabel } from "@/lib/dataMode";

/**
 * DemoBanner - sits at the top of every dashboard route.
 *
 * The dashboard renders seeded mock data (deterministic fake values for
 * marketplace orders, oracle readings, compliance certificates, governance
 * delegate stats, etc.) so the platform's UX can be reviewed before mainnet.
 *
 * Without this banner, a stakeholder, regulator, or screen-share viewer
 * could mistake the numbers for live on-chain state. Surfacing it on every
 * route is a deliberate design + compliance choice.
 */
export function DemoBanner() {
  const mode = getDashboardDataMode();
  const isLive = mode === "live";
  const label = getDashboardDataModeLabel();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-50 w-full border-b backdrop-blur-md ${
        isLive
          ? "border-emerald-500/25 bg-emerald-500/[0.06]"
          : "border-amber-500/25 bg-amber-500/[0.06]"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-6">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            isLive ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
          }`}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p
          className={`font-body text-[13px] leading-snug ${
            isLive ? "text-emerald-100/90" : "text-amber-100/90"
          }`}
        >
          <span
            className={`font-semibold uppercase tracking-wider ${
              isLive ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {label} &middot;
          </span>{" "}
          {isLive
            ? "Synthetic feed injection is disabled. Any remaining seeded panels must be replaced with live API or chain data before production launch."
            : "Credits data (portfolio, provenance, certificates, analytics) is read live from the connected network; remaining dashboards show deterministic sample data for UX review. Mainnet has not launched and no value is at risk."}
        </p>
      </div>
    </div>
  );
}
