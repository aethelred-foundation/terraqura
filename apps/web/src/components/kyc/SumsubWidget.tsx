"use client";

// TerraQura Sumsub KYC Widget
// Embedded identity verification using Sumsub WebSDK

import { useEffect, useRef, useCallback, useState } from "react";
import Script from "next/script";

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
            console.error("[Sumsub] Error:", error);
            onError?.(new Error(error.message || "Sumsub verification error"));
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
          console.error("[Sumsub] Check error:", error);
          onError?.(new Error(error.message || "Verification check failed"));
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
      console.error("[Sumsub] Init error:", error);
      onError?.(error instanceof Error ? error : new Error("Failed to initialize Sumsub"));
    }
  }, [accessToken, sdkLoaded, isInitialized, onComplete, onError, onTokenExpired]);

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
        onError={() => onError?.(new Error("Failed to load Sumsub SDK"))}
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
