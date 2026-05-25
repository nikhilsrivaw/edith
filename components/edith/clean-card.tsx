import { cn } from "@/lib/utils";
import { AccentLine } from "./accent-line";

export function CleanCard({
  children,
  className,
  withAccent = true,
  hoverable = true,
}: {
  children: React.ReactNode;
  className?: string;
  withAccent?: boolean;
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] transition-colors duration-200",
        hoverable && "hover:border-[var(--border-hot)]",
        className,
      )}
    >
      {withAccent && <AccentLine />}
      {children}
    </div>
  );
}
