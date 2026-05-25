/**
 * Repo-side SEO checks.
 *
 * Scans for technical-SEO failure modes that AI agents (Cursor / Claude /
 * v0 / Lovable / Bolt) ship most consistently:
 *   – placeholder metadata ("My App", "Create Next App")
 *   – missing <html lang>
 *   – missing robots.txt / sitemap / llms.txt
 *   – localhost in OG URLs
 *   – <img> instead of next/image, missing alt, missing dims (CLS)
 *   – <a href="/foo"> instead of <Link> (loses client-side prefetch)
 *   – JSON-LD structured data missing
 *   – AI-search readiness (GPTBot / ClaudeBot allowlist, llms.txt)
 *
 * Each check is conservative — designed to fire only on real footguns,
 * not on stylistic preferences. False positives kill the product.
 */
import "server-only";
import { Node, SyntaxKind, type SourceFile } from "ts-morph";
import type { Dimension, Severity } from "../mock-data";
import type { RepoProject } from "./project";
import type { FetchedFile } from "./github-tree";

export type SeoIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
  subDimension:
    | "technical_foundation"
    | "core_web_vitals"
    | "content_structure"
    | "indexability"
    | "discoverability"
    | "ai_readiness";
};

const rel = (p: string) => (p.startsWith("/") ? p.slice(1) : p);
const lineOf = (sf: SourceFile, pos: number) => {
  try {
    return sf.getLineAndColumnAtPos(pos).line;
  } catch {
    return 1;
  }
};
const snip = (s: string, n = 200) => (s.length > n ? s.slice(0, n) + "…" : s);

const PLACEHOLDER_TITLES = new Set([
  "create next app",
  "next.js app",
  "my app",
  "my website",
  "untitled",
  "localhost",
  "react app",
  "vite + react",
  "v0 app",
  "lovable app",
  "bolt app",
  "starter",
  "hello world",
  "example",
]);

const LOCALHOST_RE =
  /(?:https?:\/\/)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/i;

type Ctx = RepoProject;
type Files = FetchedFile[];

const file = (files: Files, path: string) => files.find((f) => f.path === path);
const has = (files: Files, ...paths: string[]) =>
  paths.some((p) => file(files, p));

/* ================================================================
 * TECHNICAL FOUNDATION (25 of 80 — the must-have layer)
 * ============================================================== */

/* 1. metadata export missing on layout */
function checkMissingMetadataExport(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") ||
    file(files, "app/layout.ts") ||
    file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (/export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata)\b/.test(layout.content))
    return [];
  return [{
    checkId: "seo/missing-root-metadata",
    dimension: "seo",
    severity: "critical",
    subDimension: "technical_foundation",
    title: "Root layout has no `metadata` export",
    description:
      "Without a Metadata export in app/layout.tsx, every page falls back to Next's defaults — usually 'Create Next App'. Search engines index this verbatim. Add `export const metadata: Metadata = { title: { default: '…', template: '%s | Brand' }, description: '…' }`.",
    filePath: layout.path,
    lineNumber: 1,
  }];
}

/* 2. Placeholder / generic title */
function checkPlaceholderTitle(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const f of files) {
    if (!/\.tsx?$/.test(f.path)) continue;
    if (!/\bmetadata\b|\btitle\s*:/.test(f.content)) continue;
    // Find `title: "…"` literals; skip template forms.
    const re = /title\s*:\s*["'`]([^"'`]{1,80})["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      const t = m[1].trim().toLowerCase();
      if (!t) continue;
      if (PLACEHOLDER_TITLES.has(t)) {
        out.push({
          checkId: "seo/placeholder-title",
          dimension: "seo",
          severity: "high",
          subDimension: "technical_foundation",
          title: `Placeholder title shipped: "${m[1].trim()}"`,
          description:
            "AI agents leave starter-template titles in place. This is what Google indexes. Replace with a descriptive title that includes your brand and primary keyword (e.g. 'EDITH — Audit AI-built apps before they ship').",
          filePath: f.path,
          lineNumber:
            f.content.slice(0, m.index).split("\n").length,
          codeSnippet: snip(m[0]),
        });
      }
    }
  }
  return out;
}

/* 3. Title too long (> 60 chars truncates in SERP) */
function checkTitleTooLong(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const f of files) {
    if (!/\.tsx?$/.test(f.path)) continue;
    const re = /title\s*:\s*["'`]([^"'`]{61,})["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      out.push({
        checkId: "seo/title-too-long",
        dimension: "seo",
        severity: "low",
        subDimension: "technical_foundation",
        title: `Title is ${m[1].length} chars — SERP truncates at ~60`,
        description:
          "Google truncates titles longer than ~60 characters with an ellipsis. Trim it so the most important words stay visible. Use the `template` Metadata field for per-page suffixing if you need brand.",
        filePath: f.path,
        lineNumber: f.content.slice(0, m.index).split("\n").length,
        codeSnippet: snip(m[0], 120),
      });
    }
  }
  return out;
}

/* 4-5. Description missing / too long */
function checkDescription(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  const layout =
    file(files, "app/layout.tsx") ||
    file(files, "app/layout.ts") ||
    file(files, "src/app/layout.tsx");
  if (layout && !/description\s*:/.test(layout.content) &&
      /export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata)\b/.test(layout.content)) {
    out.push({
      checkId: "seo/description-missing",
      dimension: "seo",
      severity: "high",
      subDimension: "technical_foundation",
      title: "Root metadata has no `description`",
      description:
        "Without a description, Google fabricates one from page content — usually badly. Add a 150-160 char description summarising what the site does and who it's for.",
      filePath: layout.path,
      lineNumber: 1,
    });
  }
  for (const f of files) {
    if (!/\.tsx?$/.test(f.path)) continue;
    const re = /description\s*:\s*["'`]([^"'`]{161,})["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      out.push({
        checkId: "seo/description-too-long",
        dimension: "seo",
        severity: "low",
        subDimension: "technical_foundation",
        title: `Description is ${m[1].length} chars — SERP cuts at ~160`,
        description:
          "Descriptions over ~160 characters get truncated in search results. Front-load the value proposition and keep it under 160.",
        filePath: f.path,
        lineNumber: f.content.slice(0, m.index).split("\n").length,
        codeSnippet: snip(m[0]),
      });
    }
  }
  return out;
}

/* 6. <html lang> missing in root layout */
function checkHtmlLang(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") || file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (!/<html\b/.test(layout.content)) return [];
  if (/<html[^>]*\blang\s*=/.test(layout.content)) return [];
  return [{
    checkId: "seo/html-lang-missing",
    dimension: "seo",
    severity: "high",
    subDimension: "technical_foundation",
    title: "<html> element missing `lang` attribute",
    description:
      "Search engines and screen readers use `<html lang>` to identify the page language. Without it, hreflang strategies break and accessibility audits fail. Set `<html lang=\"en\">` (or your locale) in app/layout.tsx.",
    filePath: layout.path,
    lineNumber: layout.content.split("\n").findIndex((l) => /<html\b/.test(l)) + 1,
  }];
}

/* 7. robots.txt or app/robots.ts missing */
function checkRobotsMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  if (has(files, "app/robots.ts", "app/robots.tsx", "public/robots.txt",
          "src/app/robots.ts")) return [];
  return [{
    checkId: "seo/robots-missing",
    dimension: "seo",
    severity: "high",
    subDimension: "technical_foundation",
    title: "robots.txt missing",
    description:
      "Without a robots.txt, crawlers have no instructions and may waste budget on auth pages, API routes, or staging URLs. Create `app/robots.ts` exporting a `MetadataRoute.Robots` with sane defaults (sitemap URL, disallow /api).",
    filePath: "app/",
  }];
}

/* 8. sitemap missing */
function checkSitemapMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  if (has(files, "app/sitemap.ts", "app/sitemap.tsx", "public/sitemap.xml",
          "src/app/sitemap.ts", "next-sitemap.config.js")) return [];
  return [{
    checkId: "seo/sitemap-missing",
    dimension: "seo",
    severity: "high",
    subDimension: "technical_foundation",
    title: "sitemap.xml missing",
    description:
      "Without a sitemap, search engines have to discover pages organically — slow for new sites. Create `app/sitemap.ts` exporting `MetadataRoute.Sitemap` listing your indexable routes with `lastModified` for freshness signals.",
    filePath: "app/",
  }];
}

/* 9. OG image missing in metadata */
function checkOgImageMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") || file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (!/export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata)\b/.test(layout.content))
    return [];
  if (/openGraph\s*:\s*\{[\s\S]*?images?\s*:/.test(layout.content)) return [];
  if (/app\/opengraph-image\.(?:tsx?|jpg|png)/.test(layout.content)) return [];
  // Look for the convention file too.
  const hasOgFile = files.some((f) =>
    /^(?:src\/)?app\/opengraph-image\.(?:tsx?|jpg|png|jpeg|webp)$/.test(f.path),
  );
  if (hasOgFile) return [];
  return [{
    checkId: "seo/og-image-missing",
    dimension: "seo",
    severity: "high",
    subDimension: "technical_foundation",
    title: "No Open Graph image declared",
    description:
      "Every link share on Twitter / LinkedIn / Slack / iMessage uses the OG image. Without one, you get a broken placeholder. Either add `openGraph: { images: ['/og.png'] }` to metadata, or create `app/opengraph-image.tsx` with the next/og ImageResponse helper.",
    filePath: layout.path,
    lineNumber: 1,
  }];
}

/* 10. Localhost in OG URLs */
function checkLocalhostInOg(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const f of files) {
    if (!/\.(?:tsx?|jsx?|json|env|env\.example)$/.test(f.path)) continue;
    if (!/(?:openGraph|metadataBase|og:url|og:image)/i.test(f.content)) continue;
    const m = LOCALHOST_RE.exec(f.content);
    if (!m) continue;
    out.push({
      checkId: "seo/localhost-in-og",
      dimension: "seo",
      severity: "critical",
      subDimension: "technical_foundation",
      title: "localhost referenced in OG / metadataBase",
      description:
        "Localhost URLs shipped to production break all link previews — Twitter, LinkedIn, Slack will refuse to render them. Replace with `process.env.NEXT_PUBLIC_APP_URL` and ensure it's set in your hosting env.",
      filePath: f.path,
      lineNumber: f.content.slice(0, m.index).split("\n").length,
      codeSnippet: snip(m[0]),
    });
  }
  return out;
}

/* 11. <meta name="robots" content="noindex"> in code */
function checkNoindexInCode(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const f of files) {
    if (!/\.tsx?$/.test(f.path)) continue;
    // Search for robots: { index: false } OR <meta name="robots" content="noindex">
    if (
      /robots\s*:\s*\{\s*index\s*:\s*false/.test(f.content) ||
      /content\s*=\s*["']noindex/.test(f.content) ||
      /noindex\s*[:,]\s*true/.test(f.content)
    ) {
      // Allow if it's clearly scoped to a dev / staging branch
      if (/process\.env\.NODE_ENV\s*===?\s*["']development["']/.test(f.content))
        continue;
      out.push({
        checkId: "seo/noindex-in-prod",
        dimension: "seo",
        severity: "critical",
        subDimension: "indexability",
        title: "`noindex` directive present without env guard",
        description:
          "A noindex directive in code without a `process.env.NODE_ENV === 'production'` guard will silently de-index your entire site if shipped to prod. Either remove it, or wrap it in a dev-only condition.",
        filePath: f.path,
        lineNumber: 1,
      });
    }
  }
  return out;
}

/* 12. Twitter card missing */
function checkTwitterCardMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") || file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (!/metadata\b/.test(layout.content)) return [];
  if (/twitter\s*:/.test(layout.content)) return [];
  return [{
    checkId: "seo/twitter-card-missing",
    dimension: "seo",
    severity: "low",
    subDimension: "technical_foundation",
    title: "No Twitter card metadata",
    description:
      "Twitter / X uses dedicated card meta tags. Without `twitter: { card: 'summary_large_image', title, description, images }` in metadata, your tweets fall back to the OG tags (which usually works, but with reduced image quality).",
    filePath: layout.path,
    lineNumber: 1,
  }];
}

/* 13. metadataBase missing */
function checkMetadataBaseMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") || file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (!/metadata\b/.test(layout.content)) return [];
  if (/metadataBase\s*:/.test(layout.content)) return [];
  return [{
    checkId: "seo/metadata-base-missing",
    dimension: "seo",
    severity: "medium",
    subDimension: "technical_foundation",
    title: "metadataBase not set",
    description:
      "Without `metadataBase` in your root metadata export, Next.js resolves OG image URLs as relative paths and warns in dev. Set `metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!)` so absolute social URLs work in prod.",
    filePath: layout.path,
    lineNumber: 1,
  }];
}

/* ================================================================
 * CONTENT STRUCTURE
 * ============================================================== */

/* 14. <img> instead of next/image */
function checkRawImgTag(ctx: Ctx): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^(?:src\/)?(?:app|components|pages)\//.test(path)) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const name = node.getTagNameNode().getText();
      if (name !== "img") return;
      // Skip if file imports next/image (might be deliberate `<img>` for a reason)
      const text = sf.getFullText();
      if (/next\/image/.test(text) && /<Image\b/.test(text)) {
        // partially uses Image — still flag this one
      }
      out.push({
        checkId: "seo/raw-img-tag",
        dimension: "seo",
        severity: "medium",
        subDimension: "core_web_vitals",
        title: "<img> used instead of next/image",
        description:
          "Raw <img> ships full-resolution images with no lazy-loading, no AVIF/WebP serving, and no `width`/`height` reservation. This tanks LCP and CLS. Use `import Image from 'next/image'` and set explicit width/height (or `fill` with a sized parent).",
        filePath: path,
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 120),
      });
    });
  }
  return out;
}

/* 15. Internal <a href="/..."> instead of <Link> */
function checkRawAnchorInternal(ctx: Ctx): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const path = rel(sf.getFilePath());
    if (!/^(?:src\/)?(?:app|components|pages)\//.test(path)) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      const name = node.getTagNameNode().getText();
      if (name !== "a") return;
      const href = node.getAttribute("href");
      if (!href || !Node.isJsxAttribute(href)) return;
      const init = href.getInitializer();
      if (!init) return;
      let value: string | undefined;
      if (Node.isStringLiteral(init)) value = init.getLiteralValue();
      else if (Node.isJsxExpression(init)) {
        const expr = init.getExpression();
        if (expr && Node.isStringLiteral(expr)) value = expr.getLiteralValue();
      }
      if (!value || !value.startsWith("/")) return;
      // Allow anchors with target=_blank or rel=external
      if (/target=\s*["']_blank/.test(node.getText())) return;
      out.push({
        checkId: "seo/raw-anchor-internal",
        dimension: "seo",
        severity: "low",
        subDimension: "discoverability",
        title: "Internal <a> instead of next/link <Link>",
        description:
          "Raw <a href='/...'> triggers a full page reload — you lose client-side prefetch and waste a roundtrip. Replace with `import Link from 'next/link'` and `<Link href='/...'>` so Next.js can prefetch on hover.",
        filePath: path,
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 120),
      });
    });
  }
  return out;
}

/* 16. No JSON-LD structured data anywhere */
function checkNoStructuredData(_ctx: Ctx, files: Files): SeoIssue[] {
  const hasJsonLd = files.some(
    (f) =>
      /\.(?:tsx?|jsx?)$/.test(f.path) &&
      /application\/ld\+json|"@context"\s*:\s*["']https?:\/\/schema\.org/.test(
        f.content,
      ),
  );
  if (hasJsonLd) return [];
  return [{
    checkId: "seo/no-structured-data",
    dimension: "seo",
    severity: "medium",
    subDimension: "discoverability",
    title: "No JSON-LD structured data anywhere",
    description:
      "Schema.org JSON-LD is how you get rich snippets (review stars, FAQ accordions, product pricing) in Google results — and it's how LLMs ground your brand. Add at minimum an `Organization` and `WebSite` schema to your root layout via a `<script type='application/ld+json'>` tag.",
    filePath: "app/layout.tsx",
  }];
}

/* 17. Next/Script without strategy prop */
function checkScriptNoStrategy(ctx: Ctx): SeoIssue[] {
  const out: SeoIssue[] = [];
  for (const sf of ctx.project.getSourceFiles()) {
    const text = sf.getFullText();
    if (!/from\s+['"]next\/script['"]/.test(text)) continue;
    sf.forEachDescendant((node) => {
      if (!Node.isJsxOpeningElement(node) && !Node.isJsxSelfClosingElement(node))
        return;
      if (node.getTagNameNode().getText() !== "Script") return;
      if (node.getAttribute("strategy")) return;
      out.push({
        checkId: "seo/next-script-no-strategy",
        dimension: "seo",
        severity: "medium",
        subDimension: "core_web_vitals",
        title: "<Script> has no `strategy` prop",
        description:
          "Without a strategy, next/script defaults to `afterInteractive`, which is fine for some scripts but blocks for others. Be explicit: `lazyOnload` for analytics, `afterInteractive` for product-essential, `beforeInteractive` only when truly needed (it blocks paint).",
        filePath: rel(sf.getFilePath()),
        lineNumber: lineOf(sf, node.getStart()),
        codeSnippet: snip(node.getText(), 160),
      });
    });
  }
  return out;
}

/* ================================================================
 * AI READINESS — the untapped category
 * ============================================================== */

/* 18. llms.txt missing */
function checkLlmsTxtMissing(_ctx: Ctx, files: Files): SeoIssue[] {
  if (has(files, "public/llms.txt", "app/llms.txt", "app/llms.ts",
          "src/app/llms.ts")) return [];
  return [{
    checkId: "seo/llms-txt-missing",
    dimension: "seo",
    severity: "medium",
    subDimension: "ai_readiness",
    title: "llms.txt missing (AI crawler standard)",
    description:
      "llms.txt is the emerging standard (championed by Anthropic, adopted by Vercel docs, Stripe, Shopify) that tells LLM crawlers what to read and ignore. Create `public/llms.txt` listing your canonical docs URLs in markdown — LLMs use it to ground answers about your product.",
    filePath: "public/",
  }];
}

/* 19. robots.txt doesn't address AI bots */
function checkRobotsAiBots(_ctx: Ctx, files: Files): SeoIssue[] {
  const robots =
    file(files, "public/robots.txt") ||
    file(files, "app/robots.ts") ||
    file(files, "src/app/robots.ts");
  if (!robots) return []; // already flagged by check 7
  const txt = robots.content;
  const knownBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];
  const mentioned = knownBots.filter((b) => txt.includes(b));
  if (mentioned.length >= 2) return [];
  return [{
    checkId: "seo/robots-no-ai-bots",
    dimension: "seo",
    severity: "low",
    subDimension: "ai_readiness",
    title: "robots.txt doesn't explicitly address AI crawlers",
    description:
      "AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot) honor robots.txt directives. Decide your policy explicitly — either allow them (you want LLMs to cite your content) or disallow (you want to gate training). Silence defaults to allow, which is fine but worth being intentional about.",
    filePath: robots.path,
    lineNumber: 1,
  }];
}

/* 20. Use-client at top of marketing/content route → not crawlable */
function checkClientOnlyContentPage(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  const MARKETING_RE =
    /^(?:src\/)?app\/(?:\(marketing\)|blog|docs|pricing|about|features|changelog|legal|tos|privacy)\/[^/]+\/page\.tsx?$/;
  for (const f of files) {
    if (!MARKETING_RE.test(f.path)) continue;
    const head = f.content.trimStart().slice(0, 60);
    if (!/^["']use client["']/.test(head)) continue;
    out.push({
      checkId: "seo/use-client-content-page",
      dimension: "seo",
      severity: "high",
      subDimension: "ai_readiness",
      title: "Content page is client-rendered — invisible to crawlers without JS",
      description:
        "Pages with 'use client' at the top render on the client. Google JS-renders most pages, but smaller crawlers (Bing, DuckDuckGo, GPTBot, ClaudeBot) often don't — your content is invisible to them. For marketing/blog/docs pages, default to a server component and push 'use client' down to interactive leaves only.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 21. No Organization / WebSite schema */
function checkNoBrandSchema(_ctx: Ctx, files: Files): SeoIssue[] {
  const layout =
    file(files, "app/layout.tsx") || file(files, "src/app/layout.tsx");
  if (!layout) return [];
  if (
    /"@type"\s*:\s*["'](?:Organization|WebSite)["']/.test(layout.content) ||
    /@type:\s*["'](?:Organization|WebSite)["']/.test(layout.content)
  )
    return [];
  return [{
    checkId: "seo/no-brand-schema",
    dimension: "seo",
    severity: "low",
    subDimension: "ai_readiness",
    title: "No Organization / WebSite JSON-LD",
    description:
      "LLMs use Organization + WebSite schema to ground answers about your brand. Without it, when someone asks ChatGPT 'what is EDITH?', the model has no canonical signal. Add a JSON-LD script in your root layout with @type:Organization (name, url, logo, sameAs) and @type:WebSite (name, url, potentialAction for site search).",
    filePath: layout.path,
    lineNumber: 1,
  }];
}

/* ================================================================
 * AI OVERVIEWS / EXTRACTABILITY — Tier 4
 * ============================================================== */

/* 22. Content pages with no FAQ schema and no question H2s */
function checkAiOverviewsExtractability(_ctx: Ctx, files: Files): SeoIssue[] {
  const out: SeoIssue[] = [];
  // Marketing/blog/docs/help/faq pages are the AI-Overviews surface.
  const CONTENT_RE =
    /^(?:src\/)?app\/(?:\(marketing\)|blog|docs|help|faq|guides|learn|resources)\/(?:[^/]+\/)*page\.tsx?$/;
  for (const f of files) {
    if (!CONTENT_RE.test(f.path)) continue;
    const txt = f.content;
    // Skip if file already exports/renders FAQ structure
    if (/FAQPage|"@type"\s*:\s*["']FAQPage["']|<dl[\s>]/.test(txt)) continue;
    // Look for question-form H2s (start with How/What/Why/Can/Is/Do/Does/Should/When/Where + ends with ?)
    const h2Matches =
      txt.match(/<h2[^>]*>([^<]+)<\/h2>/gi) ?? [];
    const questionH2s = h2Matches.filter((h) =>
      /(?:How|What|Why|Can|Is|Are|Do|Does|Should|When|Where|Will|Could)\b[^<]*\?/i.test(
        h.replace(/<[^>]+>/g, ""),
      ),
    );
    if (questionH2s.length >= 2) continue;
    // Borderline. Only flag content-heavy pages (>800 chars of body text).
    const wordCount = txt
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "")
      .replace(/<[^>]+>/g, " ")
      .split(/\s+/)
      .filter(Boolean).length;
    if (wordCount < 120) continue;
    out.push({
      checkId: "seo/ai-overviews-not-extractable",
      dimension: "seo",
      severity: "low",
      subDimension: "ai_readiness",
      title: "Content page has no Q&A structure for AI Overviews",
      description:
        "Google's AI Overviews + ChatGPT/Claude/Perplexity citations favor pages with extractable answer-shaped content. This page has no FAQ JSON-LD, no <dl> definition list, and no question-form H2s — LLMs will struggle to quote a specific answer. Add either: (a) <h2>How does X work?</h2><p>1-sentence answer.</p> blocks, or (b) FAQPage JSON-LD with mainEntity Q/A pairs.",
      filePath: f.path,
      lineNumber: 1,
    });
  }
  return out;
}

/* 23. blog/docs/learn directory but no RSS / Atom feed */
function checkContentNoFeed(_ctx: Ctx, files: Files): SeoIssue[] {
  const hasContentDir = files.some((f) =>
    /^(?:src\/)?app\/(?:blog|docs|changelog|learn|guides)\/page\.tsx?$/.test(
      f.path,
    ),
  );
  if (!hasContentDir) return [];
  const hasFeed = files.some((f) =>
    /^(?:src\/)?app\/(?:feed|rss|atom)(?:\.xml)?\/route\.tsx?$/.test(f.path) ||
    f.path === "public/feed.xml" ||
    f.path === "public/rss.xml",
  );
  if (hasFeed) return [];
  return [{
    checkId: "seo/no-rss-feed",
    dimension: "seo",
    severity: "low",
    subDimension: "discoverability",
    title: "Content directory detected but no RSS / Atom feed",
    description:
      "You have a blog/docs/changelog/learn section but no feed. AI crawlers (RSS-aware: GPTBot, ClaudeBot, FeedBurner-equivalents) use feeds to discover new content. Add an `app/feed.xml/route.ts` that emits an RSS 2.0 or Atom 1.0 document.",
    filePath: "app/feed.xml/route.ts",
  }];
}

/* ================================================================
 * Run all
 * ============================================================== */
export function runSeoRepoChecks(ctx: Ctx, files: Files): SeoIssue[] {
  return [
    ...checkMissingMetadataExport(ctx, files),
    ...checkPlaceholderTitle(ctx, files),
    ...checkTitleTooLong(ctx, files),
    ...checkDescription(ctx, files),
    ...checkHtmlLang(ctx, files),
    ...checkRobotsMissing(ctx, files),
    ...checkSitemapMissing(ctx, files),
    ...checkOgImageMissing(ctx, files),
    ...checkLocalhostInOg(ctx, files),
    ...checkNoindexInCode(ctx, files),
    ...checkTwitterCardMissing(ctx, files),
    ...checkMetadataBaseMissing(ctx, files),
    ...checkRawImgTag(ctx),
    ...checkRawAnchorInternal(ctx),
    ...checkNoStructuredData(ctx, files),
    ...checkScriptNoStrategy(ctx),
    ...checkLlmsTxtMissing(ctx, files),
    ...checkRobotsAiBots(ctx, files),
    ...checkClientOnlyContentPage(ctx, files),
    ...checkNoBrandSchema(ctx, files),
    ...checkAiOverviewsExtractability(ctx, files),
    ...checkContentNoFeed(ctx, files),
  ];
}
