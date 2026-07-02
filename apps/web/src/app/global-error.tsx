"use client";

import { useEffect } from "react";

import { reportClientError } from "@/lib/errors";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    void reportClientError(error, {
      source: "next-global-error",
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          backgroundColor: "#050810",
          color: "#ffffff",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <p
            style={{
              color: "rgba(251, 191, 36, 0.7)",
              fontSize: "0.75rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Critical Failure
          </p>
          <h1 style={{ fontSize: "2rem", marginBottom: "1rem", fontWeight: 700 }}>
            TerraQura is temporarily unavailable.
          </h1>
          <p style={{ color: "rgba(255,255,255,0.7)", marginBottom: "2rem" }}>
            We hit an unexpected error. Please refresh, or try again shortly.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              backgroundColor: "#059669",
              color: "white",
              padding: "0.875rem 1.75rem",
              borderRadius: "0.625rem",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
