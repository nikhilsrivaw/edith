/**
 * Handles `push` events. Only acts on the default branch — feature-branch
 * pushes are scanned via `pull_request.synchronize` (incremental diff).
 *
 * Triggers a full repo scan, persists scan + issues, updates the dashboard.
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOctokitForInstallation } from "@/lib/github-app";
import { runScan } from "@/lib/scanner/runner";
import { dbUpsertRepoFromGithub } from "@/lib/db";

type PushPayload = {
  ref: string; // refs/heads/main
  before: string;
  after: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    default_branch: string;
    language: string | null;
    owner: { login: string };
  };
  installation: { id: number };
  head_commit?: { message: string };
};

export async function handlePush(raw: Record<string, unknown>) {
  const p = raw as unknown as PushPayload;
  const branch = p.ref.replace(/^refs\/heads\//, "");
  if (branch !== p.repository.default_branch) {
    return; // ignore feature-branch pushes here
  }

  const installationId = p.installation?.id;
  if (!installationId) return;

  // Find the org by installation_id.
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("github_installation_id", installationId)
    .maybeSingle();
  if (!org) return;

  // Upsert the repo.
  const { id: repoId } = await dbUpsertRepoFromGithub({
    orgId: org.id as string,
    githubRepoId: p.repository.id,
    owner: p.repository.owner.login,
    name: p.repository.name,
    description: p.repository.description,
    defaultBranch: p.repository.default_branch,
    stack: p.repository.language ? [p.repository.language] : [],
  });

  // We need a GitHub token to scan — use an installation token.
  const octokit = await getOctokitForInstallation(installationId);
  // @ts-expect-error — Octokit exposes the underlying auth token via auth() — types are loose.
  const token: string = (await octokit.auth({ type: "installation" })).token;

  await runScan({
    providerToken: token,
    owner: p.repository.owner.login,
    repo: p.repository.name,
    defaultBranch: branch,
    repoIdInDb: repoId,
    commit: p.after.slice(0, 7),
    triggeredByUser: undefined,
  });
}
