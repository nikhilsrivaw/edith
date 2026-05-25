/**
 * Handles `pull_request` events.
 *
 * Strategy: respond to the webhook fast (≤1s) by creating a check-run
 * with status=in_progress and dispatching the actual scan via Inngest.
 * The scan-completed Inngest function posts the summary + inline +
 * finalises the check-run asynchronously.
 *
 * Falls back to inline (synchronous) execution if Inngest isn't configured,
 * so local dev without Inngest still works.
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOctokitForInstallation } from "@/lib/github-app";
import { runScan } from "@/lib/scanner/runner";
import { dbUpsertRepoFromGithub } from "@/lib/db";
import { postPrSummary } from "@/lib/github/pr-summary";
import { postInlineComments } from "@/lib/github/pr-comments";
import { postCheckRun } from "@/lib/github/check-status";
import { postSeoPrComment, type SeoDelta } from "@/lib/seo/pr-comment";
import { inngest } from "@/lib/inngest/client";
import { env } from "@/lib/env";
import type { Severity } from "@/lib/mock-data";

type PrPayload = {
  action: string;
  number: number;
  pull_request: {
    head: { sha: string; ref: string };
    base: { sha: string; ref: string };
    title: string;
    user: { login: string };
    html_url: string;
  };
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
};

const RELEVANT_ACTIONS = new Set(["opened", "reopened", "synchronize"]);

function inngestConfigured(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}

export async function handlePullRequest(raw: Record<string, unknown>) {
  const p = raw as unknown as PrPayload;
  if (!RELEVANT_ACTIONS.has(p.action)) return;

  const installationId = p.installation?.id;
  if (!installationId) return;

  const admin = getSupabaseAdmin();
  const { data: org } = await admin
    .from("organizations")
    .select("id")
    .eq("github_installation_id", installationId)
    .maybeSingle();
  if (!org) return;

  const { id: repoIdInDb } = await dbUpsertRepoFromGithub({
    orgId: org.id as string,
    githubRepoId: p.repository.id,
    owner: p.repository.owner.login,
    name: p.repository.name,
    description: p.repository.description,
    defaultBranch: p.repository.default_branch,
    stack: p.repository.language ? [p.repository.language] : [],
  });

  const octokit = await getOctokitForInstallation(installationId);

  // Start a check-run as in_progress so the PR shows EDITH is working.
  let checkRunId: number | undefined;
  try {
    const check = await postCheckRun(octokit, {
      owner: p.repository.owner.login,
      repo: p.repository.name,
      headSha: p.pull_request.head.sha,
      status: "in_progress",
      name: "EDITH",
      summary: "Scanning…",
    });
    checkRunId = check.id;
  } catch (e) {
    console.warn("[handlePullRequest] check-run create failed:", e);
  }

  // ───── Async path (Inngest) ─────
  if (inngestConfigured()) {
    await inngest.send({
      name: "edith/scan.requested",
      data: {
        repoIdInDb,
        owner: p.repository.owner.login,
        repo: p.repository.name,
        defaultBranch: p.pull_request.head.ref,
        commit: p.pull_request.head.sha.slice(0, 7),
        triggeredBy: "webhook",
        installationId,
        prNumber: p.number,
        prHeadSha: p.pull_request.head.sha,
        checkRunId,
      },
    });
    return;
  }

  // ───── Sync fallback (no Inngest yet) ─────
  // @ts-expect-error — auth() returns { token }
  const token: string = (await octokit.auth({ type: "installation" })).token;

  const result = await runScan({
    providerToken: token,
    owner: p.repository.owner.login,
    repo: p.repository.name,
    defaultBranch: p.pull_request.head.ref,
    repoIdInDb,
    commit: p.pull_request.head.sha.slice(0, 7),
  });

  try {
    await postPrSummary(octokit, {
      owner: p.repository.owner.login,
      repo: p.repository.name,
      prNumber: p.number,
      scoreEdith: result.scoreEdith,
      issues: result.issues,
      scanId: result.scanId,
    });
  } catch (e) {
    console.warn("[handlePullRequest] summary post failed:", e);
  }

  try {
    await postInlineComments(octokit, {
      owner: p.repository.owner.login,
      repo: p.repository.name,
      prNumber: p.number,
      headSha: p.pull_request.head.sha,
      issues: result.issues,
    });
  } catch (e) {
    console.warn("[handlePullRequest] inline comments failed:", e);
  }

  // === SEO PR comment (opt-out via seo-skip label) ===
  try {
    await postSeoPrCommentForPr(octokit, {
      owner: p.repository.owner.login,
      repo: p.repository.name,
      prNumber: p.number,
      scanId: result.scanId,
      repoIdInDb,
      defaultBranch: p.repository.default_branch,
      issues: result.issues,
    });
  } catch (e) {
    console.warn("[handlePullRequest] SEO comment failed:", e);
  }

  if (checkRunId) {
    const critical = result.issues.filter(
      (i) => i.severity === "critical",
    ).length;
    const conclusion = critical > 0 ? "failure" : "success";
    try {
      await postCheckRun(octokit, {
        owner: p.repository.owner.login,
        repo: p.repository.name,
        headSha: p.pull_request.head.sha,
        status: "completed",
        conclusion,
        name: "EDITH",
        summary: `EDITH Score ${result.scoreEdith}/100 · ${result.issues.length} issues (${critical} critical)`,
        existingRunId: checkRunId,
      });
    } catch (e) {
      console.warn("[handlePullRequest] check-run update failed:", e);
    }
  }
}

/* ================================================================
 * SEO PR comment dispatcher
 *
 * Compares this scan's SEO issues against the most recent base-branch
 * scan and posts/edits the sticky SEO comment. Opt-out: a `seo-skip`
 * label on the PR.
 * ============================================================== */

const SEV_PENALTY: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
};

const SUB_DIM_KEYS = [
  "technical_foundation",
  "core_web_vitals",
  "content_structure",
  "indexability",
  "discoverability",
  "ai_readiness",
] as const;
type SubDim = (typeof SUB_DIM_KEYS)[number];

function classifySubDimension(checkId: string): SubDim {
  if (/metadata|description|title|og|twitter|robots-missing|sitemap-missing|html-lang|metadata-base/.test(checkId))
    return "technical_foundation";
  if (/lcp|cls|inp|raw-img|next-script|font|priority|image-no-size|image-bloat|image-no-dims|gif-too-big|image-cdn-sprawl|heavy-page|render-blocking|third-party|long-tasks|cls-source/.test(checkId))
    return "core_web_vitals";
  if (/h1|heading|alt|structured-data|wordcount|main|json-ld|live-no-h1|live-multiple-h1/.test(checkId))
    return "content_structure";
  if (/noindex|x-robots|broken-internal|cache-control|home-not-200|sitemap-not-200|robots-disallows|canonical|duplicate-title|duplicate-description|crawl-errors|orphan|image-broken|failed-resources/.test(checkId))
    return "indexability";
  if (/raw-anchor|hreflang|breadcrumb|no-rss-feed/.test(checkId))
    return "discoverability";
  if (/llms-txt|ai-bots|use-client-content|brand-schema|ai-overviews|js-only-rendering|ai-plugin|mcp-manifest/.test(checkId))
    return "ai_readiness";
  return "technical_foundation";
}

type SeoIssueLite = {
  checkId: string;
  severity: Severity;
  title: string;
  filePath: string;
  lineNumber?: number;
};

function computeSeoScore(seoIssues: SeoIssueLite[]): {
  score: number;
  subGrades: Record<SubDim, number>;
} {
  const subGrades: Record<SubDim, number> = {
    technical_foundation: 100,
    core_web_vitals: 100,
    content_structure: 100,
    indexability: 100,
    discoverability: 100,
    ai_readiness: 100,
  };
  const WEIGHTS: Record<SubDim, number> = {
    technical_foundation: 0.30,
    core_web_vitals: 0.25,
    content_structure: 0.15,
    indexability: 0.15,
    discoverability: 0.10,
    ai_readiness: 0.05,
  };
  for (const i of seoIssues) {
    const sd = classifySubDimension(i.checkId);
    subGrades[sd] = Math.max(0, subGrades[sd] - SEV_PENALTY[i.severity]);
  }
  const score = Math.round(
    SUB_DIM_KEYS.reduce((s, k) => s + subGrades[k] * WEIGHTS[k], 0),
  );
  return { score, subGrades };
}

async function postSeoPrCommentForPr(
  octokit: import("@octokit/rest").Octokit,
  args: {
    owner: string;
    repo: string;
    prNumber: number;
    scanId: string;
    repoIdInDb: string;
    defaultBranch: string;
    issues: ReadonlyArray<{
      checkId: string;
      severity: Severity;
      title: string;
      filePath: string;
      lineNumber?: number;
      dimension: string;
    }>;
  },
): Promise<void> {
  // Skip if the PR has the seo-skip label.
  const labels = await octokit.rest.issues
    .listLabelsOnIssue({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.prNumber,
    })
    .then((r) => r.data.map((l) => l.name.toLowerCase()))
    .catch(() => [] as string[]);
  if (labels.includes("seo-skip")) return;

  const seoIssues: SeoIssueLite[] = args.issues
    .filter((i) => i.dimension === "seo")
    .map((i) => ({
      checkId: i.checkId,
      severity: i.severity,
      title: i.title,
      filePath: i.filePath,
      lineNumber: i.lineNumber,
    }));

  // Skip emitting a comment if there are zero SEO findings and no prior
  // comment exists — handled by postSeoPrComment internally (it edits if
  // present, creates only when there's content).
  const { score, subGrades } = computeSeoScore(seoIssues);

  // Compute baseline from the most recent completed scan on the default branch.
  const admin = getSupabaseAdmin();
  const { data: baseScanRow } = await admin
    .from("scans")
    .select("id")
    .eq("repo_id", args.repoIdInDb)
    .eq("status", "completed")
    .eq("branch", args.defaultBranch)
    .neq("id", args.scanId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type BS = { id: string } | null;
  const baseScan = baseScanRow as BS;

  let baseScore: number | null = null;
  let baseIssues: SeoIssueLite[] = [];
  if (baseScan) {
    const { data: rows } = await admin
      .from("issues")
      .select("check_id, severity, title, file_path, line_number, dimension")
      .eq("scan_id", baseScan.id)
      .eq("dimension", "seo");
    type IR = {
      check_id: string;
      severity: Severity;
      title: string;
      file_path: string;
      line_number: number | null;
      dimension: string;
    };
    const list = (rows as IR[] | null) ?? [];
    baseIssues = list.map((r) => ({
      checkId: r.check_id,
      severity: r.severity,
      title: r.title,
      filePath: r.file_path,
      lineNumber: r.line_number ?? undefined,
    }));
    baseScore = computeSeoScore(baseIssues).score;
  }

  // Diff: new = in current but not in base (by checkId+filePath).
  const baseKey = new Set(
    baseIssues.map((i) => `${i.checkId}|${i.filePath}`),
  );
  const currKey = new Set(
    seoIssues.map((i) => `${i.checkId}|${i.filePath}`),
  );
  const newIssues = seoIssues.filter(
    (i) => !baseKey.has(`${i.checkId}|${i.filePath}`),
  );
  const resolvedIssues = baseIssues.filter(
    (i) => !currKey.has(`${i.checkId}|${i.filePath}`),
  );

  const delta: SeoDelta = {
    score,
    baseScore,
    newIssues,
    resolvedIssues,
    subGrades,
  };

  await postSeoPrComment(octokit, {
    owner: args.owner,
    repo: args.repo,
    prNumber: args.prNumber,
    scanId: args.scanId,
    appUrl: env.APP_URL,
    delta,
  });
}
