/**
 * LLM citation tracker.
 *
 * Asks Claude an open-ended question about the user's brand, with the
 * web_search tool enabled. The response naturally includes citations.
 * We then parse:
 *
 *   – Was the user's own domain cited? (signal: LLM has been trained on
 *     or successfully searched for our brand)
 *   – Which competitor domains were cited?
 *   – Overall sentiment of the response toward the brand
 *
 * One row per check is persisted to `ai_citations` so the dashboard can
 * trend over time (weekly cron).
 *
 * Designed to fail soft — never throws. If Claude or web search is
 * unavailable, returns { ok: false, reason } and the dashboard shows it.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

export type CitationCheck = {
  brand: string;
  ownDomain: string; // e.g. "edith.expert" — used to classify own-site citations
  /** Optional list of known competitors to bias parsing toward. */
  knownCompetitors?: string[];
};

export type CitationResult =
  | {
      ok: true;
      model: string;
      prompt: string;
      responseText: string;
      cited: boolean;
      ownCitations: Array<{ url: string; title?: string }>;
      competitorCitations: Array<{ url: string; title?: string; domain: string }>;
      competitorsMentioned: string[];
      sentiment: "positive" | "neutral" | "negative" | "mixed" | "unknown";
    }
  | { ok: false; reason: string };

const DEFAULT_MODEL = "claude-sonnet-4-6";
const PROMPT_TEMPLATE = (brand: string) =>
  `What is ${brand}? What does ${brand} do, who is it for, and what are its main competitors? Cite sources for any factual claims.`;

const POS_WORDS = [
  "best",
  "leading",
  "popular",
  "powerful",
  "trusted",
  "innovative",
  "respected",
  "recommended",
  "polished",
  "strong",
  "excellent",
];
const NEG_WORDS = [
  "limited",
  "lacks",
  "weak",
  "poor",
  "criticized",
  "controversial",
  "outdated",
  "deprecated",
  "abandoned",
  "discontinued",
  "buggy",
  "unreliable",
];

function client(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function classifySentiment(
  text: string,
  brand: string,
): CitationResult extends { ok: true } ? CitationResult["sentiment"] : never;
function classifySentiment(
  text: string,
  brand: string,
): "positive" | "neutral" | "negative" | "mixed" | "unknown" {
  const lc = text.toLowerCase();
  if (!lc.includes(brand.toLowerCase())) return "unknown";

  // Look at words within 40 chars of brand mentions.
  const brandRe = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  let m: RegExpExecArray | null;
  let pos = 0;
  let neg = 0;
  while ((m = brandRe.exec(text))) {
    const start = Math.max(0, m.index - 80);
    const end = Math.min(text.length, m.index + brand.length + 80);
    const window = text.slice(start, end).toLowerCase();
    for (const w of POS_WORDS) if (window.includes(w)) pos++;
    for (const w of NEG_WORDS) if (window.includes(w)) neg++;
  }

  if (pos > 0 && neg > 0) return "mixed";
  if (pos > 0) return "positive";
  if (neg > 0) return "negative";
  return "neutral";
}

/**
 * Parse markdown-style citations `[1]: https://…` and inline URLs from
 * the response. Conservative — false-positive citations are worse than
 * false-negative.
 */
function extractCitedUrls(text: string): Array<{ url: string; title?: string }> {
  const out: Array<{ url: string; title?: string }> = [];
  const seen = new Set<string>();

  // Markdown footnote-style: `[Title](https://example.com)`
  const mdRe = /\[([^\]]{2,120})\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = mdRe.exec(text))) {
    const url = m[2];
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url, title: m[1] });
    }
  }

  // Bare URLs.
  const urlRe = /(?<![\(\[\"'])\bhttps?:\/\/[^\s<>"']+[a-zA-Z0-9/]/g;
  while ((m = urlRe.exec(text))) {
    const url = m[0];
    if (!seen.has(url)) {
      seen.add(url);
      out.push({ url });
    }
  }
  return out;
}

/**
 * Pull plausible competitor names from "competitors include X, Y, Z."
 * patterns. Best-effort. Real competitor lists come from the
 * `knownCompetitors` config and the cited domains.
 */
function extractCompetitors(text: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /competitors?(?:\s+include|s?\s+are|s?\s+like|s?\s*:)\s*([^.\n]{4,200})/gi,
    /alternatives?\s+(?:include|are|like|to\s+\S+(?:\s+include)?)\s*[:\-]?\s*([^.\n]{4,200})/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const list = m[1];
      for (const item of list.split(/,| and | or /)) {
        const name = item
          .trim()
          .replace(/[.\s]+$/, "")
          .replace(/^the\s+/i, "");
        if (name.length >= 2 && name.length <= 40 && /^[A-Z0-9]/.test(name)) {
          out.add(name);
        }
      }
    }
  }
  return Array.from(out).slice(0, 20);
}

/* ================================================================
 * Public API
 * ============================================================== */

export async function runCitationCheck(
  args: CitationCheck,
): Promise<CitationResult> {
  const ai = client();
  if (!ai) return { ok: false, reason: "ANTHROPIC_API_KEY not configured" };

  const prompt = PROMPT_TEMPLATE(args.brand);
  const model = DEFAULT_MODEL;

  // Anthropic web_search tool. If the user's account doesn't have it
  // enabled, the API returns a 400 — we catch and fall back to a no-search
  // capture (still useful: tests pre-training knowledge of the brand).
  let responseText = "";
  let usedWebSearch = false;
  try {
    const res = await ai.messages.create({
      model,
      max_tokens: 1500,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 4,
        },
      ] as unknown as Anthropic.Messages.MessageCreateParams["tools"],
      messages: [{ role: "user", content: prompt }],
    });
    usedWebSearch = true;
    for (const block of res.content) {
      if (block.type === "text") responseText += block.text + "\n";
    }
  } catch (err) {
    // Fall back: no web search.
    try {
      const res = await ai.messages.create({
        model,
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: `${prompt}\n\nAnswer from your knowledge. If you don't know, say so explicitly.`,
          },
        ],
      });
      for (const block of res.content) {
        if (block.type === "text") responseText += block.text + "\n";
      }
    } catch (fallbackErr) {
      return {
        ok: false,
        reason: `Claude call failed: ${(fallbackErr as Error).message ?? String(fallbackErr)} (web_search attempt: ${(err as Error).message ?? String(err)})`,
      };
    }
  }

  if (!responseText.trim()) {
    return { ok: false, reason: "Empty response from Claude" };
  }

  // Parse citations + competitors.
  const citations = extractCitedUrls(responseText);
  const ownDomainLc = args.ownDomain.toLowerCase().replace(/^www\./, "");
  const ownCitations = citations.filter((c) => {
    const d = domainOf(c.url).toLowerCase();
    return d === ownDomainLc || d.endsWith("." + ownDomainLc);
  });
  const competitorCitations = citations
    .filter((c) => {
      const d = domainOf(c.url).toLowerCase();
      if (!d) return false;
      if (d === ownDomainLc || d.endsWith("." + ownDomainLc)) return false;
      // skip generic refs (wikipedia, news aggregators)
      if (/^(wikipedia\.org|en\.wikipedia\.org|news\.ycombinator\.com)$/.test(d))
        return false;
      return true;
    })
    .map((c) => ({ ...c, domain: domainOf(c.url) }));

  const heuristic = extractCompetitors(responseText);
  const fromKnown = (args.knownCompetitors ?? []).filter((name) =>
    responseText.toLowerCase().includes(name.toLowerCase()),
  );
  const competitorsMentioned = Array.from(
    new Set([...fromKnown, ...heuristic]),
  ).slice(0, 30);

  return {
    ok: true,
    model: usedWebSearch ? `${model}+web` : model,
    prompt,
    responseText: responseText.trim(),
    cited: ownCitations.length > 0,
    ownCitations,
    competitorCitations,
    competitorsMentioned,
    sentiment: classifySentiment(responseText, args.brand),
  };
}
