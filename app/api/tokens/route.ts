/**
 * Tokens CRUD.
 *
 *   POST /api/tokens   { name }       → creates a token, returns raw value ONCE
 *   GET  /api/tokens                  → lists user's active tokens (no values)
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateToken } from "@/lib/mcp/auth";
import { dbEnsureUserAndOrg } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("api_tokens")
    .select("id, name, token_prefix, scopes, last_used_at, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({ ok: true, tokens: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name ?? "Default token").slice(0, 80);

  const { orgId } = await dbEnsureUserAndOrg({
    userId: user.id,
    email: user.email ?? "",
    displayName: (user.user_metadata?.name as string | undefined) ?? null,
    githubLogin: (user.user_metadata?.user_name as string | undefined) ?? null,
    githubId: (user.user_metadata?.provider_id as unknown as number) ?? null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  });

  const { raw, hash, prefix } = generateToken();
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("api_tokens")
    .insert({
      user_id: user.id,
      org_id: orgId,
      name,
      token_hash: hash,
      token_prefix: prefix,
      scopes: ["scan:read", "scan:trigger"],
    })
    .select("id, name, token_prefix, created_at")
    .single();
  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "token-create-failed" },
      { status: 500 },
    );
  }
  return NextResponse.json({
    ok: true,
    token: {
      ...data,
      raw, // ONLY returned this once. Frontend must warn the user.
    },
  });
}
