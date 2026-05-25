/**
 * Supabase OAuth callback.
 *
 * After GitHub OAuth, Supabase redirects here with a ?code= param.
 * We exchange it for a session cookie and bounce the user to /dashboard
 * (or /onboarding if it's a brand-new account).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(new URL("/signin?error=missing_code", req.url));
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/signin?error=${encodeURIComponent(error.message)}`, req.url),
    );
  }

  return NextResponse.redirect(new URL(next, req.url));
}
