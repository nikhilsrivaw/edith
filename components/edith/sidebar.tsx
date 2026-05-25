"use client";
import {
  Activity,
  AlertTriangle,
  Bot,
  CreditCard,
  FileText,
  GitBranch,
  Globe,
  LayoutGrid,
  Network,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { EdithLogo } from "./logo";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    label: "Audit",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
      { href: "/issues", label: "Issues", icon: AlertTriangle },
      { href: "/repos", label: "Repositories", icon: GitBranch },
      { href: "/drift", label: "Drift", icon: Zap },
      { href: "/activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/plan-check", label: "Plan Check", icon: Wand2 },
      { href: "/ai-activity", label: "AI Activity", icon: Bot },
      { href: "/extension", label: "Extension", icon: Globe },
      { href: "/integrations", label: "Integrations", icon: Plug },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/seo", label: "SEO", icon: Sparkles },
      { href: "/audit", label: "Compliance", icon: ShieldCheck },
      { href: "/reports", label: "Reports", icon: FileText },
      { href: "/graph", label: "Graph", icon: Network },
    ],
  },
  {
    label: "Org",
    items: [
      { href: "/team", label: "Team", icon: Users },
      { href: "/audit-log", label: "Audit Log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings },
      { href: "/settings#billing", label: "Billing", icon: CreditCard },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-svh w-60 shrink-0 self-start flex-col border-r border-[var(--border)] bg-[var(--bg-elev)]/55 px-4 py-5 backdrop-blur-sm md:flex">
      {/* === Logo + tiny live pill === */}
      <div className="flex items-center justify-between gap-2 px-2">
        <Link href="/dashboard" className="text-[var(--text)]">
          <EdithLogo />
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[8.5px] font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
          <span className="relative flex h-1 w-1">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
            <span className="relative inline-flex h-1 w-1 rounded-full bg-[var(--accent)]" />
          </span>
          live
        </span>
      </div>

      {/* === Nav === */}
      <nav className="mt-6 flex flex-1 flex-col gap-5 overflow-y-auto pb-4">
        {NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <div className="mb-1 px-3 font-mono text-[8.5px] font-medium uppercase tracking-[0.24em] text-[var(--text-muted)]">
              {group.label}
            </div>
            {group.items.map((item) => {
              const base = item.href.split("#")[0];
              const active =
                base === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(base);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex h-8 items-center gap-3 rounded-md px-3 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "bg-[var(--bg-elev-2)]/80 text-[var(--text)]"
                      : "text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)]/40 hover:text-[var(--text)]",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-[var(--accent)]"
                    />
                  )}
                  <item.icon
                    className={cn(
                      "h-3.5 w-3.5 transition-colors",
                      active
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-muted)] group-hover:text-[var(--text-dim)]",
                    )}
                    strokeWidth={1.75}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* === Footer status card === */}
      <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)]">
        {/* Top: pro trial */}
        <Link
          href="/pricing"
          className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-elev)]"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--accent)] text-[var(--bg)]">
            <Sparkles className="h-3 w-3" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text)]">
              Pro · 13 days left
            </div>
            <div className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Trial → upgrade
            </div>
          </div>
        </Link>

        {/* Bottom: live stat */}
        <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
          <StatCell label="Repos" value="0" />
          <StatCell label="Scans" value="0" />
        </div>
      </div>
    </aside>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2">
      <div className="font-mono text-[15px] font-semibold leading-none tabular-nums text-[var(--text)]">
        {value}
      </div>
      <div className="mt-1 font-mono text-[8.5px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}
