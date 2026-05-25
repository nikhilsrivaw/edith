"use client";
/**
 * Marquee — infinite-scrolling strip (horizontal or vertical).
 *
 * Duplicates children twice and animates the wrapper. Pauses on hover by
 * default. Tailwind-only animation — no JS rAF loop required.
 */
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  vertical?: boolean;
  /** Duration in seconds. */
  duration?: number;
  /** Gap between items (Tailwind class fragment). */
  gap?: string;
}

export function Marquee({
  children,
  className,
  reverse = false,
  pauseOnHover = true,
  vertical = false,
  duration = 40,
  gap = "gap-12",
}: Props) {
  const axis = vertical ? "flex-col" : "flex-row";
  const animation = vertical
    ? reverse
      ? "edith-marquee-vertical-reverse"
      : "edith-marquee-vertical"
    : reverse
      ? "edith-marquee-reverse"
      : "edith-marquee";

  return (
    <div
      className={cn(
        "group flex overflow-hidden",
        vertical ? "flex-col" : "flex-row",
        className,
      )}
    >
      {[0, 1].map((i) => (
        <div
          key={i}
          aria-hidden={i === 1}
          className={cn(
            "flex shrink-0 items-center",
            axis,
            gap,
            "pr-12",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
          )}
          style={{
            animation: `${animation} ${duration}s linear infinite`,
          }}
        >
          {children}
        </div>
      ))}

      <style jsx>{`
        @keyframes edith-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-100%);
          }
        }
        @keyframes edith-marquee-reverse {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes edith-marquee-vertical {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(-100%);
          }
        }
        @keyframes edith-marquee-vertical-reverse {
          from {
            transform: translateY(-100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
