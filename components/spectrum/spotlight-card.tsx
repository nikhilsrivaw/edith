"use client";
import { useRef, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export function SpotlightCard({
  children,
  className,
  spotlightColor = "rgba(255, 182, 39, 0.16)",
  size = 460,
}: {
  children: React.ReactNode;
  className?: string;
  spotlightColor?: string;
  size?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={cn(
        "group relative h-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] transition-colors duration-200 hover:border-[var(--border-hot)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(${size}px circle at var(--mx, 50%) var(--my, 50%), ${spotlightColor}, transparent 60%)`,
        }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] [mask-image:radial-gradient(at_50%_0%,white_0%,transparent_70%)]">
        <div className="absolute inset-0 rounded-[inherit] [background:linear-gradient(180deg,var(--accent-soft),transparent_30%)] opacity-30" />
      </div>
      <div className="relative h-full">{children}</div>
    </div>
  );
}
