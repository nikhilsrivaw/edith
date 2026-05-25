/**
 * EDITH SEO PR comment.
 *
 * Posts a sticky top-level comment on the PR with:
 *   – Current SEO score + delta vs. base
 *   – New SEO issues introduced by this PR
 *   – SEO issues resolved by this PR
 *   – Block-merge banner if score dropped > 8 points
 *
 * Separate from pr-summary.ts on purpose — SEO is a distinct discipline
 * and reviewers want to scan it independently of security/perf findings.
 */
import "server-only";
import type { Octokit } from "@octokit/rest";
import type { Severity } from "@/lib/mock-data";

const MARKER = "<!-- edith-seo-summary -->";
const BLOCK_THRESHOLD = 8;

type SeoIssueLite = {
  checkId: string;
  severity: Severity;
  title: string;
  filePath: string;
  lineNumber?: number;
};

export type SeoDelta = {
  score: number;
  baseScore: number | null;
  newIssues: SeoIssueLite[];
  resolvedIssues: SeoIssueLite[];
  subGrades: Record<string, number>;
};

const SEV_EMOJI: Record<Severity, string> = {
  critical: "🛑",
  high: "⚠️",
  medium: "🟡",
  low: "·",
};

const SUB_DIM_LABEL: Record<string, string> = {
  technical_foundation: "Technical Foundation",
  core_web_vitals: "Core Web Vitals",
  content_structure: "Content Structure",
  indexability: "Indexability",
  discoverability: "Discoverability",
  ai_readiness: "AI Readiness",
};

export async function postSeoPrComment(
  octokit: Octokit,
  args: {
    owner: string;
    repo: string;
    prNumber: number;
    scanId: string;
    appUrl: string; // e.g. https://edith.expert — for "View full report" links
    delta: SeoDelta;
  },
): Promise<void> {
  const body = renderBody(args);

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

function renderBody(args: {
  scanId: string;
  appUrl: string;
  delta: SeoDelta;
}): string {
  const { delta } = args;
  const sign = delta.baseScore == null
    ? ""
    : delta.score > delta.baseScore
      ? `+${delta.score - delta.baseScore}`
      : delta.score < delta.baseScore
        ? `${delta.score - delta.baseScore}`
        : "±0";

  const grade =
    delta.score >= 90
      ? "A"
      : delta.score >= 75
        ? "B"
        : delta.score >= 60
          ? "C"
          : delta.score >= 40
            ? "D"
            : "F";

  const dropMagnitude =
    delta.baseScore != null ? delta.baseScore - delta.score : 0;
  const isBlocking = dropMagnitude > BLOCK_THRESHOLD;

  const lines: string[] = [];
  lines.push(MARKER);
  lines.push("");
  lines.push("## 👓 EDITH SEO");
  lines.push("");
  lines.push(
    `**Score**: ${delta.score}/100 (${grade}) ${sign ? `· **Δ ${sign}** vs base` : ""}`,
  );

  if (isBlocking) {
    lines.push("");
    lines.push(
      `> 🛑 **Merge blocked**: SEO score dropped ${dropMagnitude} points (threshold ${BLOCK_THRESHOLD}). Review the new issues below or add the \`seo-skip\` label to override.`,
    );
  }

  // Sub-grade bar
  const subOrder = [
    "technical_foundation",
    "core_web_vitals",
    "content_structure",
    "indexability",
    "discoverability",
    "ai_readiness",
  ];
  lines.push("");
  lines.push("| Sub-grade | Score |");
  lines.push("|---|---:|");
  for (const k of subOrder) {
    const v = delta.subGrades[k] ?? 0;
    const tone = v >= 75 ? "🟢" : v >= 50 ? "🟡" : "🔴";
    lines.push(`| ${SUB_DIM_LABEL[k] ?? k} | ${tone} ${v}/100 |`);
  }

  // New issues
  if (delta.newIssues.length > 0) {
    lines.push("");
    lines.push(`### 🆕 New SEO issues (${delta.newIssues.length})`);
    lines.push("");
    for (const i of delta.newIssues.slice(0, 12)) {
      const loc = i.lineNumber
        ? `\`${i.filePath}:${i.lineNumber}\``
        : `\`${i.filePath}\``;
      lines.push(`- ${SEV_EMOJI[i.severity]} **${i.title}** — ${loc}`);
    }
    if (delta.newIssues.length > 12) {
      lines.push(`- _…and ${delta.newIssues.length - 12} more_`);
    }
  }

  // Resolved
  if (delta.resolvedIssues.length > 0) {
    lines.push("");
    lines.push(`### ✅ Resolved (${delta.resolvedIssues.length})`);
    lines.push("");
    for (const i of delta.resolvedIssues.slice(0, 8)) {
      lines.push(`- ${i.title}`);
    }
    if (delta.resolvedIssues.length > 8) {
      lines.push(`- _…and ${delta.resolvedIssues.length - 8} more_`);
    }
  }

  if (delta.newIssues.length === 0 && delta.resolvedIssues.length === 0) {
    lines.push("");
    lines.push("_No SEO changes detected in this PR._");
  }

  lines.push("");
  lines.push(
    `<sub>[View full report](${args.appUrl}/seo) · scan \`${args.scanId.slice(0, 8)}\` · EDITH SEO is opt-out via \`seo-skip\` label</sub>`,
  );

  return lines.join("\n");
}
