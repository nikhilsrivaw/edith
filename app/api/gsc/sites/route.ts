/**
 * GET /api/gsc/sites
 *
 * Lists the verified Search Console properties on the connected Google
 * account. Used by the bind-repo UI to populate a dropdown.
 *
 * Returns { connected: false } if the user hasn't completed OAuth.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listSites } from "@/lib/gsc/client";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data: tok } = await admin
    .from("google_oauth_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();
  type T = { refresh_token: string } | null;
  const refresh = (tok as T)?.refresh_token;
  if (!refresh) {
    return NextResponse.json({ ok: true, connected: false, sites: [] });
  }

  const sites = await listSites(refresh);
  // Touch last_used_at so we can prune dead grants later.
  admin
    .from("google_oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .then(
      () => undefined,
      () => undefined,
    );

  return NextResponse.json({ ok: true, connected: true, sites });
}
