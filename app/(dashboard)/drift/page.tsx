import Link from "next/link";
import { redirect } from "next/navigation";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { listDriftAlerts, userOrgId } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  score_regression: "Score dropped",
  new_critical: "New critical",
  env_var_change: "Env var change",
  schema_drift: "Schema drift",
};

const SEV_TONE: Record<string, string> = {
  critical: "bg-[var(--danger)]",
  high: "bg-[var(--accent)]",
  medium: "bg-[var(--cool-2)]",
  low: "bg-[var(--text-muted)]",
};

export default async function DriftPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return (
      <>
        <Topbar title="Drift" />
        <main className="flex-1 px-6 py-6">
          <CleanCard className="p-6 text-[13px] text-[var(--text-dim)]">
            No org yet.
          </CleanCard>
        </main>
      </>
    );
  }

  const alerts = await listDriftAlerts(orgId, 100);
  const byKind: Record<string, typeof alerts> = {};
  for (const a of alerts) {
    (byKind[a.kind] ??= []).push(a);
  }

  return (
    <>
      <Topbar
        title="Drift"
        subtitle={`${alerts.length} unacknowledged alerts — things that got worse since the last scan`}
      />
      <main className="flex-1 px-6 py-6">
        {/* Counts row */}
        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((k) => (
            <CleanCard key={k} className="p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {KIND_LABEL[k]}
              </div>
              <div className="mt-2 font-mono text-[28px] font-semibold tabular-nums text-[var(--text)]">
                {byKind[k]?.length ?? 0}
              </div>
            </CleanCard>
          ))}
        </section>

        {alerts.length === 0 ? (
          <CleanCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              Nothing has drifted.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              EDITH compares every scan against the previous one. When something
              gets worse — score drop, new critical, schema change, new env var —
              it lands here.
            </p>
          </CleanCard>
        ) : (
          <CleanCard className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-elev-2)]/40"
                >
                  <span
                    aria-hidden
                    className={`mt-2 h-2 w-2 shrink-0 rounded-sm ${SEV_TONE[a.severity] ?? "bg-[var(--text-muted)]"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] text-[var(--text)]">
                      {a.title}
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {KIND_LABEL[a.kind] ?? a.kind} ·{" "}
                      {a.repo ? (
                        <Link
                          href={`/repos/${a.repo.name}`}
                          className="text-[var(--accent)] hover:brightness-110"
                        >
                          {a.repo.name}
                        </Link>
                      ) : (
                        "—"
                      )}{" "}
                      · {timeAgo(a.created_at)}
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
