/**
 * GET /api/cron/weekly-digest
 *
 * Monday 03:30 UTC (≈09:00 IST). Builds + delivers the weekly digest for
 * every org with digest_enabled=true. Persists each delivery to digest_runs.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { buildOrgDigest, renderSlackBlocks, deliverToSlack } from "@/lib/digest";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.NODE_ENV === "production") {
    if (!env.SESSION_SECRET || auth !== `Bearer ${env.SESSION_SECRET}`) {
      return new NextResponse("unauthorised", { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, slack_webhook_url, digest_email")
    .eq("digest_enabled", true);
  type O = {
    id: string;
    slack_webhook_url: string | null;
    digest_email: string | null;
  };
  const list = (orgs as O[]) ?? [];

  const results: Array<{
    orgId: string;
    deliveredTo: string[];
    failed?: string;
  }> = [];

  for (const org of list) {
    const digest = await buildOrgDigest(org.id);
    if (!digest) {
      results.push({ orgId: org.id, deliveredTo: [], failed: "no-org" });
      continue;
    }
    const delivered: string[] = [];
    if (org.slack_webhook_url) {
      const payload = renderSlackBlocks(digest);
      const ok = await deliverToSlack(org.slack_webhook_url, payload);
      if (ok) delivered.push("slack");
    }
    // Email delivery would go here (Resend / Postmark). Stubbed.
    await admin.from("digest_runs").insert({
      org_id: org.id,
      kind: "weekly",
      delivered_to: delivered,
      payload: digest as unknown as Record<string, unknown>,
    });
    results.push({ orgId: org.id, deliveredTo: delivered });
  }
  return NextResponse.json({ ok: true, results });
}
