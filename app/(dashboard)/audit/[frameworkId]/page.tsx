import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { userOrgId } from "@/lib/db-aggregations";
import { complianceFor } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function FrameworkDetail({
  params,
}: {
  params: Promise<{ frameworkId: string }>;
}) {
  const { frameworkId } = await params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) redirect("/dashboard");

  const all = await complianceFor(orgId);
  const f = all.find((x) => x.id === frameworkId);
  if (!f) notFound();

  return (
    <>
      <Topbar
        title={f.name}
        subtitle={`${f.percent}% — ${f.passing}/${f.totalControls} controls passing`}
        actions={
          <Link
            href="/audit"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.75} /> Back
          </Link>
        }
      />
      <main className="flex-1 px-6 py-6">
        {f.description && (
          <CleanCard className="mb-5 p-5">
            <p className="text-[13.5px] leading-relaxed text-[var(--text-dim)]">
              {f.description}
            </p>
          </CleanCard>
        )}

        {f.failingControls.length === 0 ? (
          <CleanCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              All evaluated controls pass.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              No open findings violate any {f.name} control we can evaluate
              automatically. Process-only controls still need human attestation.
            </p>
          </CleanCard>
        ) : (
          <CleanCard className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-[15px] font-semibold text-[var(--text)]">
                Failing controls
              </h2>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {f.failingControls.length}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {f.failingControls.map((c) => (
                <li key={c.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--danger)]">
                      {c.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13.5px] font-semibold text-[var(--text)]">
                        {c.title}
                      </h3>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {c.affectingIssues} open issue
                        {c.affectingIssues === 1 ? "" : "s"} · affects{" "}
                        {c.affectingRepos.length === 0
                          ? "—"
                          : c.affectingRepos.map((r, idx) => (
                              <span key={r}>
                                {idx > 0 && ", "}
                                <Link
                                  href={`/repos/${r}`}
                                  className="text-[var(--accent)] hover:brightness-110"
                                >
                                  {r}
                                </Link>
                              </span>
                            ))}
                      </div>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      weight {c.weight}
                    </span>
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
