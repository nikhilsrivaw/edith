import { cn } from "@/lib/utils";

export function EdithLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 36 16"
        className="h-4 w-9 text-[var(--text)]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="0.75" y="2.5" width="14" height="11" rx="2.5" />
        <rect x="21.25" y="2.5" width="14" height="11" rx="2.5" />
        <line x1="14.75" y1="8" x2="21.25" y2="8" />
        <circle cx="7.75" cy="8" r="1.6" fill="var(--accent)" stroke="none" />
        <circle cx="28.25" cy="8" r="1.6" fill="var(--accent)" stroke="none" />
      </svg>
      {showWordmark && (
        <span className="font-mono text-[12px] font-semibold tracking-[0.22em] uppercase text-[var(--text)]">
          EDITH
        </span>
      )}
    </div>
  );
}
