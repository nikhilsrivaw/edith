/**
 * POST /api/extension/sync
 *
 * Receives findings from the browser extension, persists a lightweight scan
 * record, and returns connection metadata the extension uses to confirm
 * it's wired up + render the "View in dashboard" panel.
 *
 * Auth: Bearer <edith_...> from /integrations/mcp (same token system).
 *
 * Body:
 *   {
 *     origin: string,
 *     url: string,
 *     title?: string,
 *     tools?: string[],
 *     findings: Array<{ checkId, severity, title, description, ... }>,
 *     score?: number,
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     user:  { email, github, avatarUrl },
 *     org:   { name },
 *     repos: { total: number, names: string[] },
 *     match: { repoName: string, latestScore: number | null } | null,
 *     dashboardUrl: string,    // deep link to extension-scans for this origin
 *     repoUrl?:  string,        // deep link to the matched repo
 *   }
 */
import { NextResponse, type NextRequest } from "next/server";
import { authenticateBearer } from "@/lib/mcp/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOW = [
  "POST, OPTIONS",
  "Content-Type, Authorization",
];

function withCors(res: NextResponse): NextResponse {
  // The extension calls us cross-origin (chrome-extension://… → edith.expert).
  // Browsers send a preflight; we have to respond permissively for the
  // extension origin pattern.
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
  origin?: string;
  url?: string;
  title?: string;
  tools?: string[];
  findings?: Array<{
    checkId: string;
    severity: "critical" | "high" | "medium" | "low";
    title: string;
    description?: string;
  }>;
  score?: number;
};

export async function POST(req: NextRequest) {
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth) {
    return withCors(
      NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 }),
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.origin || !body.url) {
    return withCors(
      NextResponse.json(
        { ok: false, error: "origin and url required" },
        { status: 400 },
      ),
    );
  }

  const findings = body.findings ?? [];
  const counts = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
  };

  const admin = getSupabaseAdmin();

  // Persist into `extension_scans` if the table exists; otherwise no-op.
  // The table is optional — see supabase/migrations/0003_extension_scans.sql.
  await admin
    .from("extension_scans")
    .insert({
      user_id: auth.userId,
      org_id: auth.orgId,
      origin: body.origin,
      url: body.url,
      title: body.title ?? null,
      tools: body.tools ?? [],
      findings: findings,
      finding_count: findings.length,
      critical_count: counts.critical,
      high_count: counts.high,
      score: body.score ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  // Look up the user for the confirmation panel.
  const { data: user } = await admin
    .from("users")
    .select("email, display_name, github_login, avatar_url")
    .eq("id", auth.userId)
    .maybeSingle();
  type URow = {
    email: string | null;
    display_name: string | null;
    github_login: string | null;
    avatar_url: string | null;
  };
  const u = user as URow | null;

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", auth.orgId)
    .maybeSingle();

  // Pull the user's connected repos (lightweight — names only).
  const { data: repos } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", auth.orgId)
    .order("updated_at", { ascending: false });
  type RRow = { id: string; name: string };
  const repoRows = (repos as RRow[]) ?? [];

  // Matching: prefer an explicit origin binding in repo_origins; only fall
  // back to a substring guess against the host if no binding exists.
  let match: {
    repoName: string;
    latestScore: number | null;
    matchedBy: "binding" | "guess";
    bindingLabel?: string | null;
  } | null = null;
  let repoUrl: string | undefined;

  let canonicalOrigin = "";
  try {
    const u = new URL(body.url);
    canonicalOrigin = `${u.protocol}//${u.host.toLowerCase()}`;
  } catch {
    /* invalid url */
  }

  if (canonicalOrigin) {
    // 1. Strong match: an explicit binding from /api/repos/[name]/origins.
    const { data: binding } = await admin
      .from("repo_origins")
      .select("repo_id, label")
      .eq("org_id", auth.orgId)
      .eq("origin", canonicalOrigin)
      .maybeSingle();
    type BRow = { repo_id: string; label: string | null };
    const b = binding as BRow | null;
    if (b) {
      const repoRow = repoRows.find((r) => r.id === b.repo_id);
      if (repoRow) {
        const { data: latestScan } = await admin
          .from("scans")
          .select("score_edith")
          .eq("repo_id", repoRow.id)
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        type S = { score_edith: number | null };
        const s = latestScan as S | null;
        match = {
          repoName: repoRow.name,
          latestScore: s?.score_edith ?? null,
          matchedBy: "binding",
          bindingLabel: b.label,
        };
        repoUrl = `${env.APP_URL}/repos/${repoRow.name}`;
      }
    }
  }

  // 2. Fallback: substring guess against host. Marked as 'guess' so the UI
  // can prompt the user to bind it explicitly.
  if (!match && canonicalOrigin) {
    try {
      const host = new URL(body.url).host.toLowerCase();
      const guessed = repoRows.find((r) =>
        host.includes(r.name.toLowerCase()),
      );
      if (guessed) {
        const { data: latestScan } = await admin
          .from("scans")
          .select("score_edith")
          .eq("repo_id", guessed.id)
          .eq("status", "completed")
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        type S = { score_edith: number | null };
        const s = latestScan as S | null;
        match = {
          repoName: guessed.name,
          latestScore: s?.score_edith ?? null,
          matchedBy: "guess",
        };
        repoUrl = `${env.APP_URL}/repos/${guessed.name}`;
      }
    } catch {
      /* */
    }
  }

  return withCors(
    NextResponse.json({
      ok: true,
      user: {
        email: u?.email ?? null,
        name: u?.display_name ?? null,
        github: u?.github_login ?? null,
        avatarUrl: u?.avatar_url ?? null,
      },
      org: { name: (org as { name: string } | null)?.name ?? null },
      repos: {
        total: repoRows.length,
        names: repoRows.slice(0, 8).map((r) => r.name),
      },
      match,
      dashboardUrl: `${env.APP_URL}/dashboard`,
      repoUrl,
    }),
  );
}
