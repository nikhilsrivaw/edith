/**
 * Inngest functions for EDITH.
 *
 * Flow:
 *   webhook (push / pull_request) → inngest.send(scan.requested)
 *   scan-repo function runs scan async, emits scan.completed
 *   post-pr-comments listens, posts summary + inline + check-run if it
 *   was a PR-triggered scan.
 */
import { inngest } from "./client";
import { runScan } from "@/lib/scanner/runner";
import { getOctokitForInstallation, hasGithubApp } from "@/lib/github-app";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { postPrSummary } from "@/lib/github/pr-summary";
import { postInlineComments } from "@/lib/github/pr-comments";
import { postCheckRun } from "@/lib/github/check-status";

export const scanRepoFn = inngest.createFunction(
  {
    id: "scan-repo",
    name: "Scan a connected repo",
    retries: 2,
    concurrency: { limit: 5, key: "event.data.repoIdInDb" },
    triggers: [{ event: "edith/scan.requested" }],
  },
  async ({ event, step }) => {
    const {
      repoIdInDb,
      owner,
      repo,
      defaultBranch,
      commit,
      triggeredByUser,
      installationId,
      prNumber,
      prHeadSha,
      checkRunId,
    } = event.data;

    const token = await step.run("get-installation-token", async () => {
      if (!installationId || !hasGithubApp()) {
        throw new Error("installation_id required for async scan");
      }
      const octokit = await getOctokitForInstallation(installationId);
      // @ts-expect-error — auth() returns { token }
      const auth = await octokit.auth({ type: "installation" });
      return auth.token as string;
    });

    const result = await step.run("run-scan", () =>
      runScan({
        providerToken: token,
        owner,
        repo,
        defaultBranch,
        commit,
        repoIdInDb,
        triggeredByUser,
      }),
    );

    await step.sendEvent("scan-completed", {
      name: "edith/scan.completed",
      data: {
        scanId: result.scanId,
        repoId: repoIdInDb,
        scoreEdith: result.scoreEdith,
        owner,
        repo,
        installationId,
        prNumber,
        prHeadSha,
        checkRunId,
      },
    });

    return {
      scanId: result.scanId,
      score: result.scoreEdith,
      status: result.status,
      durationMs: result.durationMs,
    };
  },
);

/**
 * Fired after a scan completes. If the scan was PR-triggered, post the
 * summary + inline comments + finalise the check-run.
 */
export const postPrCommentsFn = inngest.createFunction(
  {
    id: "post-pr-comments",
    name: "Post EDITH review on PR",
    retries: 3,
    triggers: [{ event: "edith/scan.completed" }],
  },
  async ({ event, step }) => {
    const {
      scanId,
      repoId,
      owner,
      repo,
      installationId,
      prNumber,
      prHeadSha,
      checkRunId,
    } = event.data;

    if (!prNumber || !prHeadSha || !installationId) {
      return { skipped: "not a PR-triggered scan" };
    }

    const issues = await step.run("load-issues", async () => {
      const admin = getSupabaseAdmin();
      const { data } = await admin
        .from("issues")
        .select("severity, dimension, title, file_path, line_number, description")
        .eq("scan_id", scanId);
      type R = {
        severity: "critical" | "high" | "medium" | "low";
        dimension: string;
        title: string;
        file_path: string;
        line_number: number | null;
        description: string | null;
      };
      return ((data as R[]) ?? []).map((r) => ({
        severity: r.severity,
        dimension: r.dimension as never,
        title: r.title,
        filePath: r.file_path,
        lineNumber: r.line_number ?? undefined,
        description: r.description ?? "",
      }));
    });

    const octokit = await step.run("get-octokit", async () => {
      return getOctokitForInstallation(installationId);
    });

    await step.run("post-summary", () =>
      postPrSummary(octokit, {
        owner,
        repo,
        prNumber,
        scoreEdith: event.data.scoreEdith,
        issues,
        scanId,
      }),
    );

    await step.run("post-inline", () =>
      postInlineComments(octokit, {
        owner,
        repo,
        prNumber,
        headSha: prHeadSha,
        issues,
      }),
    );

    if (checkRunId) {
      const critical = issues.filter((i) => i.severity === "critical").length;
      const conclusion = critical > 0 ? "failure" : "success";
      await step.run("finalise-check-run", () =>
        postCheckRun(octokit, {
          owner,
          repo,
          headSha: prHeadSha,
          status: "completed",
          conclusion,
          name: "EDITH",
          summary: `EDITH ${event.data.scoreEdith}/100 · ${issues.length} issues (${critical} critical)`,
          existingRunId: checkRunId,
        }),
      );
    }

    void repoId;
    return { posted: true, issueCount: issues.length };
  },
);

export const functions = [scanRepoFn, postPrCommentsFn];
