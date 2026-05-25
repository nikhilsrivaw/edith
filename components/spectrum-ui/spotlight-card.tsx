"use client";
/**
 * SpotlightCard — radial spotlight that follows the cursor on hover.
 *
 * Wraps any children. Tracks mouse position relative to the card and renders
 * an amber radial-gradient halo that follows the cursor. Falls back to a
 * static, centred glow on touch / when the cursor leaves.
 */
import { cn } from "@/lib/utils";
import { useRef, useState, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  /** Spotlight radius in pixels. */
  radius?: number;
  /** Spotlight color. CSS color value. */
  color?: string;
  /** Border-glow opacity at peak. */
  intensity?: number;
}

export function SpotlightCard({
  children,
  className,
  radius = 240,
  color = "rgba(255, 182, 39, 0.18)",
  intensity = 1,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState(false);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const spotlight = pos
    ? `radial-gradient(${radius}px circle at ${pos.x}px ${pos.y}px, ${color}, transparent 70%)`
    : `radial-gradient(${radius}px circle at 50% 0%, ${color}, transparent 70%)`;

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPos(null);
      }}
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] transition-colors hover:border-[var(--border-hot)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: spotlight,
          opacity: hover ? intensity : intensity * 0.4,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
