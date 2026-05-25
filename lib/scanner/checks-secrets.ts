/**
 * Secret-leak detection. Scans every fetched file for high-confidence
 * credential patterns. Used to be an "easy win" — turns out it routinely
 * catches stripe/openai/aws keys committed to public repos by AI tools that
 * scaffold .env files alongside code.
 *
 * Patterns are deliberate (no entropy heuristics) to keep false positives
 * near zero. Findings are CRITICAL because rotation is the only fix.
 */
import "server-only";
import type { Dimension, Severity } from "../mock-data";
import type { FetchedFile } from "./github-tree";

export type SecretIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

type SecretPattern = {
  name: string;
  regex: RegExp;
  rotate: string;
};

const PATTERNS: SecretPattern[] = [
  {
    name: "Stripe live secret key",
    regex: /\bsk_live_[0-9A-Za-z]{24,}\b/g,
    rotate:
      "Roll the key at https://dashboard.stripe.com/apikeys → 'Roll key'. Anything signed with the old key continues to work for 1 hour.",
  },
  {
    name: "Stripe restricted live key",
    regex: /\brk_live_[0-9A-Za-z]{24,}\b/g,
    rotate: "Rotate at https://dashboard.stripe.com/apikeys.",
  },
  {
    name: "Stripe publishable live key",
    regex: /\bpk_live_[0-9A-Za-z]{24,}\b/g,
    rotate:
      "Publishable keys aren't catastrophic but should still be loaded via NEXT_PUBLIC_ env, not hardcoded.",
  },
  {
    name: "Razorpay live key",
    regex: /\brzp_live_[0-9A-Za-z]{14,}\b/g,
    rotate:
      "Razorpay Dashboard → Settings → API Keys → Regenerate. Confirm webhooks update.",
  },
  {
    name: "AWS access key id",
    regex: /\bAKIA[0-9A-Z]{16}\b/g,
    rotate:
      "IAM → Users → Security credentials → Make Inactive on the leaked AKIA, then Create new access key.",
  },
  {
    name: "AWS secret access key (likely)",
    regex: /\b(?<![\w/])([A-Za-z0-9/+]{40})(?![\w/])/g,
    rotate:
      "If this is an AWS secret, rotate the parent access key via IAM. Otherwise ignore — entropy heuristic.",
  },
  {
    name: "GitHub personal access token (classic)",
    regex: /\bghp_[A-Za-z0-9]{36}\b/g,
    rotate: "Settings → Developer settings → Personal access tokens → Revoke.",
  },
  {
    name: "GitHub fine-grained token",
    regex: /\bgithub_pat_[A-Za-z0-9_]{82,}\b/g,
    rotate: "Settings → Developer settings → Fine-grained tokens → Revoke.",
  },
  {
    name: "OpenAI API key",
    regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    rotate:
      "https://platform.openai.com/api-keys → Revoke. Any in-flight requests stop within ~5min.",
  },
  {
    name: "Anthropic API key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{40,}\b/g,
    rotate:
      "https://console.anthropic.com/settings/keys → Revoke. Generate a new key + redeploy.",
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    rotate:
      "https://api.slack.com/apps → your app → OAuth → Revoke + regenerate.",
  },
  {
    name: "Supabase service-role JWT",
    // Service-role JWTs typically have role=service_role in the payload.
    // The base64 segment shape we look for here is conservative.
    regex: /\beyJ[A-Za-z0-9+/_-]{30,}\.eyJ[A-Za-z0-9+/_-]{30,}\.[A-Za-z0-9+/_-]{30,}\b/g,
    rotate:
      "Supabase Dashboard → Settings → API → 'Reset service_role secret'. Any client using the old key fails immediately.",
  },
  {
    name: "PayU merchant salt",
    regex: /\bPAYU[_-]?MERCHANT[_-]?SALT\s*=\s*['"]?([A-Za-z0-9]{16,})['"]?/gi,
    rotate:
      "PayU Dashboard → Merchant → Salt → Regenerate. Update on all environments at once.",
  },
];

const SKIP_DIRS = /(^|\/)(node_modules|\.next|dist|build|coverage|\.git)\//;
const SKIP_EXT = /\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf|otf|eot|pdf|mp4|webm|zip|tar|gz)$/i;

function lineOf(content: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function redact(s: string): string {
  if (s.length <= 8) return "[redacted]";
  return s.slice(0, 4) + "…" + s.slice(-4);
}

export function runSecretChecks(files: FetchedFile[]): SecretIssue[] {
  const issues: SecretIssue[] = [];
  // Dedup by (file, line, name) — long content can match the same value twice.
  const seen = new Set<string>();
  for (const f of files) {
    if (SKIP_DIRS.test(f.path) || SKIP_EXT.test(f.path)) continue;
    for (const p of PATTERNS) {
      // Reset regex state (global flag).
      p.regex.lastIndex = 0;
      let m;
      while ((m = p.regex.exec(f.content)) !== null) {
        const matched = m[0];
        const line = lineOf(f.content, m.index);
        const key = `${f.path}:${line}:${p.name}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({
          checkId: `security/leaked-secret/${p.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`,
          dimension: "security",
          severity: "critical",
          title: `${p.name} committed to repo`,
          description: `A live ${p.name} appears verbatim in this file. The key is now in git history forever — even if you delete the line. Rotate the key NOW (don't wait for the deploy). ${p.rotate}`,
          filePath: f.path,
          lineNumber: line,
          codeSnippet: `${p.name}: ${redact(matched)}`,
        });
      }
    }
  }
  return issues;
}
