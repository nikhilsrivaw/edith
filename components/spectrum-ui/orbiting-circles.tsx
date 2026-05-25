"use client";
/**
 * OrbitingCircles — child elements rotate evenly around a shared centre.
 *
 * Drop inside a `relative` container. Each child is placed at the centre,
 * then a single keyframe spins it around at `radius` distance — and a
 * counter-rotation keeps the child upright. `animationDelay` is used to
 * offset each item by its angular position so we share one keyframe.
 */
import { cn } from "@/lib/utils";
import { Children, type ReactNode, useId } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  radius?: number;
  duration?: number;
  reverse?: boolean;
  delay?: number;
}

export function OrbitingCircles({
  children,
  className,
  radius = 140,
  duration = 24,
  reverse = false,
  delay = 0,
}: Props) {
  const items = Children.toArray(children);
  const count = items.length;
  const direction = reverse ? "reverse" : "normal";
  const ns = useId().replace(/[^a-zA-Z0-9]/g, "");

  return (
    <>
      {items.map((child, i) => {
        const angle = (360 / count) * i;
        const offset = -(angle / 360) * duration;
        return (
          <div
            key={i}
            className="pointer-events-none absolute left-1/2 top-1/2"
            style={{
              animation: `edith-orbit-${ns} ${duration}s linear infinite`,
              animationDirection: direction,
              animationDelay: `${offset + delay}s`,
            }}
          >
            <div
              className={cn("inline-block -translate-x-1/2 -translate-y-1/2", className)}
              style={{
                animation: `edith-orbit-counter-${ns} ${duration}s linear infinite`,
                animationDirection: reverse ? "normal" : "reverse",
                animationDelay: `${offset + delay}s`,
              }}
            >
              {child}
            </div>
          </div>
        );
      })}
      <style jsx global>{`
        @keyframes edith-orbit-${ns} {
          from {
            transform: rotate(0deg) translateY(-${radius}px);
          }
          to {
            transform: rotate(360deg) translateY(-${radius}px);
          }
        }
        @keyframes edith-orbit-counter-${ns} {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(-360deg);
          }
        }
      `}</style>
    </>
  );
}
