/**
 * Compliance scoring: for a given org, compute which controls of each
 * framework are at risk based on open issues. Returns a percentage per
 * framework + the failing-control list.
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";

export type FrameworkSummary = {
  id: string;
  name: string;
  description: string | null;
  totalControls: number;
  passing: number;
  failing: number;
  unevaluated: number;
  percent: number; // passing / evaluated
  failingControls: Array<{
    id: string;
    code: string;
    title: string;
    weight: number;
    affectingIssues: number;
    affectingRepos: string[];
  }>;
};

export async function complianceFor(orgId: string): Promise<FrameworkSummary[]> {
  const admin = getSupabaseAdmin();

  const [{ data: frameworks }, { data: controls }, { data: mappings }] =
    await Promise.all([
      admin.from("compliance_frameworks").select("id, name, description, total_controls"),
      admin
        .from("compliance_controls")
        .select("id, framework_id, code, title, description, weight"),
      admin
        .from("compliance_check_mapping")
        .select("check_id, control_id, relation"),
    ]);

  type Fw = {
    id: string;
    name: string;
    description: string | null;
    total_controls: number;
  };
  type Ctrl = {
    id: string;
    framework_id: string;
    code: string;
    title: string;
    description: string | null;
    weight: number;
  };
  type Map = { check_id: string; control_id: string; relation: string };

  const frRows = (frameworks as Fw[]) ?? [];
  const ctrlRows = (controls as Ctrl[]) ?? [];
  const mapRows = (mappings as Map[]) ?? [];

  // checkId → control_ids
  const byCheck = new Map<string, string[]>();
  for (const m of mapRows) {
    const list = byCheck.get(m.check_id) ?? [];
    list.push(m.control_id);
    byCheck.set(m.check_id, list);
  }

  // Pull open issues across the org's repos
  const { data: repos } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", orgId);
  type R = { id: string; name: string };
  const repoRows = (repos as R[]) ?? [];
  const repoById = new Map(repoRows.map((r) => [r.id, r.name]));

  let issues: Array<{ check_id: string; repo_id: string }> = [];
  if (repoRows.length > 0) {
    // Use latest scan per repo.
    const scanIds: string[] = [];
    for (const r of repoRows) {
      const { data: scan } = await admin
        .from("scans")
        .select("id")
        .eq("repo_id", r.id)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (scan) scanIds.push((scan as { id: string }).id);
    }
    if (scanIds.length > 0) {
      const { data } = await admin
        .from("issues")
        .select("check_id, repo_id, resolved_at")
        .in("scan_id", scanIds)
        .is("resolved_at", null);
      type II = { check_id: string; repo_id: string; resolved_at: string | null };
      issues = ((data as II[]) ?? []).map((i) => ({
        check_id: i.check_id,
        repo_id: i.repo_id,
      }));
    }
  }

  // controlId → {issueCount, repoSet}
  const failureByControl = new Map<
    string,
    { issues: number; repos: Set<string> }
  >();
  for (const i of issues) {
    const controlIds = byCheck.get(i.check_id) ?? [];
    for (const cid of controlIds) {
      const e = failureByControl.get(cid) ?? { issues: 0, repos: new Set() };
      e.issues += 1;
      const rname = repoById.get(i.repo_id);
      if (rname) e.repos.add(rname);
      failureByControl.set(cid, e);
    }
  }

  // Build per-framework summary
  return frRows.map((fw): FrameworkSummary => {
    const fwControls = ctrlRows.filter((c) => c.framework_id === fw.id);
    const failing = fwControls.filter((c) => failureByControl.has(c.id));
    const passing = fwControls.length - failing.length;
    const unevaluated = 0; // v1 — every control is either passing or failing
    const denom = fwControls.length || 1;
    return {
      id: fw.id,
      name: fw.name,
      description: fw.description,
      totalControls: fwControls.length || fw.total_controls,
      passing,
      failing: failing.length,
      unevaluated,
      percent: Math.round((passing / denom) * 100),
      failingControls: failing
        .map((c) => {
          const e = failureByControl.get(c.id)!;
          return {
            id: c.id,
            code: c.code,
            title: c.title,
            weight: c.weight,
            affectingIssues: e.issues,
            affectingRepos: Array.from(e.repos).sort(),
          };
        })
        .sort((a, b) => b.weight - a.weight || b.affectingIssues - a.affectingIssues),
    };
  });
}
