import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });
  const orgId = await userOrgId(user.id);
  if (!orgId) return NextResponse.json({ ok: false, error: "no-org" }, { status: 404 });

  const admin = getSupabaseAdmin();
  const [{ data: members }, { data: invites }] = await Promise.all([
    admin
      .from("org_members")
      .select(
        "user_id, role, joined_at, users(email, github_login, avatar_url)",
      )
      .eq("org_id", orgId),
    admin
      .from("org_invites")
      .select("id, email, role, expires_at, created_at, accepted_at")
      .eq("org_id", orgId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  type MemRow = {
    user_id: string;
    role: string;
    joined_at: string;
    users: { email: string | null; github_login: string | null; avatar_url: string | null } | null;
  };
  const membersOut = ((members as MemRow[]) ?? []).map((m) => ({
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    user: m.users ?? { email: null, github_login: null, avatar_url: null },
  }));

  return NextResponse.json({
    ok: true,
    members: membersOut,
    invites: invites ?? [],
  });
}
