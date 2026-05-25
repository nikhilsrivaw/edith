/**
 * v1 scanner.
 *
 * 1. Fetches the full repo tree via GitHub Trees API.
 * 2. Pulls scannable files in parallel via Blobs API.
 * 3. Builds an in-memory ts-morph Project.
 * 4. Runs both v0 (regex) and v1 (AST + cross-file) check registries.
 * 5. Persists scan + issues to Supabase.
 */
import "server-only";
import type { Dimension } from "../mock-data";
import {
  dbCreateScan,
  dbFinishScan,
  dbInsertIssues,
} from "../db";
import { fetchScannableFiles } from "./github-tree";
import { createRepoProject } from "./project";
import { runAllChecks as runV0Checks, type CheckIssue as V0Issue } from "./checks-v0";
import { runV1Checks, type CheckIssue as V1Issue } from "./checks-v1";
import { runV2Checks, type CheckIssue as V2Issue } from "./checks-v2";
import { runV3Checks, type CheckIssue as V3Issue } from "./checks-v3";
import { runV4Checks, type CheckIssue as V4Issue } from "./checks-v4";
import { runAiPatternChecks, detectAiTools, type AiIssue } from "./checks-ai";
import { runSecretChecks, type SecretIssue } from "./checks-secrets";
import { runSeoRepoChecks, type SeoIssue } from "./checks-seo";
import { runDependencyChecks, type DepIssue } from "./checks-deps";
import { probeLiveSeo, type SeoHttpIssue } from "../probe/seo-http";
import { getSupabaseAdmin } from "../supabase-admin";
import {
  parseRepoConfig,
  runCustomRules,
  type CustomRuleIssue,
} from "./custom-rules";

export type ScanInput = {
  providerToken: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
  repoIdInDb: string;
  commit?: string;
  triggeredByUser?: string;
};

export type ScanResult = {
  scanId: string;
  status: "completed" | "failed";
  scoreEdith: number;
  scoreTest: number;
  scoreDebt: number;
  dimensionScores: Record<Dimension, number>;
  durationMs: number;
  issues: Array<V0Issue | V1Issue | V2Issue | V3Issue | V4Issue | AiIssue | SecretIssue | CustomRuleIssue | SeoIssue | DepIssue | SeoHttpIssue>;
  fileCount: number;
  detectedTools: string[];
  errorMessage?: string;
};

async function ghHeadCommit(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<{ sha: string; message: string } | null> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${branch}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "edith-scanner",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const j = (await res.json()) as { sha: string; commit: { message: string } };
  return { sha: j.sha.slice(0, 7), message: j.commit.message.split("\n")[0] };
}

export async function runScan(input: ScanInput): Promise<ScanResult> {
  const startedAt = Date.now();
  const branch = input.defaultBranch ?? "main";

  const head =
    (await ghHeadCommit(input.providerToken, input.owner, input.repo, branch)) ??
    { sha: input.commit ?? "unknown", message: "" };

  const { id: scanId } = await dbCreateScan({
    repoId: input.repoIdInDb,
    commit: head.sha,
    branch,
    commitMessage: head.message,
    triggeredBy: "manual",
    triggeredByUser: input.triggeredByUser,
  });

  try {
    // 1. Fetch the repo's scannable files (TS/TSX + SQL + configs).
    const { files, truncated } = await fetchScannableFiles(
      input.providerToken,
      input.owner,
      input.repo,
      head.sha,
    );

    // 2. Build the ts-morph project for AST checks.
    const project = createRepoProject(files);

    // 3. Run all check registries (v0 regex + v1 AST + v2/v3 deep + AI + secrets + custom).
    const v0Issues = await runV0Checks({ files });
    const v1Issues = runV1Checks(project);
    const v2Issues = runV2Checks(project, files);
    const v3Issues = runV3Checks(project, files);
    const v4Issues = runV4Checks(project, files);
    const aiIssues = runAiPatternChecks(project);
    const secretIssues = runSecretChecks(files);
    const seoIssues = runSeoRepoChecks(project, files);
    const depIssues = runDependencyChecks(files);
    const config = parseRepoConfig(files);
    const customIssues = config
      ? await runCustomRules({ files, config })
      : [];

    // Live SEO probe — only if the repo has live_url set. Adds 10-30s to
    // the scan and emits live HTTP / multi-page / image / AI-conventions
    // issues. We persist the full report into seo_http_signals for the
    // /seo dashboard.
    const liveSeoIssues = await runLiveSeoProbe(input.repoIdInDb, scanId);

    const allIssues = [
      ...v0Issues,
      ...v1Issues,
      ...v2Issues,
      ...v3Issues,
      ...v4Issues,
      ...aiIssues,
      ...secretIssues,
      ...seoIssues,
      ...depIssues,
      ...liveSeoIssues,
      ...customIssues,
    ];
    const detectedTools = detectAiTools(project);

    // 4. Score.
    const { scoreEdith, scoreTest, scoreDebt, dimensionScores } = computeScores(
      allIssues,
    );

    // 5. Persist.
    await dbInsertIssues({
      scanId,
      repoId: input.repoIdInDb,
      issues: allIssues.map((i) => ({
        checkId: i.checkId,
        severity: i.severity,
        dimension: i.dimension,
        title: i.title,
        description: i.description,
        filePath: i.filePath,
        lineNumber: i.lineNumber,
        codeSnippet: i.codeSnippet,
      })),
    });
    const durationMs = Date.now() - startedAt;
    await dbFinishScan({
      scanId,
      scoreEdith,
      scoreTest,
      scoreDebt,
      dimensionScores,
      durationMs,
      status: "completed",
    });

    // Drift: compare to previous scan + persist alerts.
    try {
      const { computeDriftForRepo, persistDriftAlerts } = await import(
        "../drift"
      );
      const { alerts } = await computeDriftForRepo(input.repoIdInDb);
      await persistDriftAlerts(input.repoIdInDb, alerts);
    } catch (err) {
      console.warn("[scanner] drift compute failed:", err);
    }

    if (truncated) {
      console.log(
        `[scanner] ${input.owner}/${input.repo} was truncated; only first 400 files scanned`,
      );
    }

    return {
      scanId,
      status: "completed",
      scoreEdith,
      scoreTest,
      scoreDebt,
      dimensionScores,
      durationMs,
      issues: allIssues,
      fileCount: files.length,
      detectedTools,
    };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorMessage = err instanceof Error ? err.message : String(err);
    await dbFinishScan({
      scanId,
      scoreEdith: 0,
      scoreTest: 0,
      scoreDebt: 0,
      dimensionScores: emptyDimScores(),
      durationMs,
      status: "failed",
      errorMessage,
    }).catch(() => undefined);
    return {
      scanId,
      status: "failed",
      scoreEdith: 0,
      scoreTest: 0,
      scoreDebt: 0,
      dimensionScores: emptyDimScores(),
      durationMs,
      issues: [],
      fileCount: 0,
      detectedTools: [],
      errorMessage,
    };
  }
}

/**
 * Looks up the repo's live_url + org_id. If present, runs probeLiveSeo()
 * and persists the report into seo_http_signals. Returns the issues so
 * the caller can include them in the scan's issue list.
 *
 * Failure-soft: any error returns an empty list rather than aborting the scan.
 */
async function runLiveSeoProbe(
  repoIdInDb: string,
  scanId: string,
): Promise<SeoHttpIssue[]> {
  try {
    const admin = getSupabaseAdmin();
    const { data: repo } = await admin
      .from("repositories")
      .select("live_url, org_id")
      .eq("id", repoIdInDb)
      .maybeSingle();
    type R = { live_url: string | null; org_id: string } | null;
    const row = repo as R;
    if (!row?.live_url) return [];

    const report = await probeLiveSeo(row.live_url);

    await admin
      .from("seo_http_signals")
      .insert({
        org_id: row.org_id,
        scan_id: scanId,
        base_url: report.baseUrl,
        home_status: report.homeStatus,
        home_headers: report.homeHeaders,
        robots_status: report.robotsTxt.status,
        robots_body: report.robotsTxt.body ?? null,
        sitemap_status: report.sitemap.status,
        sitemap_urls_found: report.sitemap.urlsFound,
        internal_crawl_checked: report.internalCrawl.checked,
        internal_crawl_broken: report.internalCrawl.broken,
        parsed_head: report.parsedHead,
        issues: report.issues,
        fetched_at: report.fetchedAt,
      })
      .then(
        () => undefined,
        () => undefined,
      );

    return report.issues;
  } catch (err) {
    console.warn("[scanner] live SEO probe failed:", err);
    return [];
  }
}

function emptyDimScores(): Record<Dimension, number> {
  return {
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
  };
}

const SEVERITY_WEIGHT = { critical: 15, high: 8, medium: 4, low: 1 } as const;
// Mirrors lib/mock-data.ts DIMENSION_WEIGHTS. Kept inline to avoid a circular import.
const DIM_WEIGHT: Record<Dimension, number> = {
  security: 0.20,
  ai_surface: 0.15,
  data_safety: 0.15,
  reliability: 0.13,
  business_logic: 0.10,
  performance: 0.08,
  deploy_readiness: 0.07,
  accessibility: 0.05,
  dependencies: 0.04,
  seo: 0.03,
};

function computeScores(
  issues: Array<V0Issue | V1Issue | V2Issue | V3Issue | V4Issue | AiIssue | SecretIssue | CustomRuleIssue | SeoIssue | DepIssue | SeoHttpIssue>,
) {
  const dimensionScores = emptyDimScores();
  (Object.keys(DIM_WEIGHT) as Dimension[]).forEach((d) => {
    const dimIssues = issues.filter((i) => i.dimension === d);
    const penalty = dimIssues.reduce(
      (s, i) => s + SEVERITY_WEIGHT[i.severity],
      0,
    );
    dimensionScores[d] = Math.max(0, Math.min(100, 100 - penalty));
  });
  const scoreEdith = Math.round(
    (Object.keys(DIM_WEIGHT) as Dimension[]).reduce(
      (s, d) => s + dimensionScores[d] * DIM_WEIGHT[d],
      0,
    ),
  );
  const scoreTest = Math.max(
    0,
    100 - issues.filter((i) => i.severity === "critical").length * 12,
  );
  const scoreDebt = Math.max(0, 100 - issues.length * 3);
  return { scoreEdith, scoreTest, scoreDebt, dimensionScores };
}
