/**
 * Auto Documentation (features.md P2 #10).
 *
 * Finds exported functions/types that lack a leading JSDoc block, asks
 * Claude to write a short docstring for each, returns the suggestions.
 *
 * Used by the PR handler to post inline review suggestions on undocumented
 * exports. Limited to N suggestions per PR to avoid spam.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { Node, SyntaxKind } from "ts-morph";
import type { RepoProject } from "./scanner/project";
import { env } from "./env";

export type DocSuggestion = {
  filePath: string;
  lineNumber: number;
  /** The original line so the caller can attach to the diff. */
  originalLine: string;
  /** What we'd suggest prepending. */
  suggestion: string;
  symbolName: string;
};

const MAX_PER_PR = 5;

const SYSTEM_PROMPT = `You write a single JSDoc block for one exported TypeScript symbol. Style: 1-3 lines, present tense, no @param/@returns unless useful, no fluff. Output ONLY the JSDoc block (starting with /** and ending with */). No surrounding code, no explanation.`;

let claudeClient: Anthropic | null = null;
function claude(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (claudeClient) return claudeClient;
  claudeClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return claudeClient;
}

export async function findUndocumentedExports(
  project: RepoProject,
): Promise<DocSuggestion[]> {
  const out: DocSuggestion[] = [];
  for (const sf of project.project.getSourceFiles()) {
    const path = sf.getFilePath().replace(/^\//, "");
    // Skip tests, node_modules, generated.
    if (/\/(node_modules|\.next|dist|build|test|tests)\//.test(path)) continue;
    if (out.length >= MAX_PER_PR) break;

    sf.forEachChild((node) => {
      if (out.length >= MAX_PER_PR) return;
      let name: string | undefined;
      let line = 0;
      if (
        Node.isFunctionDeclaration(node) &&
        node.isExported() &&
        node.getName()
      ) {
        name = node.getName()!;
        line = sf.getLineAndColumnAtPos(node.getStart()).line;
      } else if (
        Node.isVariableStatement(node) &&
        node.isExported()
      ) {
        const d = node.getDeclarations()[0];
        if (
          d &&
          (Node.isArrowFunction(d.getInitializer() ?? node) ||
            Node.isFunctionExpression(d.getInitializer() ?? node))
        ) {
          name = d.getName();
          line = sf.getLineAndColumnAtPos(node.getStart()).line;
        }
      }
      if (!name) return;

      // Check for an immediately-preceding JSDoc comment.
      const jsdocs = (
        node as unknown as { getJsDocs?: () => unknown[] }
      ).getJsDocs?.();
      if (jsdocs && jsdocs.length > 0) return;

      const lineText = sf.getFullText().split("\n")[line - 1] ?? "";
      out.push({
        filePath: path,
        lineNumber: line,
        originalLine: lineText,
        suggestion: "", // filled below
        symbolName: name,
      });
      void SyntaxKind;
    });
  }
  return out;
}

export async function generateDocstrings(
  project: RepoProject,
  suggestions: DocSuggestion[],
): Promise<DocSuggestion[]> {
  const c = claude();
  if (!c) return suggestions;
  const out: DocSuggestion[] = [];
  for (const s of suggestions) {
    const sf = project.project.getSourceFile("/" + s.filePath);
    if (!sf) continue;
    const text = sf.getFullText();
    const startIdx = text.split("\n").slice(0, s.lineNumber - 1).join("\n").length;
    const snippet = text.slice(startIdx, startIdx + 500);
    try {
      const res = await c.messages.create({
        model: env.FIX_PROMPT_MODEL,
        max_tokens: 200,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        messages: [
          {
            role: "user",
            content: `Symbol: ${s.symbolName}\n\nCode:\n${snippet}\n\nWrite the JSDoc.`,
          },
        ],
      });
      const raw = res.content
        .filter((c) => c.type === "text")
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n")
        .trim();
      // Strip code fences if Claude wrapped it.
      const stripped = raw.replace(/^```(?:\w+)?\n?/, "").replace(/\n?```$/, "").trim();
      out.push({ ...s, suggestion: stripped });
    } catch {
      // skip on failure
    }
  }
  return out;
}
