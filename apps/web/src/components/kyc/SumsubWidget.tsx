"use client";

// TerraQura Sumsub KYC Widget
// Embedded identity verification using Sumsub WebSDK

import { useEffect, useRef, useCallback, useState } from "react";
import Script from "next/script";

import { reportClientError } from "@/lib/errors";

interface SumsubWidgetProps {
  accessToken: string;
  onComplete?: (applicantId: string) => void;
  onError?: (error: Error) => void;
  onTokenExpired?: () => Promise<string | null>;
  expirationHandler?: () => Promise<string>;
  className?: string;
}

interface SumsubSdkPayload {
  reviewStatus?: string;
  reviewResult?: {
    reviewAnswer?: string;
  };
  applicantId?: string;
  message?: string;
  [key: string]: unknown;
}

interface SumsubSdkBuilder {
  on: (
    event: string,
    callback: (payload: SumsubSdkPayload) => void | Promise<void>
  ) => SumsubSdkBuilder;
  build: () => { launch: (containerId: string) => void };
}

declare global {
  interface Window {
    snsWebSdk: {
      init: (
        accessToken: string,
        config: {
          lang?: string;
          email?: string;
          phone?: string;
          theme?: string;
        }
      ) => {
        withConf: (conf: {
          lang?: string;
          onMessage?: (type: string, payload: SumsubSdkPayload) => void;
          onError?: (error: SumsubSdkPayload) => void;
        }) => {
          withOptions: (options: { addViewportTag?: boolean }) => {
            on: (
              event: string,
              callback: (payload: SumsubSdkPayload) => void | Promise<void>
            ) => SumsubSdkBuilder;
            build: () => { launch: (containerId: string) => void };
          };
        };
      };
    };
  }
}

export function SumsubWidget({
  accessToken,
  onComplete,
  onError,
  onTokenExpired,
  className,
}: SumsubWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const reportSumsubError = useCallback(
    (error: unknown, event: string, payload?: SumsubSdkPayload) => {
      void reportClientError(error, {
        source: "sumsub-widget",
        event,
        reviewStatus: payload?.reviewStatus,
        reviewAnswer: payload?.reviewResult?.reviewAnswer,
        hasApplicantId: typeof payload?.applicantId === "string",
      });
    },
    []
  );

  const initSdk = useCallback(() => {
    if (!sdkLoaded || !accessToken || !containerRef.current || isInitialized) {
      return;
    }

    try {
      const snsWebSdkInstance = window.snsWebSdk
        .init(accessToken, {
          lang: "en",
          theme: "dark",
        })
        .withConf({
          lang: "en",
          onMessage: (type, payload) => {
            if (
              type === "idCheck.onApplicantStatusChanged" &&
              payload.reviewStatus === "completed" &&
              typeof payload.applicantId === "string"
            ) {
              onComplete?.(payload.applicantId);
            }
          },
          onError: (error) => {
            const normalized = new Error(error.message || "Sumsub verification error");
            reportSumsubError(normalized, "sdk-error", error);
            onError?.(normalized);
          },
        })
        .withOptions({
          addViewportTag: false,
        })
        .on("idCheck.onApplicantStatusChanged", (payload) => {
          if (
            payload.reviewStatus === "completed" &&
            payload.reviewResult?.reviewAnswer === "GREEN" &&
            typeof payload.applicantId === "string"
          ) {
            onComplete?.(payload.applicantId);
          }
        })
        .on("idCheck.onError", (error) => {
          const normalized = new Error(error.message || "Verification check failed");
          reportSumsubError(normalized, "check-error", error);
          onError?.(normalized);
        })
        .on("idCheck.accessTokenExpired", async () => {
          if (onTokenExpired) {
            const newToken = await onTokenExpired();
            if (newToken) {
              // Re-initialize with new token
              setIsInitialized(false);
            }
          }
        })
        .build();

      snsWebSdkInstance.launch("sumsub-websdk-container");
      setIsInitialized(true);
    } catch (error) {
      reportSumsubError(error, "init-error");
      onError?.(error instanceof Error ? error : new Error("Failed to initialize Sumsub"));
    }
  }, [accessToken, sdkLoaded, isInitialized, onComplete, onError, onTokenExpired, reportSumsubError]);

  useEffect(() => {
    if (sdkLoaded && accessToken) {
      initSdk();
    }
  }, [sdkLoaded, accessToken, initSdk]);

  // Reset when access token changes
  useEffect(() => {
    setIsInitialized(false);
  }, [accessToken]);

  return (
    <>
      <Script
        src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"
        onLoad={() => setSdkLoaded(true)}
        onError={() => {
          const error = new Error("Failed to load Sumsub SDK");
          reportSumsubError(error, "script-load-error");
          onError?.(error);
        }}
      />
      <div
        id="sumsub-websdk-container"
        ref={containerRef}
        className={`min-h-[600px] w-full rounded-lg bg-gray-900 ${className || ""}`}
      />
    </>
  );
}

export default SumsubWidget;
