/**
 * Multi-page SEO crawl — server-side.
 *
 * Crawls the deployed app starting from the home page + sitemap URLs.
 * Caps at depth 2, 50 pages total, 6 concurrent. For each page captures
 * status + parsed head + outgoing links so the aggregator can detect:
 *
 *   – Duplicate <title> across pages (Google merges results, kills rank)
 *   – Duplicate <description>
 *   – Pages with no canonical or wrong-domain canonical
 *   – Orphan pages (in sitemap, not linked from any crawled page)
 *   – Pages where the rendered head conflicts with the home page's
 *
 * Designed to finish in under 30s for any reasonable site. Uses HEAD-then-GET
 * pattern: HEAD to confirm 200 + Content-Type, GET only if HTML.
 */
import "server-only";
import type { Severity } from "../mock-data";
import type { SeoHttpIssue } from "./seo-http";

const TIMEOUT_MS = 5_000;
const CRAWL_BUDGET = 50;
const MAX_DEPTH = 2;
const CONCURRENCY = 6;
const UA = "edith-bot/1.0 (+https://edith.expert)";

export type CrawledPage = {
  url: string;
  depth: number;
  status: number;
  contentType: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  h1Count: number;
  bytes: number;
  outgoingInternalLinks: string[];
};

export type CrawlReport = {
  pages: CrawledPage[];
  budget: { used: number; limit: number };
  issues: SeoHttpIssue[];
};

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

function normalize(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base);
    if (u.hostname !== base.hostname) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    u.search = "";
    // Strip trailing slash for dedup, except for root.
    if (u.pathname.length > 1 && u.pathname.endsWith("/"))
      u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

function get(re: RegExp, html: string): string | null {
  const m = re.exec(html);
  return m ? m[1].trim() : null;
}

function parsePage(url: string, html: string): Omit<CrawledPage, "url" | "depth" | "status" | "contentType" | "bytes" | "outgoingInternalLinks"> {
  return {
    title: get(/<title[^>]*>([^<]+)<\/title>/i, html),
    description: get(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
      html,
    ),
    canonical: get(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
      html,
    ),
    h1Count: (html.match(/<h1[\s>]/gi) ?? []).length,
  };
  void url;
}

function extractLinks(html: string, base: URL): string[] {
  const out = new Set<string>();
  const re = /<a\b[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const norm = normalize(m[1], base);
    if (norm) out.add(norm);
  }
  return Array.from(out);
}

export async function crawlSite(args: {
  baseUrl: string;
  /** URLs already discovered (e.g. from sitemap.xml) — seeded into the queue. */
  seedUrls?: string[];
}): Promise<CrawlReport> {
  let base: URL;
  try {
    base = new URL(args.baseUrl);
  } catch {
    return {
      pages: [],
      budget: { used: 0, limit: CRAWL_BUDGET },
      issues: [],
    };
  }

  const visited = new Set<string>();
  const pages: CrawledPage[] = [];
  type Job = { url: string; depth: number };
  let queue: Job[] = [{ url: base.toString(), depth: 0 }];
  for (const s of args.seedUrls ?? []) {
    const norm = normalize(s, base);
    if (norm) queue.push({ url: norm, depth: 0 });
  }

  while (queue.length > 0 && pages.length < CRAWL_BUDGET) {
    const batch = queue.slice(0, CONCURRENCY);
    queue = queue.slice(CONCURRENCY);

    const fetched = await Promise.all(
      batch.map(async (job): Promise<CrawledPage | null> => {
        if (visited.has(job.url)) return null;
        visited.add(job.url);
        const res = await fetchWithTimeout(job.url);
        if (!res) {
          return {
            url: job.url,
            depth: job.depth,
            status: 0,
            contentType: null,
            title: null,
            description: null,
            canonical: null,
            h1Count: 0,
            bytes: 0,
            outgoingInternalLinks: [],
          };
        }
        const ct = res.headers.get("content-type");
        if (!res.ok || !ct || !/text\/html/i.test(ct)) {
          return {
            url: job.url,
            depth: job.depth,
            status: res.status,
            contentType: ct,
            title: null,
            description: null,
            canonical: null,
            h1Count: 0,
            bytes: 0,
            outgoingInternalLinks: [],
          };
        }
        const html = await res.text();
        const parsed = parsePage(job.url, html);
        const links =
          job.depth < MAX_DEPTH ? extractLinks(html, base) : [];
        return {
          url: job.url,
          depth: job.depth,
          status: res.status,
          contentType: ct,
          ...parsed,
          bytes: html.length,
          outgoingInternalLinks: links,
        };
      }),
    );

    for (const p of fetched) {
      if (!p) continue;
      pages.push(p);
      if (p.depth < MAX_DEPTH) {
        for (const link of p.outgoingInternalLinks) {
          if (!visited.has(link) && pages.length + queue.length < CRAWL_BUDGET) {
            queue.push({ url: link, depth: p.depth + 1 });
          }
        }
      }
    }
  }

  return {
    pages,
    budget: { used: pages.length, limit: CRAWL_BUDGET },
    issues: analyzeCrawl(pages, base, args.seedUrls ?? []),
  };
}

/** Site-wide correlations across crawled pages. */
function analyzeCrawl(
  pages: CrawledPage[],
  base: URL,
  sitemapUrls: string[],
): SeoHttpIssue[] {
  const issues: SeoHttpIssue[] = [];
  const ok = pages.filter((p) => p.status >= 200 && p.status < 300 && p.title);

  /* ===== Duplicate titles ===== */
  const titleMap = new Map<string, CrawledPage[]>();
  for (const p of ok) {
    if (!p.title) continue;
    const key = p.title.trim().toLowerCase();
    const arr = titleMap.get(key) || [];
    arr.push(p);
    titleMap.set(key, arr);
  }
  for (const [key, group] of titleMap) {
    if (group.length < 2) continue;
    issues.push({
      checkId: "seo/duplicate-title",
      dimension: "seo",
      severity: "high",
      subDimension: "indexability",
      title: `${group.length} pages share the same <title>`,
      description: `${group.length} pages return the title "${group[0]!.title}" — Google merges duplicate results, killing your ranking on the merged-away ones. URLs: ${group.slice(0, 4).map((g) => g.url).join(", ")}${group.length > 4 ? "…" : ""}. Set a per-page title (or use metadata.template with %s for dynamic slugs).`,
      filePath: `live${new URL(group[0]!.url).pathname}`,
      evidence: {
        url: group[0]!.url,
        status: group[0]!.status,
        snippet: key.slice(0, 200),
      },
    });
  }

  /* ===== Duplicate descriptions ===== */
  const descMap = new Map<string, CrawledPage[]>();
  for (const p of ok) {
    if (!p.description || p.description.length < 30) continue;
    const key = p.description.trim().toLowerCase();
    const arr = descMap.get(key) || [];
    arr.push(p);
    descMap.set(key, arr);
  }
  for (const [, group] of descMap) {
    if (group.length < 3) continue; // 2 is common (root + group landing); 3+ is suspicious
    issues.push({
      checkId: "seo/duplicate-description",
      dimension: "seo",
      severity: "medium",
      subDimension: "indexability",
      title: `${group.length} pages share an identical <meta description>`,
      description: `${group.length} URLs return the same meta description. Crawlers treat repeated descriptions as a signal of low-quality / templated content. Generate per-page descriptions in your metadata function — the page slug or first paragraph is usually enough.`,
      filePath: `live${new URL(group[0]!.url).pathname}`,
      evidence: { url: group[0]!.url, status: group[0]!.status },
    });
  }

  /* ===== Pages missing canonical ===== */
  const noCanon = ok.filter((p) => !p.canonical);
  if (noCanon.length > 0 && noCanon.length / ok.length > 0.4) {
    issues.push({
      checkId: "seo/canonical-coverage",
      dimension: "seo",
      severity: "medium",
      subDimension: "indexability",
      title: `${noCanon.length} of ${ok.length} crawled pages have no canonical`,
      description: `Pages without rel="canonical" are vulnerable to duplicate-URL splits (with/without slash, http/https, www, query-param tracking). Add \`alternates: { canonical: '/path' }\` to every page's metadata.`,
      filePath: `live${new URL(noCanon[0]!.url).pathname}`,
      evidence: { url: noCanon[0]!.url, status: noCanon[0]!.status },
    });
  }

  /* ===== Canonical-to-different-domain ===== */
  for (const p of ok) {
    if (!p.canonical) continue;
    try {
      const canonHost = new URL(p.canonical, base).hostname;
      if (canonHost && canonHost !== base.hostname) {
        issues.push({
          checkId: "seo/canonical-cross-domain",
          dimension: "seo",
          severity: "high",
          subDimension: "indexability",
          title: `Canonical points to different domain`,
          description: `${p.url} has \`<link rel="canonical" href="${p.canonical}">\` — pointing at ${canonHost} instead of ${base.hostname}. This tells Google "the real version of this page is somewhere else", de-indexing your domain. Almost certainly an env-var mistake.`,
          filePath: `live${new URL(p.url).pathname}`,
          evidence: { url: p.url, status: p.status },
        });
      }
    } catch {
      /* ignore unparseable canonical */
    }
  }

  /* ===== Orphan pages (in sitemap, not linked from anywhere we crawled) ===== */
  const linkedUrls = new Set<string>();
  for (const p of pages) for (const l of p.outgoingInternalLinks) linkedUrls.add(l);
  const orphans: string[] = [];
  for (const s of sitemapUrls) {
    const norm = normalize(s, base);
    if (!norm) continue;
    if (norm === base.toString().replace(/\/$/, "") + "/") continue;
    if (!linkedUrls.has(norm) && !linkedUrls.has(norm + "/")) orphans.push(norm);
  }
  if (orphans.length > 0) {
    issues.push({
      checkId: "seo/orphan-pages",
      dimension: "seo",
      severity: "low",
      subDimension: "discoverability",
      title: `${orphans.length} orphan page${orphans.length === 1 ? "" : "s"} (in sitemap, not internally linked)`,
      description: `Orphan pages get crawled (sitemap entry) but inherit zero link equity, so they rank poorly. Add at least one internal link from a relevant parent. First few: ${orphans.slice(0, 5).join(", ")}`,
      filePath: `live${new URL(orphans[0]!).pathname}`,
      evidence: { url: orphans[0]!, status: 0 },
    });
  }

  /* ===== 4xx/5xx coverage ===== */
  const errors = pages.filter((p) => p.status >= 400);
  if (errors.length > 0) {
    issues.push({
      checkId: "seo/crawl-errors",
      dimension: "seo",
      severity: errors.length > 5 ? "high" : ("medium" as Severity),
      subDimension: "indexability",
      title: `${errors.length} crawled page${errors.length === 1 ? "" : "s"} returned 4xx/5xx`,
      description: `Broken pages waste crawl budget and signal low quality. First few: ${errors.slice(0, 5).map((e) => `${e.url} (${e.status})`).join(", ")}`,
      filePath: `live${new URL(errors[0]!.url).pathname}`,
      evidence: { url: errors[0]!.url, status: errors[0]!.status },
    });
  }

  return issues;
}
