"use client";
/**
 * AnimatedBeam — SVG beam that traces between two DOM refs.
 *
 * Measures both ref'd elements + a shared container, draws a bezier path,
 * then animates a gradient along the stroke. Re-measures on resize.
 *
 * Usage:
 *   const a = useRef<HTMLDivElement>(null);
 *   const b = useRef<HTMLDivElement>(null);
 *   const container = useRef<HTMLDivElement>(null);
 *   return (
 *     <div ref={container} className="relative">
 *       <div ref={a}>From</div>
 *       <div ref={b}>To</div>
 *       <AnimatedBeam containerRef={container} fromRef={a} toRef={b} />
 *     </div>
 *   );
 */
import { motion } from "motion/react";
import { useEffect, useId, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface Props {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  className?: string;
  /** Bezier curvature (-) bend down, (+) bend up. */
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  /** Beam gradient. */
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStart?: string;
  gradientStop?: string;
}

export function AnimatedBeam({
  containerRef,
  fromRef,
  toRef,
  className,
  curvature = -40,
  reverse = false,
  duration = 3.5,
  delay = 0,
  pathColor = "rgba(255, 182, 39, 0.18)",
  pathWidth = 1.5,
  pathOpacity = 0.4,
  gradientStart = "#FFB627",
  gradientStop = "#FFB62700",
}: Props) {
  const id = useId();
  const [d, setD] = useState("");
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      const C = containerRef.current?.getBoundingClientRect();
      const A = fromRef.current?.getBoundingClientRect();
      const B = toRef.current?.getBoundingClientRect();
      if (!C || !A || !B) return;
      setBox({ w: C.width, h: C.height });
      const ax = A.left + A.width / 2 - C.left;
      const ay = A.top + A.height / 2 - C.top;
      const bx = B.left + B.width / 2 - C.left;
      const by = B.top + B.height / 2 - C.top;
      const cx = (ax + bx) / 2;
      const cy = (ay + by) / 2 + curvature;
      setD(`M ${ax},${ay} Q ${cx},${cy} ${bx},${by}`);
    };
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    if (fromRef.current) ro.observe(fromRef.current);
    if (toRef.current) ro.observe(toRef.current);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [containerRef, fromRef, toRef, curvature]);

  return (
    <svg
      fill="none"
      width={box.w}
      height={box.h}
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute left-0 top-0",
        className,
      )}
      viewBox={`0 0 ${box.w} ${box.h}`}
    >
      <path
        d={d}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />
      <path
        d={d}
        strokeWidth={pathWidth}
        stroke={`url(#${id})`}
        strokeOpacity="1"
        strokeLinecap="round"
      />
      <defs>
        <motion.linearGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{
            x1: "0%",
            x2: "0%",
            y1: "0%",
            y2: "0%",
          }}
          animate={
            reverse
              ? {
                  x1: ["90%", "-10%"],
                  x2: ["100%", "0%"],
                  y1: ["0%", "0%"],
                  y2: ["0%", "0%"],
                }
              : {
                  x1: ["-10%", "90%"],
                  x2: ["0%", "100%"],
                  y1: ["0%", "0%"],
                  y2: ["0%", "0%"],
                }
          }
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: "linear",
            repeatDelay: 0,
          }}
        >
          <stop stopColor={gradientStop} />
          <stop offset="32.5%" stopColor={gradientStart} />
          <stop offset="100%" stopColor={gradientStop} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
