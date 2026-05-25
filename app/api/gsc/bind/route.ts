/**
 * POST /api/gsc/bind
 *
 * Binds an EDITH repo to a Search Console verified property. One-to-one;
 * upsert by repo_id. Caller must be a member of the repo's org.
 *
 * Body: { repoId: string, siteUrl: string, permissionLevel?: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type Body = {
  repoId?: string;
  siteUrl?: string;
  permissionLevel?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.repoId || !body.siteUrl) {
    return NextResponse.json(
      { ok: false, error: "repoId and siteUrl required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();
  // Authorise: caller must be an org member of this repo's org.
  const { data: repo } = await admin
    .from("repositories")
    .select("id, org_id")
    .eq("id", body.repoId)
    .maybeSingle();
  type R = { id: string; org_id: string } | null;
  const repoRow = repo as R;
  if (!repoRow) {
    return NextResponse.json({ ok: false, error: "repo not found" }, { status: 404 });
  }
  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", repoRow.org_id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { error } = await admin
    .from("gsc_properties")
    .upsert(
      {
        org_id: repoRow.org_id,
        repo_id: body.repoId,
        site_url: body.siteUrl,
        permission_level: body.permissionLevel ?? null,
        bound_by: user.id,
        bound_at: new Date().toISOString(),
      },
      { onConflict: "repo_id" },
    );
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
