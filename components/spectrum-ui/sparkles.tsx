"use client";
/**
 * Sparkles — twinkling dots drifting at random in a bounded area.
 *
 * Generates `count` particles once on mount, each with a randomised offset
 * keyframe duration. Restrained density by default so it works as ambience
 * behind hero text without becoming noise.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  count?: number;
  color?: string;
  minSize?: number;
  maxSize?: number;
}

export function Sparkles({
  className,
  count = 28,
  color = "#FFB627",
  minSize = 1,
  maxSize = 2.5,
}: Props) {
  const [items, setItems] = useState<
    Array<{
      id: number;
      x: number;
      y: number;
      size: number;
      delay: number;
      duration: number;
    }>
  >([]);

  useEffect(() => {
    setItems(
      Array.from({ length: count }, (_, id) => ({
        id,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: minSize + Math.random() * (maxSize - minSize),
        delay: Math.random() * 4,
        duration: 2.5 + Math.random() * 4,
      })),
    );
  }, [count, minSize, maxSize]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
    >
      {items.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background: color,
            opacity: 0,
            animation: `edith-sparkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes edith-sparkle {
          0%,
          100% {
            opacity: 0;
            transform: scale(0.6);
          }
          50% {
            opacity: 0.85;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
