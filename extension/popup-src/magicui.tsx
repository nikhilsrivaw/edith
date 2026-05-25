/**
 * MagicUI primitives — ported from the main app, slimmed for the popup.
 *
 * Exposes: BorderBeam, ShinyText, DotPattern, Particles.
 * All zero-config, no external assets, pure inline SVG / canvas / CSS.
 */
import React, { useEffect, useId, useRef } from "react";
import { cn } from "./lib";

/* ============ BorderBeam ============ */

export function BorderBeam({
  className,
  size = 180,
  duration = 9,
  delay = 0,
  colorFrom = "#FFB627",
  colorTo = "#FF6B27",
  borderWidth = 1.25,
}: {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
}) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": duration + "s",
          "--delay": delay + "s",
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--border-width": borderWidth + "px",
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width))_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)]",
        "after:animate-border-beam after:[animation-delay:var(--delay)] after:[animation-duration:var(--duration)]",
        "after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]",
        "after:[offset-anchor:90%_50%]",
        "after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        className,
      )}
    />
  );
}

/* ============ ShinyText ============ */

export function ShinyText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block bg-clip-text bg-no-repeat text-transparent",
        "bg-[linear-gradient(110deg,#7A8896_40%,#E6EDF5_50%,#7A8896_60%)]",
        "bg-[length:200%_100%] animate-shimmer",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ============ DotPattern ============ */

export function DotPattern({
  width = 18,
  height = 18,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
}: {
  width?: number;
  height?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
}) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-[var(--color-border-edith)]/40",
        className,
      )}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}

/* ============ Particles ============ */

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  target: number;
};

export function Particles({
  quantity = 28,
  color = "#FFB627",
  size = 0.5,
  speed = 0.12,
  className,
}: {
  quantity?: number;
  color?: string;
  size?: number;
  speed?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const r = container.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = r.width + "px";
      canvas.style.height = r.height + "px";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      particlesRef.current = Array.from({ length: quantity }, () => ({
        x: Math.random() * r.width,
        y: Math.random() * r.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        size: Math.random() * 1.2 + size,
        alpha: 0,
        target: Math.random() * 0.4 + 0.15,
      }));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const animate = () => {
      const r = container.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.alpha < p.target) p.alpha += 0.008;
        if (p.x < 0 || p.x > r.width) p.vx = -p.vx;
        if (p.y < 0 || p.y > r.height) p.vy = -p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [quantity, color, size, speed]);

  return (
    <div
      ref={containerRef}
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
