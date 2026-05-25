"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error so it lands in Vercel logs / Sentry / any other
    // attached reporter. The digest is the stable hash Next.js attaches
    // to server-rendered errors for cross-referencing.
    console.error("[edith global error]", error.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#0A0E14",
          color: "#E6EDF3",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "left" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#FFB627",
              marginBottom: 12,
            }}
          >
            EDITH · error
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
            Something broke on our side.
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#9BA9B4", marginBottom: 20 }}>
            EDITH logged this. If it keeps happening, email{" "}
            <a
              href="mailto:support@edith.expert"
              style={{ color: "#FFB627" }}
            >
              support@edith.expert
            </a>{" "}
            with the code below.
          </p>
          {error.digest && (
            <div
              style={{
                fontSize: 11,
                color: "#5A6672",
                marginBottom: 20,
                fontFamily: "inherit",
              }}
            >
              digest: <span style={{ color: "#E6EDF3" }}>{error.digest}</span>
            </div>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#FFB627",
              color: "#0A0E14",
              border: 0,
              padding: "8px 14px",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: 8,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
