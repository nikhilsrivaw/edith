import { redirect } from "next/navigation";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type AuditRow = {
  id: string;
  org_id: string | null;
  user_id: string | null;
  action: string;
  resource_kind: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export default async function AuditLogPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const orgId = await userOrgId(user.id);
  if (!orgId) redirect("/dashboard");

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("audit_log")
    .select("id, org_id, user_id, action, resource_kind, resource_id, metadata, ip_address, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data as AuditRow[]) ?? [];

  return (
    <>
      <Topbar
        title="Audit log"
        subtitle="Who did what, when. Required by SOC 2."
      />
      <main className="flex-1 px-6 py-6">
        {rows.length === 0 ? (
          <CleanCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              No audit events yet.
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-dim)]">
              Sensitive actions (repo connect/disconnect, token create/revoke,
              billing changes, team invites) land here automatically. New
              installs start with zero history.
            </p>
          </CleanCard>
        ) : (
          <CleanCard className="p-0">
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[12px] text-[var(--text)]">
                      {r.action}
                    </div>
                    {(r.resource_kind || r.resource_id) && (
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                        {r.resource_kind ?? ""} {r.resource_id ?? ""}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                      {timeAgo(r.created_at)}
                    </div>
                    {r.ip_address && (
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                        {r.ip_address}
                      </div>
                    )}
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
