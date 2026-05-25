"use client";
/**
 * RetroGrid — perspective-tilted grid that scrolls toward the viewer.
 *
 * Pure CSS — a single tiled background-image rotated on X-axis to create
 * the "Tron horizon" feel, then translated continuously. Honors the brand
 * by being amber-tinted and low-opacity (no neon explosion).
 */
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  angle?: number;
  cellSize?: number;
  opacity?: number;
  lightLineColor?: string;
  darkLineColor?: string;
}

export function RetroGrid({
  className,
  angle = 65,
  cellSize = 60,
  opacity = 0.35,
  lightLineColor = "rgba(255, 182, 39, 0.22)",
  darkLineColor = "rgba(255, 182, 39, 0.22)",
}: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden [perspective:200px]",
        className,
      )}
      style={
        {
          "--edith-grid-angle": `${angle}deg`,
          "--edith-grid-cell-size": `${cellSize}px`,
          "--edith-grid-opacity": opacity,
          "--edith-grid-light-line": lightLineColor,
          "--edith-grid-dark-line": darkLineColor,
        } as React.CSSProperties
      }
    >
      <div className="absolute inset-0 [transform:rotateX(var(--edith-grid-angle))]">
        <div
          className="animate-edith-retro-grid"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--edith-grid-light-line) 1px, transparent 0), linear-gradient(to bottom, var(--edith-grid-dark-line) 1px, transparent 0)",
            backgroundRepeat: "repeat",
            backgroundSize:
              "var(--edith-grid-cell-size) var(--edith-grid-cell-size)",
            height: "300vh",
            inset: "0% 0px",
            marginLeft: "-50%",
            transformOrigin: "100% 0 0",
            width: "600%",
            position: "absolute",
            opacity: "var(--edith-grid-opacity)",
          }}
        />
      </div>
      {/* Fade out at the horizon so it doesn't bleed into the rest of the page */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] to-transparent to-90%" />

      <style jsx>{`
        @keyframes edith-retro-grid-anim {
          0% {
            transform: translateY(-50%);
          }
          100% {
            transform: translateY(0);
          }
        }
        .animate-edith-retro-grid {
          animation: edith-retro-grid-anim 18s linear infinite;
        }
      `}</style>
    </div>
  );
}
