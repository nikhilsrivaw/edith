/**
 * POST /api/probe/ai-bot
 *
 * Beacon endpoint for the middleware snippet. Records when a known AI
 * crawler User-Agent hits the user's deployed app — first known fact
 * about whether GPTBot / ClaudeBot / PerplexityBot are actually reading
 * the content. Unauthenticated because it's fired from the user's own
 * server-side middleware (which has no EDITH credentials by default).
 *
 * If the user wants secure-multi-tenant logging, they can add a header
 * like `X-Edith-Org: <org_id>` in their middleware and we'll honour it.
 *
 * Body: { ua: string, path: string, ts: number, host?: string }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const ALLOW = ["POST, OPTIONS", "Content-Type, X-Edith-Org"];
function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", ALLOW[0]);
  res.headers.set("Access-Control-Allow-Headers", ALLOW[1]);
  return res;
}
export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

type Body = {
  ua?: string;
  path?: string;
  ts?: number;
  host?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.ua) {
    return withCors(
      NextResponse.json({ ok: false, error: "ua required" }, { status: 400 }),
    );
  }
  const orgId = req.headers.get("x-edith-org");
  const host = body.host ?? req.headers.get("origin") ?? null;

  // Best-effort insert; table may not exist yet.
  const admin = getSupabaseAdmin();
  await admin
    .from("ai_bot_hits")
    .insert({
      org_id: orgId,
      ua: body.ua.slice(0, 500),
      path: (body.path ?? "/").slice(0, 500),
      host,
      ts: body.ts ? new Date(body.ts).toISOString() : new Date().toISOString(),
    })
    .then(
      () => undefined,
      () => undefined,
    );
  return withCors(NextResponse.json({ ok: true }));
}
