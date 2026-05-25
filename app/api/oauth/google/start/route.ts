/**
 * GET /api/oauth/google/start
 *
 * Kicks off the Google OAuth 2.0 flow with the webmasters.readonly scope
 * (Search Console read access). User must already be signed in via Supabase
 * — we attach a signed state cookie tying the OAuth callback to this user.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { env } from "@/lib/env";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const STATE_COOKIE = "edith_gsc_state";
const RETURN_COOKIE = "edith_gsc_return";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/signin?next=/seo", req.url));
  }

  if (!env.GOOGLE_OAUTH_CLIENT_ID) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GOOGLE_OAUTH_CLIENT_ID not configured — see docs/integrations/search-console.md",
      },
      { status: 500 },
    );
  }

  const state = randomBytes(24).toString("hex");
  const ret = req.nextUrl.searchParams.get("return") || "/seo";

  const params = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",       // returns refresh_token
    prompt: "consent",            // forces consent so we get refresh_token even on re-auth
    include_granted_scopes: "true",
    state,
  });

  const res = NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 min — generous for the OAuth round-trip
  });
  res.cookies.set(RETURN_COOKIE, ret, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
