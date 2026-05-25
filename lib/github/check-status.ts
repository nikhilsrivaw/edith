/**
 * Posts a "check run" on a PR commit for the Quality Gate.
 *
 * GitHub shows this as a ✓ / × / ⏳ next to the commit in the PR view.
 * Branch protection rules can require this check to pass before merge.
 */
import "server-only";
import type { Octokit } from "@octokit/rest";

export async function postCheckRun(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    headSha: string;
    name: string;
    status: "queued" | "in_progress" | "completed";
    conclusion?:
      | "success"
      | "failure"
      | "neutral"
      | "cancelled"
      | "timed_out"
      | "action_required";
    summary?: string;
    text?: string;
    existingRunId?: number;
  },
): Promise<{ id: number }> {
  if (args.existingRunId) {
    const res = await octokit.rest.checks.update({
      owner: args.owner,
      repo: args.repo,
      check_run_id: args.existingRunId,
      status: args.status,
      conclusion: args.conclusion,
      completed_at:
        args.status === "completed" ? new Date().toISOString() : undefined,
      output: {
        title: args.name,
        summary: args.summary ?? "",
        text: args.text,
      },
    });
    return { id: res.data.id };
  }

  const res = await octokit.rest.checks.create({
    owner: args.owner,
    repo: args.repo,
    name: args.name,
    head_sha: args.headSha,
    status: args.status,
    conclusion: args.conclusion,
    started_at: new Date().toISOString(),
    completed_at:
      args.status === "completed" ? new Date().toISOString() : undefined,
    output: {
      title: args.name,
      summary: args.summary ?? "",
      text: args.text,
    },
  });
  return { id: res.data.id };
}
