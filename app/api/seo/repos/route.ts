/**
 * /api/seo/repos
 *
 * Manages the subset of an org's repositories that are "SEO-tracked".
 * A repo is SEO-tracked when its `repositories.live_url` column is set.
 * All SEO surface (live probe, multi-page crawl, GSC binding, AI
 * citations, auto-fix PRs) only operates on this subset.
 *
 *   GET  → list current tracked sites + their GSC binding (if any)
 *   POST → add or update a repo's live_url
 *          body: { repoId: string, liveUrl: string }
 *   DELETE → stop tracking — clears live_url
 *          body: { repoId: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";

export const runtime = "nodejs";

function normalizeLiveUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Strip trailing slash from root pathnames.
    if (u.pathname === "/") u.pathname = "";
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function authorizeRepo(
  userId: string,
  repoId: string,
): Promise<{ orgId: string; name: string; owner: string } | null> {
  const admin = getSupabaseAdmin();
  const { data: repo } = await admin
    .from("repositories")
    .select("id, name, owner, org_id")
    .eq("id", repoId)
    .maybeSingle();
  type R = { id: string; name: string; owner: string; org_id: string } | null;
  const row = repo as R;
  if (!row) return null;
  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("user_id", userId)
    .eq("org_id", row.org_id)
    .maybeSingle();
  if (!member) return null;
  return { orgId: row.org_id, name: row.name, owner: row.owner };
}

/* ============== GET: list tracked sites ============== */
export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return NextResponse.json({ ok: true, repos: [] });
  }

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("repositories")
    .select("id, name, owner, default_branch, live_url")
    .eq("org_id", orgId)
    .not("live_url", "is", null)
    .order("name", { ascending: true });
  type R = {
    id: string;
    name: string;
    owner: string;
    default_branch: string | null;
    live_url: string;
  };
  const tracked = (data as R[] | null) ?? [];

  // Enrich with GSC binding presence.
  const { data: gscRows } = await admin
    .from("gsc_properties")
    .select("repo_id, site_url")
    .in("repo_id", tracked.map((r) => r.id));
  type G = { repo_id: string; site_url: string };
  const gscByRepo = new Map(
    ((gscRows as G[] | null) ?? []).map((g) => [g.repo_id, g.site_url]),
  );

  return NextResponse.json({
    ok: true,
    repos: tracked.map((r) => ({
      id: r.id,
      name: r.name,
      owner: r.owner,
      defaultBranch: r.default_branch,
      liveUrl: r.live_url,
      gscSiteUrl: gscByRepo.get(r.id) ?? null,
    })),
  });
}

/* ============== POST: add / update tracking ============== */
type PostBody = {
  repoId?: string;
  liveUrl?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as PostBody;
  if (!body.repoId || !body.liveUrl) {
    return NextResponse.json(
      { ok: false, error: "repoId and liveUrl required" },
      { status: 400 },
    );
  }
  const normalized = normalizeLiveUrl(body.liveUrl);
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: "liveUrl must be a valid http(s) URL" },
      { status: 400 },
    );
  }
  const repo = await authorizeRepo(user.id, body.repoId);
  if (!repo) {
    return NextResponse.json(
      { ok: false, error: "forbidden or repo not found" },
      { status: 403 },
    );
  }
  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("repositories")
    .update({ live_url: normalized })
    .eq("id", body.repoId);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, repoId: body.repoId, liveUrl: normalized });
}

/* ============== DELETE: stop tracking ============== */
type DeleteBody = { repoId?: string };

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as DeleteBody;
  if (!body.repoId) {
    return NextResponse.json(
      { ok: false, error: "repoId required" },
      { status: 400 },
    );
  }
  const repo = await authorizeRepo(user.id, body.repoId);
  if (!repo) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }
  const admin = getSupabaseAdmin();
  await admin
    .from("repositories")
    .update({ live_url: null })
    .eq("id", body.repoId);
  return NextResponse.json({ ok: true });
}
