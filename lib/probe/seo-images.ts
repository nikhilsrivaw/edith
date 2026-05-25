/**
 * Image deep audit — server-side.
 *
 * Extracts every <img src> + CSS background-image URL from the home HTML,
 * HEADs each (up to a budget cap), and reports per-image:
 *   – format (jpeg / png / webp / avif / svg / gif / unknown)
 *   – Content-Length (bytes on the wire)
 *   – Cache-Control presence
 *   – Whether next/image-optimized (Vercel/Next pattern: /_next/image?url=…)
 *
 * Then emits issues for:
 *   – Photos > 500KB without AVIF/WebP
 *   – Hero images > 2MB
 *   – Images without explicit width/height in the source HTML (CLS risk)
 *   – More than 10 distinct image hosts (CDN sprawl)
 */
import "server-only";
import type { Severity } from "../mock-data";
import type { SeoHttpIssue } from "./seo-http";

export type ImageAudit = {
  totalFound: number;
  totalAudited: number;
  totalBytes: number;
  perImage: Array<ImageRecord>;
  issues: SeoHttpIssue[];
};

export type ImageRecord = {
  src: string;
  resolved: string;
  format: string | null;
  bytes: number | null;
  status: number;
  cacheControl: string | null;
  optimized: boolean;
  hasExplicitDims: boolean;
};

const TIMEOUT_MS = 4_000;
const BUDGET = 30;
const UA = "edith-bot/1.0 (+https://edith.expert)";

const FORMAT_FROM_CT: Array<[RegExp, string]> = [
  [/avif/, "avif"],
  [/webp/, "webp"],
  [/png/, "png"],
  [/jpeg|jpg/, "jpeg"],
  [/svg/, "svg"],
  [/gif/, "gif"],
];

function formatFromContentType(ct: string | null): string | null {
  if (!ct) return null;
  const lc = ct.toLowerCase();
  for (const [re, name] of FORMAT_FROM_CT) if (re.test(lc)) return name;
  return null;
}

function formatFromUrl(url: string): string | null {
  const m = url.toLowerCase().match(/\.([a-z0-9]{3,4})(?:\?|#|$)/);
  if (!m) return null;
  const ext = m[1];
  if (["avif", "webp", "png", "svg", "gif"].includes(ext)) return ext;
  if (["jpg", "jpeg"].includes(ext)) return "jpeg";
  return null;
}

async function headWithTimeout(
  url: string,
  timeoutMs = TIMEOUT_MS,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: "HEAD",
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "image/avif,image/webp,*/*" },
      redirect: "follow",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/** Pull every <img src=…> + style background-image URL from raw HTML. */
function extractImageSources(
  html: string,
  baseUrl: string,
): Array<{ src: string; resolved: string; hasExplicitDims: boolean }> {
  const base = new URL(baseUrl);
  const out: Array<{ src: string; resolved: string; hasExplicitDims: boolean }> = [];
  const seen = new Set<string>();

  // <img src="…"> with optional width/height
  const imgRe = /<img\b([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html))) {
    const attrs = m[1];
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) continue;
    const src = srcMatch[1];
    if (!src || src.startsWith("data:")) continue;
    const hasW = /\bwidth\s*=/.test(attrs);
    const hasH = /\bheight\s*=/.test(attrs);
    let resolved = src;
    try {
      resolved = new URL(src, base).toString();
    } catch {
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push({
      src,
      resolved,
      hasExplicitDims: hasW && hasH,
    });
  }

  // CSS background-image: url(…)
  const bgRe = /background-image\s*:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRe.exec(html))) {
    const src = m[1];
    if (!src || src.startsWith("data:")) continue;
    let resolved = src;
    try {
      resolved = new URL(src, base).toString();
    } catch {
      continue;
    }
    if (seen.has(resolved)) continue;
    seen.add(resolved);
    out.push({ src, resolved, hasExplicitDims: false });
  }

  return out;
}

export async function auditImages(args: {
  homeUrl: string;
  html: string;
}): Promise<ImageAudit> {
  const sources = extractImageSources(args.html, args.homeUrl);
  const budgeted = sources.slice(0, BUDGET);

  const records: ImageRecord[] = await Promise.all(
    budgeted.map(async (s) => {
      const res = await headWithTimeout(s.resolved);
      const ct = res?.headers.get("content-type");
      const cc = res?.headers.get("cache-control");
      const len = res?.headers.get("content-length");
      const fmt = formatFromContentType(ct) ?? formatFromUrl(s.resolved);
      return {
        src: s.src,
        resolved: s.resolved,
        format: fmt,
        bytes: len ? Number(len) : null,
        status: res?.status ?? 0,
        cacheControl: cc,
        optimized: /\/_next\/image\?/.test(s.resolved),
        hasExplicitDims: s.hasExplicitDims,
      };
    }),
  );

  const totalBytes = records.reduce((s, r) => s + (r.bytes ?? 0), 0);
  const issues: SeoHttpIssue[] = [];

  // Big photos without modern format
  for (const r of records) {
    if (!r.bytes) continue;
    const isPhoto =
      r.format === "jpeg" || r.format === "png" || r.format === "gif";
    if (isPhoto && r.bytes > 500 * 1024 && !r.optimized) {
      issues.push({
        checkId: "seo/image-bloat",
        dimension: "seo",
        severity: r.bytes > 2 * 1024 * 1024 ? "high" : "medium",
        subDimension: "core_web_vitals",
        title: `${r.format?.toUpperCase()} image ${(r.bytes / 1024).toFixed(0)}KB without AVIF/WebP`,
        description: `${r.resolved.split("/").at(-1)} is ${(r.bytes / 1024).toFixed(0)}KB served as ${r.format}. Switch to next/image — Next.js auto-serves AVIF/WebP and resizes for the viewport, typically a 5-10× reduction in bytes.`,
        filePath: `live/${new URL(r.resolved).pathname}`,
        evidence: {
          url: r.resolved,
          status: r.status,
        },
      });
    }
    if (!r.hasExplicitDims && r.bytes > 50 * 1024) {
      issues.push({
        checkId: "seo/image-no-dims",
        dimension: "seo",
        severity: "low",
        subDimension: "core_web_vitals",
        title: `Image without explicit width/height (${(r.bytes / 1024).toFixed(0)}KB)`,
        description: `${r.resolved.split("/").at(-1)} has no width/height attributes — browser can't reserve space, causing layout shift when it loads. Set both attrs (or use next/image with explicit dims).`,
        filePath: `live/${new URL(r.resolved).pathname}`,
        evidence: { url: r.resolved, status: r.status },
      });
    }
    if (r.format === "gif" && r.bytes > 200 * 1024) {
      issues.push({
        checkId: "seo/gif-too-big",
        dimension: "seo",
        severity: "medium",
        subDimension: "core_web_vitals",
        title: `GIF ${(r.bytes / 1024).toFixed(0)}KB used where video would be smaller`,
        description: `GIFs above ~200KB are almost always smaller as <video autoplay muted loop> with H.264/H.265 or WebM. Typical 10-50× reduction. ${r.resolved}`,
        filePath: `live/${new URL(r.resolved).pathname}`,
        evidence: { url: r.resolved, status: r.status },
      });
    }
    if (r.status === 404 || r.status === 0) {
      issues.push({
        checkId: "seo/image-broken",
        dimension: "seo",
        severity: "high" as Severity,
        subDimension: "content_structure",
        title: "Broken image reference",
        description: `${r.resolved} returns ${r.status || "no response"}. Broken images hurt UX, kill alt-text-based SEO, and waste crawl budget.`,
        filePath: `live/${new URL(r.resolved).pathname}`,
        evidence: { url: r.resolved, status: r.status },
      });
    }
  }

  // CDN sprawl — many distinct hosts means complex configuration + DNS overhead
  const hosts = new Set(
    records.map((r) => {
      try {
        return new URL(r.resolved).host;
      } catch {
        return "?";
      }
    }),
  );
  if (hosts.size > 6) {
    issues.push({
      checkId: "seo/image-cdn-sprawl",
      dimension: "seo",
      severity: "low",
      subDimension: "core_web_vitals",
      title: `Images served from ${hosts.size} different hosts`,
      description: `Each new host triggers a DNS lookup + TLS handshake. Consolidate to a single image CDN (next/image, Vercel, Cloudinary, ImageKit) so the browser reuses one warm connection.`,
      filePath: `live${new URL(args.homeUrl).pathname}`,
      evidence: { url: args.homeUrl, status: 200 },
    });
  }

  return {
    totalFound: sources.length,
    totalAudited: records.length,
    totalBytes,
    perImage: records,
    issues,
  };
}
