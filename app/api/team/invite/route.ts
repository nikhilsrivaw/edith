import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });
  const orgId = await userOrgId(user.id);
  if (!orgId)
    return NextResponse.json({ ok: false, error: "no-org" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "valid email required" },
      { status: 400 },
    );
  }
  const role =
    body.role === "admin" || body.role === "owner" ? body.role : "member";

  const token = crypto.randomBytes(24).toString("base64url");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("org_invites")
    .upsert(
      {
        org_id: orgId,
        email,
        role,
        invited_by: user.id,
        token,
      },
      { onConflict: "org_id,email" },
    )
    .select("id, email, role, expires_at, created_at, accepted_at")
    .single();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const inviteUrl = `${env.APP_URL}/invite/${token}`;
  return NextResponse.json({ ok: true, invite: data, inviteUrl });
}

export async function DELETE(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });
  const orgId = await userOrgId(user.id);
  if (!orgId)
    return NextResponse.json({ ok: false, error: "no-org" }, { status: 404 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  const admin = getSupabaseAdmin();
  await admin
    .from("org_invites")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);
  return NextResponse.json({ ok: true });
}
