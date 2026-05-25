import type { Severity } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STYLES: Record<Severity, string> = {
  critical:
    "bg-[rgba(248,113,113,0.1)] text-[var(--danger)] border-[var(--danger)]/30",
  high: "bg-[var(--accent-soft)] text-[var(--accent)] border-[var(--accent)]/30",
  medium:
    "bg-[rgba(107,174,214,0.1)] text-[var(--cool-2)] border-[var(--cool-2)]/30",
  low: "bg-[var(--bg-elev-2)] text-[var(--text-dim)] border-[var(--border)]",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em]",
        STYLES[severity],
        className,
      )}
    >
      {severity}
    </span>
  );
}
