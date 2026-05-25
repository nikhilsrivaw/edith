"use client";
import { cn } from "@/lib/utils";

interface ShinyTextProps {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}

export function ShinyText({
  children,
  className,
  shimmerWidth = 100,
}: ShinyTextProps) {
  return (
    <span
      style={
        {
          "--shimmer-width": `${shimmerWidth}px`,
        } as React.CSSProperties
      }
      className={cn(
        "mx-auto inline-block max-w-full bg-clip-text bg-no-repeat text-transparent",
        "bg-[linear-gradient(110deg,var(--text-dim)_40%,var(--text)_50%,var(--text-dim)_60%)]",
        "bg-[length:200%_100%]",
        "animate-shimmer",
        className,
      )}
    >
      {children}
    </span>
  );
}
