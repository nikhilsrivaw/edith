/**
 * Cross-repo aggregations for the unified pages (Issues, Drift, Activity,
 * Compliance). All scope to the caller's org and use the service-role
 * client because we already verified the user's session at the route.
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";
import type { Severity } from "./mock-data";

export type UnifiedIssueRow = {
  id: string;
  scan_id: string;
  check_id: string;
  severity: Severity;
  dimension: string;
  title: string;
  description: string | null;
  file_path: string;
  line_number: number | null;
  created_at: string;
  repo: { id: string; name: string; owner: string };
};

/** All repo names for an org, sorted alphabetically. */
export async function listOrgRepoNames(orgId: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("repositories")
    .select("name")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  type R = { name: string };
  return ((data as R[]) ?? []).map((r) => r.name);
}

/** Find the org_id for a user. (One personal org per user in v1.) */
export async function userOrgId(userId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("org_members")
    .select("org_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  type M = { org_id: string };
  return (data as M | null)?.org_id ?? null;
}

/** All open issues across all repos in an org, latest scan per repo. */
export async function listOpenIssues(args: {
  orgId: string;
  severity?: Severity;
  repoName?: string;
  limit?: number;
}): Promise<UnifiedIssueRow[]> {
  const admin = getSupabaseAdmin();
  const limit = args.limit ?? 200;

  // For each repo, find latest completed scan id, then pull issues.
  const { data: repos } = await admin
    .from("repositories")
    .select("id, name, owner")
    .eq("org_id", args.orgId);
  type R = { id: string; name: string; owner: string };
  const repoRows = (repos as R[]) ?? [];
  if (repoRows.length === 0) return [];

  const filteredRepos = args.repoName
    ? repoRows.filter((r) => r.name === args.repoName)
    : repoRows;

  // Get latest scan for each repo.
  const latestScans: { repoId: string; scanId: string }[] = [];
  for (const r of filteredRepos) {
    const { data: scan } = await admin
      .from("scans")
      .select("id")
      .eq("repo_id", r.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (scan) latestScans.push({ repoId: r.id, scanId: (scan as { id: string }).id });
  }
  if (latestScans.length === 0) return [];

  // Pull issues for those scans.
  const scanIds = latestScans.map((s) => s.scanId);
  let q = admin
    .from("issues")
    .select(
      "id, scan_id, check_id, severity, dimension, title, description, file_path, line_number, created_at, repo_id, resolved_at",
    )
    .in("scan_id", scanIds)
    .is("resolved_at", null);
  if (args.severity) q = q.eq("severity", args.severity);
  const { data: issues } = await q
    .order("severity", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  type I = {
    id: string;
    scan_id: string;
    check_id: string;
    severity: Severity;
    dimension: string;
    title: string;
    description: string | null;
    file_path: string;
    line_number: number | null;
    created_at: string;
    repo_id: string;
  };
  const rows = (issues as I[]) ?? [];

  const repoById = new Map(repoRows.map((r) => [r.id, r]));
  return rows.map(
    (i): UnifiedIssueRow => ({
      id: i.id,
      scan_id: i.scan_id,
      check_id: i.check_id,
      severity: i.severity,
      dimension: i.dimension,
      title: i.title,
      description: i.description,
      file_path: i.file_path,
      line_number: i.line_number,
      created_at: i.created_at,
      repo: repoById.get(i.repo_id) ?? { id: i.repo_id, name: "?", owner: "?" },
    }),
  );
}

/** Org-wide drift alerts. */
export async function listDriftAlerts(orgId: string, limit = 100) {
  const admin = getSupabaseAdmin();
  const { data: repos } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", orgId);
  type R = { id: string; name: string };
  const repoRows = (repos as R[]) ?? [];
  if (repoRows.length === 0) return [];
  const repoIds = repoRows.map((r) => r.id);
  const { data } = await admin
    .from("drift_alerts")
    .select("id, repo_id, kind, severity, title, detail, acknowledged_at, created_at")
    .in("repo_id", repoIds)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  type DA = {
    id: string;
    repo_id: string;
    kind: string;
    severity: string;
    title: string;
    detail: Record<string, unknown> | null;
    acknowledged_at: string | null;
    created_at: string;
  };
  const rows = (data as DA[]) ?? [];
  const repoById = new Map(repoRows.map((r) => [r.id, r]));
  return rows.map((d) => ({
    ...d,
    repo: repoById.get(d.repo_id),
  }));
}

/** Recent activity feed: scans + drift + extension scans, last 50. */
export type ActivityEvent = {
  kind:
    | "scan_completed"
    | "scan_failed"
    | "drift_alert"
    | "extension_scan"
    | "mcp_call"
    | "issue_dismissed";
  at: string;
  title: string;
  subtitle?: string;
  repo?: string;
  severity?: string;
  href?: string;
};

export async function listActivity(orgId: string, limit = 50): Promise<ActivityEvent[]> {
  const admin = getSupabaseAdmin();
  const events: ActivityEvent[] = [];

  // Recent scans
  const { data: repos } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", orgId);
  type R = { id: string; name: string };
  const repoRows = (repos as R[]) ?? [];
  const repoById = new Map(repoRows.map((r) => [r.id, r]));
  if (repoRows.length > 0) {
    const repoIds = repoRows.map((r) => r.id);
    const { data: scans } = await admin
      .from("scans")
      .select("id, repo_id, status, score_edith, commit, started_at, finished_at")
      .in("repo_id", repoIds)
      .order("started_at", { ascending: false })
      .limit(limit);
    type S = {
      id: string;
      repo_id: string;
      status: string;
      score_edith: number | null;
      commit: string;
      started_at: string;
      finished_at: string | null;
    };
    for (const s of (scans as S[]) ?? []) {
      const repo = repoById.get(s.repo_id);
      events.push({
        kind: s.status === "failed" ? "scan_failed" : "scan_completed",
        at: s.finished_at ?? s.started_at,
        title:
          s.status === "failed"
            ? `Scan failed on ${repo?.name ?? s.repo_id}`
            : `Scanned ${repo?.name ?? s.repo_id} — ${s.score_edith ?? "?"}/100`,
        subtitle: `commit ${s.commit}`,
        repo: repo?.name,
        href: repo ? `/repos/${repo.name}/scans/${s.id}` : undefined,
      });
    }

    // Drift
    const { data: drift } = await admin
      .from("drift_alerts")
      .select("id, repo_id, severity, title, kind, created_at")
      .in("repo_id", repoIds)
      .order("created_at", { ascending: false })
      .limit(limit);
    type D = {
      id: string;
      repo_id: string;
      severity: string;
      title: string;
      kind: string;
      created_at: string;
    };
    for (const d of (drift as D[]) ?? []) {
      const repo = repoById.get(d.repo_id);
      events.push({
        kind: "drift_alert",
        at: d.created_at,
        title: d.title,
        subtitle: `drift · ${d.kind.replace("_", " ")}`,
        repo: repo?.name,
        severity: d.severity,
        href: repo ? `/repos/${repo.name}` : undefined,
      });
    }
  }

  // Extension scans
  const { data: ext } = await admin
    .from("extension_scans")
    .select("id, origin, url, finding_count, critical_count, high_count, score, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit / 2);
  type EX = {
    id: string;
    origin: string;
    url: string;
    finding_count: number;
    critical_count: number;
    high_count: number;
    score: number | null;
    created_at: string;
  };
  for (const e of (ext as EX[]) ?? []) {
    events.push({
      kind: "extension_scan",
      at: e.created_at,
      title: `Browser scan of ${e.origin}`,
      subtitle: `${e.finding_count} findings · ${e.critical_count}🔴 ${e.high_count}🟠`,
    });
  }

  // MCP calls (last 30)
  const { data: mcp } = await admin
    .from("mcp_calls")
    .select("id, tool, status, duration_ms, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(30);
  type MC = {
    id: string;
    tool: string;
    status: string;
    duration_ms: number | null;
    created_at: string;
  };
  for (const m of (mcp as MC[]) ?? []) {
    events.push({
      kind: "mcp_call",
      at: m.created_at,
      title: `Agent called ${m.tool}`,
      subtitle: m.status === "ok" ? `${m.duration_ms ?? 0}ms` : "errored",
    });
  }

  // Sort + truncate
  events.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return events.slice(0, limit);
}
