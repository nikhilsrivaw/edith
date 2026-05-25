/**
 * POST /api/gsc/sync
 *
 * Pulls the last 28 days of Search Analytics data for every gsc_property
 * the caller's org owns, and upserts into gsc_metrics. Idempotent —
 * re-running on the same day refreshes data without dupes (unique
 * constraint on the tuple).
 *
 * Body: { repoId?: string }  — if present, sync just that repo
 *
 * Designed to be invokable from a button in /seo and from a daily cron.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { searchAnalytics } from "@/lib/gsc/client";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { repoId?: string };

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const admin = getSupabaseAdmin();

  // Refresh token
  const { data: tok } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();
  type T = { refresh_token: string } | null;
  const refresh = (tok as T)?.refresh_token;
  if (!refresh) {
    return NextResponse.json(
      { ok: false, error: "Google not connected — go to /seo and click Connect" },
      { status: 400 },
    );
  }

  // Which properties to sync?
  let query = admin.from("gsc_properties").select("repo_id, site_url, org_id");
  if (body.repoId) query = query.eq("repo_id", body.repoId);
  // Restrict to caller's orgs.
  const { data: memberRows } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);
  const orgIds = (memberRows as Array<{ org_id: string }> | null)?.map(
    (m) => m.org_id,
  ) ?? [];
  if (orgIds.length === 0) {
    return NextResponse.json({ ok: true, syncedRepos: 0, rows: 0 });
  }
  query = query.in("org_id", orgIds);

  const { data: properties } = await query;
  type P = { repo_id: string; site_url: string; org_id: string };
  const props = (properties as P[]) ?? [];

  const startDate = daysAgo(30);
  const endDate = daysAgo(2);

  let syncedRepos = 0;
  let totalRows = 0;

  for (const p of props) {
    // Pull page+query+date+device — single call (5000-row cap).
    const rows = await searchAnalytics(refresh, p.site_url, {
      startDate,
      endDate,
      dimensions: ["date", "page", "query", "device"],
      rowLimit: 5000,
    });

    if (rows.length === 0) continue;

    const upserts = rows.map((r) => ({
      repo_id: p.repo_id,
      date: r.keys[0]!,
      page: r.keys[1]!,
      query: r.keys[2] ?? null,
      device: r.keys[3] ?? null,
      country: null,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr: r.ctr,
      position: r.position,
      pulled_at: new Date().toISOString(),
    }));

    // Supabase has a 1k-row limit per insert in the JS client.
    for (let i = 0; i < upserts.length; i += 500) {
      const slice = upserts.slice(i, i + 500);
      const { error } = await admin
        .from("gsc_metrics")
        .upsert(slice, {
          onConflict: "repo_id,date,page,query,device,country",
          ignoreDuplicates: false,
        });
      if (error) {
        console.warn("[gsc-sync] upsert failed:", error.message);
        break;
      }
      totalRows += slice.length;
    }
    syncedRepos++;
  }

  return NextResponse.json({
    ok: true,
    syncedRepos,
    rows: totalRows,
    window: { startDate, endDate },
  });
}
