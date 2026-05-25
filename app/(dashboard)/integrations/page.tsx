import { ArrowRight, Hash, MessageSquare, Plug, Webhook } from "lucide-react";
import Link from "next/link";
import { CleanCard } from "@/components/edith/clean-card";
import { GithubMark } from "@/components/edith/github-mark";
import { Topbar } from "@/components/edith/topbar";

type Integration = {
  id: string;
  name: string;
  blurb: string;
  href: string;
  status: "live" | "coming-soon";
  icon: "github" | "plug" | "slack" | "linear" | "webhook";
};

const INTEGRATIONS: Integration[] = [
  {
    id: "github-app",
    name: "GitHub App",
    blurb:
      "Install EDITH on your repos. Auto-scans every PR, posts inline comments, runs the quality gate.",
    href: "/dashboard",
    status: "live",
    icon: "github",
  },
  {
    id: "mcp",
    name: "MCP Server",
    blurb:
      "Plug EDITH directly into Cursor, Claude Code, Windsurf, or any MCP-compatible agent. Your agent fetches issues + fix prompts itself.",
    href: "/integrations/mcp",
    status: "live",
    icon: "plug",
  },
  {
    id: "slack",
    name: "Slack",
    blurb: "Daily digest of critical findings + drift alerts in your team channel.",
    href: "#",
    status: "coming-soon",
    icon: "slack",
  },
  {
    id: "linear",
    name: "Linear",
    blurb: "Auto-create Linear tickets for new critical issues. Closes when EDITH stops flagging them.",
    href: "#",
    status: "coming-soon",
    icon: "linear",
  },
  {
    id: "webhook",
    name: "Outgoing webhooks",
    blurb: "Fire JSON to any URL when EDITH score drops or a critical lands. Build your own ops surface.",
    href: "#",
    status: "coming-soon",
    icon: "webhook",
  },
];

const ICONS: Record<Integration["icon"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  github: () => <GithubMark className="h-5 w-5 text-[var(--text)]" />,
  plug: Plug,
  slack: Hash,
  linear: MessageSquare,
  webhook: Webhook,
};

export default function IntegrationsIndex() {
  return (
    <>
      <Topbar
        title="Integrations"
        subtitle="Connect EDITH to your existing tools and workflow"
      />
      <main className="flex-1 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          {INTEGRATIONS.map((i) => {
            const Icon = ICONS[i.icon];
            const isLive = i.status === "live";
            return (
              <CleanCard key={i.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]">
                    <Icon
                      className="h-4 w-4 text-[var(--accent)]"
                      strokeWidth={1.75}
                    />
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                      isLive
                        ? "text-[var(--success)]"
                        : "text-[var(--text-muted)]"
                    }`}
                  >
                    {isLive ? "Live" : "Coming soon"}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold text-[var(--text)]">
                  {i.name}
                </h3>
                <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-dim)]">
                  {i.blurb}
                </p>
                {isLive ? (
                  <Link
                    href={i.href}
                    className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
                  >
                    Configure <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Notify me
                  </span>
                )}
              </CleanCard>
            );
          })}
        </div>
      </main>
    </>
  );
}
