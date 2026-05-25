/**
 * POST /api/probe/seo
 *
 * Receives a runtime SEO probe payload from the browser extension. Stores
 * Core Web Vitals + DOM snapshot + console errors in `seo_runtime_signals`
 * so the aggregator can correlate live measurements with repo source.
 *
 * Auth: Bearer <edith_...> (same token system as /api/extension/sync).
 *
 * Body (from extension/content/seo-probe.js):
 *   {
 *     url: string,
 *     origin: string,
 *     capturedAt: number,
 *     cwv: { lcp, cls, inp, lcpElement },
 *     dom: { title, description, canonical, lang, ... },
 *     consoleErrors: Array<{ msg, source?, line?, t }>
 *   }
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearer } from "@/lib/mcp/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 15;

const ALLOW = ["POST, OPTIONS", "Content-Type, Authorization"];

function withCors(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", ALLOW[0]);
  res.headers.set("Access-Control-Allow-Headers", ALLOW[1]);
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

type Body = {
  url?: string;
  origin?: string;
  capturedAt?: number;
  cwv?: {
    lcp?: number | null;
    cls?: number;
    inp?: number | null;
    lcpElement?: string | null;
  };
  clsSources?: Array<{
    selector: string;
    tag: string;
    shift: number;
    count: number;
  }>;
  longTasks?: {
    count: number;
    totalBlockingMs: number;
    worst: Array<{
      startTime: number;
      duration: number;
      containerType: string | null;
      containerName: string | null;
      containerSrc: string | null;
    }>;
    offenders: Array<{ src: string; duration: number; count: number }>;
  } | null;
  resources?: {
    totalResources: number;
    totalTransferBytes: number;
    totalThirdPartyBytes: number;
    thirdParty: Array<{
      host: string;
      count: number;
      bytes: number;
      avgMs: number;
    }>;
    top10ByBytes: Array<{
      url: string;
      host: string;
      initiatorType: string;
      transferSize: number;
      duration: number;
    }>;
    renderBlocking: Array<{
      url: string;
      initiatorType: string;
      duration: number;
      transfer: number;
      startTime: number;
    }>;
    failed: Array<{ url: string; duration: number; initiatorType: string }>;
  } | null;
  dom?: Record<string, unknown>;
  consoleErrors?: Array<{ msg: string; source?: string; line?: number; t?: number }>;
};

export async function POST(req: NextRequest) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth) {
    return withCors(
      NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 }),
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.url) {
    return withCors(
      NextResponse.json({ ok: false, error: "url required" }, { status: 400 }),
    );
  }

  const admin = getSupabaseAdmin();
  await admin
    .from("seo_runtime_signals")
    .insert({
      user_id: auth.userId,
      org_id: auth.orgId,
      url: body.url,
      origin: body.origin ?? null,
      lcp_ms: body.cwv?.lcp ?? null,
      cls: body.cwv?.cls ?? null,
      inp_ms: body.cwv?.inp ?? null,
      lcp_element: body.cwv?.lcpElement ?? null,
      cls_sources: body.clsSources ?? [],
      long_tasks: body.longTasks ?? null,
      resources: body.resources ?? null,
      dom_snapshot: body.dom ?? {},
      console_errors: body.consoleErrors ?? [],
      captured_at: body.capturedAt
        ? new Date(body.capturedAt).toISOString()
        : new Date().toISOString(),
    })
    .then(
      () => undefined,
      // Table may not exist yet (migration pending) — fail soft so the
      // extension keeps working; aggregator will be empty until migrated.
      () => undefined,
    );

  return withCors(NextResponse.json({ ok: true }));
}
