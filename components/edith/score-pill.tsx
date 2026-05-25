import { cn } from "@/lib/utils";
import { scoreTone } from "@/lib/format";

const TONE_BG: Record<"good" | "warn" | "bad", string> = {
  good: "bg-[rgba(74,222,128,0.12)] text-[var(--success)] border-[var(--success)]/30",
  warn: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30",
  bad: "bg-[rgba(248,113,113,0.12)] text-[var(--danger)] border-[var(--danger)]/30",
};

export function ScorePill({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tone = scoreTone(score);
  const sizeClass =
    size === "sm"
      ? "h-6 px-2 text-[11px]"
      : size === "lg"
        ? "h-9 px-4 text-[15px]"
        : "h-7 px-3 text-[12px]";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border font-mono font-semibold tabular-nums",
        TONE_BG[tone],
        sizeClass,
        className,
      )}
    >
      {score}
      <span className="ml-0.5 opacity-60">/100</span>
    </span>
  );
}
