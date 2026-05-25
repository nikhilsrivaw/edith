"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";
import { cn } from "@/lib/utils";

interface TypingAnimationProps {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
  startOnView?: boolean;
}

export function TypingAnimation({
  text,
  className,
  duration = 40,
  delay = 0,
  startOnView = true,
}: TypingAnimationProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (startOnView && !inView) return;
    const startTimer = setTimeout(() => {
      let i = 0;
      const id = setInterval(() => {
        if (i < text.length) {
          setDisplay(text.substring(0, i + 1));
          i++;
        } else {
          clearInterval(id);
          setDone(true);
        }
      }, duration);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [inView, startOnView, text, duration, delay]);

  return (
    <span ref={ref} className={cn("inline-block", className)}>
      {display}
      {!done && display.length > 0 && (
        <span className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[2px] animate-pulse bg-[var(--accent)] align-middle" />
      )}
    </span>
  );
}
