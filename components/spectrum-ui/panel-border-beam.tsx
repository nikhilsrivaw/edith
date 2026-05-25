"use client";
/**
 * PanelBorderBeam — an animated gradient stroke that traces the actual
 * perimeter of its parent.
 *
 * Why not MagicUI's BorderBeam: that component relies on `offset-path: rect()`
 * + `mask-composite: intersect` to clip a moving square gradient down to the
 * border ring. On large rectangular containers the mask doesn't always hold
 * across browsers / Tailwind versions, so the glowing square ends up visible
 * crossing the interior.
 *
 * This implementation just draws a rounded-rect SVG path and animates the
 * stroke-dashoffset of a gradient-stroked overlay along it. Result: a real
 * light pulse that follows the actual border, every time.
 */
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Border-radius in px. Match the parent's rounded-* value. */
  radius?: number;
  /** Stroke width in px. */
  strokeWidth?: number;
  /** Length of the bright trailing pulse, as a fraction of the perimeter. */
  pulseFraction?: number;
  /** Seconds for one full traverse of the perimeter. */
  duration?: number;
  /** Faint background stroke colour. */
  trackColor?: string;
  /** Bright pulse colours. */
  beamColorFrom?: string;
  beamColorTo?: string;
}

export function PanelBorderBeam({
  className,
  radius = 16,
  strokeWidth = 1.5,
  pulseFraction = 0.22,
  duration = 6,
  trackColor = "rgba(255, 182, 39, 0.10)",
  beamColorFrom = "#FFB627",
  beamColorTo = "#FFB62700",
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      style={{ borderRadius: radius }}
    >
      {size && size.w > 0 && size.h > 0 && (
        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          className="absolute inset-0"
        >
          <defs>
            <linearGradient id={`pbb-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={beamColorTo} />
              <stop offset="50%" stopColor={beamColorFrom} />
              <stop offset="100%" stopColor={beamColorTo} />
            </linearGradient>
          </defs>

          {/* Faint full-perimeter track */}
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Animated bright pulse traversing the same path */}
          <rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={radius}
            ry={radius}
            fill="none"
            stroke={`url(#pbb-${id})`}
            strokeWidth={strokeWidth}
            pathLength={100}
            strokeDasharray={`${pulseFraction * 100} ${(1 - pulseFraction) * 100}`}
            strokeLinecap="round"
            style={{
              animation: `panel-beam-${id} ${duration}s linear infinite`,
            }}
          />
        </svg>
      )}

      <style jsx>{`
        @keyframes panel-beam-${id} {
          from {
            stroke-dashoffset: 100;
          }
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
