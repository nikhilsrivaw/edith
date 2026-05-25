"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const [meteors, setMeteors] = useState<
    Array<{ id: number; left: string; top: string; delay: string; duration: string }>
  >([]);

  useEffect(() => {
    setMeteors(
      Array.from({ length: number }, (_, i) => ({
        id: i,
        left: Math.random() * 120 - 10 + "%",
        top: Math.random() * 50 - 50 + "%",
        delay: (Math.random() * 4).toFixed(2) + "s",
        duration: (Math.random() * 5 + 4).toFixed(2) + "s",
      })),
    );
  }, [number]);

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {meteors.map((m) => (
        <span
          key={m.id}
          aria-hidden
          className={cn(
            "absolute h-0.5 w-0.5 rotate-[215deg] rounded-full bg-[var(--accent)]",
            "shadow-[0_0_4px_1px_var(--accent-glow)]",
            "before:absolute before:top-1/2 before:h-px before:w-[80px] before:-translate-y-1/2",
            "before:bg-gradient-to-r before:from-[var(--accent)] before:to-transparent",
            "animate-meteor",
          )}
          style={{
            left: m.left,
            top: m.top,
            animationDelay: m.delay,
            animationDuration: m.duration,
          }}
        />
      ))}
    </div>
  );
}
