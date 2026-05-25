/**
 * Score drift tracking + alert generation.
 *
 * After every scan completes, compare against the previous successful scan
 * for the same repo. Emit drift_alerts when:
 *   1. EDITH Score dropped >= 5 points       → 'score_regression'
 *   2. A new critical check_id appeared      → 'new_critical'
 *   3. A new process.env.X reference appeared → 'env_var_change'
 *   4. New `create table` without RLS        → 'schema_drift'
 *
 * Plus return a trend series for the dashboard chart.
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";
import type { Severity } from "./mock-data";

const REGRESSION_THRESHOLD = 5;

export type DriftAlert = {
  kind: "score_regression" | "new_critical" | "env_var_change" | "schema_drift";
  severity: Severity;
  title: string;
  detail: Record<string, unknown>;
};

type ScanRow = {
  id: string;
  repo_id: string;
  score_edith: number | null;
  started_at: string | null;
  commit: string;
};
type IssueRow = {
  check_id: string;
  severity: Severity;
  file_path: string;
  title: string;
};

/** Compute drift between the latest completed scan for a repo and the one before it. */
export async function computeDriftForRepo(repoId: string): Promise<{
  alerts: DriftAlert[];
  current: ScanRow | null;
  previous: ScanRow | null;
}> {
  const admin = getSupabaseAdmin();
  const { data: scans } = await admin
    .from("scans")
    .select("id, repo_id, score_edith, started_at, commit")
    .eq("repo_id", repoId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(2);

  const rows = (scans ?? []) as ScanRow[];
  if (rows.length < 2) {
    return { alerts: [], current: rows[0] ?? null, previous: null };
  }
  const [current, previous] = rows;

  // Pull issues for both scans.
  const { data: curIssues } = await admin
    .from("issues")
    .select("check_id, severity, file_path, title")
    .eq("scan_id", current.id);
  const { data: prevIssues } = await admin
    .from("issues")
    .select("check_id, severity, file_path, title")
    .eq("scan_id", previous.id);

  const alerts: DriftAlert[] = [];

  // 1. Score regression.
  if (
    current.score_edith !== null &&
    previous.score_edith !== null &&
    previous.score_edith - current.score_edith >= REGRESSION_THRESHOLD
  ) {
    alerts.push({
      kind: "score_regression",
      severity:
        previous.score_edith - current.score_edith >= 15 ? "high" : "medium",
      title: `EDITH Score dropped ${previous.score_edith - current.score_edith} points`,
      detail: {
        from: previous.score_edith,
        to: current.score_edith,
        deltaCommit: current.commit,
        fromCommit: previous.commit,
      },
    });
  }

  // 2. New critical check_ids that weren't in the previous scan.
  const prevCriticals = new Set(
    (prevIssues ?? [])
      .filter((i): i is IssueRow => (i as IssueRow).severity === "critical")
      .map((i) => i.check_id),
  );
  const newCriticals = (curIssues ?? [])
    .filter(
      (i): i is IssueRow =>
        (i as IssueRow).severity === "critical" &&
        !prevCriticals.has((i as IssueRow).check_id),
    );
  for (const i of newCriticals) {
    alerts.push({
      kind: "new_critical",
      severity: "critical",
      title: `New critical: ${i.title}`,
      detail: { checkId: i.check_id, filePath: i.file_path },
    });
  }

  // 3. New env var references.
  const prevEnvFiles = new Set(
    (prevIssues ?? [])
      .filter((i) => (i as IssueRow).check_id === "deploy_readiness/env-var-undocumented")
      .map((i) => (i as IssueRow).title),
  );
  const newEnvIssues = (curIssues ?? []).filter(
    (i) =>
      (i as IssueRow).check_id === "deploy_readiness/env-var-undocumented" &&
      !prevEnvFiles.has((i as IssueRow).title),
  );
  for (const e of newEnvIssues) {
    alerts.push({
      kind: "env_var_change",
      severity: "medium",
      title: `New env var: ${(e as IssueRow).title}`,
      detail: { filePath: (e as IssueRow).file_path },
    });
  }

  // 4. New schema-drift events (RLS missing on a newly-added table).
  const prevSchemaTables = new Set(
    (prevIssues ?? [])
      .filter((i) => (i as IssueRow).check_id === "data_safety/rls-not-enabled")
      .map((i) => (i as IssueRow).title),
  );
  const newSchemaIssues = (curIssues ?? []).filter(
    (i) =>
      (i as IssueRow).check_id === "data_safety/rls-not-enabled" &&
      !prevSchemaTables.has((i as IssueRow).title),
  );
  for (const s of newSchemaIssues) {
    alerts.push({
      kind: "schema_drift",
      severity: "critical",
      title: `${(s as IssueRow).title}`,
      detail: { filePath: (s as IssueRow).file_path },
    });
  }

  return { alerts, current, previous };
}

/** Persist alerts to drift_alerts table. Idempotent — dedups by (repo, kind, title). */
export async function persistDriftAlerts(
  repoId: string,
  alerts: DriftAlert[],
): Promise<void> {
  if (alerts.length === 0) return;
  const admin = getSupabaseAdmin();
  for (const a of alerts) {
    const { data: existing } = await admin
      .from("drift_alerts")
      .select("id")
      .eq("repo_id", repoId)
      .eq("kind", a.kind)
      .eq("title", a.title)
      .is("acknowledged_at", null)
      .maybeSingle();
    if (existing) continue;
    await admin.from("drift_alerts").insert({
      repo_id: repoId,
      kind: a.kind,
      severity: a.severity,
      title: a.title,
      detail: a.detail,
    });
  }
}

/** Return a sparkline series for the repo's last N scans. */
export async function getScoreTrend(
  repoId: string,
  limit = 20,
): Promise<Array<{ scanId: string; score: number; commit: string; startedAt: string }>> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("scans")
    .select("id, score_edith, commit, started_at")
    .eq("repo_id", repoId)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(limit);
  type Row = { id: string; score_edith: number | null; commit: string; started_at: string | null };
  return ((data as Row[]) ?? [])
    .reverse()
    .map((r) => ({
      scanId: r.id,
      score: r.score_edith ?? 0,
      commit: r.commit,
      startedAt: r.started_at ?? "",
    }));
}

/** All unacked drift alerts for a repo. */
export async function getOpenDriftAlerts(repoId: string) {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("drift_alerts")
    .select("*")
    .eq("repo_id", repoId)
    .is("acknowledged_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
