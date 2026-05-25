"use client";
import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: number;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
}

type Square = { id: number; pos: [number, number] };

export function AnimatedGridPattern({
  width = 44,
  height = 44,
  x = -1,
  y = -1,
  strokeDasharray = 0,
  numSquares = 36,
  className,
  maxOpacity = 0.35,
  duration = 4,
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [squares, setSquares] = useState<Square[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setDims({ w: r.width, h: r.height });
    };
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!dims.w || !dims.h) return;
    const cols = Math.floor(dims.w / width);
    const rows = Math.floor(dims.h / height);
    if (cols < 1 || rows < 1) return;
    setSquares(
      Array.from({ length: numSquares }, (_, i) => ({
        id: i,
        pos: [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)],
      })),
    );
  }, [dims, numSquares, width, height]);

  const refreshSquare = (sid: number) =>
    setSquares((prev) => {
      const cols = Math.floor(dims.w / width);
      const rows = Math.floor(dims.h / height);
      if (cols < 1 || rows < 1) return prev;
      return prev.map((s) =>
        s.id === sid
          ? {
              ...s,
              pos: [Math.floor(Math.random() * cols), Math.floor(Math.random() * rows)],
            }
          : s,
      );
    });

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-[var(--border)]/30 stroke-[var(--border)]/50",
        className,
      )}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path d={`M.5 ${height}V.5H${width}`} fill="none" strokeDasharray={strokeDasharray} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [px, py], id: sid }, idx) => (
          <motion.rect
            key={`${sid}-${px}-${py}-${idx}`}
            width={width - 1}
            height={height - 1}
            x={px * width + 1}
            y={py * height + 1}
            fill="var(--accent)"
            strokeWidth={0}
            initial={{ opacity: 0 }}
            animate={{ opacity: maxOpacity }}
            transition={{
              duration,
              repeat: 1,
              delay: idx * 0.12,
              repeatType: "reverse",
            }}
            onAnimationComplete={() => refreshSquare(sid)}
          />
        ))}
      </svg>
    </svg>
  );
}
