/**
 * Per-repo origin bindings.
 *
 *   GET    /api/repos/[repoName]/origins
 *   POST   /api/repos/[repoName]/origins   { origin, label? }
 *   DELETE /api/repos/[repoName]/origins?id=<binding-id>
 *
 * Scoped to the caller's org via Supabase session.
 *
 * Origins are normalised to scheme + host + port (no path / no trailing slash).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

/** Canonicalise: 'https://Foo.com/bar/' → 'https://foo.com'. */
function normaliseOrigin(input: string): string | null {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.host.toLowerCase();
    if (!host) return null;
    return `${u.protocol}//${host}`;
  } catch {
    return null;
  }
}

async function resolveRepo(userId: string, repoName: string) {
  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  type M = { org_id: string };
  if (!member) return null;
  const orgId = (member as M).org_id;

  const { data: repo } = await admin
    .from("repositories")
    .select("id, name, owner")
    .eq("org_id", orgId)
    .eq("name", repoName)
    .maybeSingle();
  type R = { id: string; name: string; owner: string };
  if (!repo) return null;
  return { repo: repo as R, orgId };
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ repoName: string }> },
) {
  const { repoName } = await ctx.params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const resolved = await resolveRepo(user.id, repoName);
  if (!resolved)
    return NextResponse.json({ ok: false, error: "repo-not-found" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("repo_origins")
    .select("id, origin, label, created_at")
    .eq("repo_id", resolved.repo.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, origins: data ?? [] });
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ repoName: string }> },
) {
  const { repoName } = await ctx.params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const resolved = await resolveRepo(user.id, repoName);
  if (!resolved)
    return NextResponse.json({ ok: false, error: "repo-not-found" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    origin?: string;
    label?: string;
  };
  const origin = body.origin ? normaliseOrigin(body.origin) : null;
  if (!origin) {
    return NextResponse.json(
      {
        ok: false,
        error: "Origin must be http(s)://host[:port]. No path.",
      },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("repo_origins")
    .upsert(
      {
        repo_id: resolved.repo.id,
        org_id: resolved.orgId,
        origin,
        label: body.label?.trim() || null,
      },
      { onConflict: "repo_id,origin" },
    )
    .select("id, origin, label, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, binding: data });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ repoName: string }> },
) {
  const { repoName } = await ctx.params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const resolved = await resolveRepo(user.id, repoName);
  if (!resolved)
    return NextResponse.json({ ok: false, error: "repo-not-found" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { ok: false, error: "id required" },
      { status: 400 },
    );

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from("repo_origins")
    .delete()
    .eq("id", id)
    .eq("repo_id", resolved.repo.id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
