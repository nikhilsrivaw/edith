"use client";
/**
 * MagicCard — gradient border that follows the cursor (CSS-mask trick).
 *
 * Uses a CSS conic-gradient + mask-composite to paint just the border with a
 * cursor-tracked highlight. Falls back gracefully to a static border when
 * the cursor is elsewhere.
 */
import { cn } from "@/lib/utils";
import { useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  gradientColor?: string;
  gradientSize?: number;
  borderRadius?: string;
}

export function MagicCard({
  children,
  className,
  gradientColor = "rgba(255, 182, 39, 0.6)",
  gradientSize = 220,
  borderRadius = "0.75rem",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -200, y: -200 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const onLeave = () => setPos({ x: -200, y: -200 });

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "relative isolate rounded-xl bg-[var(--bg-elev)]",
        className,
      )}
      style={{ borderRadius }}
    >
      {/* Border layer — masked so only ~1px ring is visible */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px transition-opacity duration-200"
        style={{
          borderRadius,
          background: `radial-gradient(${gradientSize}px circle at ${pos.x}px ${pos.y}px, ${gradientColor}, transparent 60%)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />
      {/* Persistent subtle border so the card has shape when cursor is far */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] border border-[var(--border)]"
        style={{ borderRadius }}
      />
      <div className="relative z-10" style={{ borderRadius }}>
        {children}
      </div>
    </div>
  );
}
