"use client";

import React from "react";
import { type ProvenanceEvent } from "@/types/provenance";
import { cn } from "@/lib/utils";

interface ProvenanceTimelineProps {
  events: ProvenanceEvent[];
  creditId: string;
  className?: string;
}

const eventConfig: Record<
  ProvenanceEvent["type"],
  {
    label: string;
    icon: string;
    color: string;
  }
> = {
  CAPTURE_STARTED: {
    label: "Capture Started",
    icon: "play",
    color: "bg-blue-500",
  },
  CAPTURE_COMPLETED: {
    label: "Capture Completed",
    icon: "check",
    color: "bg-blue-600",
  },
  VERIFICATION_STARTED: {
    label: "Verification Started",
    icon: "search",
    color: "bg-yellow-500",
  },
  SOURCE_VERIFIED: {
    label: "Source Verified",
    icon: "shield-check",
    color: "bg-green-500",
  },
  LOGIC_VERIFIED: {
    label: "Physics Verified",
    icon: "cpu",
    color: "bg-green-600",
  },
  MINT_VERIFIED: {
    label: "Mint Verified",
    icon: "fingerprint",
    color: "bg-green-700",
  },
  MINTED: {
    label: "Minted on Chain",
    icon: "link",
    color: "bg-terra-500",
  },
  TRANSFERRED: {
    label: "Transferred",
    icon: "arrow-right",
    color: "bg-purple-500",
  },
  RETIRED: {
    label: "Retired",
    icon: "archive",
    color: "bg-gray-500",
  },
};

function EventIcon({ type }: { type: ProvenanceEvent["type"] }) {
  const icons: Record<string, React.JSX.Element> = {
    play: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    check: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
    search: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    ),
    "shield-check": (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    cpu: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
        />
      </svg>
    ),
    fingerprint: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
        />
      </svg>
    ),
    link: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    "arrow-right": (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M14 5l7 7m0 0l-7 7m7-7H3"
        />
      </svg>
    ),
    archive: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
        />
      </svg>
    ),
  };

  const config = eventConfig[type];
  const iconKey = config?.icon || "check";
  return icons[iconKey] || icons.check;
}

export function ProvenanceTimeline({
  events,
  creditId,
  className,
}: ProvenanceTimelineProps) {
  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const shortenHash = (hash: string) => {
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Provenance Timeline</h3>
        <span className="text-sm text-gray-400">Credit: {creditId}</span>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />

        {/* Events */}
        <div className="space-y-6">
          {events.map((event, index) => {
            const config = eventConfig[event.type];
            const isLast = index === events.length - 1;

            return (
              <div key={`${event.type}-${index}`} className="relative pl-10">
                {/* Event dot */}
                <div
                  className={cn(
                    "absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-white",
                    config?.color || "bg-gray-500"
                  )}
                >
                  <EventIcon type={event.type} />
                </div>

                {/* Event content */}
                <div
                  className={cn(
                    "bg-gray-800/50 border border-gray-700 rounded-lg p-4",
                    isLast && "border-terra-500/50 bg-terra-900/20"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-white">
                        {config?.label || event.type}
                      </h4>
                      <p className="text-sm text-gray-400 mt-1">
                        {formatTimestamp(event.timestamp)}
                      </p>
                    </div>

                    {event.txHash && (
                      <a
                        href={`https://explorer.aethelred.network/tx/${event.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-terra-400 hover:text-terra-300 text-sm flex items-center gap-1"
                      >
                        {shortenHash(event.txHash)}
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    )}
                  </div>

                  {/* Event details */}
                  {Object.keys(event.details).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(event.details).map(([key, value]) => (
                          <div key={key}>
                            <span className="text-gray-500">{key}:</span>{" "}
                            <span className="text-gray-300">
                              {typeof value === "number"
                                ? value.toLocaleString()
                                : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ProvenanceTimeline;
