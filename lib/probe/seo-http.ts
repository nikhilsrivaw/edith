/**
 * Live SEO probe — server-side.
 *
 * Fetches the deployed URL plus robots.txt + sitemap.xml + a depth-1
 * internal-link mini-crawl. Captures response headers, status codes,
 * and the parsed HTML head of the home page. Designed to complete in
 * under 10s for a ~20-URL budget.
 *
 * Cheap (max ~30 HTTP requests per scan). The expensive part — rendering
 * each page in a browser for CWV — is the extension's job, not this file.
 */
import "server-only";
import type { Dimension, Severity } from "../mock-data";
import { detectJsRendered, type RenderVerdict } from "./seo-render";
import { auditImages, type ImageAudit } from "./seo-images";
import { crawlSite, type CrawlReport } from "./seo-crawl";

export type SeoHttpIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string; // synthetic: "live/<url-path>"
  lineNumber?: number;
  codeSnippet?: string;
  subDimension:
    | "technical_foundation"
    | "core_web_vitals"
    | "content_structure"
    | "indexability"
    | "discoverability"
    | "ai_readiness";
  evidence?: {
    url: string;
    status: number;
    headers?: Record<string, string>;
    snippet?: string;
  };
};

export type SeoHttpReport = {
  baseUrl: string;
  fetchedAt: string;
  homeStatus: number;
  homeHeaders: Record<string, string>;
  robotsTxt: { status: number; body?: string };
  sitemap: { status: number; urlsFound: number; urlsChecked: number };
  internalCrawl: {
    checked: number;
    broken: Array<{ url: string; status: number; foundOn: string }>;
  };
  parsedHead: ParsedHead | null;
  /** Tier 2 additions */
  renderVerdict: RenderVerdict | null;
  imageAudit: ImageAudit | null;
  siteCrawl: CrawlReport | null;
  issues: SeoHttpIssue[];
};

type ParsedHead = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  lang: string | null;
  metaRobots: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  twitterCard: string | null;
  hreflangs: Array<{ hreflang: string; href: string }>;
  jsonLdTypes: string[];
  h1Count: number;
};

const TIMEOUT_MS = 6_000;
const CRAWL_BUDGET = 20;
const UA = "edith-bot/1.0 (+https://edith.expert)";

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = TIMEOUT_MS,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function headersToObject(h: Headers): Record<string, string> {
  const o: Record<string, string> = {};
  h.forEach((v, k) => {
    o[k.toLowerCase()] = v;
  });
  return o;
}

function parseHead(html: string): ParsedHead {
  // Lightweight regex parsing — no DOM dependency. Tolerant of malformed input.
  const get = (re: RegExp): string | null => {
    const m = re.exec(html);
    return m ? m[1].trim() : null;
  };
  const matches = (re: RegExp): RegExpMatchArray[] => {
    const all: RegExpMatchArray[] = [];
    let m: RegExpMatchArray | null;
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    while ((m = g.exec(html))) all.push(m);
    return all;
  };

  const title = get(/<title[^>]*>([^<]+)<\/title>/i);
  const description = get(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const canonical = get(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const lang = get(/<html[^>]+lang=["']([^"']+)["']/i);
  const metaRobots = get(
    /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogTitle = get(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogDescription = get(
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
  );
  const ogImage = get(
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
  );
  const twitterCard = get(
    /<meta[^>]+name=["']twitter:card["'][^>]+content=["']([^"']*)["']/i,
  );
  const hreflangs = matches(
    /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi,
  ).map((m) => ({ hreflang: m[1], href: m[2] }));

  const jsonLdBlocks = matches(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  const jsonLdTypes: string[] = [];
  for (const block of jsonLdBlocks) {
    try {
      const j: unknown = JSON.parse(block[1].trim());
      const walk = (obj: unknown) => {
        if (Array.isArray(obj)) obj.forEach(walk);
        else if (obj && typeof obj === "object") {
          const t = (obj as Record<string, unknown>)["@type"];
          if (typeof t === "string") jsonLdTypes.push(t);
          else if (Array.isArray(t))
            t.forEach((s) => typeof s === "string" && jsonLdTypes.push(s));
        }
      };
      walk(j);
    } catch {
      // invalid JSON-LD will be reported by a check
    }
  }

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;

  return {
    title,
    description,
    canonical,
    lang,
    metaRobots,
    ogTitle,
    ogDescription,
    ogImage,
    twitterCard,
    hreflangs,
    jsonLdTypes,
    h1Count,
  };
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const out = new Set<string>();
  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1];
    try {
      const u = new URL(href, base);
      if (u.hostname !== base.hostname) continue;
      // Strip hash and search for de-dup; we crawl by path only.
      u.hash = "";
      u.search = "";
      out.add(u.toString());
    } catch {
      // ignore malformed hrefs
    }
  }
  return Array.from(out);
}

function parseSitemapUrls(xml: string): string[] {
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/* ================================================================
 * The probe entrypoint
 * ============================================================== */

export async function probeLiveSeo(baseUrl: string): Promise<SeoHttpReport> {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error(`Invalid baseUrl: ${baseUrl}`);
  }

  const issues: SeoHttpIssue[] = [];

  // 1. Home page
  const homeRes = await fetchWithTimeout(base.toString());
  const homeStatus = homeRes?.status ?? 0;
  const homeHeaders = homeRes ? headersToObject(homeRes.headers) : {};
  const html = homeRes && homeRes.ok ? await homeRes.text() : "";

  if (!homeRes || !homeRes.ok) {
    issues.push({
      checkId: "seo/home-not-200",
      dimension: "seo",
      severity: "critical",
      subDimension: "indexability",
      title: `Home page returned ${homeStatus || "no response"}`,
      description: `EDITH fetched ${base.toString()} and got ${homeStatus || "no response"}. Search engines see exactly this — pages that don't return 200 don't get indexed.`,
      filePath: `live${base.pathname}`,
      evidence: { url: base.toString(), status: homeStatus, headers: homeHeaders },
    });
  }

  // 2. Parse head
  const parsedHead = html ? parseHead(html) : null;

  if (parsedHead) {
    // Issues derived from live HTML head
    if (!parsedHead.title) {
      issues.push({
        checkId: "seo/live-no-title",
        dimension: "seo",
        severity: "critical",
        subDimension: "technical_foundation",
        title: "Live page rendered with no <title>",
        description:
          "The deployed page has no <title> in the rendered HTML. This is what Google indexes — without a title you're invisible. Compare your metadata exports to what's actually rendered (likely a layout override).",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (!parsedHead.lang) {
      issues.push({
        checkId: "seo/live-html-no-lang",
        dimension: "seo",
        severity: "high",
        subDimension: "technical_foundation",
        title: "<html> on live page has no `lang`",
        description:
          "The deployed page omits the html lang attribute. Screen readers can't switch voice profiles, and Google's hreflang strategy can't work. Set `<html lang='en'>` (or your locale).",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (!parsedHead.canonical) {
      issues.push({
        checkId: "seo/live-no-canonical",
        dimension: "seo",
        severity: "medium",
        subDimension: "indexability",
        title: "No canonical URL on live page",
        description:
          "Without a `<link rel='canonical'>`, duplicate URLs (with/without trailing slash, www, query params) all compete for the same ranking. Add `alternates: { canonical: '/...' }` to metadata.",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (parsedHead.metaRobots && /noindex/i.test(parsedHead.metaRobots)) {
      issues.push({
        checkId: "seo/live-noindex-shipped",
        dimension: "seo",
        severity: "critical",
        subDimension: "indexability",
        title: "Live page is `noindex` — entire site is de-indexed",
        description: `The live page renders <meta name='robots' content='${parsedHead.metaRobots}'>. Google will not index this. Almost certainly a guard left in code or a CMS setting.`,
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (parsedHead.h1Count === 0) {
      issues.push({
        checkId: "seo/live-no-h1",
        dimension: "seo",
        severity: "high",
        subDimension: "content_structure",
        title: "Live page has no <h1>",
        description:
          "Every page should have one and only one <h1>. Without it, Google has no primary heading signal and screen readers can't establish a top-level landmark.",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (parsedHead.h1Count > 1) {
      issues.push({
        checkId: "seo/live-multiple-h1",
        dimension: "seo",
        severity: "medium",
        subDimension: "content_structure",
        title: `Live page has ${parsedHead.h1Count} <h1> tags`,
        description:
          "Multiple <h1>s split the page's heading authority. Use one <h1> per page (your main page title) and downgrade the others to <h2> / <h3>.",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (!parsedHead.ogImage) {
      issues.push({
        checkId: "seo/live-no-og-image",
        dimension: "seo",
        severity: "high",
        subDimension: "technical_foundation",
        title: "Live page renders no og:image",
        description:
          "Every social share will get a blank or generic placeholder. Add `openGraph: { images: [...] }` to metadata or create `app/opengraph-image.tsx`.",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
    if (parsedHead.jsonLdTypes.length === 0) {
      issues.push({
        checkId: "seo/live-no-json-ld",
        dimension: "seo",
        severity: "medium",
        subDimension: "ai_readiness",
        title: "No JSON-LD structured data in rendered HTML",
        description:
          "No <script type='application/ld+json'> blocks found on the live page. LLMs (ChatGPT, Claude, Perplexity) lean heavily on schema.org for grounding. Add at least Organization + WebSite.",
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
  }

  // 3. Response headers
  if (homeHeaders["x-robots-tag"] && /noindex/i.test(homeHeaders["x-robots-tag"])) {
    issues.push({
      checkId: "seo/x-robots-noindex",
      dimension: "seo",
      severity: "critical",
      subDimension: "indexability",
      title: "Response header `X-Robots-Tag: noindex`",
      description: `The server is sending \`X-Robots-Tag: ${homeHeaders["x-robots-tag"]}\`. This trumps any <meta robots> directive. Check your next.config headers() and your hosting platform's edge config — common cause: staging headers leaked to prod.`,
      filePath: `live${base.pathname}`,
      evidence: {
        url: base.toString(),
        status: homeStatus,
        headers: homeHeaders,
      },
    });
  }

  if (!homeHeaders["cache-control"] && homeRes && homeRes.ok) {
    issues.push({
      checkId: "seo/no-cache-control",
      dimension: "seo",
      severity: "low",
      subDimension: "indexability",
      title: "No `Cache-Control` header on home page",
      description:
        "Without a Cache-Control header, browsers and CDNs use heuristic caching — unpredictable and usually wrong. Set explicit `Cache-Control: public, max-age=...` via `headers()` in next.config.",
      filePath: `live${base.pathname}`,
      evidence: { url: base.toString(), status: homeStatus, headers: homeHeaders },
    });
  }

  // 4. robots.txt
  const robotsUrl = new URL("/robots.txt", base).toString();
  const robotsRes = await fetchWithTimeout(robotsUrl);
  const robotsStatus = robotsRes?.status ?? 0;
  const robotsBody = robotsRes && robotsRes.ok ? await robotsRes.text() : undefined;
  if (!robotsRes || !robotsRes.ok) {
    issues.push({
      checkId: "seo/robots-not-200",
      dimension: "seo",
      severity: "high",
      subDimension: "technical_foundation",
      title: `robots.txt returns ${robotsStatus || "no response"}`,
      description:
        "Crawlers expect /robots.txt to return 200. A 404 means no crawler instructions — they'll crawl everything (waste of budget) and you have no way to gate AI bots.",
      filePath: `live/robots.txt`,
      evidence: { url: robotsUrl, status: robotsStatus },
    });
  } else if (robotsBody && /^\s*User-agent:\s*\*\s*$\s*Disallow:\s*\/\s*$/m.test(robotsBody)) {
    issues.push({
      checkId: "seo/robots-disallows-all",
      dimension: "seo",
      severity: "critical",
      subDimension: "indexability",
      title: "robots.txt disallows the entire site",
      description:
        "Your live robots.txt blocks all crawlers from `/`. Unless this is intentional (private app), it means zero search visibility. Likely a staging file shipped to prod.",
      filePath: `live/robots.txt`,
      evidence: { url: robotsUrl, status: robotsStatus, snippet: robotsBody.slice(0, 200) },
    });
  }

  // 5. sitemap.xml
  const sitemapUrl = new URL("/sitemap.xml", base).toString();
  const sitemapRes = await fetchWithTimeout(sitemapUrl);
  const sitemapStatus = sitemapRes?.status ?? 0;
  let sitemapUrls: string[] = [];
  if (sitemapRes && sitemapRes.ok) {
    const xml = await sitemapRes.text();
    sitemapUrls = parseSitemapUrls(xml);
  } else {
    issues.push({
      checkId: "seo/sitemap-not-200",
      dimension: "seo",
      severity: "high",
      subDimension: "technical_foundation",
      title: `sitemap.xml returns ${sitemapStatus || "no response"}`,
      description:
        "Without a reachable sitemap, search engines discover pages only via crawl. Indexing latency stretches from hours to weeks for new content.",
      filePath: `live/sitemap.xml`,
      evidence: { url: sitemapUrl, status: sitemapStatus },
    });
  }

  // 6. Internal crawl (budget = CRAWL_BUDGET)
  const broken: Array<{ url: string; status: number; foundOn: string }> = [];
  let checked = 0;
  if (html) {
    const links = extractInternalLinks(html, base.toString()).slice(0, CRAWL_BUDGET);
    const results = await Promise.all(
      links.map(async (url) => {
        const r = await fetchWithTimeout(url, { method: "HEAD" }, 3000);
        return { url, status: r?.status ?? 0 };
      }),
    );
    checked = results.length;
    for (const { url, status } of results) {
      if (status >= 400 || status === 0) {
        broken.push({ url, status, foundOn: base.toString() });
      }
    }
    if (broken.length > 0) {
      issues.push({
        checkId: "seo/broken-internal-links",
        dimension: "seo",
        severity: "high",
        subDimension: "indexability",
        title: `${broken.length} broken internal link${broken.length === 1 ? "" : "s"}`,
        description: `Found ${broken.length} internal link${broken.length === 1 ? "" : "s"} returning 4xx/5xx (out of ${checked} checked). Broken links waste crawl budget and hurt rankings. First few: ${broken.slice(0, 5).map((b) => `${b.url} (${b.status})`).join(", ")}.`,
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
  }

  /* ===== Tier 4: AI conventions ===== */
  await probeAiConventions(base, issues);

  /* ===== Tier 2: JS-render detection ===== */
  let renderVerdict: RenderVerdict | null = null;
  if (html) {
    renderVerdict = detectJsRendered(html);
    if (renderVerdict.isSpa && renderVerdict.confidence !== "low") {
      issues.push({
        checkId: "seo/js-only-rendering",
        dimension: "seo",
        severity:
          renderVerdict.confidence === "high" ? "critical" : "high",
        subDimension: "ai_readiness",
        title: "Page is client-rendered — non-JS crawlers see an empty shell",
        description: `Raw HTML response contains almost no visible content (${renderVerdict.visibleTextLength} chars of text). Bing, DuckDuckGo, ChatGPT (with web), Claude (with web), Perplexity, and AI-search crawlers don't execute JS — they see what curl sees. Switch to server components / SSR / SSG for content pages, or use next/dynamic with \`ssr: true\`. Reasons detected: ${renderVerdict.reasons.join(" · ")}`,
        filePath: `live${base.pathname}`,
        evidence: { url: base.toString(), status: homeStatus },
      });
    }
  }

  /* ===== Tier 2: image deep audit ===== */
  let imageAudit: ImageAudit | null = null;
  if (html) {
    imageAudit = await auditImages({ homeUrl: base.toString(), html });
    issues.push(...imageAudit.issues);
  }

  /* ===== Tier 2: multi-page crawl ===== */
  let siteCrawl: CrawlReport | null = null;
  if (homeRes && homeRes.ok) {
    siteCrawl = await crawlSite({
      baseUrl: base.toString(),
      seedUrls: sitemapUrls,
    });
    issues.push(...siteCrawl.issues);
  }

  return {
    baseUrl: base.toString(),
    fetchedAt: new Date().toISOString(),
    homeStatus,
    homeHeaders,
    robotsTxt: { status: robotsStatus, body: robotsBody },
    sitemap: {
      status: sitemapStatus,
      urlsFound: sitemapUrls.length,
      urlsChecked: siteCrawl?.pages.length ?? 0,
    },
    internalCrawl: { checked, broken },
    parsedHead,
    renderVerdict,
    imageAudit,
    siteCrawl,
    issues,
  };
}

/* ================================================================
 * AI convention probes — llms.txt content + .well-known/* discovery
 * ============================================================== */
async function probeAiConventions(
  base: URL,
  issues: SeoHttpIssue[],
): Promise<void> {
  // llms.txt content
  const llmsRes = await fetchWithTimeout(new URL("/llms.txt", base).toString());
  if (llmsRes && llmsRes.ok) {
    const body = await llmsRes.text();
    // Validate: looks like markdown with URLs in it
    const urlsInside = body.match(/https?:\/\/\S+/g) ?? [];
    if (urlsInside.length === 0) {
      issues.push({
        checkId: "seo/llms-txt-empty",
        dimension: "seo",
        severity: "low",
        subDimension: "ai_readiness",
        title: "llms.txt is empty or has no URLs",
        description:
          "llms.txt is meant to list canonical doc URLs for LLM crawlers. An empty file confuses crawlers more than no file. Either populate it with markdown links to your docs/blog/api refs, or remove it.",
        filePath: "live/llms.txt",
        evidence: { url: new URL("/llms.txt", base).toString(), status: llmsRes.status },
      });
    } else {
      // Sample up to 5 URLs and HEAD them to catch broken refs.
      const sample = urlsInside.slice(0, 5);
      const broken: string[] = [];
      await Promise.all(
        sample.map(async (u) => {
          const r = await fetchWithTimeout(u, { method: "HEAD" }, 3000);
          if (!r || !r.ok) broken.push(u);
        }),
      );
      if (broken.length > 0) {
        issues.push({
          checkId: "seo/llms-txt-broken-urls",
          dimension: "seo",
          severity: "medium",
          subDimension: "ai_readiness",
          title: `${broken.length} URL${broken.length === 1 ? "" : "s"} in llms.txt are unreachable`,
          description: `llms.txt should point to live, reachable canonical docs. Broken refs include: ${broken.slice(0, 3).join(", ")}. Fix the URLs or remove dead entries.`,
          filePath: "live/llms.txt",
          evidence: {
            url: new URL("/llms.txt", base).toString(),
            status: llmsRes.status,
          },
        });
      }
    }
  }

  // .well-known/ai-plugin.json
  const aiPluginUrl = new URL("/.well-known/ai-plugin.json", base).toString();
  const aiRes = await fetchWithTimeout(aiPluginUrl);
  if (aiRes && aiRes.ok) {
    const txt = await aiRes.text();
    try {
      const j = JSON.parse(txt) as Record<string, unknown>;
      const required = ["schema_version", "name_for_model", "description_for_model"];
      const missing = required.filter((k) => !(k in j));
      if (missing.length > 0) {
        issues.push({
          checkId: "seo/ai-plugin-invalid",
          dimension: "seo",
          severity: "medium",
          subDimension: "ai_readiness",
          title: ".well-known/ai-plugin.json is missing required fields",
          description: `Missing keys: ${missing.join(", ")}. The OpenAI plugin spec (still used by some AI agents for tool discovery) requires schema_version, name_for_model, description_for_model. Either complete the manifest or remove it.`,
          filePath: "live/.well-known/ai-plugin.json",
          evidence: { url: aiPluginUrl, status: aiRes.status },
        });
      }
    } catch {
      issues.push({
        checkId: "seo/ai-plugin-not-json",
        dimension: "seo",
        severity: "medium",
        subDimension: "ai_readiness",
        title: ".well-known/ai-plugin.json doesn't parse",
        description:
          "The file exists but isn't valid JSON. AI agents will silently skip it. Either fix the syntax or remove the file.",
        filePath: "live/.well-known/ai-plugin.json",
        evidence: { url: aiPluginUrl, status: aiRes.status },
      });
    }
  }

  // .well-known/mcp.json — emerging MCP-server discovery convention
  const mcpUrl = new URL("/.well-known/mcp.json", base).toString();
  const mcpRes = await fetchWithTimeout(mcpUrl);
  if (mcpRes && mcpRes.ok) {
    const txt = await mcpRes.text();
    try {
      JSON.parse(txt);
    } catch {
      issues.push({
        checkId: "seo/mcp-manifest-invalid",
        dimension: "seo",
        severity: "low",
        subDimension: "ai_readiness",
        title: ".well-known/mcp.json doesn't parse",
        description:
          "The MCP discovery manifest must be valid JSON. AI agents looking for MCP-compatible APIs will silently skip it. Fix the syntax.",
        filePath: "live/.well-known/mcp.json",
        evidence: { url: mcpUrl, status: mcpRes.status },
      });
    }
  }
}
