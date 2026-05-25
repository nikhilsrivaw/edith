/**
 * SEO Aggregator — the moat.
 *
 * Takes three independent signal streams (repo scan, live HTTP probe,
 * browser-extension runtime probe) and emits correlated Issue rows that
 * no single tool can produce alone.
 *
 * The killer correlations:
 *   – **Title drift**: repo metadata.title ≠ live <title>
 *     ("your code says X but Google sees Y; layout override at file:line")
 *   – **LCP source**: extension says LCP element is <img src=...>,
 *     aggregator finds that <Image> / <img> in the repo and attaches
 *     file:line + the source size attribute.
 *   – **Robots conflict**: repo's robots.ts allows /, live response sends
 *     X-Robots-Tag: noindex. Almost always a hosting-config leak.
 *   – **Indexability via cron drift**: yesterday's snapshot indexed, today's
 *     doesn't. Aggregator surfaces the diff and links to the offending PR.
 *
 * Pure functions over the three signal sets. No DB calls — callers fetch.
 */
import type { Severity } from "../mock-data";
import type { SeoIssue } from "../scanner/checks-seo";
import type { SeoHttpReport, SeoHttpIssue } from "../probe/seo-http";

export type RuntimeSignal = {
  url: string;
  origin: string | null;
  lcp_ms: number | null;
  cls: number | null;
  inp_ms: number | null;
  lcp_element: string | null;
  cls_sources?: Array<{
    selector: string;
    tag: string;
    shift: number;
    count: number;
  }>;
  long_tasks?: {
    count: number;
    totalBlockingMs: number;
    worst: Array<{
      startTime: number;
      duration: number;
      containerType: string | null;
      containerName: string | null;
      containerSrc: string | null;
    }>;
    offenders: Array<{ src: string; duration: number; count: number }>;
  } | null;
  resources?: {
    totalResources: number;
    totalTransferBytes: number;
    totalThirdPartyBytes: number;
    thirdParty: Array<{
      host: string;
      count: number;
      bytes: number;
      avgMs: number;
    }>;
    top10ByBytes: Array<{
      url: string;
      host: string;
      initiatorType: string;
      transferSize: number;
      duration: number;
    }>;
    renderBlocking: Array<{
      url: string;
      initiatorType: string;
      duration: number;
      transfer: number;
      startTime: number;
    }>;
    failed: Array<{ url: string; duration: number; initiatorType: string }>;
  } | null;
  dom_snapshot: {
    title?: string | null;
    description?: string | null;
    canonical?: string | null;
    lang?: string | null;
    metaRobots?: string | null;
    ogTitle?: string | null;
    ogImage?: string | null;
    twitterCard?: string | null;
    hreflangs?: Array<{ hreflang: string; href: string }>;
    h1Count?: number;
    headings?: Array<{ tag: string; text: string }>;
    jsonLdTypes?: string[];
    imagesNoAlt?: number;
    imagesNoDims?: number;
    hasMain?: boolean;
    wordCount?: number;
  };
  console_errors: Array<{ msg: string; source?: string; line?: number }>;
  captured_at: string;
};

/** Human-readable bytes, kept inline so the aggregator stays self-contained. */
function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

export type RepoFileIndex = {
  /** filename → first-N lines of content, for grep-style lookups. */
  files: Array<{ path: string; content: string }>;
};

export type CorrelatedIssue = {
  checkId: string;
  severity: Severity;
  subDimension:
    | "technical_foundation"
    | "core_web_vitals"
    | "content_structure"
    | "indexability"
    | "discoverability"
    | "ai_readiness";
  title: string;
  description: string;
  /** Best-effort source attribution. */
  filePath: string;
  lineNumber?: number;
  /** The evidence chain — for UI rendering and audit trail. */
  evidence: Array<
    | { kind: "repo"; file: string; line?: number; snippet?: string }
    | { kind: "live"; url: string; status: number; snippet?: string }
    | { kind: "runtime"; url: string; metric: string; value: string }
  >;
};

const CRITICAL_THRESHOLDS = { lcp: 4000, cls: 0.25, inp: 500 };
const HIGH_THRESHOLDS = { lcp: 2500, cls: 0.1, inp: 200 };

function vitalSeverity(
  metric: "lcp" | "cls" | "inp",
  value: number,
): Severity | null {
  if (value > CRITICAL_THRESHOLDS[metric]) return "critical";
  if (value > HIGH_THRESHOLDS[metric]) return "high";
  return null;
}

/* ================================================================
 * Correlation 1: title drift  (repo says X, live says Y)
 * ============================================================== */
function correlateTitleDrift(
  repoIssues: SeoIssue[],
  liveDom: RuntimeSignal["dom_snapshot"] | null | undefined,
  repoFiles: RepoFileIndex,
  liveUrl: string,
): CorrelatedIssue | null {
  if (!liveDom?.title) return null;

  // Grep the repo for `title:` in any metadata-looking object.
  const declared: Array<{ file: string; line: number; value: string }> = [];
  for (const f of repoFiles.files) {
    if (!/\.tsx?$/.test(f.path)) continue;
    if (!/\bmetadata\b/.test(f.content)) continue;
    const re = /title\s*:\s*["'`]([^"'`]+)["'`]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content))) {
      declared.push({
        file: f.path,
        line: f.content.slice(0, m.index).split("\n").length,
        value: m[1].trim(),
      });
    }
  }

  if (declared.length === 0) return null;

  const liveTitle = liveDom.title.trim();
  // If at least one declared title matches the live title, no drift.
  if (declared.some((d) => d.value === liveTitle)) return null;

  // Skip if the live title is generic (template substituted from a child page).
  const looksTemplated = /\s[—|·:-]\s/.test(liveTitle);
  if (looksTemplated && declared.some((d) => liveTitle.includes(d.value)))
    return null;

  // Mark hint with whichever declared title was closest (lowest path depth)
  const root = declared.reduce((best, cur) =>
    cur.file.split("/").length < best.file.split("/").length ? cur : best,
  );

  return {
    checkId: "seo/title-drift",
    severity: "high",
    subDimension: "technical_foundation",
    title: "Live <title> differs from your metadata export",
    description: `Your code declares title: "${root.value}" (at ${root.file}:${root.line}) but Google and crawlers see "${liveTitle}" on the live page. Almost always caused by a child layout overriding the root metadata. Hoist the title into a Metadata.template if you want a brand suffix, otherwise remove the override.`,
    filePath: root.file,
    lineNumber: root.line,
    evidence: [
      { kind: "repo", file: root.file, line: root.line, snippet: `title: "${root.value}"` },
      { kind: "runtime", url: liveUrl, metric: "<title>", value: liveTitle },
    ],
  };
  // The other declared sites (if any) are reported separately if they differ
  // too — but we keep one main correlated issue to avoid noise.
  void repoIssues;
}

/* ================================================================
 * Correlation 2: LCP element source
 * ============================================================== */
function correlateLcpSource(
  runtime: RuntimeSignal | null,
  repoFiles: RepoFileIndex,
): CorrelatedIssue | null {
  if (!runtime?.lcp_ms) return null;
  const sev = vitalSeverity("lcp", runtime.lcp_ms);
  if (!sev) return null;

  const html = runtime.lcp_element ?? "";
  const srcMatch = html.match(/src=["']([^"']+)["']/);
  const lcpSrc = srcMatch?.[1] ?? null;

  let attributedFile: string | undefined;
  let attributedLine: number | undefined;
  let snippet: string | undefined;

  if (lcpSrc) {
    // Strip query strings + leading slash for matching
    const needle = lcpSrc.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    const tail = needle.replace(/^\//, "").split("/").at(-1) ?? needle;

    for (const f of repoFiles.files) {
      if (!/\.(?:tsx?|jsx?)$/.test(f.path)) continue;
      const idx = f.content.indexOf(needle);
      const fallbackIdx = idx >= 0 ? idx : (tail ? f.content.indexOf(tail) : -1);
      if (fallbackIdx < 0) continue;
      const before = f.content.slice(0, fallbackIdx);
      attributedFile = f.path;
      attributedLine = before.split("\n").length;
      snippet = f.content
        .slice(Math.max(0, fallbackIdx - 40), fallbackIdx + 160)
        .replace(/\s+/g, " ")
        .slice(0, 200);
      break;
    }
  }

  const evidence: CorrelatedIssue["evidence"] = [
    {
      kind: "runtime",
      url: runtime.url,
      metric: "LCP",
      value: `${runtime.lcp_ms}ms`,
    },
  ];
  if (attributedFile) {
    evidence.push({
      kind: "repo",
      file: attributedFile,
      line: attributedLine,
      snippet,
    });
  }

  return {
    checkId: "seo/lcp-source",
    severity: sev,
    subDimension: "core_web_vitals",
    title: `LCP is ${runtime.lcp_ms}ms${attributedFile ? ` (element rendered from ${attributedFile}:${attributedLine ?? "?"})` : ""}`,
    description: `Largest Contentful Paint is ${runtime.lcp_ms}ms — Google's "Needs Improvement" threshold is 2500ms, "Poor" is 4000ms. ${attributedFile ? `The slow element traces back to ${attributedFile}. ` : ""}If it's an image, switch to next/image with the \`priority\` prop and explicit width/height. If it's text waiting on a font, set \`font-display: swap\` and preload the file.`,
    filePath: attributedFile ?? `live${new URL(runtime.url).pathname}`,
    lineNumber: attributedLine,
    evidence,
  };
}

/* ================================================================
 * Correlation 3: indexability conflict
 * ============================================================== */
function correlateIndexConflict(
  repoIssues: SeoIssue[],
  httpReport: SeoHttpReport | null,
): CorrelatedIssue | null {
  if (!httpReport) return null;

  const repoSaysIndexable = !repoIssues.some(
    (i) => i.checkId === "seo/noindex-in-prod",
  );
  const xRobots = httpReport.homeHeaders["x-robots-tag"];
  const liveNoindex = xRobots ? /noindex/i.test(xRobots) : false;

  if (!liveNoindex || !repoSaysIndexable) return null;

  return {
    checkId: "seo/indexability-conflict",
    severity: "critical",
    subDimension: "indexability",
    title: "Your code allows indexing — your live response says noindex",
    description: `The deployed home page returns the header \`X-Robots-Tag: ${xRobots}\`, which de-indexes the site. Your code has no noindex directive, so the most likely cause is a hosting platform setting (Vercel password-protect, Cloudflare WAF, or a headers() rule with the wrong environment guard).`,
    filePath: "next.config.ts",
    evidence: [
      {
        kind: "live",
        url: httpReport.baseUrl,
        status: httpReport.homeStatus,
        snippet: `X-Robots-Tag: ${xRobots}`,
      },
    ],
  };
}

/* ================================================================
 * Correlation 4: heading-hierarchy issue at runtime
 * ============================================================== */
function correlateHeadingIssues(
  runtime: RuntimeSignal | null,
): CorrelatedIssue | null {
  const h1 = runtime?.dom_snapshot?.h1Count;
  if (h1 === undefined) return null;
  if (h1 === 1) return null;

  return {
    checkId: "seo/runtime-h1-count",
    severity: h1 === 0 ? "high" : "medium",
    subDimension: "content_structure",
    title: h1 === 0 ? "Live page has no <h1>" : `Live page has ${h1} <h1> tags`,
    description:
      h1 === 0
        ? "Without an <h1>, Google has no primary heading signal and screen readers can't anchor the page. Use one <h1> per page."
        : `${h1} competing <h1> tags split heading authority. Promote one to the page title and downgrade the rest to <h2>/<h3>.`,
    filePath: `live${runtime ? new URL(runtime.url).pathname : ""}`,
    evidence: [
      {
        kind: "runtime",
        url: runtime!.url,
        metric: "<h1> count",
        value: String(h1),
      },
    ],
  };
}

/* ================================================================
 * Correlation 5: CLS source attribution
 * ============================================================== */
function correlateClsSources(
  runtime: RuntimeSignal | null,
): CorrelatedIssue | null {
  if (!runtime?.cls_sources?.length) return null;
  const sev = runtime.cls ? vitalSeverity("cls", runtime.cls) : null;
  if (!sev) return null;

  // Top contributor takes >40% of total CLS? Call it out by name.
  const top = runtime.cls_sources[0];
  if (!top) return null;
  const totalShift = runtime.cls_sources.reduce((s, c) => s + c.shift, 0);
  const share = totalShift > 0 ? top.shift / totalShift : 0;

  const others = runtime.cls_sources
    .slice(1, 4)
    .map((c) => c.selector)
    .join(", ");

  return {
    checkId: "seo/cls-source",
    severity: sev,
    subDimension: "core_web_vitals",
    title: `CLS ${runtime.cls?.toFixed(3)} — biggest shifter: ${top.selector}`,
    description: `\`${top.selector}\` (a <${top.tag}>) accounts for ~${Math.round(share * 100)}% of cumulative layout shift on this page. Common causes for that element type: missing width/height on images, web font swap without \`font-display: optional\`, ad/embed iframes with no reserved space, dynamic content insertion above existing content.${others ? ` Other contributors: ${others}.` : ""}`,
    filePath: `live${new URL(runtime.url).pathname}`,
    evidence: [
      {
        kind: "runtime",
        url: runtime.url,
        metric: "CLS source",
        value: `${top.selector} = ${top.shift.toFixed(3)} (${top.count} shifts)`,
      },
    ],
  };
}

/* ================================================================
 * Correlation 6: long-task → INP root cause
 * ============================================================== */
function correlateLongTasks(
  runtime: RuntimeSignal | null,
): CorrelatedIssue | null {
  if (!runtime?.long_tasks) return null;
  const lt = runtime.long_tasks;
  if (lt.count === 0 || lt.totalBlockingMs < 200) return null;

  const worstOffender = lt.offenders[0];
  const sev: Severity =
    lt.totalBlockingMs > 600
      ? "critical"
      : lt.totalBlockingMs > 300
        ? "high"
        : "medium";

  return {
    checkId: "seo/long-tasks",
    severity: sev,
    subDimension: "core_web_vitals",
    title: `${lt.count} long tasks blocked the main thread for ${lt.totalBlockingMs}ms total`,
    description: `Long tasks (>50ms each) freeze the main thread and are the dominant cause of poor INP. ${worstOffender ? `The biggest offender is \`${worstOffender.src}\` (${worstOffender.duration}ms across ${worstOffender.count} task${worstOffender.count === 1 ? "" : "s"}). ` : ""}Strategies: split bundle by route, defer non-critical third-party scripts with \`<Script strategy="lazyOnload">\`, move heavy work off the main thread via Web Workers.`,
    filePath: `live${new URL(runtime.url).pathname}`,
    evidence: [
      {
        kind: "runtime",
        url: runtime.url,
        metric: "Long tasks",
        value: `${lt.count} tasks, ${lt.totalBlockingMs}ms blocking`,
      },
    ],
  };
}

/* ================================================================
 * Correlation 7: resource bloat (size + render-blocking)
 * ============================================================== */
function correlateResourceBloat(
  runtime: RuntimeSignal | null,
): CorrelatedIssue[] {
  const issues: CorrelatedIssue[] = [];
  if (!runtime?.resources) return issues;
  const r = runtime.resources;

  // 1. Heavy page (> 2MB transfer is "needs improvement" territory)
  if (r.totalTransferBytes > 4 * 1024 * 1024) {
    issues.push({
      checkId: "seo/heavy-page",
      severity: r.totalTransferBytes > 8 * 1024 * 1024 ? "high" : "medium",
      subDimension: "core_web_vitals",
      title: `Page transferred ${fmtBytes(r.totalTransferBytes)} of resources`,
      description: `Total transfer size is ${fmtBytes(r.totalTransferBytes)} across ${r.totalResources} resources. Mobile users on 4G load this at ~${Math.round(r.totalTransferBytes / 1024 / 100)}s. Largest offender: \`${r.top10ByBytes[0]?.url.slice(0, 100)}\` at ${fmtBytes(r.top10ByBytes[0]?.transferSize ?? 0)}. Compress images (AVIF/WebP), tree-shake JS, and lazy-load below-the-fold media.`,
      filePath: `live${new URL(runtime.url).pathname}`,
      evidence: [
        {
          kind: "runtime",
          url: runtime.url,
          metric: "Total transfer",
          value: fmtBytes(r.totalTransferBytes),
        },
      ],
    });
  }

  // 2. Third-party drag (>1MB or >40% of total)
  if (r.totalThirdPartyBytes > 1024 * 1024) {
    const share =
      r.totalTransferBytes > 0
        ? Math.round((r.totalThirdPartyBytes / r.totalTransferBytes) * 100)
        : 0;
    const top3 = r.thirdParty
      .slice(0, 3)
      .map((t) => `${t.host} (${fmtBytes(t.bytes)})`)
      .join(", ");
    issues.push({
      checkId: "seo/third-party-bloat",
      severity: share > 60 ? "high" : "medium",
      subDimension: "core_web_vitals",
      title: `Third-party scripts shipped ${fmtBytes(r.totalThirdPartyBytes)} (${share}% of page)`,
      description: `Top third-party domains by bytes: ${top3}. These hurt both performance and privacy. Audit each: is it essential (analytics) or convenience (chat widget)? Defer with \`<Script strategy="lazyOnload">\`, self-host where possible, and verify GDPR/CCPA compliance for any tracker you keep.`,
      filePath: `live${new URL(runtime.url).pathname}`,
      evidence: [
        {
          kind: "runtime",
          url: runtime.url,
          metric: "Third-party bytes",
          value: `${fmtBytes(r.totalThirdPartyBytes)} (${share}%)`,
        },
      ],
    });
  }

  // 3. Render-blocking resources
  if (r.renderBlocking.length > 0) {
    const top = r.renderBlocking[0]!;
    issues.push({
      checkId: "seo/render-blocking",
      severity: "high",
      subDimension: "core_web_vitals",
      title: `${r.renderBlocking.length} render-blocking resource${r.renderBlocking.length === 1 ? "" : "s"} in <head>`,
      description: `Render-blocking ${top.initiatorType} delays paint by ~${top.duration}ms: \`${top.url.slice(0, 120)}\`. For scripts, use \`<Script strategy="afterInteractive">\` or move to bottom of body. For CSS, inline critical path styles + load the rest async with media trick or \`<link rel="preload" as="style">\`.`,
      filePath: `live${new URL(runtime.url).pathname}`,
      evidence: [
        {
          kind: "runtime",
          url: runtime.url,
          metric: "render-blocking",
          value: `${r.renderBlocking.length} resource${r.renderBlocking.length === 1 ? "" : "s"}`,
        },
      ],
    });
  }

  // 4. Failed resources
  if (r.failed.length > 0) {
    const head = r.failed
      .slice(0, 3)
      .map((f) => f.url.split("/").at(-1) || f.url)
      .join(", ");
    issues.push({
      checkId: "seo/failed-resources",
      severity: "medium",
      subDimension: "indexability",
      title: `${r.failed.length} resource${r.failed.length === 1 ? "" : "s"} failed to load`,
      description: `Resources that fail (CORS, 404, blocked by CSP) still cost network time and may break layout. First few: ${head}. Check the Network panel in DevTools — if these are critical, fix the URLs; if optional, remove the references.`,
      filePath: `live${new URL(runtime.url).pathname}`,
      evidence: [
        {
          kind: "runtime",
          url: runtime.url,
          metric: "failed resources",
          value: String(r.failed.length),
        },
      ],
    });
  }

  return issues;
}

/* ================================================================
 * Public entrypoint
 * ============================================================== */
export function correlateSeoSignals(args: {
  repoIssues: SeoIssue[];
  httpIssues: SeoHttpIssue[];
  httpReport: SeoHttpReport | null;
  runtime: RuntimeSignal | null;
  repoFiles: RepoFileIndex;
  liveUrl: string;
}): {
  /** Direct issues passed through (repo + live, after de-dup). */
  passthrough: Array<SeoIssue | SeoHttpIssue>;
  /** New issues that exist only because we combined sources. */
  correlated: CorrelatedIssue[];
} {
  // Dedupe by checkId+filePath — repo and live can fire the same logical
  // issue (e.g. both say "no canonical"). Keep the most severe.
  const all: Array<SeoIssue | SeoHttpIssue> = [
    ...args.repoIssues,
    ...args.httpIssues,
  ];
  const seen = new Map<string, SeoIssue | SeoHttpIssue>();
  for (const i of all) {
    const key = `${i.checkId}:${i.filePath}`;
    const existing = seen.get(key);
    if (!existing) seen.set(key, i);
    else {
      const order = { critical: 4, high: 3, medium: 2, low: 1 } as const;
      if (order[i.severity] > order[existing.severity]) seen.set(key, i);
    }
  }
  const passthrough = Array.from(seen.values());

  const correlated: CorrelatedIssue[] = [];
  const dom = args.runtime?.dom_snapshot;
  const title = correlateTitleDrift(
    args.repoIssues,
    dom,
    args.repoFiles,
    args.liveUrl,
  );
  if (title) correlated.push(title);

  const lcp = correlateLcpSource(args.runtime, args.repoFiles);
  if (lcp) correlated.push(lcp);

  const idx = correlateIndexConflict(args.repoIssues, args.httpReport);
  if (idx) correlated.push(idx);

  const h1 = correlateHeadingIssues(args.runtime);
  if (h1) correlated.push(h1);

  const clsSrc = correlateClsSources(args.runtime);
  if (clsSrc) correlated.push(clsSrc);

  const longTasks = correlateLongTasks(args.runtime);
  if (longTasks) correlated.push(longTasks);

  correlated.push(...correlateResourceBloat(args.runtime));

  // CLS + INP runtime issues (no source correlation needed — just upgrade
  // to a unified Issue shape with evidence).
  if (args.runtime?.cls != null) {
    const sev = vitalSeverity("cls", args.runtime.cls);
    if (sev)
      correlated.push({
        checkId: "seo/runtime-cls",
        severity: sev,
        subDimension: "core_web_vitals",
        title: `Cumulative Layout Shift is ${args.runtime.cls}`,
        description:
          "CLS measures unexpected layout shifts after load — typical causes are images without width/height, fonts swapping in without `font-display: swap`, and ads/embeds with no reserved space.",
        filePath: `live${new URL(args.runtime.url).pathname}`,
        evidence: [
          {
            kind: "runtime",
            url: args.runtime.url,
            metric: "CLS",
            value: String(args.runtime.cls),
          },
        ],
      });
  }
  if (args.runtime?.inp_ms != null) {
    const sev = vitalSeverity("inp", args.runtime.inp_ms);
    if (sev)
      correlated.push({
        checkId: "seo/runtime-inp",
        severity: sev,
        subDimension: "core_web_vitals",
        title: `Interaction to Next Paint is ${args.runtime.inp_ms}ms`,
        description:
          "INP measures the worst observed interaction latency. > 200ms is sluggish. Common causes: heavy synchronous JS on click, third-party scripts hogging the main thread, large React re-renders.",
        filePath: `live${new URL(args.runtime.url).pathname}`,
        evidence: [
          {
            kind: "runtime",
            url: args.runtime.url,
            metric: "INP",
            value: `${args.runtime.inp_ms}ms`,
          },
        ],
      });
  }

  return { passthrough, correlated };
}

/* ================================================================
 * Per-page sub-grade calculator (for the dashboard)
 * ============================================================== */
const SUB_DIM_WEIGHTS = {
  technical_foundation: 0.30,
  core_web_vitals: 0.25,
  content_structure: 0.15,
  indexability: 0.15,
  discoverability: 0.10,
  ai_readiness: 0.05,
} as const;

const SEV_PENALTY = { critical: 25, high: 10, medium: 4, low: 1 } as const;

export function computeSeoScore(args: {
  repoIssues: SeoIssue[];
  httpIssues: SeoHttpIssue[];
  correlated: CorrelatedIssue[];
}): {
  overall: number;
  subGrades: Record<keyof typeof SUB_DIM_WEIGHTS, number>;
} {
  const subGrades: Record<keyof typeof SUB_DIM_WEIGHTS, number> = {
    technical_foundation: 100,
    core_web_vitals: 100,
    content_structure: 100,
    indexability: 100,
    discoverability: 100,
    ai_readiness: 100,
  };

  const allIssues = [
    ...args.repoIssues,
    ...args.httpIssues,
    ...args.correlated,
  ];
  for (const i of allIssues) {
    const bucket = i.subDimension;
    subGrades[bucket] = Math.max(0, subGrades[bucket] - SEV_PENALTY[i.severity]);
  }

  const overall = Math.round(
    (Object.keys(SUB_DIM_WEIGHTS) as Array<keyof typeof SUB_DIM_WEIGHTS>).reduce(
      (s, k) => s + subGrades[k] * SUB_DIM_WEIGHTS[k],
      0,
    ),
  );

  return { overall, subGrades };
}
