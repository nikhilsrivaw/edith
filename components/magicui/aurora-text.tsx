"use client";
import { cn } from "@/lib/utils";

interface AuroraTextProps {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
  speed?: number;
}

export function AuroraText({
  children,
  className,
  colors = ["#FFB627", "#FF6B27", "#FFD27F", "#FF9A27", "#FFB627"],
  speed = 1,
}: AuroraTextProps) {
  const gradient = `linear-gradient(110deg, ${colors.join(", ")})`;
  return (
    <span className={cn("relative inline-block", className)}>
      <span className="sr-only">{children}</span>
      <span
        aria-hidden
        className="relative inline-block bg-clip-text text-transparent"
        style={{
          backgroundImage: gradient,
          backgroundSize: "300% 300%",
          animation: `aurora ${10 / speed}s ease-in-out infinite`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {children}
      </span>
    </span>
  );
}
