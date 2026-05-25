/**
 * Posts the EDITH top-level PR summary comment.
 *
 * Strategy: find a previous comment by edith-bot (by marker string) and
 * EDIT it on re-runs (synchronize event) so the PR thread doesn't fill
 * with duplicates. Otherwise create new.
 */
import "server-only";
import type { Octokit } from "@octokit/rest";
import type { Dimension, Severity } from "@/lib/mock-data";

const MARKER = "<!-- edith-summary -->";

type Issue = {
  severity: Severity;
  dimension: Dimension;
  title: string;
  filePath: string;
  lineNumber?: number;
};

export async function postPrSummary(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    prNumber: number;
    scoreEdith: number;
    issues: Issue[];
    scanId: string;
  },
): Promise<void> {
  const body = renderSummaryBody(args);

  // Look for a previous EDITH comment on this PR.
  const existing = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: args.owner,
    repo: args.repo,
    issue_number: args.prNumber,
    per_page: 100,
  });
  const prior = existing.find((c) => c.body?.includes(MARKER));

  if (prior) {
    await octokit.rest.issues.updateComment({
      owner: args.owner,
      repo: args.repo,
      comment_id: prior.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.prNumber,
      body,
    });
  }
}

function renderSummaryBody(args: {
  scoreEdith: number;
  issues: Issue[];
  scanId: string;
}): string {
  const critical = args.issues.filter((i) => i.severity === "critical").length;
  const high = args.issues.filter((i) => i.severity === "high").length;
  const medium = args.issues.filter((i) => i.severity === "medium").length;
  const low = args.issues.filter((i) => i.severity === "low").length;

  const scoreEmoji =
    args.scoreEdith >= 85 ? "🟢" : args.scoreEdith >= 65 ? "🟡" : "🔴";

  // Group top 5 critical/high for the body.
  const top = args.issues
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .slice(0, 5)
    .map(
      (i) =>
        `- **${labelSeverity(i.severity)}** \`${i.filePath}${
          i.lineNumber ? `:${i.lineNumber}` : ""
        }\` — ${i.title}`,
    )
    .join("\n");

  return `${MARKER}
## 👓 EDITH Review

${scoreEmoji} **EDITH Score: ${args.scoreEdith}/100**

| Severity | Count |
|---|---|
| 🔴 Critical | ${critical} |
| 🟠 High | ${high} |
| 🟡 Medium | ${medium} |
| ⚪ Low | ${low} |

${top ? `### Top findings\n${top}\n` : "_No critical or high findings on this PR._"}

[Open full report →](https://edith.expert/r/${args.scanId})

<sub>EDITH is the AI-built-app auditor. Comments above are not blocking unless the Quality Gate rule fires. Reply with \`@edith <question>\` to chat (coming soon).</sub>`;
}

function labelSeverity(s: Severity): string {
  return { critical: "CRITICAL", high: "HIGH", medium: "MEDIUM", low: "LOW" }[s];
}
