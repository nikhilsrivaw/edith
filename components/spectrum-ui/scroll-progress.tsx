"use client";
/**
 * ScrollProgress — fixed top-of-page bar that fills as the user scrolls.
 *
 * Uses Motion's useScroll + useSpring for a smooth, non-jittery progress
 * indicator. Renders at the top z-index so it sits above the nav.
 */
import { useScroll, useSpring, motion } from "motion/react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  color?: string;
}

export function ScrollProgress({
  className,
  color = "var(--accent)",
}: Props) {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 200,
    damping: 50,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-0 right-0 top-0 z-[60] h-[2px] origin-left",
        className,
      )}
      style={{ scaleX, background: color }}
    />
  );
}
