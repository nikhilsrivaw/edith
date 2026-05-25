import { cn } from "@/lib/utils";

export function AccentLine({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)] transition-all duration-200 group-hover:h-6",
        className,
      )}
    />
  );
}
