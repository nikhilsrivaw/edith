import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "EDITH — Every Deploy Inspected. Thoroughly. Honestly.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0E14",
          backgroundImage:
            "radial-gradient(circle at 75% 30%, rgba(255,182,39,0.10), transparent 55%), radial-gradient(circle at 10% 90%, rgba(107,174,214,0.06), transparent 50%)",
          display: "flex",
          flexDirection: "column",
          padding: "72px 80px",
          color: "#E6EDF3",
          fontFamily: "ui-sans-serif, system-ui",
          position: "relative",
        }}
      >
        {/* amber accent line — matches the in-app design */}
        <div
          style={{
            position: "absolute",
            top: 72,
            left: 80,
            width: 2,
            height: 32,
            background: "#FFB627",
            boxShadow: "0 0 12px rgba(255,182,39,0.55)",
          }}
        />
        <div
          style={{
            fontSize: 14,
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "#FFB627",
            marginLeft: 28,
            display: "flex",
          }}
        >
          EDITH · the AI-app auditor
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 600,
              lineHeight: 1.02,
              letterSpacing: "-0.025em",
              color: "#FFFFFF",
              maxWidth: 1000,
              display: "flex",
            }}
          >
            Audit your AI-built app before users do.
          </div>
          <div
            style={{
              marginTop: 36,
              fontSize: 26,
              lineHeight: 1.4,
              color: "#9BA9B4",
              maxWidth: 960,
              display: "flex",
            }}
          >
            Security · SEO · AI-surface · performance · accessibility —
            one scan, fix prompts your AI tool can apply.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 16,
            color: "#5A6672",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex" }}>edith.expert</div>
          <div style={{ display: "flex" }}>v1 · early access</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
