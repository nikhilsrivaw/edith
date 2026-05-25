"use client";
/**
 * NumberTicker — smooth animated count-up when the element scrolls into view.
 *
 * Uses Motion's useInView so the rolling animation triggers once and stays
 * stable. Uses a plain rAF loop (Motion's useMotionValue + useTransform
 * fights React 19 in production — same fix we used on the popup hero).
 */
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface Props {
  value: number;
  className?: string;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}

export function NumberTicker({
  value,
  className,
  duration = 1500,
  decimals = 0,
  prefix = "",
  suffix = "",
}: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  const formatted = display.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
