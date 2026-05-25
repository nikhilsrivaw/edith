/**
 * AI-pattern checks — Wedge 1.
 *
 * Specific failure modes that AI coding tools (Cursor, Claude Code, Windsurf,
 * v0, Lovable, Bolt) introduce. These are NOT generic best-practice lints;
 * they're patterns we've observed AI tools producing.
 *
 * Each check returns CheckIssue[] like checks-v0/v1.
 */
import "server-only";
import { Node } from "ts-morph";
import type { Dimension, Severity } from "../mock-data";
import type { RepoProject } from "./project";

export type AiIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

const rel = (p: string) => (p.startsWith("/") ? p.slice(1) : p);
const lineOf = (sf: ReturnType<RepoProject["project"]["getSourceFiles"]>[number], pos: number) => {
  try {
    return sf.getLineAndColumnAtPos(pos).line;
  } catch {
    return 1;
  }
};

/* 1. Empty catch — AI's go-to "make the error go away" pattern. */
function checkSilentCatches(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCatchClause(node)) return;
      const block = node.getBlock();
      const body = block.getStatements();
      // Empty catch
      const isEmpty = body.length === 0;
      // catch with only a `return ...` — silent failure
      const isOnlyReturn =
        body.length === 1 && Node.isReturnStatement(body[0]);
      if (!isEmpty && !isOnlyReturn) return;
      issues.push({
        checkId: "ai_pattern/silent-catch",
        dimension: "reliability",
        severity: "high",
        title: isEmpty
          ? "Empty catch block silently swallows errors"
          : "Catch block returns without logging or rethrowing",
        description: isEmpty
          ? "Empty catch blocks are a classic AI-tool tell — when the model isn't sure what error could occur, it inserts `catch {}` to make the type checker happy. The original error is lost; debugging in production is impossible."
          : "The catch immediately returns without logging the error or re-throwing. The caller sees a normal return path even when something went wrong.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: node.getText().slice(0, 200),
      });
    });
  }
  return issues;
}

/* 2. Default exports placeholders (e.g. `export default function Page() { return <div /> }`). */
function checkPlaceholderPages(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/.+\/page\.tsx?$/.test(path)) continue;
    const text = sf.getFullText();
    // Heuristic: page is <50 lines AND contains "TODO" or returns empty div or "lorem"
    if (text.length > 2000) continue;
    const looksPlaceholder =
      /\bTODO\b|lorem|placeholder|coming soon|<div\s*\/>/i.test(text);
    if (!looksPlaceholder) continue;
    issues.push({
      checkId: "ai_pattern/placeholder-page",
      dimension: "deploy_readiness",
      severity: "low",
      title: "Page looks like an AI-generated placeholder",
      description:
        "This page is short and contains common placeholder markers (TODO, lorem, empty div, 'coming soon'). AI scaffolds tend to leave these behind after a session ends. Either implement or delete before deploying.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return issues;
}

/* 3. Stub API routes — `route.ts` that returns NextResponse.json({}) or echoes the request. */
function checkStubRoutes(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^app\/api\/.+\/route\.tsx?$/.test(path)) continue;
    const text = sf.getFullText();
    if (text.length > 800) continue;
    // Looks like a stub if it just returns an empty object or echoes the body.
    if (
      /NextResponse\.json\(\s*\{\s*\}\s*\)/.test(text) ||
      /NextResponse\.json\(\s*\{\s*ok:\s*true\s*\}\s*\)/.test(text)
    ) {
      issues.push({
        checkId: "ai_pattern/stub-route",
        dimension: "deploy_readiness",
        severity: "medium",
        title: "Route handler looks like an AI stub",
        description:
          "Handler is short and returns `{ ok: true }` or `{}`. AI tools generate stubs like this when they're not given the full requirement. Verify this isn't shipping with the actual logic missing.",
        filePath: path,
        lineNumber: 1,
      });
    }
  }
  return issues;
}

/* 4. Unused imports — small signal but a strong AI fingerprint. */
function checkUnusedImports(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    if (/\/(test|tests)\//.test(sf.getFilePath())) continue;
    for (const imp of sf.getImportDeclarations()) {
      const named = imp.getNamedImports();
      if (named.length === 0) continue;
      for (const n of named) {
        const symbol = n.getNameNode();
        const refs = symbol
          .findReferencesAsNodes()
          .filter((r) => r !== symbol);
        if (refs.length === 0) {
          issues.push({
            checkId: "ai_pattern/unused-import",
            dimension: "deploy_readiness",
            severity: "low",
            title: `Unused import: ${n.getName()}`,
            description: `Import \`${n.getName()}\` from \`${imp.getModuleSpecifierValue()}\` is never used. AI tools often add imports speculatively while exploring a plan, then forget to remove them.`,
            filePath: rel(sf.getFilePath()),
            lineNumber: lineOf(sf, imp.getStart()),
            codeSnippet: imp.getText(),
          });
        }
      }
    }
  }
  return issues;
}

/* 5. "fixme" / "fix later" / "this is temporary" comments. */
function checkTempComments(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  const re = /\b(FIXME|XXX|HACK|TEMP(?:ORARY)?|REMOVE BEFORE|FIX LATER)\b/i;
  for (const f of ctx.tsFiles) {
    const lines = f.content.split("\n");
    lines.forEach((ln, i) => {
      if (re.test(ln) && /\/\//.test(ln)) {
        issues.push({
          checkId: "ai_pattern/temp-comment",
          dimension: "deploy_readiness",
          severity: "low",
          title: "Temporary/FIXME comment left in code",
          description:
            "Comments like FIXME, HACK, TEMP, or 'remove before' suggest unfinished work. AI sessions often leave these as breadcrumbs that humans forget about.",
          filePath: rel(f.path),
          lineNumber: i + 1,
          codeSnippet: ln.trim().slice(0, 200),
        });
      }
    });
  }
  return issues;
}

/* 6. console.log left in production code. */
function checkConsoleLog(ctx: RepoProject): AiIssue[] {
  const issues: AiIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (/\/(test|tests|scripts)\//.test(path)) continue;
    // Skip server-only handler/logger files.
    if (/\/lib\/log\b/.test(path)) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const text = node.getExpression().getText();
      if (text !== "console.log" && text !== "console.debug") return;
      issues.push({
        checkId: "ai_pattern/console-log",
        dimension: "deploy_readiness",
        severity: "low",
        title: `\`${text}\` in production code`,
        description: `AI scaffolds tend to use console.log liberally during development. Each call ships to your Vercel logs in production, often with sensitive data attached. Replace with a structured logger or remove.`,
        filePath: path,
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: node.getText().slice(0, 200),
      });
    });
  }
  return issues;
}

export function runAiPatternChecks(ctx: RepoProject): AiIssue[] {
  return [
    ...checkSilentCatches(ctx),
    ...checkPlaceholderPages(ctx),
    ...checkStubRoutes(ctx),
    ...checkUnusedImports(ctx),
    ...checkTempComments(ctx),
    ...checkConsoleLog(ctx),
  ];
}

/* ============================================================ */
/* AI tool fingerprinting — best-effort detection from artifacts */
/* ============================================================ */

export type DetectedAiTool = "cursor" | "claude_code" | "windsurf" | "v0" | "lovable" | "bolt";

export function detectAiTools(ctx: RepoProject): DetectedAiTool[] {
  const tools = new Set<DetectedAiTool>();
  for (const f of ctx.fileMap.values()) {
    const path = f.path.toLowerCase();
    if (/\.cursor\//.test(path) || /cursorrules/.test(path)) tools.add("cursor");
    if (/\.claude\//.test(path) || /claude\.md$/.test(path))
      tools.add("claude_code");
    if (/\.windsurf\//.test(path)) tools.add("windsurf");
    if (/lovable\.dev/i.test(f.content)) tools.add("lovable");
    if (/v0\.dev/i.test(f.content) || /\bvercel\/v0\b/i.test(f.content))
      tools.add("v0");
    if (/bolt\.new/i.test(f.content)) tools.add("bolt");
  }
  return [...tools];
}
