/**
 * Claude client for fix-prompt generation.
 *
 * One Claude call per issue, lazily — only when the user expands an issue
 * row on the scan detail page. Result is cached in `fix_prompts` table so
 * the second view is free.
 *
 * Uses prompt caching on the system message to keep cost low.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { getSupabaseAdmin } from "./supabase-admin";

export type AiTool = "cursor" | "claude_code" | "windsurf" | "v0";

const TOOL_LABEL: Record<AiTool, string> = {
  cursor: "Cursor",
  claude_code: "Claude Code",
  windsurf: "Windsurf",
  v0: "v0",
};

const SYSTEM_PROMPT = `You are EDITH, a senior security and reliability auditor for Next.js apps. You generate **fix prompts** that the user pastes into their AI coding tool to fix one specific, already-identified issue.

Output requirements:
- File-anchored. Always reference the exact file path and line number from the issue.
- Imperative voice. "In <path>:<line>, replace <X> with <Y>." Not "you could" or "consider".
- Show the corrected code verbatim, wrapped in a fenced code block with the right language tag.
- Mention any prerequisites: env vars to set, dependencies to install, migrations to apply, tests to run.
- No preamble. No "here's a fix prompt:" intro. No markdown H1/H2 headers. Output is pasted straight into the user's editor.
- Length: 150–400 words. Concise but complete.

The user has chosen their AI tool. Match its idiom:
- **Cursor / Claude Code**: imperative, file-anchored, expects you to apply the edit directly.
- **Windsurf**: same but allow a one-line rationale before the diff if it clarifies intent.
- **v0**: only if the issue is UI; otherwise note "v0 is for UI; use Cursor instead." and proceed Cursor-style.

You are part of EDITH's PR comment payload. Be calm, precise, on the user's side.`;

let cached: Anthropic | null = null;
function client(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (cached) return cached;
  cached = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return cached;
}

export type FixPromptInput = {
  issueId: string;
  tool: AiTool;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  severity: string;
  dimension: string;
};

export type FixPromptResult = {
  prompt: string;
  cached: boolean;
  generated: boolean;
};

function templatedPrompt(input: FixPromptInput): string {
  return `Fix the following issue in ${input.filePath}${
    input.lineNumber ? `:${input.lineNumber}` : ""
  }.

Issue: ${input.title}
Severity: ${input.severity}

What's wrong:
${input.description}

${input.codeSnippet ? `Current code:\n\`\`\`\n${input.codeSnippet}\n\`\`\`\n\n` : ""}Please apply the fix and add a one-line test that would catch this regression in CI.`;
}

export async function getOrGenerateFixPrompt(
  input: FixPromptInput,
): Promise<FixPromptResult> {
  const supabase = getSupabaseAdmin();

  // 1. Check cache in `fix_prompts` table.
  const { data: cachedRow } = await supabase
    .from("fix_prompts")
    .select("prompt")
    .eq("issue_id", input.issueId)
    .eq("ai_tool", input.tool)
    .maybeSingle();
  if (cachedRow?.prompt) {
    return { prompt: cachedRow.prompt as string, cached: true, generated: false };
  }

  // 2. If no Claude key, fall back to template (still store so we don't keep retrying).
  const claude = client();
  if (!claude) {
    const fallback = templatedPrompt(input);
    await supabase
      .from("fix_prompts")
      .insert({
        issue_id: input.issueId,
        ai_tool: input.tool,
        prompt: fallback,
      })
      .select()
      .single()
      .then(() => undefined, () => undefined);
    return { prompt: fallback, cached: false, generated: false };
  }

  // 3. Generate via Claude (cached system message).
  const message = await claude.messages.create({
    model: env.FIX_PROMPT_MODEL,
    max_tokens: 600,
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
        content: `Issue: ${input.title}
Severity: ${input.severity}
Dimension: ${input.dimension}
File: ${input.filePath}${input.lineNumber ? `:${input.lineNumber}` : ""}

Description:
${input.description}

${input.codeSnippet ? `Code snippet:\n\`\`\`\n${input.codeSnippet}\n\`\`\`\n\n` : ""}Target AI tool: ${TOOL_LABEL[input.tool]}

Generate the fix prompt now.`,
      },
    ],
  });

  const prompt =
    message.content
      .filter((c) => c.type === "text")
      .map((c) => (c.type === "text" ? c.text : ""))
      .join("\n")
      .trim() || templatedPrompt(input);

  // 4. Persist for next time.
  await supabase
    .from("fix_prompts")
    .insert({
      issue_id: input.issueId,
      ai_tool: input.tool,
      prompt,
    })
    .select()
    .single()
    .then(() => undefined, () => undefined);

  return { prompt, cached: false, generated: true };
}
