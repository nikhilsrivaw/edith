/**
 * GET /api/oauth/google/callback
 *
 * Google redirects here with ?code=… &state=…. We:
 *   1. Verify the state cookie matches.
 *   2. Exchange the code for tokens.
 *   3. Persist the refresh_token in google_oauth_tokens.
 *   4. Redirect back to the original /seo (or whatever ?return= was).
 *
 * If the user denies, Google redirects with ?error=access_denied — we land
 * them on /seo with an ?oauth=denied so the UI can show a friendly note.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "edith_gsc_state";
const RETURN_COOKIE = "edith_gsc_return";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  const returnTo = req.cookies.get(RETURN_COOKIE)?.value || "/seo";

  // Clear short-lived cookies on the way out, always.
  function finish(target: string): NextResponse {
    const res = NextResponse.redirect(new URL(target, env.APP_URL));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(RETURN_COOKIE);
    return res;
  }

  if (error) return finish(`${returnTo}?oauth=denied`);
  if (!code || !state || !cookieState || state !== cookieState) {
    return finish(`${returnTo}?oauth=invalid`);
  }

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return finish("/signin?next=/seo");

  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET
  ) {
    return finish(`${returnTo}?oauth=misconfigured`);
  }

  // Exchange code for tokens.
  const body = new URLSearchParams({
    code,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!tokenRes.ok) {
    return finish(`${returnTo}?oauth=exchange_failed`);
  }
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    scope: string;
    expires_in: number;
  };

  // First-time grant returns refresh_token. If we already have one for this
  // user (re-auth without revoke), Google may omit it — keep the existing
  // refresh_token in that case.
  const admin = getSupabaseAdmin();
  const refresh = tokens.refresh_token;
  if (refresh) {
    await admin
      .from("google_oauth_tokens")
      .upsert(
        {
          user_id: user.id,
          refresh_token: refresh,
          scope: tokens.scope,
          granted_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      .then(
        () => undefined,
        () => undefined,
      );
  } else {
    // Re-grant without new refresh token — just touch the timestamp.
    await admin
      .from("google_oauth_tokens")
      .update({ granted_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .then(
        () => undefined,
        () => undefined,
      );
  }

  return finish(`${returnTo}?oauth=connected`);
}
