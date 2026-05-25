/**
 * JS-rendering detection — pure heuristic.
 *
 * Given the raw HTML returned by a non-JS HTTP fetch, decide whether the
 * page is effectively a client-rendered shell. This matters because:
 *   – Google JS-renders most pages, but rarely for new sites and never for
 *     crawl-budget-constrained ones.
 *   – Bing, DuckDuckGo, ClaudeBot, GPTBot, PerplexityBot, CCBot — none
 *     execute JS. They see exactly what `fetch()` sees.
 *   – If your home page returns 8KB of bootstrap + an empty root div, you
 *     have zero SEO. EDITH should yell about this.
 *
 * Heuristics (any 2 trigger):
 *   1. Body text < 200 visible chars
 *   2. <div id="root"> or <div id="__next"> or <div id="app"> is empty
 *      (i.e. the framework hasn't hydrated server-side)
 *   3. <noscript> tag whose text mentions JavaScript / enable
 *   4. Page contains < 2 visible headings
 *   5. Body contains no <a href>, <p>, <h1>, <h2> outside script/style
 */
import "server-only";

export type RenderVerdict = {
  isSpa: boolean;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  /** Approx visible text length for diagnostics. */
  visibleTextLength: number;
};

const EMPTY_ROOT_RE =
  /<div\s+id=["'](?:root|__next|app|svelte|nuxt|q-app|vue-app)["']\s*>(\s*)<\/div>/i;

const NOSCRIPT_JS_RE =
  /<noscript[^>]*>[\s\S]{0,600}?(?:javascript|enable\s+js|js\s+enabled|browser\s+does\s+not\s+support)[\s\S]{0,600}?<\/noscript>/i;

const SCRIPT_STYLE_RE = /<script\b[\s\S]*?<\/script>|<style\b[\s\S]*?<\/style>/gi;
const TAG_RE = /<[^>]+>/g;

function approxVisibleText(html: string): string {
  return html.replace(SCRIPT_STYLE_RE, "").replace(TAG_RE, " ").replace(/\s+/g, " ").trim();
}

function countTag(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length;
}

export function detectJsRendered(html: string): RenderVerdict {
  if (!html || html.length < 200) {
    return {
      isSpa: true,
      confidence: "high",
      reasons: ["Response body is essentially empty (< 200 bytes)."],
      visibleTextLength: 0,
    };
  }

  const reasons: string[] = [];
  let score = 0;

  // (1) visible text length
  const visible = approxVisibleText(html);
  if (visible.length < 200) {
    reasons.push(`Visible text is only ${visible.length} chars after stripping markup.`);
    score += 2;
  } else if (visible.length < 600) {
    reasons.push(
      `Visible text is ${visible.length} chars — borderline for content-driven pages.`,
    );
    score += 1;
  }

  // (2) empty root div
  if (EMPTY_ROOT_RE.test(html)) {
    reasons.push("Empty framework root div (#root / #__next / #app).");
    score += 2;
  }

  // (3) JS-required noscript
  if (NOSCRIPT_JS_RE.test(html)) {
    reasons.push("<noscript> block warns that JavaScript is required.");
    score += 2;
  }

  // (4) heading count
  const headings = countTag(html, /<h[1-3][\s>]/gi);
  if (headings === 0) {
    reasons.push("No <h1>/<h2>/<h3> tags in the raw HTML.");
    score += 1;
  }

  // (5) anchor + paragraph count outside script/style
  const stripped = html.replace(SCRIPT_STYLE_RE, "");
  const anchors = countTag(stripped, /<a\s[^>]*href=/gi);
  const paras = countTag(stripped, /<p[\s>]/gi);
  if (anchors === 0 && paras === 0) {
    reasons.push("No <a> or <p> tags in the rendered HTML.");
    score += 1;
  }

  let confidence: RenderVerdict["confidence"] = "low";
  if (score >= 4) confidence = "high";
  else if (score >= 2) confidence = "medium";

  return {
    isSpa: score >= 2,
    confidence,
    reasons,
    visibleTextLength: visible.length,
  };
}
