/**
 * Data layer.
 *
 * One source of truth for reading/writing EDITH's persisted state.
 * Falls back to mock fixtures when `EDITH_USE_FIXTURES=1` or when the
 * Supabase service-role key isn't configured.
 */
import "server-only";
import { env } from "./env";
import { getSupabaseAdmin } from "./supabase-admin";
import {
  REPOS,
  SCANS,
  type Repo,
  type Scan,
  type Issue,
  type Severity,
  type Dimension,
  type ScanStatus,
} from "./mock-data";

const useFixtures = () => env.USE_FIXTURES || !env.SUPABASE_SERVICE_ROLE_KEY;

/* ============= USER + ORG (first-touch provisioning) ========== */

export async function dbEnsureUserAndOrg(args: {
  userId: string;
  email: string;
  displayName: string | null;
  githubLogin: string | null;
  githubId: number | null;
  avatarUrl: string | null;
}): Promise<{ orgId: string }> {
  if (useFixtures()) return { orgId: "fixtures-org" };
  const supabase = getSupabaseAdmin();

  // Upsert into public.users (mirrors auth.users with extra metadata).
  await supabase.from("users").upsert(
    {
      id: args.userId,
      email: args.email,
      display_name: args.displayName,
      github_login: args.githubLogin,
      github_id: args.githubId,
      avatar_url: args.avatarUrl,
    },
    { onConflict: "id" },
  );

  // Does this user already have an org?
  const { data: existing } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", args.userId)
    .limit(1)
    .maybeSingle();

  if (existing?.org_id) return { orgId: existing.org_id as string };

  // Create a personal org.
  const slugBase = (args.githubLogin ?? args.email.split("@")[0] ?? "user")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");
  const slug = `${slugBase}-${args.userId.slice(0, 8)}`;
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .insert({
      name: args.displayName ?? args.githubLogin ?? args.email,
      slug,
      plan: "free",
    })
    .select("id")
    .single();
  if (orgErr || !org) {
    throw new Error(`org create failed: ${orgErr?.message ?? "unknown"}`);
  }

  await supabase.from("org_members").insert({
    org_id: org.id,
    user_id: args.userId,
    role: "owner",
  });

  return { orgId: org.id as string };
}

/* =========================== REPOS =========================== */

export async function dbUpsertRepoFromGithub(args: {
  orgId: string;
  githubRepoId: number;
  owner: string;
  name: string;
  description: string | null;
  defaultBranch: string;
  stack: string[];
}): Promise<{ id: string }> {
  if (useFixtures()) {
    return { id: args.name };
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("repositories")
    .upsert(
      {
        org_id: args.orgId,
        github_repo_id: args.githubRepoId,
        owner: args.owner,
        name: args.name,
        description: args.description,
        default_branch: args.defaultBranch,
        stack: args.stack,
      },
      { onConflict: "org_id,github_repo_id" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

/* =========================== SCANS =========================== */

export async function dbCreateScan(args: {
  repoId: string;
  commit: string;
  branch: string;
  commitMessage?: string;
  triggeredBy?: "manual" | "webhook" | "cli" | "schedule";
  triggeredByUser?: string;
}): Promise<{ id: string }> {
  if (useFixtures()) {
    return { id: `${args.repoId}-scan-fake-${Date.now()}` };
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scans")
    .insert({
      repo_id: args.repoId,
      status: "running" as ScanStatus,
      commit: args.commit,
      branch: args.branch,
      commit_message: args.commitMessage,
      triggered_by: args.triggeredBy ?? "manual",
      triggered_by_user: args.triggeredByUser,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export async function dbFinishScan(args: {
  scanId: string;
  scoreEdith: number;
  scoreTest: number;
  scoreDebt: number;
  dimensionScores: Record<Dimension, number>;
  durationMs: number;
  status?: "completed" | "failed";
  errorMessage?: string;
}): Promise<void> {
  if (useFixtures()) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("scans")
    .update({
      status: args.status ?? "completed",
      score_edith: args.scoreEdith,
      score_test: args.scoreTest,
      score_debt: args.scoreDebt,
      dimension_scores: args.dimensionScores,
      duration_ms: args.durationMs,
      finished_at: new Date().toISOString(),
      error_message: args.errorMessage,
    })
    .eq("id", args.scanId);
  if (error) throw error;
}

export async function dbInsertIssues(args: {
  scanId: string;
  repoId: string;
  issues: Array<{
    checkId: string;
    severity: Severity;
    dimension: Dimension;
    title: string;
    description?: string;
    filePath: string;
    lineNumber?: number;
    codeSnippet?: string;
  }>;
}): Promise<void> {
  if (useFixtures() || args.issues.length === 0) return;
  const supabase = getSupabaseAdmin();
  const rows = args.issues.map((i) => ({
    scan_id: args.scanId,
    repo_id: args.repoId,
    check_id: i.checkId,
    severity: i.severity,
    dimension: i.dimension,
    title: i.title,
    description: i.description,
    file_path: i.filePath,
    line_number: i.lineNumber,
    code_snippet: i.codeSnippet,
  }));
  const { error } = await supabase.from("issues").insert(rows);
  if (error) throw error;
}

/* ============================ READS =========================== */

export async function dbGetScan(scanId: string): Promise<Scan | null> {
  if (useFixtures()) return SCANS.find((s) => s.id === scanId) ?? null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scans")
    .select("*, issues(*)")
    .eq("id", scanId)
    .single();
  if (error || !data) return null;
  return mapDbScan(
    data as DbScanRow & { issues: DbIssueRow[] },
  );
}

export async function dbGetScansForRepo(repoId: string): Promise<Scan[]> {
  if (useFixtures())
    return SCANS.filter((s) => s.repoId === repoId).sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scans")
    .select("*, issues(*)")
    .eq("repo_id", repoId)
    .order("started_at", { ascending: false })
    .limit(20);
  if (error || !data) return [];
  return (data as Array<DbScanRow & { issues: DbIssueRow[] }>).map(mapDbScan);
}

export async function dbGetRepoByName(args: {
  owner: string;
  name: string;
}): Promise<Repo | null> {
  if (useFixtures())
    return REPOS.find((r) => r.owner === args.owner && r.name === args.name) ?? null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("repositories")
    .select("*")
    .eq("owner", args.owner)
    .eq("name", args.name)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as DbRepoRow;
  return {
    id: row.id,
    name: row.name,
    owner: row.owner,
    description: row.description ?? "",
    defaultBranch: row.default_branch,
    lastScanAt: row.updated_at,
    latestScore: 0,
    scoreDelta: 0,
    totalScans: 0,
    criticalIssues: 0,
    highIssues: 0,
    stack: row.stack ?? [],
    autoScan: row.auto_scan,
    aiTool: row.ai_tool ?? "cursor",
  };
}

/* ====================== row → domain mappers ==================== */

type DbRepoRow = {
  id: string;
  org_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  description: string | null;
  default_branch: string;
  auto_scan: boolean;
  ai_tool: "cursor" | "claude_code" | "windsurf" | "v0";
  stack: string[];
  updated_at: string;
};

type DbScanRow = {
  id: string;
  repo_id: string;
  status: ScanStatus;
  commit: string;
  commit_message: string | null;
  branch: string;
  pr_number: number | null;
  triggered_by: string;
  score_edith: number | null;
  score_test: number | null;
  score_debt: number | null;
  dimension_scores: Record<Dimension, number> | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
};

type DbIssueRow = {
  id: string;
  scan_id: string;
  repo_id: string;
  check_id: string;
  severity: Severity;
  dimension: Dimension;
  title: string;
  description: string | null;
  file_path: string;
  line_number: number | null;
  code_snippet: string | null;
};

function mapDbScan(row: DbScanRow & { issues: DbIssueRow[] }): Scan {
  return {
    id: row.id,
    repoId: row.repo_id,
    status: row.status,
    commit: row.commit,
    commitMessage: row.commit_message ?? "",
    branch: row.branch,
    prNumber: row.pr_number ?? undefined,
    scoreEdith: row.score_edith ?? 0,
    scoreTest: row.score_test ?? 0,
    scoreDebt: row.score_debt ?? 0,
    dimensionScores: (row.dimension_scores ?? {
      security: 0,
      performance: 0,
      reliability: 0,
      data_safety: 0,
      business_logic: 0,
      deploy_readiness: 0,
      ai_surface: 0,
      accessibility: 0,
      dependencies: 0,
      seo: 0,
    }) as Record<Dimension, number>,
    startedAt: row.started_at ?? new Date().toISOString(),
    finishedAt: row.finished_at,
    durationMs: row.duration_ms ?? 0,
    issues: (row.issues ?? []).map(
      (i): Issue => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        dimension: i.dimension,
        file: i.file_path,
        line: i.line_number ?? 0,
        description: i.description ?? "",
        fixPrompt: "", // filled in lazily by Claude
      }),
    ),
  };
}
