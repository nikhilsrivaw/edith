import { Bot, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const TOOL_LABEL: Record<string, string> = {
  edith_list_repos: "Listed your repos",
  edith_get_issues: "Fetched issues",
  edith_get_fix_prompt: "Generated a fix prompt",
  edith_get_regression_test: "Generated a regression test",
  edith_plan_check: "Validated a plan",
  edith_get_score_trend: "Pulled score trend",
};

export default async function AiActivityPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const orgId = await userOrgId(user.id);
  if (!orgId) redirect("/dashboard");

  const admin = getSupabaseAdmin();
  const { data: calls } = await admin
    .from("mcp_calls")
    .select("id, token_id, tool, arguments, duration_ms, status, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  type C = {
    id: string;
    token_id: string;
    tool: string;
    arguments: Record<string, unknown> | null;
    duration_ms: number | null;
    status: string;
    created_at: string;
  };
  const rows = (calls as C[]) ?? [];

  // Aggregate this-week stats
  const weekAgo = Date.now() - 7 * 86_400_000;
  const thisWeek = rows.filter((r) => +new Date(r.created_at) > weekAgo);
  const byTool: Record<string, number> = {};
  for (const r of thisWeek) byTool[r.tool] = (byTool[r.tool] ?? 0) + 1;

  return (
    <>
      <Topbar
        title="AI activity"
        subtitle="Calls your coding agents made to EDITH through MCP"
      />
      <main className="flex-1 px-6 py-6">
        {/* Header stats */}
        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <Stat label="This week" value={thisWeek.length.toString()} />
          <Stat
            label="Most-used tool"
            value={
              Object.entries(byTool).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"
            }
            mono
          />
          <Stat
            label="Avg duration"
            value={
              thisWeek.length > 0
                ? `${Math.round(thisWeek.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / thisWeek.length)}ms`
                : "—"
            }
          />
        </section>

        {rows.length === 0 ? (
          <CleanCard className="p-10 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)]">
              <Bot className="h-6 w-6 text-[var(--accent)]" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--text)]">
              No agent calls yet.
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
              Wire Cursor / Claude Code to EDITH through{" "}
              <span className="font-mono text-[12px] text-[var(--text)]">
                /integrations/mcp
              </span>
              . Every tool call your agent makes lands here.
            </p>
          </CleanCard>
        ) : (
          <CleanCard className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--accent)]">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--text)]">
                      {TOOL_LABEL[r.tool] ?? r.tool}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                      {r.tool}
                      {r.arguments && Object.keys(r.arguments).length > 0
                        ? ` · ${JSON.stringify(r.arguments).slice(0, 80)}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      {timeAgo(r.created_at)}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                      {r.duration_ms ?? 0}ms ·{" "}
                      <span
                        className={
                          r.status === "ok"
                            ? "text-[var(--success)]"
                            : "text-[var(--danger)]"
                        }
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CleanCard>
        )}
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <CleanCard className="p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-2 ${mono ? "font-mono text-[14px]" : "font-mono text-[28px] font-semibold"} text-[var(--text)] tabular-nums`}
      >
        {value}
      </div>
    </CleanCard>
  );
}
