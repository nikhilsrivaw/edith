/**
 * GET /api/health
 *
 * Lightweight liveness + dependency check. Used by uptime monitors,
 * Vercel deploy-protection probes, and the EDITH-on-EDITH scan to
 * confirm prod is up. Never reads or writes user data.
 *
 * Returns 200 with { ok: true, ... } when the service can reach its
 * core dependencies; 503 if Supabase URL/key is missing entirely.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  const ok =
    env.SUPABASE_URL.length > 0 &&
    env.SUPABASE_ANON_KEY.length > 0;

  return NextResponse.json(
    {
      ok,
      service: "edith",
      env: process.env.NODE_ENV,
      uptimeMs: Date.now() - startedAt,
      time: new Date().toISOString(),
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export function HEAD() {
  return new NextResponse(null, { status: 200 });
}
