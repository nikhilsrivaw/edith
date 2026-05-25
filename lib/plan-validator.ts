/**
 * EDITH Plan-Validation Mode — Wedge 1.
 *
 * The user pastes a 3-paragraph plan ("I want to add Stripe checkout to my
 * existing Next.js app — should call out to the new Razorpay variant for INR
 * users"). EDITH cross-references:
 *
 *   - the plan text (Claude-summarised intent)
 *   - the user's existing repo (recent scan + AST)
 *
 * Returns a structured list of pitfalls the user should warn Claude/Cursor
 * about BEFORE letting it write code. This is the pre-code product — the
 * thing CodeRabbit can't credibly build because their UX is post-PR.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "./env";

export type PlanPitfall = {
  category:
    | "auth"
    | "payment"
    | "data"
    | "performance"
    | "deployment"
    | "business_logic"
    | "ai_pattern";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  why: string;
  watchFor: string;
  promptHint: string;
};

export type PlanValidation = {
  summary: string;
  pitfalls: PlanPitfall[];
  meta: {
    model: string;
    cached: boolean;
  };
};

const SYSTEM_PROMPT = `You are EDITH's Plan Validation engine. The user is about to ask their AI coding tool (Cursor / Claude Code / Windsurf / v0) to make a change to their Next.js app. Your job is to anticipate the pitfalls the AI will likely walk into.

Output strict JSON in this shape:
{
  "summary": "one-line summary of what they're trying to do",
  "pitfalls": [
    {
      "category": "auth" | "payment" | "data" | "performance" | "deployment" | "business_logic" | "ai_pattern",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "short headline",
      "why": "1-2 sentences on what the bug looks like in code",
      "watchFor": "1-line concrete signal to look for in the AI's output",
      "promptHint": "exact one-line addition to add to the user's prompt to prevent this"
    }
  ]
}

Rules:
- 3 to 8 pitfalls, ranked by severity desc.
- Focus on the bugs AI tools (Cursor, Claude, v0) actually make: signature verification skipped, RLS forgotten, totals trusted from client, idempotency missed, env vars assumed.
- "ai_pattern" is for AI-specific failure modes (e.g. "Claude tends to wrap the new code in a try/catch that swallows the error").
- Each pitfall must be actionable. No "consider doing X" — say "tell it: do X".
- Reply with JSON ONLY. No markdown fences, no preamble.`;

let client: Anthropic | null = null;
function claude(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  if (client) return client;
  client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export async function validatePlan(args: {
  plan: string;
  repoSummary?: string;
}): Promise<PlanValidation> {
  const c = claude();
  if (!c) {
    return staticFallback(args.plan);
  }
  const userMessage = `Plan:
${args.plan}

${args.repoSummary ? `Repo context:\n${args.repoSummary}\n` : ""}Generate the JSON now.`;

  const response = await c.messages.create({
    model: env.FIX_PROMPT_MODEL,
    max_tokens: 1500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const raw = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();

  try {
    // Tolerate accidental code fences.
    const json = raw
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = JSON.parse(json) as Pick<
      PlanValidation,
      "summary" | "pitfalls"
    >;
    return {
      summary: parsed.summary ?? "",
      pitfalls: parsed.pitfalls ?? [],
      meta: { model: env.FIX_PROMPT_MODEL, cached: false },
    };
  } catch {
    return {
      summary: "EDITH could not parse the model output; returning fallback.",
      pitfalls: staticFallback(args.plan).pitfalls,
      meta: { model: env.FIX_PROMPT_MODEL, cached: false },
    };
  }
}

function staticFallback(plan: string): PlanValidation {
  const out: PlanPitfall[] = [];
  const t = plan.toLowerCase();
  if (/stripe|payment|checkout|razorpay|payu/.test(t)) {
    out.push({
      category: "payment",
      severity: "critical",
      title: "Webhook signature verification will likely be skipped",
      why: "AI tools default to parsing the JSON body directly. They forget the Stripe-Signature / x-razorpay-signature check.",
      watchFor: "A webhook handler that reads `req.json()` without calling `stripe.webhooks.constructEvent` or `crypto.createHmac('sha256', secret)`.",
      promptHint:
        "In the webhook handler, verify the signature header against the webhook secret before parsing the body.",
    });
    out.push({
      category: "business_logic",
      severity: "critical",
      title: "Final price may be trusted from the client",
      why: "AI tools accept the amount field from the request body and pass it to the payment provider.",
      watchFor: "An `amount` field used directly from `req.body` rather than recomputed server-side from product IDs.",
      promptHint:
        "Recompute the final amount server-side from product IDs and quantities. Never trust the amount from the client.",
    });
  }
  if (/supabase|postgres|rls|database|table/.test(t)) {
    out.push({
      category: "data",
      severity: "critical",
      title: "RLS will probably not be enabled on new tables",
      why: "AI tools generate `create table` statements without RLS policies.",
      watchFor: "A new migration with `create table` but no `enable row level security` and no `create policy`.",
      promptHint:
        "Every new public table must have `enable row level security` and at least one explicit policy scoped by auth.uid().",
    });
  }
  if (/auth|login|signup|session|protected/.test(t)) {
    out.push({
      category: "auth",
      severity: "high",
      title: "Mutating routes may ship without auth checks",
      why: "AI tools write the happy path first and forget to gate mutations.",
      watchFor: "An app/api/.../route.ts exporting POST/PUT/DELETE that doesn't call `getUser()` or equivalent.",
      promptHint:
        "Every mutating route must check the session at the top of the handler and 401 if missing.",
    });
  }
  out.push({
    category: "ai_pattern",
    severity: "medium",
    title: "Errors may be caught and silently dropped",
    why: "AI tools tend to wrap new code in try/catch with empty catch blocks to avoid surfacing failures during dev.",
    watchFor: "`catch (e) {}` or `catch { return ... }` blocks with no logging or re-throw.",
    promptHint:
      "Don't swallow errors. Log them and either re-throw or return a typed error response.",
  });
  return {
    summary:
      "Static fallback — ANTHROPIC_API_KEY not configured. Live LLM analysis would give more targeted pitfalls.",
    pitfalls: out,
    meta: { model: "static-fallback", cached: false },
  };
}
