/**
 * GET /api/github/install/callback?installation_id=...&setup_action=...&state=...
 *
 * GitHub redirects here after the user authorises the App. We persist the
 * installation_id on the org and bounce back to the dashboard.
 *
 * Note: the canonical way installations land in our DB is the `installation`
 * webhook (see lib/github/handlers/installation.ts). This callback is for
 * UX continuity — the webhook may arrive before or after this redirect.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { dbEnsureUserAndOrg } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user, session },
  } = await supabase.auth.getSession().then((r) => ({
    data: { user: r.data.session?.user ?? null, session: r.data.session },
  }));
  if (!user) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  const installationIdRaw = req.nextUrl.searchParams.get("installation_id");
  const installationId = installationIdRaw
    ? parseInt(installationIdRaw, 10)
    : NaN;
  if (!installationId || Number.isNaN(installationId)) {
    return NextResponse.redirect(
      new URL("/dashboard?error=missing_installation_id", req.url),
    );
  }

  // Ensure the user has an org row, then attach the installation_id to it.
  const { orgId } = await dbEnsureUserAndOrg({
    userId: user.id,
    email: user.email ?? "",
    displayName:
      (user.user_metadata?.name as string | undefined) ?? null,
    githubLogin:
      (user.user_metadata?.user_name as string | undefined) ?? null,
    githubId:
      (user.user_metadata?.provider_id as unknown as number) ?? null,
    avatarUrl:
      (user.user_metadata?.avatar_url as string | undefined) ?? null,
  });

  const admin = getSupabaseAdmin();
  await admin
    .from("organizations")
    .update({ github_installation_id: installationId })
    .eq("id", orgId);

  // Note: session arg used only to silence unused warning if any
  void session;

  return NextResponse.redirect(
    new URL("/dashboard?installed=1", req.url),
  );
}
