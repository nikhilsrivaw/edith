/**
 * GET  /api/organization     → current user's org settings
 * PATCH /api/organization    → update slack_webhook_url, digest_email, digest_enabled
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

async function getOrg(userId: string) {
  const admin = getSupabaseAdmin();
  const { data: member } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  type M = { org_id: string };
  if (!member) return null;
  const { data: org } = await admin
    .from("organizations")
    .select(
      "id, name, slug, plan, slack_webhook_url, digest_email, digest_enabled",
    )
    .eq("id", (member as M).org_id)
    .maybeSingle();
  return org;
}

export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });
  const org = await getOrg(user.id);
  return NextResponse.json({ ok: true, org });
}

export async function PATCH(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    slack_webhook_url?: string | null;
    digest_email?: string | null;
    digest_enabled?: boolean;
  };

  const org = await getOrg(user.id);
  if (!org) return new NextResponse("no-org", { status: 404 });
  type ORow = { id: string };

  const updates: Record<string, unknown> = {};
  if ("slack_webhook_url" in body) {
    const v = body.slack_webhook_url?.trim();
    if (v && !/^https:\/\/hooks\.slack\.com\//.test(v)) {
      return NextResponse.json(
        {
          ok: false,
          error: "slack_webhook_url must start with https://hooks.slack.com/",
        },
        { status: 400 },
      );
    }
    updates.slack_webhook_url = v || null;
  }
  if ("digest_email" in body) {
    updates.digest_email = body.digest_email?.trim() || null;
  }
  if ("digest_enabled" in body) {
    updates.digest_enabled = !!body.digest_enabled;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, org });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("organizations")
    .update(updates)
    .eq("id", (org as ORow).id)
    .select(
      "id, name, slack_webhook_url, digest_email, digest_enabled",
    )
    .single();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, org: data });
}
