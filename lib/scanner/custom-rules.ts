/**
 * Custom Rules Engine (features.md P2 #11).
 *
 * The user commits an `edith.config.json` at the repo root listing their
 * team's natural-language rules. EDITH passes each rule + the codebase
 * summary to Claude and asks "does any code violate this?". Violations
 * land as regular issues.
 *
 * Example edith.config.json:
 * {
 *   "custom_rules": [
 *     "Never commit console.log to main",
 *     "All API routes must have rate limiting",
 *     "No direct DB queries outside /models"
 *   ],
 *   "quality_gate": {
 *     "min_score": 70,
 *     "block_on_critical": true
 *   }
 * }
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import type { FetchedFile } from "./github-tree";
import type { Dimension, Severity } from "../mock-data";

export type RepoConfig = {
  custom_rules?: string[];
  quality_gate?: {
    min_score?: number;
    block_on_critical?: boolean;
    block_on_secrets?: boolean;
  };
};

export type CustomRuleIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

const SYSTEM_PROMPT = `You evaluate a single custom code-review rule against the user's codebase. The user has stated a rule in natural language; you must decide whether the codebase contains violations.

Output strict JSON in this shape:
{
  "violations": [
    {
      "filePath": "app/api/foo/route.ts",
      "lineNumber": 24,
      "title": "1-line summary of the violation",
      "description": "1-2 sentence explanation of WHY this is a violation of the rule",
      "severity": "critical" | "high" | "medium" | "low",
      "codeSnippet": "the specific lines"
    }
  ]
}

Rules:
- 0 to 10 violations per rule. Be conservative — only flag clear violations.
- severity reflects the impact of the violation, not the rule itself.
- Reply with JSON ONLY. No markdown fences, no preamble.`;

let claudeClient: Anthropic | null = null;
function claude(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (claudeClient) return claudeClient;
  claudeClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return claudeClient;
}

export function parseRepoConfig(files: FetchedFile[]): RepoConfig | null {
  const cfg = files.find((f) => f.path === "edith.config.json");
  if (!cfg) return null;
  try {
    return JSON.parse(cfg.content) as RepoConfig;
  } catch {
    return null;
  }
}

/** Build a 4-8k token codebase summary for Claude to reason over. */
function buildCodeContext(files: FetchedFile[]): string {
  const TS = files.filter((f) => /\.(tsx?|jsx?|mjs|cjs)$/.test(f.path));
  // Prefer route handlers + small files first.
  const prioritized = [
    ...TS.filter((f) => /\/route\.tsx?$/.test(f.path)),
    ...TS.filter((f) => !/\/route\.tsx?$/.test(f.path) && f.content.length < 3000),
  ];
  let total = 0;
  const out: string[] = [];
  for (const f of prioritized) {
    if (total > 20_000) break;
    const snippet = f.content.slice(0, 2500);
    out.push(`### ${f.path}\n${snippet}\n`);
    total += snippet.length;
  }
  return out.join("\n");
}

export async function runCustomRules(args: {
  files: FetchedFile[];
  config: RepoConfig;
}): Promise<CustomRuleIssue[]> {
  const rules = args.config.custom_rules ?? [];
  if (rules.length === 0) return [];

  const c = claude();
  if (!c) {
    // Without Claude, we can't evaluate natural-language rules.
    // Emit one "rule-configured" informational issue per rule so the user
    // at least sees their rules registered.
    return rules.map<CustomRuleIssue>((rule, i) => ({
      checkId: `custom_rule/${i + 1}`,
      dimension: "business_logic",
      severity: "low",
      title: `Custom rule registered (LLM not configured): ${rule}`,
      description:
        "EDITH detected this rule in your edith.config.json but ANTHROPIC_API_KEY is not set, so it can't evaluate it. Configure the API key to get violation findings.",
      filePath: "edith.config.json",
      lineNumber: 1,
    }));
  }

  const codeContext = buildCodeContext(args.files);
  const issues: CustomRuleIssue[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    try {
      const res = await c.messages.create({
        model: env.FIX_PROMPT_MODEL,
        max_tokens: 1500,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: `Rule: ${rule}

Codebase:
${codeContext}

Return JSON now.`,
          },
        ],
      });
      const raw = res.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n")
        .trim();
      const json = raw
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/i, "")
        .trim();
      const parsed = JSON.parse(json) as {
        violations: Array<{
          filePath: string;
          lineNumber?: number;
          title: string;
          description: string;
          severity: Severity;
          codeSnippet?: string;
        }>;
      };
      for (const v of parsed.violations ?? []) {
        issues.push({
          checkId: `custom_rule/${i + 1}`,
          dimension: "business_logic",
          severity: v.severity ?? "medium",
          title: `${rule} — ${v.title}`,
          description: v.description ?? "",
          filePath: v.filePath,
          lineNumber: v.lineNumber,
          codeSnippet: v.codeSnippet,
        });
      }
    } catch (err) {
      console.warn(`[custom-rules] rule ${i + 1} failed:`, err);
    }
  }
  return issues;
}
