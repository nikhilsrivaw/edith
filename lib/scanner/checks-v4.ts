/**
 * v4 checks — the AI-agent footgun pack.
 *
 * 76 deterministic checks targeting bugs that Cursor / Claude / Codex / v0
 * / Lovable / Bolt agents ship most consistently. Organised by category:
 *
 *   LLM-app footguns (1-12)       — cost-bombs + prompt-safety in AI-built AI-apps
 *   React / Next.js patterns (13-24)
 *   Database (25-34)
 *   Auth / session (35-42)
 *   Async / error handling (43-48)
 *   Build / deploy (49-53)
 *   File upload (54-58)
 *   Rate limit / DoS (59-62)
 *   Email / verification (63-65)
 *   Privacy / compliance (66-70)
 *   Accessibility (71-76)
 *
 * Same conservative-by-default approach as v3 — each check tuned to fire
 * only on patterns we've actually seen in AI-generated repos.
 */
import "server-only";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { Dimension, Severity } from "../mock-data";
import type { RepoProject } from "./project";
import type { FetchedFile } from "./github-tree";

export type CheckIssue = {
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
const lineOf = (sf: SourceFile, pos: number) => {
  try {
    return sf.getLineAndColumnAtPos(pos).line;
  } catch {
    return 1;
  }
};
const snip = (s: string, n = 160) => s.slice(0, n);

type Ctx = RepoProject;
type Files = FetchedFile[];

/* ================================================================
 * 1-12 · LLM-APP FOOTGUNS — cost / safety bombs unique to AI-built AI-apps
 * ============================================================== */

const LLM_CHAT_CALL =
  /(?:openai|anthropic|claude|client|ai)\s*\.\s*(?:chat\.completions|messages|responses)\s*\.\s*(?:create|stream)\s*\(/;

/* 1. LLM call missing max_tokens */
function checkLlmNoMaxTokens(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      if (!LLM_CHAT_CALL.test(txt)) return;
      if (/max_tokens|maxTokens|max_output_tokens/.test(txt)) return;
      out.push({
        checkId: "ai_pattern/llm-no-max-tokens",
        dimension: "ai_surface",
        severity: "high",
        title: "LLM call has no max_tokens / max_output_tokens",
        description:
          "Without a hard cap on output length, a single request can produce thousands of tokens and quietly multiply your bill. Set max_tokens (OpenAI) / max_output_tokens (Anthropic) to a sane ceiling.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 2. LLM call inside useEffect with user-input deps */
function checkLlmInUseEffect(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useEffect") return;
      const body = node.getArguments()[0]?.getText() ?? "";
      if (!LLM_CHAT_CALL.test(body)) return;
      out.push({
        checkId: "ai_pattern/llm-in-useeffect",
        dimension: "ai_surface",
        severity: "high",
        title: "LLM API call inside useEffect",
        description:
          "useEffect re-fires on every dependency change. Putting an LLM call here means each keystroke / re-render hits the model. Move to a Server Action, a route handler, or React Query with a manual trigger.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 3. LLM call inside a loop (while / setInterval / for) */
function checkLlmInLoop(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (
        !Node.isWhileStatement(node) &&
        !Node.isForStatement(node) &&
        !Node.isForOfStatement(node) &&
        !(Node.isCallExpression(node) &&
          /setInterval|setTimeout/.test(node.getExpression().getText()))
      )
        return;
      const txt = node.getText();
      if (!LLM_CHAT_CALL.test(txt)) return;
      out.push({
        checkId: "ai_pattern/llm-in-loop",
        dimension: "ai_surface",
        severity: "critical",
        title: "LLM call inside a loop / setInterval",
        description:
          "Agent-style tutorials show LLM calls inside while loops. Without a hard stop condition this becomes an unbounded billing event. Add a max-iterations counter and an external kill switch.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 4. System prompt visible to client */
function checkSystemPromptClient(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^(?:app|components|src)\//.test(path)) continue;
    const text = sf.getFullText();
    if (!/['"]use client['"]/.test(text) && !/^components\//.test(path))
      continue;
    if (!/role:\s*['"]system['"]|systemPrompt|SYSTEM_PROMPT/.test(text))
      continue;
    out.push({
      checkId: "ai_pattern/system-prompt-in-client",
      dimension: "ai_surface",
      severity: "high",
      title: "System prompt defined in a client component",
      description:
        "System prompts placed in client code are bundled and visible to every user via DevTools. Prompts often contain instructions that reveal business logic, jailbreak protections, and persona constraints. Move it server-side.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 5. User input concatenated into prompt with no separator */
function checkPromptInjectionRisk(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isTemplateExpression(node)) return;
      const txt = node.getText();
      if (
        !/(?:user|input|message|query|prompt|body|searchParams|params)/.test(
          txt,
        )
      )
        return;
      if (!/(?:role|system|assistant|instruction|prompt)/i.test(txt)) return;
      // Bonus heuristic: real injection guards usually use ---, ###, <user>, or zod parse.
      if (/---|###|<\/?user>|zod\.|parse\(/.test(txt)) return;
      out.push({
        checkId: "ai_pattern/prompt-injection-risk",
        dimension: "ai_surface",
        severity: "high",
        title: "User input interpolated into prompt with no delimiter",
        description:
          "Raw user input concatenated into a prompt is the prompt-injection footgun. Wrap user content in clear delimiters (e.g. `\\n---\\n${userInput}\\n---\\n`), validate via zod, and instruct the model to treat the inner block as untrusted.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 6. Hardcoded ancient model name */
function checkAncientModel(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  // Models that AI agents still write because they were the default at training time.
  const ANCIENT = /\b(?:gpt-3\.5(?:-turbo)?|text-davinci|gpt-4(?!-)|claude-2|claude-instant|claude-3-opus-20240229)\b/;
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isStringLiteral(node) && !Node.isNoSubstitutionTemplateLiteral(node))
        return;
      const v = node.getLiteralValue();
      if (!ANCIENT.test(v)) return;
      out.push({
        checkId: "ai_pattern/ancient-model",
        dimension: "ai_surface",
        severity: "medium",
        title: `Hardcoded outdated model: ${v}`,
        description:
          "Agents often write the model name they were trained on. Newer mini / haiku / sonnet models are usually cheaper and better. Confirm this is deliberate and pin the version explicitly (e.g. claude-haiku-4-5).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(v),
      });
    });
  }
  return out;
}

/* 7. Streaming response with no AbortController on the client */
function checkStreamingNoAbort(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      if (
        !/getReader\(|EventSource\(|new ReadableStream\(/.test(txt) &&
        !/\.stream\s*\(/.test(txt)
      )
        return;
      const parent = node.getSourceFile().getFullText();
      if (/AbortController|abortSignal|AbortSignal/.test(parent)) return;
      out.push({
        checkId: "ai_pattern/streaming-no-abort",
        dimension: "ai_surface",
        severity: "medium",
        title: "Streaming consumer has no AbortController",
        description:
          "Open SSE / streaming connections without an AbortController leak when the user navigates away — the model keeps generating, you keep paying. Wire an AbortController.signal into the fetch and abort it on unmount.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 8. Tool-calling executor with no allowlist */
function checkToolNoAllowlist(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      // tools[name](...) or registry.get(name)(...)
      if (
        !/\[\s*(?:tool_name|toolName|name)\s*\]/.test(callee) &&
        !/registry\.(?:get|resolve)/.test(callee)
      )
        return;
      const parent = sf.getFullText();
      if (/allowlist|ALLOWED_TOOLS|whitelist|allowedTools/.test(parent)) return;
      out.push({
        checkId: "ai_pattern/tool-no-allowlist",
        dimension: "ai_surface",
        severity: "high",
        title: "Tool dispatcher with no allowlist",
        description:
          "Invoking a tool by name from the model's output without an allowlist lets a prompt-injected response call any tool you've registered, including destructive ones. Constrain to an explicit allowed set.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 9. Embedding endpoint with no cache */
function checkEmbeddingNoCache(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      if (!/\.embeddings\s*\.\s*create\s*\(/.test(txt) && !/createEmbedding/.test(txt))
        return;
      const parent = sf.getFullText();
      if (/cache|redis|memo|getOr|kv\.get/i.test(parent)) return;
      out.push({
        checkId: "ai_pattern/embedding-no-cache",
        dimension: "ai_surface",
        severity: "medium",
        title: "Embedding call has no caching layer",
        description:
          "Embedding the same input twice is pure waste — embeddings are deterministic for a given model. Hash the input and store in Redis / Upstash / a DB cache table.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 10. Conversation messages array never capped */
function checkUncappedMessages(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      // messages.push(...) or setMessages(prev => [...prev, ...])
      if (!/messages\.push|setMessages\(/.test(txt)) return;
      const parent = sf.getFullText();
      if (/\.slice\(|MAX_MESSAGES|maxMessages|trimMessages/.test(parent)) return;
      out.push({
        checkId: "ai_pattern/uncapped-conversation",
        dimension: "ai_surface",
        severity: "medium",
        title: "Conversation history grows unbounded",
        description:
          "Each turn adds to the messages array but nothing trims it. Eventually you pay for the entire history every turn. Slice to the last N messages or summarise older turns into a system note.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 11. LLM output rendered via dangerouslySetInnerHTML */
function checkLlmDangerouslySetHtml(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isJsxAttribute(node)) return;
      if (node.getNameNode().getText() !== "dangerouslySetInnerHTML") return;
      const init = node.getInitializer()?.getText() ?? "";
      const parent = sf.getFullText();
      // If a fetch/openai/anthropic/completion appears in the same file, flag.
      if (!/completion|message|assistant|llm|gpt|claude|response\.content/i.test(parent))
        return;
      out.push({
        checkId: "ai_pattern/llm-dangerously-set-html",
        dimension: "ai_surface",
        severity: "critical",
        title: "dangerouslySetInnerHTML used near LLM response",
        description:
          "Rendering raw model output as HTML is an XSS vector — a prompt-injected response can deliver <script> tags. Use a markdown renderer with sanitisation (react-markdown + rehype-sanitize, or DOMPurify before injection).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(init),
      });
    });
  }
  return out;
}

/* 12. No temperature on deterministic-looking flow */
function checkMissingTemperature(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      if (!LLM_CHAT_CALL.test(txt)) return;
      if (/temperature\s*:/.test(txt)) return;
      // Only flag in test/scoring/extract/classify-shaped files.
      const path = rel(sf.getFilePath());
      if (!/test|scoring|score|classif|extract|grade|judge|eval/i.test(path)) return;
      out.push({
        checkId: "ai_pattern/missing-temperature",
        dimension: "ai_surface",
        severity: "low",
        title: "LLM call in deterministic flow has no temperature set",
        description:
          "Classification / extraction / scoring flows need temperature=0 (or low) for repeatability. Without it the model picks varying tokens and tests flake.",
        filePath: path,
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* ================================================================
 * 13-24 · REACT / NEXT.JS PATTERNS AI SHIPS WRONG
 * ============================================================== */

/* 13. "use client" on a file that does no client work */
function checkUseClientUnneeded(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/^['"]use client['"]/.test(text.trimStart())) continue;
    if (
      /\buse(?:State|Effect|Ref|Memo|Callback|Reducer|Layout|Context|Transition)\b/.test(
        text,
      )
    )
      continue;
    if (/onClick|onChange|onSubmit|onKey|addEventListener/.test(text)) continue;
    out.push({
      checkId: "performance/use-client-unneeded",
      dimension: "performance",
      severity: "low",
      title: '"use client" directive without any client APIs',
      description:
        "This file opts out of RSC but uses no hooks / event handlers / browser APIs. Removing the directive sends zero JS to the client for this component.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* 14. Data fetch in useEffect when the file could be a Server Component */
function checkClientFetchInUseEffect(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!path.endsWith("page.tsx") && !path.endsWith("page.jsx")) continue;
    const text = sf.getFullText();
    if (!/^['"]use client['"]/.test(text.trimStart())) continue;
    if (
      !/useEffect\([\s\S]*?=>\s*\{[\s\S]*?(?:fetch|axios)\(/.test(text)
    )
      continue;
    out.push({
      checkId: "performance/client-fetch-in-page",
      dimension: "performance",
      severity: "medium",
      title: "page.tsx is 'use client' and fetches data in useEffect",
      description:
        "Move this to a Server Component and await the fetch directly. Saves a full client-side round-trip, ships smaller JS, and lets you set cache hints. Extract any interactive bits into a child client component.",
      filePath: path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 15. useState(props.value) — never updates when prop changes */
function checkUseStateFromProp(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useState") return;
      const arg = node.getArguments()[0];
      if (!arg) return;
      const t = arg.getText();
      // bare identifier like "value" or "props.value" — risky pattern
      if (!/^[a-zA-Z_$][\w$]*$|^props\.\w+$/.test(t)) return;
      out.push({
        checkId: "reliability/use-state-from-prop",
        dimension: "reliability",
        severity: "medium",
        title: `useState(${t}) initialised from a prop`,
        description:
          "useState only reads its argument on first render. If the prop later changes, the local state stays stale. Either lift the state up, derive from the prop directly, or sync via useEffect with care.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 16. useEffect with inline-object dep -> infinite loop */
function checkUseEffectObjectDep(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useEffect") return;
      const args = node.getArguments();
      if (args.length < 2) return;
      const deps = args[1];
      if (!Node.isArrayLiteralExpression(deps)) return;
      const inlineObj = deps
        .getElements()
        .some((e) => Node.isObjectLiteralExpression(e) || Node.isArrayLiteralExpression(e));
      if (!inlineObj) return;
      out.push({
        checkId: "reliability/useeffect-object-dep",
        dimension: "reliability",
        severity: "high",
        title: "useEffect has an inline object/array as dependency",
        description:
          "Object/array literals get a fresh identity every render. Listing them as a dep makes the effect re-run forever. Move the value outside, use useMemo, or compare a primitive key like JSON.stringify(obj).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 17. useState(expensive()) instead of useState(() => expensive()) */
function checkUseStateExpensiveInit(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useState") return;
      const arg = node.getArguments()[0];
      if (!arg) return;
      if (!Node.isCallExpression(arg)) return;
      // Skip cheap allowed cases.
      const callee = arg.getExpression().getText();
      if (
        /^(?:Boolean|Number|String|Array|Object|Math\.|JSON\.parse|JSON\.stringify|new Date|Date\.now)/.test(
          callee,
        )
      )
        return;
      out.push({
        checkId: "performance/usestate-expensive-init",
        dimension: "performance",
        severity: "low",
        title: `useState(${callee}()) runs on every render`,
        description:
          "Passing a function-call to useState executes that function each render. Wrap in a lazy initialiser: useState(() => " +
          callee +
          "()).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 18. Stale closure in useEffect (uses identifier not in dep array) */
function checkUseEffectStaleClosure(ctx: Ctx): CheckIssue[] {
  // Conservative: only fire when the body clearly references a variable that's
  // not in the deps array and isn't a setter / constant from outside scope.
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useEffect") return;
      const args = node.getArguments();
      if (args.length < 2) return;
      const deps = args[1];
      if (!Node.isArrayLiteralExpression(deps)) return;
      // Look for setState calls inside body that reference the previous value: setX(X + 1)
      const body = args[0].getText();
      const setterMatch = body.match(/\bset([A-Z][\w$]*)\s*\(\s*(\w+)/);
      if (!setterMatch) return;
      const refName = setterMatch[2];
      if (
        /^(?:true|false|null|undefined|\d+|prev|previous|p|state)$/.test(refName)
      )
        return;
      const depsText = deps.getText();
      if (depsText.includes(refName)) return;
      out.push({
        checkId: "reliability/useeffect-stale-closure",
        dimension: "reliability",
        severity: "medium",
        title: `useEffect references '${refName}' but it's not in the deps array`,
        description:
          "The effect captures a stale value. Either add the identifier to the deps array, switch the setter to functional form (setX(prev => prev + 1)), or move the logic outside the effect.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 19. process.env.X in 'use client' file without NEXT_PUBLIC_ */
function checkClientProcessEnv(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/^['"]use client['"]/.test(text.trimStart())) continue;
    const re = /process\.env\.([A-Z][A-Z0-9_]*)/g;
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = re.exec(text)) !== null) {
      const name = m[1];
      if (name.startsWith("NEXT_PUBLIC_") || name === "NODE_ENV") continue;
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        checkId: "deploy_readiness/client-non-public-env",
        dimension: "deploy_readiness",
        severity: "high",
        title: `process.env.${name} referenced in a client component`,
        description:
          "Client components only see env vars prefixed with NEXT_PUBLIC_. This reference will be undefined at runtime. Either rename the var or move the code to a Server Component / route handler.",
        filePath: rel(sf.getFilePath()),
        lineNumber: 1,
      });
    }
  }
  return out;
}

/* 20. notFound() / redirect() called outside RSC */
function checkNotFoundInClient(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/^['"]use client['"]/.test(text.trimStart())) continue;
    if (!/\b(?:notFound|redirect)\s*\(/.test(text)) continue;
    out.push({
      checkId: "reliability/next-rsc-only-in-client",
      dimension: "reliability",
      severity: "high",
      title: "notFound() / redirect() called inside a client component",
      description:
        "These APIs throw control-flow errors that only Next's RSC runtime catches. From a client component they surface as uncaught errors. Use router.push() / router.replace() on the client.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* 21. cookies() / headers() without await (Next 15) */
function checkUnawaitedCookies(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (callee !== "cookies" && callee !== "headers" && callee !== "draftMode")
        return;
      const parent = node.getParent();
      // If wrapped in await -> fine.
      if (parent && Node.isAwaitExpression(parent)) return;
      // If immediately followed by .get / .set chain treated as Promise-as-thenable, still flag.
      out.push({
        checkId: "reliability/next15-unawaited-cookies",
        dimension: "reliability",
        severity: "high",
        title: `${callee}() called without await (Next 15)`,
        description:
          "In Next 15 cookies() / headers() / draftMode() are async. Calling them without await yields a Promise where you expected a store, causing runtime errors. Add await.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 22. Server Action exported with no early auth check */
function checkServerActionNoAuth(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:ts|tsx)$/.test(f.path)) continue;
    if (!/^['"]use server['"]/.test(f.content.trimStart())) continue;
    if (!/export\s+async\s+function/.test(f.content)) continue;
    if (
      /auth\(\)|getUser|getSession|getServerSession|currentUser|requireAuth|getSupabaseServer|validateRequest/.test(
        f.content,
      )
    )
      continue;
    out.push({
      checkId: "security/server-action-no-auth",
      dimension: "security",
      severity: "high",
      title: '"use server" action with no visible auth check',
      description:
        "Server Actions are POST endpoints — same threat model as route handlers. Add an auth check (e.g. await getUser()) before any mutation. Without it any signed-in user (or any anonymous request if your auth lets them in) can invoke this.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 23. <Image> without width/height */
function checkImageNoSize(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const tagName = node.getTagNameNode().getText();
      if (tagName !== "Image") return;
      const attrs = node.getAttributes().map((a) => a.getText());
      const hasFill = attrs.some((a) => /^fill\b/.test(a));
      if (hasFill) return;
      const hasW = attrs.some((a) => /^width\s*=/.test(a));
      const hasH = attrs.some((a) => /^height\s*=/.test(a));
      if (hasW && hasH) return;
      out.push({
        checkId: "performance/image-no-size",
        dimension: "performance",
        severity: "low",
        title: "<Image> without width/height (and no fill)",
        description:
          "next/image requires width+height OR fill — otherwise it triggers layout shift and breaks LCP. Add the dimensions or set fill on a positioned parent.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 24. Missing loading.tsx / error.tsx siblings on routes with async data */
function checkMissingRouteBoundaries(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  const byDir = new Map<string, FetchedFile[]>();
  for (const f of files) {
    const dir = f.path.replace(/\/[^/]+$/, "");
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(f);
  }
  for (const [dir, dirFiles] of byDir) {
    const page = dirFiles.find((f) => /\/page\.(?:tsx|jsx|ts|js)$/.test(f.path));
    if (!page) continue;
    // Only RSCs (page must NOT be 'use client') with await inside.
    if (/^['"]use client['"]/.test(page.content.trimStart())) continue;
    if (!/\bawait\b/.test(page.content)) continue;
    const hasLoading = dirFiles.some((f) => /\/loading\.(?:tsx|jsx)$/.test(f.path));
    const hasError = dirFiles.some((f) => /\/error\.(?:tsx|jsx)$/.test(f.path));
    if (hasLoading && hasError) continue;
    out.push({
      checkId: "reliability/missing-route-boundaries",
      dimension: "reliability",
      severity: "low",
      title: `Route ${dir} missing ${[!hasLoading && "loading.tsx", !hasError && "error.tsx"].filter(Boolean).join(" + ")}`,
      description:
        "Async Server Components benefit from sibling loading.tsx (instant skeleton) and error.tsx (graceful recovery from thrown errors). Add the missing files.",
      filePath: page.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* ================================================================
 * 25-34 · DATABASE
 * ============================================================== */

/* 25. new PrismaClient() / new Pool() at module scope in API route */
function checkClientAtModuleScope(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/^app\/api\/.+\/route\.(?:ts|js)$/.test(f.path)) continue;
    if (
      !/^\s*const\s+\w+\s*=\s*new\s+(?:PrismaClient|Pool|Client)\s*\(/m.test(
        f.content,
      )
    )
      continue;
    out.push({
      checkId: "reliability/db-client-at-module-scope",
      dimension: "reliability",
      severity: "high",
      title: "DB client instantiated at module scope in a route handler",
      description:
        "Each serverless invocation gets a fresh module — a new client per request — exhausting DB connections fast. Use a singleton from a shared file (e.g. lib/prisma.ts with global caching in dev).",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 26. SELECT * */
function checkSelectStar(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:ts|tsx|sql)$/.test(f.path)) continue;
    // Exclude obvious test files.
    if (/\.test\.|__tests__/.test(f.path)) continue;
    const lines = f.content.split("\n");
    lines.forEach((ln, i) => {
      if (!/select\s+\*/i.test(ln)) return;
      // Skip when in a comment.
      if (/^\s*(?:--|\/\/|\/\*|\*)/.test(ln)) return;
      out.push({
        checkId: "performance/select-star",
        dimension: "performance",
        severity: "low",
        title: "SELECT * query — fetches every column",
        description:
          "Selecting all columns wastes bandwidth, breaks TypeScript narrowing for ORMs, and silently includes columns added later (including sensitive ones). List the columns you need.",
        filePath: f.path,
        lineNumber: i + 1,
        codeSnippet: snip(ln.trim()),
      });
    });
  }
  return out;
}

/* 27. N+1: await inside a for loop hitting DB */
function checkAwaitInLoop(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (
        !Node.isForStatement(node) &&
        !Node.isForOfStatement(node) &&
        !Node.isForInStatement(node) &&
        !Node.isWhileStatement(node)
      )
        return;
      const txt = node.getText();
      if (!/\bawait\b/.test(txt)) return;
      if (
        !/\b(?:prisma|db|supabase|knex|sequelize|query|find|select|findUnique|findMany|insert|update|delete)\b/.test(
          txt,
        )
      )
        return;
      out.push({
        checkId: "performance/await-in-loop-db",
        dimension: "performance",
        severity: "medium",
        title: "Sequential await inside a loop hitting the database (N+1)",
        description:
          "Each iteration waits for a DB round-trip. Collect the inputs and batch — Prisma findMany({ where: { id: { in: ids } } }), a single SQL with IN(...), or Promise.all() of the lookups.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 28. LIMIT missing on SELECT */
function checkSelectNoLimit(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:ts|tsx|sql)$/.test(f.path)) continue;
    const re = /(?:^|[\s`'"(])select\s+[\s\S]+?from\s+[\s\S]+?(?=;|\)|`|"|')/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content)) !== null) {
      const stmt = m[0];
      if (/\blimit\b|\.first\(|\.findFirst\(|\.findUnique\(/i.test(stmt)) continue;
      if (/count\(|sum\(|avg\(|max\(|min\(/i.test(stmt)) continue;
      out.push({
        checkId: "performance/select-no-limit",
        dimension: "performance",
        severity: "low",
        title: "SELECT without LIMIT — returns full table",
        description:
          "Unbounded SELECT works on dev with 5 rows and blows up in prod. Add a LIMIT, paginate, or switch to a streaming cursor.",
        filePath: f.path,
        lineNumber: 1,
        codeSnippet: snip(stmt),
      });
      break; // one per file
    }
  }
  return out;
}

/* 29. Foreign key without an index */
function checkFkNoIndex(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.sql$/.test(f.path)) continue;
    // crude: column references some_table(id) but no create index on the same column
    const refs = [...f.content.matchAll(/(\w+)\s+\w+\s+references\s+(\w+)\s*\(/gi)];
    for (const ref of refs) {
      const col = ref[1];
      if (new RegExp(`create\\s+index[^;]*\\(${col}\\b`, "i").test(f.content))
        continue;
      out.push({
        checkId: "performance/fk-no-index",
        dimension: "performance",
        severity: "low",
        title: `Foreign key column '${col}' has no index`,
        description:
          "Joins on this column will table-scan. Add `create index idx_<table>_<col> on <table> (" +
          col +
          ");`.",
        filePath: f.path,
        lineNumber: 1,
      });
    }
  }
  return out;
}

/* 30. Multi-table write without a transaction */
function checkMultiWriteNoTx(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    // count distinct table writes in same function-ish block; very rough.
    const writes = [
      ...text.matchAll(/(?:prisma|db|supabase)\.(\w+)\.(?:create|update|delete|insert)/g),
    ];
    if (writes.length < 2) continue;
    const tables = new Set(writes.map((w) => w[1]));
    if (tables.size < 2) continue;
    if (/\$transaction|\.transaction\(|BEGIN|begin\(\)/.test(text)) continue;
    out.push({
      checkId: "data_safety/multi-write-no-transaction",
      dimension: "data_safety",
      severity: "medium",
      title: `Writes to ${tables.size} tables without a transaction`,
      description:
        "Half-written multi-table mutations corrupt invariants when one step fails. Wrap related writes in $transaction([...]) (Prisma), client.transaction() (Supabase), or BEGIN/COMMIT.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* 31. UNIQUE constraint missing on email / username */
function checkUniqueMissing(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.sql$/.test(f.path)) continue;
    // Find columns named email / username inside create table that don't have UNIQUE
    const tables = [
      ...f.content.matchAll(
        /create\s+table\s+(?:if\s+not\s+exists\s+)?[\w.]+\s*\(([\s\S]+?)\)\s*;/gi,
      ),
    ];
    for (const t of tables) {
      const body = t[1];
      const cols = body.split(",");
      for (const c of cols) {
        if (!/\b(email|username|handle)\b/i.test(c)) continue;
        if (/\bunique\b/i.test(c)) continue;
        // Skip if a table-level constraint declares unique on it.
        if (new RegExp(`unique\\s*\\(\\s*${c.trim().split(/\s+/)[0]}\\b`, "i").test(body))
          continue;
        out.push({
          checkId: "data_safety/unique-constraint-missing",
          dimension: "data_safety",
          severity: "medium",
          title: `Identity column has no UNIQUE constraint`,
          description:
            "Identifying columns (email, username) without UNIQUE let two rows collide. App-layer checks race. Add a UNIQUE constraint or a unique index.",
          filePath: f.path,
          lineNumber: 1,
        });
        break;
      }
    }
  }
  return out;
}

/* 32. Plain-stored password column */
function checkPlainPassword(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.sql$|\.prisma$/.test(f.path)) continue;
    if (!/\bpassword\b/i.test(f.content)) continue;
    // Look for password_hash / hashedPassword which are fine.
    if (/password_hash|hashed_password|passwordHash|hashedPassword/i.test(f.content))
      continue;
    out.push({
      checkId: "security/password-not-hashed-column",
      dimension: "security",
      severity: "critical",
      title: "Column 'password' (not 'password_hash') in schema",
      description:
        "Storing passwords by that name strongly suggests they're stored in plaintext or with weak hashing. Rename to password_hash and store argon2id or bcrypt(>=12 rounds) — never the raw password.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 33. bcrypt with low rounds */
function checkBcryptLowRounds(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (!/bcrypt\.(?:hash|hashSync)|argon2\.hash/.test(callee)) return;
      const args = node.getArguments();
      if (args.length < 2) return;
      const r = args[1].getText();
      const n = parseInt(r, 10);
      if (!Number.isFinite(n)) return;
      if (n >= 10) return;
      out.push({
        checkId: "security/bcrypt-low-rounds",
        dimension: "security",
        severity: "high",
        title: `bcrypt called with ${n} rounds — too low`,
        description:
          "Anything under 10 rounds is brute-forceable on commodity GPUs. Use at least 12 rounds (bcrypt) or switch to argon2id with sensible memory/time costs.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 34. created_at column with no default */
function checkCreatedAtNoDefault(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.sql$/.test(f.path)) continue;
    const cols = [...f.content.matchAll(/\bcreated_at\s+[\w()]+(?:\s+with\s+time\s+zone)?[^,)]*/gi)];
    for (const c of cols) {
      if (/\bdefault\b/i.test(c[0])) continue;
      out.push({
        checkId: "data_safety/created-at-no-default",
        dimension: "data_safety",
        severity: "low",
        title: "created_at column has no DEFAULT",
        description:
          "Rows inserted via raw SQL or other paths will have NULL created_at. Set `default now()` so the timestamp is always recorded.",
        filePath: f.path,
        lineNumber: 1,
      });
      break;
    }
  }
  return out;
}

/* ================================================================
 * 35-42 · AUTH / SESSION
 * ============================================================== */

/* 35. JWT in localStorage */
function checkJwtInLocalStorage(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (
      !/localStorage\.setItem\s*\(\s*['"][^'"]*(?:token|jwt|auth|session)[^'"]*['"]/i.test(
        text,
      )
    )
      continue;
    out.push({
      checkId: "security/jwt-in-localstorage",
      dimension: "security",
      severity: "critical",
      title: "JWT / session token stored in localStorage",
      description:
        "Any XSS on your domain can read localStorage and exfiltrate the token. Store sessions in HttpOnly Secure SameSite cookies set by the server.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* 36. jwt.sign without expiresIn */
function checkJwtNoExpiry(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (!/jwt\.sign|jose\.SignJWT/.test(node.getExpression().getText())) return;
      const txt = node.getText();
      if (/expiresIn|setExpirationTime|exp\s*:/.test(txt)) return;
      out.push({
        checkId: "security/jwt-no-expiry",
        dimension: "security",
        severity: "high",
        title: "JWT signed with no expiresIn",
        description:
          "A token that never expires is a permanent backdoor — leaked once, valid forever. Set expiresIn (15m–1h for access tokens) and use refresh tokens.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 37. Same secret for access + refresh */
function checkSharedJwtSecret(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:ts|tsx|js)$/.test(f.path)) continue;
    const t = f.content;
    const accessSecret =
      t.match(/jwt\.sign[^)]*?process\.env\.([A-Z0-9_]+)[^)]*?\)/);
    if (!accessSecret) continue;
    if (!/refresh|REFRESH/i.test(t)) continue;
    // If refresh sign uses the same env var, flag.
    if (
      new RegExp(`refresh[\\s\\S]*?process\\.env\\.${accessSecret[1]}\\b`, "i").test(t)
    ) {
      out.push({
        checkId: "security/shared-jwt-secret",
        dimension: "security",
        severity: "high",
        title: "Access and refresh tokens signed with the same secret",
        description:
          "If the secret leaks, both token types are compromised. Use separate env vars (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET).",
        filePath: f.path,
        lineNumber: 1,
      });
    }
  }
  return out;
}

/* 38. jwt.verify without audience/issuer */
function checkJwtVerifyNoAudIss(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (!/jwt\.verify|jose\.jwtVerify/.test(node.getExpression().getText()))
        return;
      const txt = node.getText();
      if (/audience|issuer/.test(txt)) return;
      out.push({
        checkId: "security/jwt-verify-loose",
        dimension: "security",
        severity: "medium",
        title: "jwt.verify without audience / issuer claims",
        description:
          "Without checking aud / iss, a token minted for another app sharing your secret would still validate here. Always require explicit audience + issuer.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 39. OAuth callback ignores `state` parameter */
function checkOAuthNoState(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/(?:auth|oauth).*?\/callback.*?\.(?:ts|js)$/i.test(f.path)) continue;
    if (/searchParams\.get\(['"]state['"]\)|state\s*=/.test(f.content) === false)
      continue;
    // If the file gets state but never compares it to something stored, flag.
    if (/storedState|cookies\(.*?state|state\s*===\s*stored/.test(f.content)) continue;
    out.push({
      checkId: "security/oauth-no-state-check",
      dimension: "security",
      severity: "high",
      title: "OAuth callback reads `state` but doesn't compare it",
      description:
        "Without verifying state matches what was set before the redirect, an attacker can CSRF a victim into logging into the attacker's account. Persist state in a cookie before redirecting, then compare on callback.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 40. Password reset token with no expiry */
function checkResetTokenNoExpiry(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\/(?:reset|forgot).*?\.(?:ts|tsx|js)$/i.test(f.path)) continue;
    if (!/(?:token|reset)/.test(f.content)) continue;
    if (/expires_at|expiresAt|expiry|TTL|ttl/.test(f.content)) continue;
    out.push({
      checkId: "security/reset-token-no-expiry",
      dimension: "security",
      severity: "high",
      title: "Password reset flow has no token expiry",
      description:
        "Reset tokens must expire (≤1h) and be single-use. Otherwise a leaked email or stolen DB row becomes a permanent account takeover.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 41. Logout doesn't invalidate token server-side */
function checkLogoutClientOnly(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\/logout.*?\.(?:ts|tsx|js)$/i.test(f.path)) continue;
    if (
      !/cookies\(.*?\.delete|deleteCookie|res\.clearCookie|cookies\(.*?\.set\(/.test(
        f.content,
      )
    )
      continue;
    if (
      /revoke|invalidate|deleteSession|deleteFromDb|delete from sessions|where\s+session/i.test(
        f.content,
      )
    )
      continue;
    out.push({
      checkId: "security/logout-client-only",
      dimension: "security",
      severity: "medium",
      title: "Logout only clears cookie — token still valid server-side",
      description:
        "If the user had the token leaked, clearing their cookie doesn't help — an attacker still has a valid token. Mark the session/refresh-token row revoked in the DB on logout.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 42. Math.random for token generation */
function checkMathRandomToken(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "Math.random") return;
      // Look at the enclosing function / variable for naming context.
      const fn =
        node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
        node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ??
        node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
      const vd = node.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      const ctxText = (fn?.getText() ?? "") + " " + (vd?.getText() ?? "");
      if (!/token|secret|otp|verification|nonce|reset/i.test(ctxText)) return;
      out.push({
        checkId: "security/math-random-token",
        dimension: "security",
        severity: "high",
        title: "Math.random used to generate a security-sensitive value",
        description:
          "Math.random is not cryptographically secure — attackers can predict the sequence. Use crypto.randomBytes / crypto.randomUUID for tokens, OTPs, password reset codes.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* ================================================================
 * 43-48 · ASYNC / ERROR HANDLING
 * ============================================================== */

/* 43. await res.json() without res.ok check */
function checkResJsonNoOkCheck(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isAwaitExpression(node)) return;
      const exprText = node.getExpression().getText();
      if (!/\.json\(\)$/.test(exprText)) return;
      // Walk up to the surrounding function body, look for res.ok / response.ok.
      const fn = node.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
        node.getFirstAncestorByKind(SyntaxKind.ArrowFunction) ??
        node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
      if (!fn) return;
      const body = fn.getText();
      if (/\.(?:ok|status)\b/.test(body)) return;
      out.push({
        checkId: "reliability/res-json-no-ok",
        dimension: "reliability",
        severity: "medium",
        title: "await res.json() without checking res.ok",
        description:
          "Calling .json() on a non-2xx response throws or returns garbage. Check `if (!res.ok) throw new Error(...)` first.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 44. Floating promise */
function checkFloatingPromise(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isExpressionStatement(node)) return;
      const expr = node.getExpression();
      if (!Node.isCallExpression(expr)) return;
      const callee = expr.getExpression().getText();
      // Heuristic: async-named, but no await / no .catch / no .then.
      if (
        !/^(?:fetch|axios|prisma|db|supabase|client|api)\b/.test(callee) &&
        !/Async$|Promise$/.test(callee)
      )
        return;
      const text = node.getText();
      if (text.startsWith("await ")) return;
      if (/\.catch\s*\(|\.then\s*\(/.test(text)) return;
      out.push({
        checkId: "reliability/floating-promise",
        dimension: "reliability",
        severity: "medium",
        title: "Promise-returning call not awaited and not caught",
        description:
          "The async call returns a Promise that nothing handles — failures become uncaught rejections and silently crash the process in some runtimes. Add await or .catch().",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(text),
      });
    });
  }
  return out;
}

/* 45. Promise.all with side-effecting writes */
function checkPromiseAllSideEffects(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "Promise.all") return;
      const txt = node.getText();
      // Trip if the array contains mutating DB / fetch calls.
      const mutates = /(?:prisma|db|supabase)\.\w+\.(?:create|update|delete|upsert)/.test(
        txt,
      );
      if (!mutates) return;
      out.push({
        checkId: "data_safety/promise-all-mutations",
        dimension: "data_safety",
        severity: "medium",
        title: "Promise.all over multiple write operations",
        description:
          "If one of these writes fails, the others succeed — leaving inconsistent state. Use a transaction (Prisma $transaction, Postgres BEGIN/COMMIT) or run sequentially with rollback.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* 46. useEffect fetch with no AbortController */
function checkUseEffectFetchNoAbort(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      if (node.getExpression().getText() !== "useEffect") return;
      const body = node.getArguments()[0]?.getText() ?? "";
      if (!/\bfetch\s*\(/.test(body)) return;
      if (/AbortController|abortSignal|AbortSignal/.test(body)) return;
      out.push({
        checkId: "reliability/useeffect-fetch-no-abort",
        dimension: "reliability",
        severity: "low",
        title: "fetch inside useEffect with no AbortController",
        description:
          "If the component unmounts mid-fetch, the response still resolves and tries to setState, throwing 'state update on unmounted component'. Pass controller.signal and abort on cleanup.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(body),
      });
    });
  }
  return out;
}

/* 47. catch { throw e } pointless */
function checkPointlessCatch(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCatchClause(node)) return;
      const block = node.getBlock();
      const stmts = block.getStatements();
      if (stmts.length !== 1) return;
      const s = stmts[0];
      if (!Node.isThrowStatement(s)) return;
      const exprText = s.getExpression().getText();
      const param = node.getVariableDeclaration()?.getName();
      if (!param) return;
      if (exprText !== param) return;
      out.push({
        checkId: "reliability/pointless-rethrow",
        dimension: "reliability",
        severity: "low",
        title: "catch block does nothing but re-throw",
        description:
          "Wrapping an operation in try { ... } catch (e) { throw e; } adds noise without behaviour change. Remove the try, or actually do something in the catch.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 48. Error.message returned to client */
function checkErrorMessageLeak(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const txt = node.getText();
      if (
        !/(?:NextResponse|Response|res)\.json\s*\([\s\S]*?error[\s\S]*?\.message/.test(
          txt,
        )
      )
        return;
      out.push({
        checkId: "security/error-message-leak",
        dimension: "security",
        severity: "medium",
        title: "Internal error.message returned in API response",
        description:
          "DB driver / ORM messages often leak table names, column names, stack traces. Return a generic message and log the real one server-side.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* ================================================================
 * 49-53 · BUILD / DEPLOY
 * ============================================================== */

/* 49. package.json missing engines.node */
function checkMissingEnginesNode(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  const pkg = files.find((f) => f.path === "package.json");
  if (!pkg) return out;
  try {
    const j = JSON.parse(pkg.content);
    if (j.engines && j.engines.node) return out;
    out.push({
      checkId: "deploy_readiness/missing-engines-node",
      dimension: "deploy_readiness",
      severity: "low",
      title: "package.json missing engines.node pin",
      description:
        "Without an engines.node range, hosting providers may upgrade Node beneath you and AI agents may regenerate against the wrong version. Pin to >=20 (or your minimum).",
      filePath: "package.json",
      lineNumber: 1,
    });
  } catch {
    /* */
  }
  return out;
}

/* 50. Lockfile missing */
function checkMissingLockfile(ctx: Ctx, files: Files): CheckIssue[] {
  const has = files.some((f) =>
    /(?:^|\/)package-lock\.json$|pnpm-lock\.yaml$|yarn\.lock$|bun\.lockb$/.test(f.path),
  );
  if (has) return [];
  if (!files.some((f) => f.path === "package.json")) return [];
  return [
    {
      checkId: "deploy_readiness/missing-lockfile",
      dimension: "deploy_readiness",
      severity: "medium",
      title: "No lockfile committed",
      description:
        "Without a lockfile, every CI build resolves different versions — supply-chain attacks via malicious patch releases land silently. Commit pnpm-lock.yaml / package-lock.json / yarn.lock.",
      filePath: "package.json",
      lineNumber: 1,
    },
  ];
}

/* 51. output: 'export' with route handlers */
function checkStaticExportWithRoutes(ctx: Ctx, files: Files): CheckIssue[] {
  const conf = files.find((f) =>
    /^next\.config\.(?:m?js|ts)$/.test(f.path),
  );
  if (!conf) return [];
  if (!/output\s*:\s*['"]export['"]/.test(conf.content)) return [];
  const hasRouteHandler = files.some((f) =>
    /^app\/api\/.+\/route\.(?:ts|js)$/.test(f.path),
  );
  if (!hasRouteHandler) return [];
  return [
    {
      checkId: "deploy_readiness/static-export-with-routes",
      dimension: "deploy_readiness",
      severity: "high",
      title: "next.config has output: 'export' but the app has route handlers",
      description:
        "Static export drops API routes — they're silently absent in production. Either remove `output: 'export'` or move the API endpoints out of the app.",
      filePath: conf.path,
      lineNumber: 1,
    },
  ];
}

/* 52. .gitignore missing common build dirs */
function checkGitignoreMissing(ctx: Ctx, files: Files): CheckIssue[] {
  const gi = files.find((f) => f.path === ".gitignore");
  if (!gi) {
    return [
      {
        checkId: "deploy_readiness/no-gitignore",
        dimension: "deploy_readiness",
        severity: "medium",
        title: ".gitignore missing",
        description:
          "Without .gitignore, build artefacts and secrets can leak into the repo. Add one and at minimum ignore node_modules, .next, .env*, dist.",
        filePath: "package.json",
        lineNumber: 1,
      },
    ];
  }
  const must = [".next", "node_modules", ".env"];
  const missing = must.filter((m) => !new RegExp(`^${m.replace(".", "\\.")}\\b`, "m").test(gi.content));
  if (missing.length === 0) return [];
  return [
    {
      checkId: "deploy_readiness/gitignore-incomplete",
      dimension: "deploy_readiness",
      severity: "low",
      title: `.gitignore missing entries: ${missing.join(", ")}`,
      description:
        "Build outputs and env files should never reach the repo. Add the missing entries.",
      filePath: ".gitignore",
      lineNumber: 1,
    },
  ];
}

/* 53. No headers() in next.config */
function checkNoSecurityHeaders(ctx: Ctx, files: Files): CheckIssue[] {
  const conf = files.find((f) => /^next\.config\.(?:m?js|ts)$/.test(f.path));
  if (!conf) return [];
  if (/async\s+headers\s*\(\s*\)|headers\s*:\s*async/.test(conf.content)) return [];
  return [
    {
      checkId: "security/no-next-config-headers",
      dimension: "security",
      severity: "medium",
      title: "next.config has no headers() function",
      description:
        "Setting security headers via next.config.js (Strict-Transport-Security, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) is the most reliable place to define them. Add `async headers() { return [{ source: '/(.*)', headers: [...] }] }`.",
      filePath: conf.path,
      lineNumber: 1,
    },
  ];
}

/* ================================================================
 * 54-58 · FILE UPLOAD
 * ============================================================== */

const UPLOAD_FILES = (files: Files) =>
  files.filter((f) =>
    /\/(?:upload|file|media|attachment|image)/.test(f.path) &&
    /\.(?:ts|tsx|js)$/.test(f.path),
  );

/* 54. No MIME validation on upload */
function checkUploadNoMime(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of UPLOAD_FILES(files)) {
    if (!/formData\(\)|formidable|busboy|multer/.test(f.content)) continue;
    if (/type\s*===|mimeType|mimetype|content-type/.test(f.content)) continue;
    out.push({
      checkId: "security/upload-no-mime-validation",
      dimension: "security",
      severity: "high",
      title: "Upload handler with no MIME-type validation",
      description:
        "Without a mime check users can upload .exe, .html, or any extension. Validate the file's actual content type (magic-bytes, file-type lib) — not just the filename — and reject anything outside your allowlist.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 55. No size cap */
function checkUploadNoSize(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of UPLOAD_FILES(files)) {
    if (!/formData|busboy|multer|formidable/.test(f.content)) continue;
    if (/maxFileSize|maxSize|limit:\s*\{|fileSize|MAX_BYTES/.test(f.content)) continue;
    out.push({
      checkId: "security/upload-no-size-limit",
      dimension: "security",
      severity: "medium",
      title: "Upload handler with no file-size cap",
      description:
        "Without a maxFileSize limit, a single attacker can fill your disk or rack up egress fees. Set an explicit per-file cap.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 56. Filename used in disk path */
function checkUploadPathTraversal(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of UPLOAD_FILES(files)) {
    if (
      !/(?:fs\.writeFile|fs\.createWriteStream).*?(?:file\.name|originalname|filename)/.test(
        f.content,
      )
    )
      continue;
    if (/path\.basename|sanitize|crypto\.randomUUID/.test(f.content)) continue;
    out.push({
      checkId: "security/upload-path-traversal",
      dimension: "security",
      severity: "critical",
      title: "User-controlled filename used in disk path",
      description:
        "A filename like '../../../etc/passwd' overwrites arbitrary files. Generate the disk filename yourself (UUID + extension you derived from sniffed MIME).",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 57. S3 putObject with public-read */
function checkS3PublicRead(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/putObject|PutObjectCommand/.test(text)) continue;
    if (!/ACL\s*:\s*['"]public-read['"]/.test(text)) continue;
    out.push({
      checkId: "security/s3-public-read",
      dimension: "security",
      severity: "high",
      title: "S3 upload uses ACL: 'public-read'",
      description:
        "User-uploaded content goes world-readable. Use presigned URLs for downloads instead, and keep the object private.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* 58. Image accepted but not re-encoded (just stored as-is) */
function checkImageNoReencoding(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of UPLOAD_FILES(files)) {
    if (!/image|avatar|photo|picture/i.test(f.path)) continue;
    if (/sharp|jimp|image-size\(/.test(f.content)) continue;
    if (!/write|upload|store/.test(f.content)) continue;
    out.push({
      checkId: "security/image-no-reencoding",
      dimension: "security",
      severity: "medium",
      title: "Image upload stored without re-encoding",
      description:
        "Image files can carry exploits (polyglots, malicious EXIF, embedded scripts). Re-encode with sharp / jimp to strip everything but pixel data.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* ================================================================
 * 59-62 · RATE LIMIT / DoS
 * ============================================================== */

/* 59. /api/login no rate limit */
function checkLoginNoRateLimit(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/^app\/api\/(?:login|signin|auth\/(?:login|signin))\/route\.(?:ts|js)$/.test(f.path))
      continue;
    if (/ratelimit|rate-?limit|throttle|@upstash\/ratelimit/i.test(f.content)) continue;
    out.push({
      checkId: "security/login-no-rate-limit",
      dimension: "security",
      severity: "high",
      title: "Login endpoint has no rate limiting",
      description:
        "Credential-stuffing attacks try millions of password combinations. Add per-IP and per-account rate limits (Upstash, Vercel KV, or your own).",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 60. /api/signup no rate limit + no captcha */
function checkSignupNoProtection(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/^app\/api\/(?:signup|register|auth\/(?:signup|register))\/route\.(?:ts|js)$/.test(f.path))
      continue;
    if (/ratelimit|rate-?limit|throttle|recaptcha|turnstile|hcaptcha/i.test(f.content))
      continue;
    out.push({
      checkId: "security/signup-no-protection",
      dimension: "security",
      severity: "medium",
      title: "Signup endpoint has no rate limit or CAPTCHA",
      description:
        "Without protection, bots flood your DB with fake accounts, spike email costs, and pollute analytics. Add a rate limit and optionally a CAPTCHA (Turnstile is invisible by default).",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 61. No body-size limit on POST/PUT route */
function checkRouteNoBodyLimit(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/^app\/api\/.+\/route\.(?:ts|js)$/.test(f.path)) continue;
    if (!/export\s+async\s+function\s+(?:POST|PUT|PATCH)/.test(f.content)) continue;
    if (
      /Content-Length|bodySize|maxBodySize|maxRequestBodySize|sizeLimit|bodyParser/.test(
        f.content,
      )
    )
      continue;
    if (
      /export\s+const\s+(?:runtime|config|maxDuration|dynamic|bodyParser)\s*=/.test(
        f.content,
      )
    )
      continue;
    out.push({
      checkId: "reliability/route-no-body-limit",
      dimension: "reliability",
      severity: "low",
      title: "POST/PUT route has no body-size cap",
      description:
        "By default Next accepts up to 1 MB but you should encode the intent. Set `export const dynamic = 'force-dynamic'` plus `export const maxDuration = X`, or use Vercel/Next's `bodyParser.sizeLimit` in route segment config.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 62. outbound fetch without AbortSignal.timeout — already in v3 as checkFetchNoTimeout. Skip duplicate. */
function checkRouteNoMaxDuration(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/^app\/api\/.+\/route\.(?:ts|js)$/.test(f.path)) continue;
    if (!/openai|anthropic|claude|\.embeddings\.|stripe\.charges|generateImage/.test(f.content))
      continue;
    if (/export\s+const\s+maxDuration\s*=/.test(f.content)) continue;
    out.push({
      checkId: "reliability/route-no-max-duration",
      dimension: "reliability",
      severity: "low",
      title: "Long-running route has no maxDuration export",
      description:
        "Routes that call LLMs / payment APIs can run >10s. Set `export const maxDuration = 60` so Vercel doesn't kill the function at the default 10s.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* ================================================================
 * 63-65 · EMAIL / VERIFICATION
 * ============================================================== */

/* 63. Verification email link with no expiry */
function checkVerifyNoExpiry(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/(?:verify|verification|confirm).*?\.(?:ts|tsx|js)$/i.test(f.path)) continue;
    if (!/token|link|url/i.test(f.content)) continue;
    if (/expires_at|expiresAt|expiry|TTL|ttl|expiresIn/.test(f.content)) continue;
    out.push({
      checkId: "security/verify-link-no-expiry",
      dimension: "security",
      severity: "medium",
      title: "Verification link has no expiry",
      description:
        "An email-verification link should be valid for 24h max. Without an expiry, a leaked email forwards forever-valid take-over links.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 64. Reset link reusable after use */
function checkResetReusable(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\/(?:reset|forgot).*?\.(?:ts|tsx|js)$/i.test(f.path)) continue;
    if (!/(?:update|set).*?password/i.test(f.content)) continue;
    if (
      /used_at|usedAt|consumed|invalidate|delete.*?token|token.*?delete/i.test(
        f.content,
      )
    )
      continue;
    out.push({
      checkId: "security/reset-token-reusable",
      dimension: "security",
      severity: "high",
      title: "Reset token not marked used after consumption",
      description:
        "The reset endpoint resets the password but doesn't invalidate the token. A second attacker who has the email link can still use it. Mark the token consumed (or delete the row) in the same transaction.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 65. HTML email with user content not sanitised */
function checkEmailHtmlInjection(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/resend|nodemailer|sendgrid|postmark|ses/i.test(text)) continue;
    // Template literal containing user / name / message inside html: ...
    if (
      !/html\s*:\s*`[^`]*\$\{(?:[^}]*?(?:user|name|message|input|body|content)[^}]*?)\}/.test(
        text,
      )
    )
      continue;
    if (/escape|sanitize|DOMPurify|encode/i.test(text)) continue;
    out.push({
      checkId: "security/email-html-injection",
      dimension: "security",
      severity: "medium",
      title: "User content interpolated into HTML email without escaping",
      description:
        "Email clients render HTML — and many strip script tags but still execute event handlers / data: URLs. Escape user content with a small helper or use react-email which escapes by default.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* ================================================================
 * 66-70 · PRIVACY / COMPLIANCE
 * ============================================================== */

/* 66. Analytics initialised before any cookie consent */
function checkAnalyticsBeforeConsent(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  const hasConsent = files.some((f) =>
    /consent|cookieconsent|gdpr|cookie-banner|iubenda/i.test(f.content),
  );
  if (hasConsent) return out;
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (
      !/posthog\.init|mixpanel\.init|amplitude\.init|gtag\(['"]config|google-analytics|@vercel\/analytics/i.test(
        text,
      )
    )
      continue;
    out.push({
      checkId: "data_safety/analytics-no-consent",
      dimension: "data_safety",
      severity: "medium",
      title: "Analytics initialised with no visible cookie consent",
      description:
        "Loading PostHog / Mixpanel / GA before the user accepts is a GDPR Article 7 violation in the EU and a Play Store data-safety violation. Gate analytics init behind explicit consent.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
    break;
  }
  return out;
}

/* 67. Privacy / Terms links missing or broken */
function checkLegalLinksMissing(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  // Find any file mentioning "privacy" or "terms" as href value
  const anyPrivacy = files.some((f) =>
    /href\s*=\s*['"](?!#)[^'"]*?(?:privacy|terms)/i.test(f.content),
  );
  if (anyPrivacy) return out;
  // Only flag if footer/layout exists, otherwise quiet.
  const hasFooter = files.some((f) =>
    /(?:footer|layout)\.(?:tsx|jsx)$/i.test(f.path),
  );
  if (!hasFooter) return out;
  out.push({
    checkId: "data_safety/no-legal-links",
    dimension: "data_safety",
    severity: "low",
    title: "No Privacy / Terms links found in app",
    description:
      "Required for app-store submission and GDPR / DPA basics. Add /privacy and /terms routes and link them from the footer / layout.",
    filePath: "app/layout.tsx",
    lineNumber: 1,
  });
  return out;
}

/* 68. No /api/account/delete (GDPR Art 17) */
function checkNoAccountDelete(ctx: Ctx, files: Files): CheckIssue[] {
  const has = files.some((f) =>
    /^app\/api\/(?:account|user)\/delete\/route\.(?:ts|js)$/.test(f.path),
  );
  if (has) return [];
  const hasUserConcept = files.some((f) =>
    /(?:signup|register|auth)/.test(f.path),
  );
  if (!hasUserConcept) return [];
  return [
    {
      checkId: "data_safety/no-account-delete",
      dimension: "data_safety",
      severity: "medium",
      title: "No /api/account/delete endpoint",
      description:
        "GDPR Article 17 (right to erasure) and Apple App Store policy require a self-service account deletion path. Add one and link from settings.",
      filePath: "app/api",
      lineNumber: 1,
    },
  ];
}

/* 69. No /api/account/export (GDPR Art 20) */
function checkNoAccountExport(ctx: Ctx, files: Files): CheckIssue[] {
  const has = files.some((f) =>
    /^app\/api\/(?:account|user)\/(?:export|data)\/route\.(?:ts|js)$/.test(f.path),
  );
  if (has) return [];
  const hasUserConcept = files.some((f) =>
    /(?:signup|register|auth)/.test(f.path),
  );
  if (!hasUserConcept) return [];
  return [
    {
      checkId: "data_safety/no-account-export",
      dimension: "data_safety",
      severity: "low",
      title: "No data-export endpoint",
      description:
        "GDPR Article 20 (data portability) gives users the right to download their data. Implement /api/account/export.",
      filePath: "app/api",
      lineNumber: 1,
    },
  ];
}

/* 70. console.error(error) where error contains PII */
function checkPiiInErrorLog(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) return;
      const callee = node.getExpression().getText();
      if (!/console\.(?:error|warn|log)/.test(callee)) return;
      const txt = node.getText();
      // Looks like logging an error that wraps user input.
      if (!/(?:err|error|e)\b/.test(txt)) return;
      if (!/(?:user|body|payload|input|email|phone)/.test(txt)) return;
      out.push({
        checkId: "data_safety/pii-in-error-log",
        dimension: "data_safety",
        severity: "low",
        title: "console.error includes user / payload data",
        description:
          "Error logs often end up in Sentry / Logflare / Datadog — third parties that may not be on your DPA. Strip user fields before logging, or use Sentry's beforeSend hook.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(txt),
      });
    });
  }
  return out;
}

/* ================================================================
 * 71-76 · ACCESSIBILITY
 * ============================================================== */

/* 71. <div onClick=> used as button */
function checkDivAsButton(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const tag = node.getTagNameNode().getText();
      if (tag !== "div" && tag !== "span") return;
      const attrs = node.getAttributes().map((a) => a.getText());
      const hasOnClick = attrs.some((a) => /^onClick\b/.test(a));
      if (!hasOnClick) return;
      const hasRole = attrs.some((a) => /^role\b/.test(a));
      const hasKb = attrs.some((a) => /^onKeyDown\b|^onKeyUp\b/.test(a));
      if (hasRole && hasKb) return;
      out.push({
        checkId: "accessibility/div-as-button",
        dimension: "accessibility",
        severity: "low",
        title: `<${tag} onClick> used as a button`,
        description:
          "Keyboard users can't activate this. Use a real <button>, or add role='button', tabIndex=0, and an onKeyDown that fires the same handler on Enter / Space.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 72. <img> without alt */
function checkImgNoAlt(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const tag = node.getTagNameNode().getText();
      if (tag !== "img") return;
      const attrs = node.getAttributes().map((a) => a.getText());
      if (attrs.some((a) => /^alt\b/.test(a))) return;
      out.push({
        checkId: "accessibility/img-no-alt",
        dimension: "accessibility",
        severity: "low",
        title: "<img> without alt attribute",
        description:
          "Screen readers skip images with no alt. Provide a short description or alt='' for purely decorative images.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 73. <input> with no associated <label> */
function checkInputNoLabel(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const tag = node.getTagNameNode().getText();
      if (tag !== "input") return;
      const attrs = node.getAttributes().map((a) => a.getText());
      // Allow type="hidden" / "submit" / "button" / "checkbox" / "radio".
      const typeAttr = attrs.find((a) => /^type\s*=/.test(a)) ?? "";
      if (/['"](?:hidden|submit|button|reset|checkbox|radio)['"]/.test(typeAttr))
        return;
      if (attrs.some((a) => /^aria-label|^aria-labelledby|^id\b/.test(a))) return;
      out.push({
        checkId: "accessibility/input-no-label",
        dimension: "accessibility",
        severity: "low",
        title: "<input> with no label / aria-label",
        description:
          "Form inputs need a <label htmlFor> or an aria-label, otherwise screen readers announce 'edit'. Either add an id+label or set aria-label.",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText()),
      });
    });
  }
  return out;
}

/* 74. Heading skip h1 -> h3 */
function checkHeadingSkip(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:tsx|jsx)$/.test(f.path)) continue;
    if (/<h1[\s>][\s\S]*?<h3[\s>]/.test(f.content) && !/<h2[\s>]/.test(f.content)) {
      out.push({
        checkId: "accessibility/heading-skip",
        dimension: "accessibility",
        severity: "low",
        title: "Heading skip — h1 → h3 with no h2",
        description:
          "Screen readers announce heading levels. Skipping h2 breaks the document outline. Either re-rank the smaller heading or insert an h2.",
        filePath: f.path,
        lineNumber: 1,
      });
    }
  }
  return out;
}

/* 75. Color-only state (red text / green text, no icon or aria) */
function checkColorOnlyState(ctx: Ctx, files: Files): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const f of files) {
    if (!/\.(?:tsx|jsx)$/.test(f.path)) continue;
    // Heuristic: class names like text-red-500 / text-green-500 used multiple times
    // without aria-label / role.
    const matches = [
      ...f.content.matchAll(/text-(?:red|green|yellow)-(?:500|600)[^"`'\s]*/g),
    ];
    if (matches.length < 2) continue;
    if (/aria-label|role=|sr-only|<svg/.test(f.content)) continue;
    out.push({
      checkId: "accessibility/color-only-state",
      dimension: "accessibility",
      severity: "low",
      title: "Status conveyed by colour alone",
      description:
        "Multiple red/green/yellow classes without icons or aria-labels means colour-blind users miss the state. Add an icon or text qualifier ('Error: …').",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 76. Modal with no aria-modal or focus trap */
function checkModalNoAria(ctx: Ctx): CheckIssue[] {
  const out: CheckIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/(?:Modal|Dialog|Drawer)/.test(text)) continue;
    if (
      !/(?:function|const)\s+(?:Modal|Dialog|Drawer)\b/.test(text) &&
      !/<(?:Modal|Dialog|Drawer)\b/.test(text)
    )
      continue;
    if (/aria-modal|FocusTrap|FocusScope|@radix-ui|@headlessui|cmdk/.test(text))
      continue;
    out.push({
      checkId: "accessibility/modal-no-aria",
      dimension: "accessibility",
      severity: "low",
      title: "Modal/Dialog without aria-modal or focus trap",
      description:
        "Custom modals without aria-modal='true' and a focus trap break keyboard / screen-reader users. Prefer Radix Dialog / Headless UI Dialog, or add the wiring manually.",
      filePath: rel(sf.getFilePath()),
      lineNumber: 1,
    });
  }
  return out;
}

/* ================================================================
 * Orchestration
 * ============================================================== */

export function runV4Checks(
  project: RepoProject,
  files: FetchedFile[],
): CheckIssue[] {
  const out: CheckIssue[] = [];
  const runners: Array<() => CheckIssue[]> = [
    // 1-12 · LLM-app footguns
    () => checkLlmNoMaxTokens(project),
    () => checkLlmInUseEffect(project),
    () => checkLlmInLoop(project),
    () => checkSystemPromptClient(project),
    () => checkPromptInjectionRisk(project),
    () => checkAncientModel(project),
    () => checkStreamingNoAbort(project),
    () => checkToolNoAllowlist(project),
    () => checkEmbeddingNoCache(project),
    () => checkUncappedMessages(project),
    () => checkLlmDangerouslySetHtml(project),
    () => checkMissingTemperature(project),
    // 13-24 · React / Next.js
    () => checkUseClientUnneeded(project),
    () => checkClientFetchInUseEffect(project),
    () => checkUseStateFromProp(project),
    () => checkUseEffectObjectDep(project),
    () => checkUseStateExpensiveInit(project),
    () => checkUseEffectStaleClosure(project),
    () => checkClientProcessEnv(project),
    () => checkNotFoundInClient(project),
    () => checkUnawaitedCookies(project),
    () => checkServerActionNoAuth(project, files),
    () => checkImageNoSize(project),
    () => checkMissingRouteBoundaries(project, files),
    // 25-34 · Database
    () => checkClientAtModuleScope(project, files),
    () => checkSelectStar(project, files),
    () => checkAwaitInLoop(project),
    () => checkSelectNoLimit(project, files),
    () => checkFkNoIndex(project, files),
    () => checkMultiWriteNoTx(project),
    () => checkUniqueMissing(project, files),
    () => checkPlainPassword(project, files),
    () => checkBcryptLowRounds(project),
    () => checkCreatedAtNoDefault(project, files),
    // 35-42 · Auth
    () => checkJwtInLocalStorage(project),
    () => checkJwtNoExpiry(project),
    () => checkSharedJwtSecret(project, files),
    () => checkJwtVerifyNoAudIss(project),
    () => checkOAuthNoState(project, files),
    () => checkResetTokenNoExpiry(project, files),
    () => checkLogoutClientOnly(project, files),
    () => checkMathRandomToken(project),
    // 43-48 · Async / error
    () => checkResJsonNoOkCheck(project),
    () => checkFloatingPromise(project),
    () => checkPromiseAllSideEffects(project),
    () => checkUseEffectFetchNoAbort(project),
    () => checkPointlessCatch(project),
    () => checkErrorMessageLeak(project),
    // 49-53 · Build / deploy
    () => checkMissingEnginesNode(project, files),
    () => checkMissingLockfile(project, files),
    () => checkStaticExportWithRoutes(project, files),
    () => checkGitignoreMissing(project, files),
    () => checkNoSecurityHeaders(project, files),
    // 54-58 · Upload
    () => checkUploadNoMime(project, files),
    () => checkUploadNoSize(project, files),
    () => checkUploadPathTraversal(project, files),
    () => checkS3PublicRead(project),
    () => checkImageNoReencoding(project, files),
    // 59-62 · Rate limit
    () => checkLoginNoRateLimit(project, files),
    () => checkSignupNoProtection(project, files),
    () => checkRouteNoBodyLimit(project, files),
    () => checkRouteNoMaxDuration(project, files),
    // 63-65 · Email
    () => checkVerifyNoExpiry(project, files),
    () => checkResetReusable(project, files),
    () => checkEmailHtmlInjection(project),
    // 66-70 · Privacy
    () => checkAnalyticsBeforeConsent(project, files),
    () => checkLegalLinksMissing(project, files),
    () => checkNoAccountDelete(project, files),
    () => checkNoAccountExport(project, files),
    () => checkPiiInErrorLog(project),
    // 71-76 · A11y
    () => checkDivAsButton(project),
    () => checkImgNoAlt(project),
    () => checkInputNoLabel(project),
    () => checkHeadingSkip(project, files),
    () => checkColorOnlyState(project, files),
    () => checkModalNoAria(project),
  ];
  for (const r of runners) {
    try {
      out.push(...r());
    } catch (err) {
      console.warn("[checks-v4] check crashed:", err);
    }
  }
  return out;
}
