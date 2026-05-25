import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Globe,
  Sparkles,
  XCircle,
} from "lucide-react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { listActivity, userOrgId, type ActivityEvent } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const ICON: Record<ActivityEvent["kind"], React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  scan_completed: Activity,
  scan_failed: XCircle,
  drift_alert: AlertTriangle,
  extension_scan: Globe,
  mcp_call: Sparkles,
  issue_dismissed: XCircle,
};

const TONE: Record<ActivityEvent["kind"], string> = {
  scan_completed: "text-[var(--success)]",
  scan_failed: "text-[var(--danger)]",
  drift_alert: "text-[var(--accent)]",
  extension_scan: "text-[var(--cool-2)]",
  mcp_call: "text-[var(--accent)]",
  issue_dismissed: "text-[var(--text-muted)]",
};

export default async function ActivityPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return (
      <>
        <Topbar title="Activity" />
        <main className="flex-1 px-6 py-6">
          <CleanCard className="p-6 text-[13px] text-[var(--text-dim)]">
            No org yet.
          </CleanCard>
        </main>
      </>
    );
  }

  const events = await listActivity(orgId, 80);

  return (
    <>
      <Topbar
        title="Activity"
        subtitle="Everything EDITH has done for you, latest first"
      />
      <main className="flex-1 px-6 py-6">
        {events.length === 0 ? (
          <CleanCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              No activity yet.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              Run a scan, open a PR on a connected repo, or call EDITH through
              the MCP server from your agent. Everything shows up here.
            </p>
          </CleanCard>
        ) : (
          <CleanCard className="p-0">
            <ol className="divide-y divide-[var(--border)]">
              {events.map((e, i) => {
                const Icon = ICON[e.kind] ?? Activity;
                const inner = (
                  <div className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-elev-2)]/40">
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] ${TONE[e.kind]}`}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-[var(--text)]">
                        {e.title}
                      </div>
                      {e.subtitle && (
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {e.subtitle}
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {timeAgo(e.at)}
                    </span>
                  </div>
                );
                return (
                  <li key={`${e.kind}-${i}`}>
                    {e.href ? <Link href={e.href}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ol>
          </CleanCard>
        )}
      </main>
    </>
  );
}
