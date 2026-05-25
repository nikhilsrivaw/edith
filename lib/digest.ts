/**
 * Weekly digest (features.md P2 #9).
 *
 * For each org with digest_enabled=true, build a 7-day summary:
 *   - Score now vs 7 days ago, per repo
 *   - Total issues caught / fixed / dismissed
 *   - Top open critical issues
 *   - Commit streak without EDITH flags
 *
 * Send via Slack webhook if `slack_webhook_url` is set. Email is stubbed
 * (we'd wire Resend later).
 *
 * Called by /api/cron/weekly-digest (Monday 09:00 IST = 03:30 UTC).
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type RepoDigest = {
  name: string;
  scoreNow: number | null;
  scoreLastWeek: number | null;
  newCritical: number;
  newHigh: number;
  resolved: number;
};

export type OrgDigest = {
  orgId: string;
  orgName: string;
  generatedAt: string;
  repos: RepoDigest[];
  totalRepos: number;
  totalIssuesCaught: number;
  totalResolved: number;
  totalDismissed: number;
  topCritical: Array<{ repo: string; title: string; filePath: string }>;
};

export async function buildOrgDigest(orgId: string): Promise<OrgDigest | null> {
  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .maybeSingle();
  if (!org) return null;
  type ORow = { id: string; name: string };

  const { data: repos } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", orgId);
  type RRow = { id: string; name: string };
  const repoRows = (repos as RRow[]) ?? [];

  const now = new Date();
  const weekAgo = new Date(now.getTime() - WEEK_MS).toISOString();

  const perRepo: RepoDigest[] = [];
  let totalIssuesCaught = 0;
  let totalResolved = 0;
  const topCritical: OrgDigest["topCritical"] = [];

  for (const r of repoRows) {
    const { data: latest } = await admin
      .from("scans")
      .select("id, score_edith")
      .eq("repo_id", r.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: lastWeek } = await admin
      .from("scans")
      .select("score_edith")
      .eq("repo_id", r.id)
      .eq("status", "completed")
      .lt("started_at", weekAgo)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    type S = { id?: string; score_edith: number | null };
    const ls = latest as S | null;
    const ws = lastWeek as S | null;

    // Count new issues this week.
    const { data: weekIssues } = await admin
      .from("issues")
      .select("severity, title, file_path")
      .eq("repo_id", r.id)
      .gte("created_at", weekAgo);
    type I = { severity: string; title: string; file_path: string };
    const wi = (weekIssues as I[]) ?? [];
    const newCritical = wi.filter((i) => i.severity === "critical").length;
    const newHigh = wi.filter((i) => i.severity === "high").length;

    const { data: weekResolved } = await admin
      .from("issues")
      .select("id")
      .eq("repo_id", r.id)
      .gte("resolved_at", weekAgo);
    type IR = { id: string };
    const resolved = ((weekResolved as IR[]) ?? []).length;

    totalIssuesCaught += wi.length;
    totalResolved += resolved;

    for (const i of wi.filter((x) => x.severity === "critical").slice(0, 2)) {
      topCritical.push({
        repo: r.name,
        title: i.title,
        filePath: i.file_path,
      });
    }

    perRepo.push({
      name: r.name,
      scoreNow: ls?.score_edith ?? null,
      scoreLastWeek: ws?.score_edith ?? null,
      newCritical,
      newHigh,
      resolved,
    });
  }

  const { data: dismissedThisWeek } = await admin
    .from("issue_dismissals")
    .select("id")
    .eq("org_id", orgId)
    .gte("created_at", weekAgo);
  type ID = { id: string };
  const totalDismissed = ((dismissedThisWeek as ID[]) ?? []).length;

  return {
    orgId: (org as ORow).id,
    orgName: (org as ORow).name,
    generatedAt: now.toISOString(),
    repos: perRepo,
    totalRepos: repoRows.length,
    totalIssuesCaught,
    totalResolved,
    totalDismissed,
    topCritical: topCritical.slice(0, 5),
  };
}

/** Render the digest as a Slack-compatible markdown payload. */
export function renderSlackBlocks(d: OrgDigest) {
  const trendLines = d.repos
    .map((r) => {
      if (r.scoreNow === null) return `• ${r.name} — _no scans yet_`;
      const delta =
        r.scoreLastWeek === null ? "" : ` (${r.scoreNow - r.scoreLastWeek >= 0 ? "+" : ""}${r.scoreNow - r.scoreLastWeek})`;
      return `• *${r.name}* — ${r.scoreNow}/100${delta} · ${r.newCritical}🔴 ${r.newHigh}🟠 / ${r.resolved} resolved`;
    })
    .join("\n");
  const top =
    d.topCritical.length === 0
      ? "_No open critical findings this week._"
      : d.topCritical
          .map((t) => `• \`${t.repo}\` — ${t.title} (\`${t.filePath}\`)`)
          .join("\n");
  return {
    text: `EDITH weekly digest — ${d.orgName}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `👓 EDITH weekly digest` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Repos*\n${d.totalRepos}` },
          { type: "mrkdwn", text: `*Issues caught*\n${d.totalIssuesCaught}` },
          { type: "mrkdwn", text: `*Resolved*\n${d.totalResolved}` },
          { type: "mrkdwn", text: `*Dismissed*\n${d.totalDismissed}` },
        ],
      },
      { type: "section", text: { type: "mrkdwn", text: `*By repo*\n${trendLines}` } },
      { type: "section", text: { type: "mrkdwn", text: `*Top critical*\n${top}` } },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Generated ${d.generatedAt.slice(0, 10)} — manage at https://edith.expert/settings`,
          },
        ],
      },
    ],
  };
}

export async function deliverToSlack(
  webhookUrl: string,
  payload: ReturnType<typeof renderSlackBlocks>,
): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}
