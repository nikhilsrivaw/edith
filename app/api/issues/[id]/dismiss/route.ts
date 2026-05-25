/**
 * POST /api/issues/[id]/dismiss
 * Body: { scope?: 'user' | 'repo' | 'org', reason?: string }
 *
 * Marks one dismissal of the issue's check_id. After 5 dismissals of the
 * same check_id by the same user, that check is silenced for them.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { dismissIssue } from "@/lib/learning";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: issueId } = await ctx.params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    scope?: "user" | "repo" | "org";
    reason?: string;
  };

  // Look up the issue to get check_id + repo_id + verify org membership.
  const admin = getSupabaseAdmin();
  const { data: issue } = await admin
    .from("issues")
    .select("id, check_id, repo_id")
    .eq("id", issueId)
    .maybeSingle();
  if (!issue)
    return NextResponse.json(
      { ok: false, error: "issue-not-found" },
      { status: 404 },
    );
  type IRow = { id: string; check_id: string; repo_id: string };
  const i = issue as IRow;

  const { data: repo } = await admin
    .from("repositories")
    .select("org_id")
    .eq("id", i.repo_id)
    .maybeSingle();
  if (!repo) return new NextResponse("not-found", { status: 404 });
  type RR = { org_id: string };

  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", (repo as RR).org_id)
    .maybeSingle();
  if (!member) return new NextResponse("forbidden", { status: 403 });

  await dismissIssue({
    userId: user.id,
    orgId: (repo as RR).org_id,
    checkId: i.check_id,
    scope: body.scope,
    repoId: i.repo_id,
    reason: body.reason,
  });

  return NextResponse.json({ ok: true });
}
