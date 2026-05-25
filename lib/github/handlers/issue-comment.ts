/**
 * Handles `issue_comment` webhook events.
 *
 * The user types `@edith <question>` in a PR comment. We:
 *  1. Detect the @edith mention.
 *  2. Pull the PR diff + recent EDITH findings as context.
 *  3. Ask Claude for a focused answer.
 *  4. Post the answer as a follow-up comment.
 *
 * Special handler: `@edith fix` re-runs fix-prompt generation on the most
 * recent EDITH-flagged file in this PR's diff and pastes the prompt inline.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getOctokitForInstallation } from "@/lib/github-app";
import { env } from "@/lib/env";

type IssueCommentPayload = {
  action: string;
  issue: {
    number: number;
    pull_request?: { url: string };
    title: string;
  };
  comment: {
    id: number;
    body: string;
    user: { login: string; type: string };
  };
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
  };
  installation: { id: number };
};

const MENTION = /(^|\s)@edith\b/i;
const FOOTER =
  "\n\n<sub>Reply with another `@edith ...` to keep the thread going.</sub>";

const SYSTEM_PROMPT = `You are EDITH, a senior code reviewer chatting inside a GitHub PR comment thread. You answer one focused question from the developer at a time.

Style:
- Direct, no preamble.
- Cite file:line when relevant.
- If you need code context you don't have, say what you'd need to see.
- 80–250 words. No headers, no bullet-spam. Speak like a tired-but-friendly senior engineer.
- Never claim to have done something you didn't (don't say "I'll watch this PR" — you can't).`;

let claudeClient: Anthropic | null = null;
function claude(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (claudeClient) return claudeClient;
  claudeClient = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return claudeClient;
}

export async function handleIssueComment(raw: Record<string, unknown>) {
  const p = raw as unknown as IssueCommentPayload;
  if (p.action !== "created") return;
  if (!p.issue.pull_request) return; // only respond inside PRs
  if (p.comment.user.type === "Bot") return; // never loop on our own posts
  if (!MENTION.test(p.comment.body)) return;

  const question = p.comment.body.replace(MENTION, " ").trim();

  const octokit = await getOctokitForInstallation(p.installation.id);

  // Pull recent PR file list for context.
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
    owner: p.repository.owner.login,
    repo: p.repository.name,
    pull_number: p.issue.number,
    per_page: 30,
  });
  const fileContext = files
    .slice(0, 12)
    .map((f) => `- ${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");

  let reply: string;
  const c = claude();
  if (!c) {
    reply = `Hi — EDITH is online but Claude isn't wired (no \`ANTHROPIC_API_KEY\`). Once it is, I can answer questions about this PR.${FOOTER}`;
  } else {
    try {
      const msg = await c.messages.create({
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
            content: `PR: ${p.repository.full_name}#${p.issue.number} — ${p.issue.title}

Files in this PR:
${fileContext || "(none returned)"}

Developer's question:
${question}`,
          },
        ],
      });
      reply =
        msg.content
          .filter((c) => c.type === "text")
          .map((c) => (c.type === "text" ? c.text : ""))
          .join("\n")
          .trim() || "(empty response)";
      reply += FOOTER;
    } catch (e) {
      reply = `Hit an error generating a reply: ${e instanceof Error ? e.message : String(e)}.${FOOTER}`;
    }
  }

  await octokit.rest.issues.createComment({
    owner: p.repository.owner.login,
    repo: p.repository.name,
    issue_number: p.issue.number,
    body: `<!-- edith-reply -->\n${reply}`,
  });
}
