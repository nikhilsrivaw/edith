/**
 * GET /api/cron/dep-scan
 *
 * Daily dependency-vulnerability sweep across all repos with an installation.
 * Schedule via vercel.json `crons` (daily, 02:00).
 *
 * Auth: must be called with header `Authorization: Bearer <CRON_SECRET>`
 * matching env.EDITH_SESSION_SECRET (or skipped in dev).
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOctokitForInstallation } from "@/lib/github-app";
import {
  scanRepoDependencies,
  persistAdvisoriesAsAlerts,
} from "@/lib/dep-watcher";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Light auth — production should require this header.
  const auth = req.headers.get("authorization") ?? "";
  if (process.env.NODE_ENV === "production") {
    if (!env.SESSION_SECRET || auth !== `Bearer ${env.SESSION_SECRET}`) {
      return new NextResponse("unauthorised", { status: 401 });
    }
  }

  const admin = getSupabaseAdmin();
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, github_installation_id")
    .not("github_installation_id", "is", null);

  type OrgRow = { id: string; github_installation_id: number };
  const list = (orgs as OrgRow[]) ?? [];
  const results: Array<{
    orgId: string;
    repos: number;
    advisories: number;
    error?: string;
  }> = [];

  for (const org of list) {
    try {
      // Get a fresh installation token, then list repos for the installation.
      const octokit = await getOctokitForInstallation(
        org.github_installation_id,
      );
      // @ts-expect-error — auth() returns { token }
      const token: string = (await octokit.auth({ type: "installation" })).token;
      const reposResp =
        await octokit.rest.apps.listReposAccessibleToInstallation();
      const repos = reposResp.data.repositories;
      let advisoryCount = 0;
      for (const r of repos) {
        const advisories = await scanRepoDependencies({
          providerToken: token,
          owner: r.owner.login,
          repo: r.name,
          defaultBranch: r.default_branch,
        });
        if (advisories.length === 0) continue;
        // Upsert the repo so we can persist alerts against it.
        const { data: existingRepo } = await admin
          .from("repositories")
          .select("id")
          .eq("org_id", org.id)
          .eq("github_repo_id", r.id)
          .maybeSingle();
        let repoId = existingRepo?.id as string | undefined;
        if (!repoId) {
          const { data: inserted } = await admin
            .from("repositories")
            .insert({
              org_id: org.id,
              github_repo_id: r.id,
              owner: r.owner.login,
              name: r.name,
              description: r.description,
              default_branch: r.default_branch,
              stack: r.language ? [r.language] : [],
            })
            .select("id")
            .single();
          repoId = inserted?.id as string | undefined;
        }
        if (!repoId) continue;
        await persistAdvisoriesAsAlerts(repoId, advisories);
        advisoryCount += advisories.length;
      }
      results.push({
        orgId: org.id,
        repos: repos.length,
        advisories: advisoryCount,
      });
    } catch (err) {
      results.push({
        orgId: org.id,
        repos: 0,
        advisories: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
