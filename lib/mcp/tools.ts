/**
 * EDITH's MCP tool surface.
 *
 * Each tool is a thin wrapper over the same data layer the dashboard uses.
 * Output is plain text formatted for an LLM's token window (markdown,
 * bullets, file:line citations).
 */
import "server-only";
import { getSupabaseAdmin } from "../supabase-admin";
import { getOrGenerateFixPrompt, type AiTool } from "../claude";
import { getOrGenerateTest } from "../test-gen";
import { validatePlan } from "../plan-validator";
import type { ToolSchema, ToolCallResult } from "./protocol";
import type { AuthedToken } from "./auth";

/* =============== Schemas =============== */

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    name: "edith_list_repos",
    description:
      "List repositories this account has connected to EDITH. Returns repo name, owner, latest EDITH score, and counts of open critical/high issues.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "edith_get_issues",
    description:
      "Get the open issues for a repo from its latest completed scan. Optionally filter by severity. Returns a numbered list with file:line and issue id (use the id for edith_get_fix_prompt).",
    inputSchema: {
      type: "object",
      properties: {
        repo: {
          type: "string",
          description: "Repo name (e.g. 'checkout-app'). Match against edith_list_repos output.",
        },
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
          description: "Optional severity filter.",
        },
        limit: {
          type: "number",
          description: "Maximum number of issues to return. Default 20.",
        },
      },
      required: ["repo"],
    },
  },
  {
    name: "edith_get_fix_prompt",
    description:
      "Get the Claude-written fix prompt for a specific EDITH issue. Returns a paste-ready prompt for the user's coding agent. Cached after first call.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: {
          type: "string",
          description: "The issue id from edith_get_issues output.",
        },
        tool: {
          type: "string",
          enum: ["cursor", "claude_code", "windsurf", "v0"],
          description: "Target coding agent. Defaults to 'cursor' if omitted.",
        },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "edith_get_regression_test",
    description:
      "Get an auto-generated Vitest regression test for a specific EDITH issue. The test FAILS while the issue exists, PASSES once it's fixed.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "The issue id from edith_get_issues." },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "edith_plan_check",
    description:
      "Pre-code product. Submit a 2-3 paragraph plan describing what the user wants to build. Returns ranked pitfalls + a reinforced prompt the user should paste into their agent INSTEAD of the bare plan.",
    inputSchema: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "The natural-language plan. Min 20 characters.",
        },
      },
      required: ["plan"],
    },
  },
  {
    name: "edith_get_score_trend",
    description:
      "Return the EDITH score over the last N scans for a repo. Useful for 'has this codebase been getting better or worse?' questions.",
    inputSchema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Repo name." },
        limit: { type: "number", description: "Number of scans (default 10)." },
      },
      required: ["repo"],
    },
  },
];

/* =============== Handlers =============== */

type Args = Record<string, unknown>;
type Handler = (args: Args, ctx: AuthedToken) => Promise<ToolCallResult>;

const text = (t: string): ToolCallResult => ({
  content: [{ type: "text", text: t }],
});

const error = (t: string): ToolCallResult => ({
  content: [{ type: "text", text: t }],
  isError: true,
});

const listRepos: Handler = async (_args, ctx) => {
  const admin = getSupabaseAdmin();
  const { data: repos } = await admin
    .from("repositories")
    .select("id, owner, name, default_branch")
    .eq("org_id", ctx.orgId);
  type R = { id: string; owner: string; name: string; default_branch: string };
  const rows = (repos as R[]) ?? [];
  if (rows.length === 0) {
    return text(
      "No repositories connected to EDITH yet. Tell the user to install the EDITH GitHub App at https://github.com/apps/edith-bot-dev",
    );
  }

  // For each repo, fetch the latest scan's score + issue counts.
  const lines: string[] = [`# Connected repositories (${rows.length})`, ""];
  for (const r of rows) {
    const { data: scan } = await admin
      .from("scans")
      .select("id, score_edith, started_at")
      .eq("repo_id", r.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    type S = { id: string; score_edith: number | null; started_at: string | null };
    const s = scan as S | null;
    let critical = 0;
    let high = 0;
    if (s?.id) {
      const { data: issues } = await admin
        .from("issues")
        .select("severity")
        .eq("scan_id", s.id);
      type I = { severity: string };
      for (const i of (issues as I[]) ?? []) {
        if (i.severity === "critical") critical++;
        else if (i.severity === "high") high++;
      }
    }
    lines.push(
      `- **${r.name}** (${r.owner}/${r.name}) — ${
        s?.score_edith !== null && s?.score_edith !== undefined
          ? `EDITH ${s.score_edith}/100`
          : "never scanned"
      } · ${critical} critical · ${high} high`,
    );
  }
  return text(lines.join("\n"));
};

const getIssues: Handler = async (args, ctx) => {
  const repo = String(args.repo ?? "");
  const severity = args.severity ? String(args.severity) : undefined;
  const limit = typeof args.limit === "number" ? args.limit : 20;
  if (!repo) return error("`repo` is required.");

  const admin = getSupabaseAdmin();
  const { data: repoRow } = await admin
    .from("repositories")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("name", repo)
    .maybeSingle();
  if (!repoRow) return error(`Repo '${repo}' not connected to this account.`);
  type RR = { id: string };

  const { data: scan } = await admin
    .from("scans")
    .select("id, commit, score_edith, started_at")
    .eq("repo_id", (repoRow as RR).id)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  type S = {
    id: string;
    commit: string;
    score_edith: number | null;
    started_at: string | null;
  };
  if (!scan) return error(`No completed scans for ${repo}. Run a scan first.`);
  const s = scan as S;

  let q = admin
    .from("issues")
    .select("id, severity, dimension, title, file_path, line_number")
    .eq("scan_id", s.id);
  if (severity) q = q.eq("severity", severity);
  const { data: issues } = await q
    .order("severity", { ascending: true })
    .limit(limit);

  type I = {
    id: string;
    severity: string;
    dimension: string;
    title: string;
    file_path: string;
    line_number: number | null;
  };
  const rows = (issues as I[]) ?? [];
  if (rows.length === 0) {
    return text(
      `No${severity ? ` ${severity}-severity` : ""} issues found in ${repo} (scan ${s.commit}, EDITH ${s.score_edith}/100). Clean!`,
    );
  }
  const lines: string[] = [
    `# ${rows.length} ${severity ? severity + "-severity " : ""}open issue${rows.length === 1 ? "" : "s"} in ${repo} (${s.commit}, EDITH ${s.score_edith}/100)`,
    "",
  ];
  rows.forEach((r, idx) => {
    lines.push(
      `${idx + 1}. **${r.severity.toUpperCase()}** [${r.dimension}] ${r.title}`,
    );
    lines.push(
      `   - location: \`${r.file_path}${r.line_number ? `:${r.line_number}` : ""}\``,
    );
    lines.push(`   - issue_id: \`${r.id}\``);
  });
  lines.push("");
  lines.push(
    `Use \`edith_get_fix_prompt\` with one of these issue_ids to get a paste-ready fix prompt.`,
  );
  return text(lines.join("\n"));
};

const getFixPrompt: Handler = async (args, ctx) => {
  const issueId = String(args.issue_id ?? "");
  const tool = (args.tool ? String(args.tool) : "cursor") as AiTool;
  if (!issueId) return error("`issue_id` is required.");

  const admin = getSupabaseAdmin();
  // Scope check: issue belongs to a repo this org owns.
  const { data: issue } = await admin
    .from("issues")
    .select(
      "id, title, description, severity, dimension, file_path, line_number, code_snippet, repo_id",
    )
    .eq("id", issueId)
    .maybeSingle();
  if (!issue) return error("Issue not found.");
  type IRow = {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    dimension: string;
    file_path: string;
    line_number: number | null;
    code_snippet: string | null;
    repo_id: string;
  };
  const i = issue as IRow;

  const { data: repoRow } = await admin
    .from("repositories")
    .select("id")
    .eq("id", i.repo_id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!repoRow) return error("Issue not accessible by this token's account.");

  const result = await getOrGenerateFixPrompt({
    issueId: i.id,
    tool,
    title: i.title,
    description: i.description ?? "",
    filePath: i.file_path,
    lineNumber: i.line_number ?? undefined,
    codeSnippet: i.code_snippet ?? undefined,
    severity: i.severity,
    dimension: i.dimension,
  });

  return text(
    `# Fix prompt for: ${i.title}\n\nTarget: ${tool} · File: \`${i.file_path}${i.line_number ? `:${i.line_number}` : ""}\`${result.cached ? " · cached" : ""}\n\n---\n\n${result.prompt}`,
  );
};

const getRegressionTest: Handler = async (args, ctx) => {
  const issueId = String(args.issue_id ?? "");
  if (!issueId) return error("`issue_id` is required.");

  const admin = getSupabaseAdmin();
  const { data: issue } = await admin
    .from("issues")
    .select(
      "id, title, description, severity, dimension, file_path, line_number, code_snippet, repo_id",
    )
    .eq("id", issueId)
    .maybeSingle();
  if (!issue) return error("Issue not found.");
  type IRow = {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    dimension: string;
    file_path: string;
    line_number: number | null;
    code_snippet: string | null;
    repo_id: string;
  };
  const i = issue as IRow;

  const { data: repoRow } = await admin
    .from("repositories")
    .select("id")
    .eq("id", i.repo_id)
    .eq("org_id", ctx.orgId)
    .maybeSingle();
  if (!repoRow) return error("Issue not accessible by this token's account.");

  const result = await getOrGenerateTest({
    issueId: i.id,
    title: i.title,
    description: i.description ?? "",
    filePath: i.file_path,
    lineNumber: i.line_number ?? undefined,
    codeSnippet: i.code_snippet ?? undefined,
    severity: i.severity,
    dimension: i.dimension,
  });

  return text(
    `# Regression test for: ${i.title}\n\nPaste into your test suite (vitest):\n\n\`\`\`ts\n${result.test}\n\`\`\``,
  );
};

const planCheck: Handler = async (args) => {
  const plan = String(args.plan ?? "");
  if (plan.length < 20) return error("Plan must be at least 20 characters.");

  const result = await validatePlan({ plan });
  const lines: string[] = [
    `# Plan validation`,
    "",
    `**Summary:** ${result.summary}`,
    "",
    `## ${result.pitfalls.length} pitfall${result.pitfalls.length === 1 ? "" : "s"}`,
    "",
  ];
  result.pitfalls.forEach((p, idx) => {
    lines.push(
      `${idx + 1}. **${p.severity.toUpperCase()}** [${p.category}] ${p.title}`,
    );
    lines.push(`   - why: ${p.why}`);
    lines.push(`   - watch for: ${p.watchFor}`);
    lines.push(`   - prompt addendum: ${p.promptHint}`);
  });
  lines.push("");
  lines.push("---");
  lines.push("## Reinforced prompt");
  lines.push("Paste this into your agent INSTEAD of the bare plan:");
  lines.push("");
  lines.push("```");
  lines.push(plan.trim());
  lines.push("");
  lines.push("Guardrails (from EDITH):");
  result.pitfalls.forEach((p, idx) => {
    lines.push(`${idx + 1}. ${p.promptHint}`);
  });
  lines.push("```");
  return text(lines.join("\n"));
};

const getScoreTrend: Handler = async (args, ctx) => {
  const repo = String(args.repo ?? "");
  const limit = typeof args.limit === "number" ? args.limit : 10;
  if (!repo) return error("`repo` is required.");

  const admin = getSupabaseAdmin();
  const { data: repoRow } = await admin
    .from("repositories")
    .select("id")
    .eq("org_id", ctx.orgId)
    .eq("name", repo)
    .maybeSingle();
  if (!repoRow) return error(`Repo '${repo}' not found in this account.`);
  type RR = { id: string };

  const { data: scans } = await admin
    .from("scans")
    .select("commit, score_edith, started_at")
    .eq("repo_id", (repoRow as RR).id)
    .eq("status", "completed")
    .order("started_at", { ascending: false })
    .limit(limit);
  type S = {
    commit: string;
    score_edith: number | null;
    started_at: string | null;
  };
  const rows = (scans as S[]) ?? [];
  if (rows.length === 0) return text(`No scans for ${repo} yet.`);
  const lines: string[] = [
    `# EDITH score trend — ${repo} (last ${rows.length} scans)`,
    "",
  ];
  rows.reverse().forEach((s) => {
    lines.push(
      `- ${s.started_at?.slice(0, 10) ?? "?"} (${s.commit}) — ${s.score_edith ?? "?"}/100`,
    );
  });
  return text(lines.join("\n"));
};

export const TOOL_HANDLERS: Record<string, Handler> = {
  edith_list_repos: listRepos,
  edith_get_issues: getIssues,
  edith_get_fix_prompt: getFixPrompt,
  edith_get_regression_test: getRegressionTest,
  edith_plan_check: planCheck,
  edith_get_score_trend: getScoreTrend,
};
