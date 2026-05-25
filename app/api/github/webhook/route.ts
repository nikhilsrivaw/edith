/**
 * POST /api/github/webhook
 *
 * Real webhook dispatcher. Verifies signature, deduplicates by delivery ID,
 * routes to per-event handlers.
 *
 * Events handled today:
 *   - installation             → store installation_id on org
 *   - installation_repositories → track repo add/remove
 *   - pull_request             → auto-scan diff, post comments + summary
 *   - push                     → full repo scan on default branch
 *   - ping                     → noop, returns 200 so GitHub shows green
 *
 * GitHub retries on 5xx, so handlers should be idempotent — we use the
 * `webhook_events` table for delivery-id dedup.
 */
import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { handleInstallation } from "@/lib/github/handlers/installation";
import { handlePullRequest } from "@/lib/github/handlers/pull-request";
import { handlePush } from "@/lib/github/handlers/push";
import { handleIssueComment } from "@/lib/github/handlers/issue-comment";

export const runtime = "nodejs";
export const maxDuration = 60;

function verifySignature(body: string, header: string | null): boolean {
  if (!header || !env.GITHUB_APP_WEBHOOK_SECRET) return false;
  const expected =
    "sha256=" +
    crypto
      .createHmac("sha256", env.GITHUB_APP_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

async function markDelivered(
  deliveryId: string,
  event: string,
  payload: unknown,
): Promise<"new" | "duplicate"> {
  if (env.USE_FIXTURES) return "new";
  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("webhook_events")
      .insert({
        id: deliveryId,
        source: "github",
        payload: { event, body: payload },
      });
    if (error && /duplicate key|already exists/i.test(error.message)) {
      return "duplicate";
    }
    return "new";
  } catch {
    return "new";
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  const eventType = req.headers.get("x-github-event") ?? "unknown";
  const deliveryId = req.headers.get("x-github-delivery") ?? `no-id-${Date.now()}`;

  if (!verifySignature(body, sig)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  // Dedup — GitHub retries on 5xx, we don't want to re-scan twice.
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }
  const state = await markDelivered(deliveryId, eventType, parsed);
  if (state === "duplicate") {
    return NextResponse.json({ ok: true, dedup: true });
  }

  // Dispatch.
  try {
    switch (eventType) {
      case "ping":
        return NextResponse.json({ ok: true, event: "ping" });
      case "installation":
      case "installation_repositories":
        await handleInstallation(parsed as Record<string, unknown>);
        break;
      case "pull_request":
        await handlePullRequest(parsed as Record<string, unknown>);
        break;
      case "push":
        await handlePush(parsed as Record<string, unknown>);
        break;
      case "issue_comment":
        await handleIssueComment(parsed as Record<string, unknown>);
        break;
      default:
        // Unknown event — log + 200 so GitHub doesn't retry.
        console.log(`[webhook/github] unhandled event: ${eventType}`);
    }
    return NextResponse.json({ ok: true, event: eventType, delivery: deliveryId });
  } catch (err) {
    console.error(`[webhook/github] handler crash on ${eventType}:`, err);
    // 200 so GitHub doesn't retry; we'll surface this internally via audit_log.
    return NextResponse.json(
      {
        ok: false,
        event: eventType,
        delivery: deliveryId,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 200 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "github webhook",
    configured: Boolean(env.GITHUB_APP_WEBHOOK_SECRET),
  });
}
