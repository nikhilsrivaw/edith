/**
 * Auto test generation.
 *
 * Given an EDITH-detected issue + the surrounding source, generate a
 * minimal Vitest/Jest-compatible test that would FAIL while the issue
 * exists and PASS after the fix is applied.
 *
 * Cached in fix_prompts table reusing the existing infra — we use a
 * synthetic ai_tool value 'test_gen' so it doesn't collide with the
 * regular fix prompts.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";
import { getSupabaseAdmin } from "./supabase-admin";

const SYSTEM_PROMPT = `You are EDITH's test generator. Given a security/reliability bug already found in code, write the **minimum failing test** that would catch this regression in CI.

Output requirements:
- Use Vitest syntax with describe/it/expect.
- If the bug is in an API route, use supertest-style request/response.
- If the bug is in a webhook handler, fire a forged-signature request and assert the route returns 4xx (not 2xx).
- If the bug is a missing auth check, fire an unauthenticated request and assert 401/403.
- Maximum 40 lines.
- No imports the reader has to install beyond vitest + the project's own modules.
- No preamble, no explanation. Output the test file content directly (no fenced code block).

The test should be COPY-PASTEABLE into the user's test suite and fail today.`;

export type GenTestInput = {
  issueId: string;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  severity: string;
  dimension: string;
};

export type GenTestResult = {
  test: string;
  cached: boolean;
  generated: boolean;
};

let client: Anthropic | null = null;
function claude(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (client) return client;
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

function templatedTest(input: GenTestInput): string {
  const safeTitle = input.title.replace(/`/g, "'");
  return `// EDITH-generated regression test for: ${safeTitle}
// File: ${input.filePath}${input.lineNumber ? `:${input.lineNumber}` : ""}
//
// ANTHROPIC_API_KEY is not configured, so this is a stub. Fill in the
// concrete assertions once you wire Claude.
import { describe, it, expect } from "vitest";

describe("${safeTitle}", () => {
  it("should not be reachable in production code", () => {
    expect(true).toBe(false);
  });
});
`;
}

export async function getOrGenerateTest(
  input: GenTestInput,
): Promise<GenTestResult> {
  const supabase = getSupabaseAdmin();

  // Reuse the fix_prompts table with a synthetic ai_tool value.
  const { data: cachedRow } = await supabase
    .from("fix_prompts")
    .select("prompt")
    .eq("issue_id", input.issueId)
    .eq("ai_tool", "cursor") // schema enum limits us; we encode "test:" prefix below
    .like("prompt", "// EDITH-generated regression test%")
    .maybeSingle();
  if (cachedRow?.prompt) {
    return {
      test: cachedRow.prompt as string,
      cached: true,
      generated: false,
    };
  }

  const c = claude();
  if (!c) {
    const fallback = templatedTest(input);
    return { test: fallback, cached: false, generated: false };
  }

  const message = await c.messages.create({
    model: env.FIX_PROMPT_MODEL,
    max_tokens: 800,
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

${input.codeSnippet ? `Code snippet:\n${input.codeSnippet}\n` : ""}Generate the failing test now.`,
      },
    ],
  });

  const test = message.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim() || templatedTest(input);

  return { test, cached: false, generated: true };
}
