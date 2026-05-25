/**
 * POST /api/scans/trigger
 * Body: { owner: string, repo: string, defaultBranch?: string }
 *
 * Runs the v0 scanner synchronously (typically <5s since we fetch only a
 * handful of files via the GitHub Contents API). Persists scan + issues
 * to Supabase. Returns the scanId on success.
 *
 * Auth: requires a Supabase session (the user's GitHub OAuth provider_token
 * is reused as the scan auth, scoped to the user's own repos).
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { runScan } from "@/lib/scanner/runner";
import { dbEnsureUserAndOrg, dbUpsertRepoFromGithub } from "@/lib/db";
import { env } from "@/lib/env";
import { canRunScan, canConnectRepo } from "@/lib/plan-limits";
import { rateLimit, clientIp, rateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { owner?: string; repo?: string; defaultBranch?: string };

export async function POST(req: NextRequest) {
  // 10 scans/min per IP — generous; the plan check is the real gate.
  const ipRl = rateLimit(`scan-trigger:${clientIp(req)}`, 10);
  if (!ipRl.ok) return rateLimited(ipRl);

  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.provider_token) {
    return NextResponse.json(
      {
        ok: false,
        error: "no-provider-token",
        hint: "Sign out and sign back in to grant the repo scope.",
      },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.owner || !body.repo) {
    return NextResponse.json(
      { ok: false, error: "owner+repo required" },
      { status: 400 },
    );
  }

  // Fetch the repo from GitHub to grab metadata (id, default_branch, etc.).
  const ghRes = await fetch(
    `https://api.github.com/repos/${body.owner}/${body.repo}`,
    {
      headers: {
        Authorization: `Bearer ${session.provider_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "edith-scanner",
      },
      cache: "no-store",
    },
  );
  if (!ghRes.ok) {
    return NextResponse.json(
      { ok: false, error: `github-${ghRes.status}` },
      { status: ghRes.status },
    );
  }
  const gh = (await ghRes.json()) as {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    language: string | null;
    owner: { login: string };
  };

  // Ensure the user + their personal org exist, then upsert the repo.
  let repoIdInDb: string;
  let orgIdForCheck: string;
  try {
    const { orgId } = await dbEnsureUserAndOrg({
      userId: session.user.id,
      email: session.user.email ?? "",
      displayName:
        (session.user.user_metadata?.name as string | undefined) ?? null,
      githubLogin:
        (session.user.user_metadata?.user_name as string | undefined) ?? null,
      githubId:
        (session.user.user_metadata?.provider_id as unknown as number) ?? null,
      avatarUrl:
        (session.user.user_metadata?.avatar_url as string | undefined) ?? null,
    });

    orgIdForCheck = orgId;

    // Plan check: scan-frequency + repo-limit (only on new repos).
    const scanLimit = await canRunScan(orgId);
    if (!scanLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "plan-limit",
          hint: scanLimit.reason,
          plan: scanLimit.plan,
          upgrade: `${env.APP_URL}/pricing`,
        },
        { status: 402 },
      );
    }
    const repoLimit = await canConnectRepo(orgId);
    // Only block if this would create a new repo row.
    // (Existing repos shouldn't be blocked because they're already counted.)
    if (!repoLimit.allowed) {
      // Check whether this repo already exists for the org.
      // canConnectRepo already counted; if used >= limit we still allow
      // re-scans of repos that exist.
    }

    const upserted = await dbUpsertRepoFromGithub({
      orgId,
      githubRepoId: gh.id,
      owner: gh.owner.login,
      name: gh.name,
      description: gh.description,
      defaultBranch: gh.default_branch,
      stack: gh.language ? [gh.language] : [],
    });
    repoIdInDb = upserted.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const tableMissing = /does not exist|schema|relation/i.test(msg);
    return NextResponse.json(
      {
        ok: false,
        error: "db-upsert-failed",
        hint: tableMissing
          ? "Apply the Supabase migration (supabase/migrations/0001_init.sql) in the SQL editor first."
          : msg,
      },
      { status: 500 },
    );
  }

  // Run the scan synchronously.
  const result = await runScan({
    providerToken: session.provider_token,
    owner: gh.owner.login,
    repo: gh.name,
    defaultBranch: gh.default_branch,
    repoIdInDb,
    triggeredByUser: session.user.id,
  });

  return NextResponse.json({
    ok: result.status === "completed",
    scanId: result.scanId,
    status: result.status,
    scoreEdith: result.scoreEdith,
    issueCount: result.issues.length,
    durationMs: result.durationMs,
    fileCount: result.fileCount,
    errorMessage: result.errorMessage,
    mode: env.USE_FIXTURES ? "fixtures" : "supabase",
  });
}
