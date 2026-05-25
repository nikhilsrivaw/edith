/**
 * Posts inline review comments on a PR — one per issue whose file+line
 * falls inside the diff. Uses GitHub's "pulls.createReview" with comments[].
 *
 * Comments outside the diff are dropped (GitHub rejects them). The summary
 * comment (pr-summary.ts) is the catch-all for those.
 */
import "server-only";
import type { Octokit } from "@octokit/rest";
import type { Dimension, Severity } from "@/lib/mock-data";

type Issue = {
  severity: Severity;
  dimension: Dimension;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
};

type DiffFile = {
  filename: string;
  patch?: string;
};

export async function postInlineComments(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    prNumber: number;
    headSha: string;
    issues: Issue[];
  },
): Promise<void> {
  // Fetch the PR's changed files so we know which lines are diff-anchored.
  const files: DiffFile[] = await octokit.paginate(
    octokit.rest.pulls.listFiles,
    {
      owner: args.owner,
      repo: args.repo,
      pull_number: args.prNumber,
      per_page: 100,
    },
  );

  const diffLines = buildDiffLineSet(files);

  const comments: Array<{
    path: string;
    line: number;
    body: string;
    side: "RIGHT";
  }> = [];

  for (const issue of args.issues) {
    if (!issue.lineNumber) continue;
    const set = diffLines.get(issue.filePath);
    if (!set || !set.has(issue.lineNumber)) continue;
    comments.push({
      path: issue.filePath,
      line: issue.lineNumber,
      side: "RIGHT",
      body: renderIssueComment(issue),
    });
    if (comments.length >= 30) break; // never spam more than 30 inline comments
  }

  if (comments.length === 0) return;

  await octokit.rest.pulls.createReview({
    owner: args.owner,
    repo: args.repo,
    pull_number: args.prNumber,
    commit_id: args.headSha,
    event: "COMMENT",
    body: "<!-- edith-inline -->",
    comments,
  });
}

function renderIssueComment(issue: Issue): string {
  const sev = {
    critical: "🔴 **CRITICAL**",
    high: "🟠 **HIGH**",
    medium: "🟡 **MEDIUM**",
    low: "⚪ **LOW**",
  }[issue.severity];
  return `${sev} — ${issue.title}

${issue.description}

<sub>Reply with \`@edith fix\` to have EDITH draft a fix prompt for your editor.</sub>`;
}

/**
 * Parse PR patches to know which `RIGHT`-side line numbers are anchorable.
 * GitHub PR review comments only attach to lines IN the diff.
 */
function buildDiffLineSet(files: DiffFile[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const f of files) {
    if (!f.patch) continue;
    const lines = new Set<number>();
    // Parse hunk headers: @@ -a,b +c,d @@
    const hunkRe = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
    let currentRight = 0;
    for (const ln of f.patch.split("\n")) {
      const m = ln.match(hunkRe);
      if (m) {
        currentRight = parseInt(m[1], 10);
        continue;
      }
      if (ln.startsWith("+") && !ln.startsWith("+++")) {
        lines.add(currentRight);
        currentRight++;
      } else if (ln.startsWith(" ")) {
        currentRight++;
      }
      // lines starting with "-" don't advance currentRight
    }
    out.set(f.filename, lines);
  }
  return out;
}
