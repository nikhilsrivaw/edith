/**
 * GET /api/github/install
 * Redirects the signed-in user to the GitHub App install page.
 * Called from the dashboard "Install GitHub App" button.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getInstallUrl, hasGithubApp } from "@/lib/github-app";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  if (!hasGithubApp()) {
    return NextResponse.redirect(
      new URL(
        "/dashboard?error=" +
          encodeURIComponent(
            "GitHub App not yet configured. Set GITHUB_APP_* env vars and create the App at github.com/settings/apps/new.",
          ),
        req.url,
      ),
    );
  }

  // Use the user's Supabase ID as the OAuth state so the callback knows
  // which user installed the App.
  return NextResponse.redirect(getInstallUrl(user.id));
}
