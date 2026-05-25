/**
 * POST /api/probes/run
 * Body: { repoId?: string, baseUrl: string }
 *
 * Runs the live runtime-probe pack against the user's deployed app.
 * The repo's discovered endpoints are pulled from the latest scan
 * (we re-discover them here via a small repo fetch).
 *
 * Returns: { ok, probeRun, durationMs }
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchScannableFiles } from "@/lib/scanner/github-tree";
import { createRepoProject } from "@/lib/scanner/project";
import { discoverEndpoints } from "@/lib/probe/discover";
import { runProbes } from "@/lib/probe/probes";
import { probeFetch } from "@/lib/probe/fetcher";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = { owner?: string; repo?: string; baseUrl?: string };

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { session, user },
  } = await supabase.auth.getSession().then((r) => ({
    data: { session: r.data.session, user: r.data.session?.user ?? null },
  }));
  if (!session?.provider_token || !user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  // Runtime probes are a paid feature (Pro+).
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
  const probesAllowed = await requiresPlan(orgId, "runtimeProbes");
  if (!probesAllowed.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "plan-limit",
        hint: probesAllowed.reason,
        plan: probesAllowed.plan,
        upgrade: `${env.APP_URL}/pricing`,
      },
      { status: 402 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.owner || !body.repo || !body.baseUrl) {
    return NextResponse.json(
      { ok: false, error: "owner, repo, baseUrl required" },
      { status: 400 },
    );
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(body.baseUrl);
    if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
      throw new Error("invalid protocol");
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: "baseUrl must be http(s)://…" },
      { status: 400 },
    );
  }

  // Get HEAD sha so we discover routes against the same commit.
  const ghHead = await fetch(
    `https://api.github.com/repos/${body.owner}/${body.repo}`,
    {
      headers: {
        Authorization: `Bearer ${session.provider_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "edith-probe",
      },
      cache: "no-store",
    },
  );
  if (!ghHead.ok) {
    return NextResponse.json(
      { ok: false, error: `github-${ghHead.status}` },
      { status: ghHead.status },
    );
  }
  const repoMeta = (await ghHead.json()) as { default_branch: string };

  // Pull files, build project, discover endpoints.
  const { files } = await fetchScannableFiles(
    session.provider_token,
    body.owner,
    body.repo,
    repoMeta.default_branch,
  );
  const project = createRepoProject(files);
  const endpoints = discoverEndpoints(project);

  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const attempts = await runProbes({
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    fetcher: probeFetch,
    endpoints,
    timeoutMs: 8000,
  });
  const durationMs = Date.now() - t0;
  const finishedAt = new Date().toISOString();

  const summary = {
    passed: attempts.filter((a) => a.status === "pass").length,
    failed: attempts.filter((a) => a.status === "fail").length,
    skipped: attempts.filter((a) => a.status === "skipped").length,
    errored: attempts.filter((a) => a.status === "error").length,
  };

  return NextResponse.json({
    ok: true,
    probeRun: {
      baseUrl: baseUrl.toString(),
      startedAt,
      finishedAt,
      durationMs,
      endpointsDiscovered: endpoints.length,
      attempts,
      summary,
    },
  });
}
