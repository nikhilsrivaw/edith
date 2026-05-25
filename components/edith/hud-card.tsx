import { cn } from "@/lib/utils";

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

const positionClasses: Record<Position, string> = {
  "top-left":
    "top-2 left-2 group-hover:top-1.5 group-hover:left-1.5 border-l border-t",
  "top-right":
    "top-2 right-2 group-hover:top-1.5 group-hover:right-1.5 border-r border-t",
  "bottom-left":
    "bottom-2 left-2 group-hover:bottom-1.5 group-hover:left-1.5 border-l border-b",
  "bottom-right":
    "bottom-2 right-2 group-hover:bottom-1.5 group-hover:right-1.5 border-r border-b",
};

function Bracket({ position }: { position: Position }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-3 w-3 border-[var(--accent)]/40 transition-all duration-200 group-hover:border-[var(--accent)]/70",
        positionClasses[position],
      )}
    />
  );
}

export function HudCard({
  children,
  className,
  bordered = true,
  brackets = true,
}: {
  children: React.ReactNode;
  className?: string;
  bordered?: boolean;
  brackets?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl bg-[var(--bg-elev)] transition-colors duration-200",
        bordered &&
          "border border-[var(--border)] hover:border-[var(--border-hot)]",
        className,
      )}
    >
      {brackets && (
        <>
          <Bracket position="top-left" />
          <Bracket position="top-right" />
          <Bracket position="bottom-left" />
          <Bracket position="bottom-right" />
        </>
      )}
      {children}
    </div>
  );
}
