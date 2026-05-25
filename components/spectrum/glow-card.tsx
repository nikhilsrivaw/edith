"use client";
import { cn } from "@/lib/utils";

export function GlowCard({
  children,
  className,
  innerClassName,
  glowColor = "rgba(255, 182, 39, 0.18)",
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  glowColor?: string;
}) {
  return (
    <div className={cn("group relative h-full", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at center, ${glowColor}, transparent 65%)`,
        }}
      />
      <div
        className={cn(
          "relative h-full rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] transition-colors duration-200 group-hover:border-[var(--border-hot)]",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
