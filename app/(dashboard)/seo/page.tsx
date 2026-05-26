import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe, ArrowRight, AlertTriangle, Sparkles, Search } from "lucide-react";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { listOpenIssues, userOrgId } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";
import { GscConnectButton, GscSyncButton } from "@/components/edith/gsc-connect";
import {
  AiCitationsPanel,
  type CitationRow,
} from "@/components/edith/ai-citations-panel";
import {
  SeoAutofixButton,
  type AutoFixableIssue,
} from "@/components/edith/seo-autofix-button";
import {
  SeoTrackedSites,
  type TrackedRepo,
} from "@/components/edith/seo-tracked-sites";
import { isAutoFixable } from "@/lib/seo/auto-pr";
import type { Severity } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

const SUB_DIM_META: Record<
  string,
  { label: string; weight: number; blurb: string }
> = {
  technical_foundation: {
    label: "Technical Foundation",
    weight: 30,
    blurb: "metadata exports · robots.txt · sitemap · canonical · lang",
  },
  core_web_vitals: {
    label: "Core Web Vitals",
    weight: 25,
    blurb: "LCP · CLS · INP · render-blocking · CLS-causing images",
  },
  content_structure: {
    label: "Content Structure",
    weight: 15,
    blurb: "headings hierarchy · alt text · semantic landmarks · JSON-LD",
  },
  indexability: {
    label: "Indexability",
    weight: 15,
    blurb: "X-Robots-Tag · noindex · broken links · response codes",
  },
  discoverability: {
    label: "Discoverability",
    weight: 10,
    blurb: "internal linking · structured data · social tags",
  },
  ai_readiness: {
    label: "AI Readiness",
    weight: 5,
    blurb: "llms.txt · AI bot allowlist · Organization schema · SSR content",
  },
};

const SEV_PENALTY: Record<Severity, number> = {
  critical: 25,
  high: 10,
  medium: 4,
  low: 1,
};

const SEV_COLOR: Record<Severity, { dot: string; pill: string; text: string }> = {
  critical: {
    dot: "bg-[var(--danger)]",
    pill: "border-[rgba(248,113,113,0.40)] bg-[rgba(248,113,113,0.08)]",
    text: "text-[var(--danger)]",
  },
  high: {
    dot: "bg-[var(--accent)]",
    pill: "border-[var(--accent)]/40 bg-[var(--accent-soft)]",
    text: "text-[var(--accent)]",
  },
  medium: {
    dot: "bg-[var(--cool-2)]",
    pill: "border-[rgba(107,174,214,0.40)] bg-[rgba(107,174,214,0.08)]",
    text: "text-[var(--cool-2)]",
  },
  low: {
    dot: "bg-[var(--text-muted)]",
    pill: "border-[var(--border)] bg-[var(--bg-elev-2)]",
    text: "text-[var(--text-dim)]",
  },
};

type SeoIssueRow = {
  id: string;
  check_id: string;
  severity: Severity;
  title: string;
  description: string | null;
  file_path: string;
  line_number: number | null;
  created_at: string;
  repo: { id: string; name: string; owner: string };
  /** Derived from check_id prefix when sub_dimension isn't stored explicitly. */
  subDimension: keyof typeof SUB_DIM_META;
};

function autofixableFrom(issues: SeoIssueRow[]): AutoFixableIssue[] {
  return issues
    .filter((i) => isAutoFixable(i.check_id))
    .map((i) => ({
      id: i.id,
      repoId: i.repo.id,
      repoName: i.repo.name,
      checkId: i.check_id,
      title: i.title,
    }));
}

function classifySubDimension(checkId: string): keyof typeof SUB_DIM_META {
  if (
    /metadata|description|title|og|twitter|robots-missing|sitemap-missing|html-lang|metadata-base/.test(
      checkId,
    )
  )
    return "technical_foundation";
  if (/lcp|cls|inp|raw-img|next-script|font|priority|image-no-size/.test(checkId))
    return "core_web_vitals";
  if (/h1|heading|alt|structured-data|wordcount|main|json-ld/.test(checkId))
    return "content_structure";
  if (/noindex|x-robots|broken-internal|cache-control|home-not-200|sitemap-not-200|robots-disallows/.test(checkId))
    return "indexability";
  if (/raw-anchor|internal|hreflang|breadcrumb|brand-schema/.test(checkId))
    return "discoverability";
  if (/llms-txt|ai-bots|use-client-content|json-ld|brand-schema/.test(checkId))
    return "ai_readiness";
  return "technical_foundation";
}

function computeScores(issues: SeoIssueRow[]) {
  const subGrades: Record<keyof typeof SUB_DIM_META, number> = {
    technical_foundation: 100,
    core_web_vitals: 100,
    content_structure: 100,
    indexability: 100,
    discoverability: 100,
    ai_readiness: 100,
  };
  for (const i of issues) {
    const bucket = i.subDimension;
    subGrades[bucket] = Math.max(0, subGrades[bucket] - SEV_PENALTY[i.severity]);
  }
  const overall = Math.round(
    (Object.keys(SUB_DIM_META) as Array<keyof typeof SUB_DIM_META>).reduce(
      (s, k) => s + subGrades[k] * (SUB_DIM_META[k].weight / 100),
      0,
    ),
  );
  return { overall, subGrades };
}

export default async function SeoDashboard() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return (
      <>
        <Topbar title="SEO" subtitle="Connect a repo first" />
        <main className="flex-1 px-6 py-8">
          <SpotlightCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              EDITH needs a repo to audit.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              Connect one in Repositories and scan it — SEO checks run automatically.
            </p>
            <Link
              href="/repos"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Browse repos <ArrowRight className="h-3 w-3" />
            </Link>
          </SpotlightCard>
        </main>
      </>
    );
  }

  // Pull SEO-dim issues from the existing aggregator.
  const allIssues = await listOpenIssues({ orgId, limit: 300 });
  const seoIssues: SeoIssueRow[] = allIssues
    .filter((i) => i.dimension === "seo")
    .map((i) => ({
      id: i.id,
      check_id: i.check_id,
      severity: i.severity,
      title: i.title,
      description: i.description,
      file_path: i.file_path,
      line_number: i.line_number,
      created_at: i.created_at,
      repo: i.repo,
      subDimension: classifySubDimension(i.check_id),
    }));

  // Pull latest runtime + http signals.
  const admin = getSupabaseAdmin();
  const { data: runtimeRows } = await admin
    .from("seo_runtime_signals")
    .select(
      "url, lcp_ms, cls, inp_ms, lcp_element, cls_sources, long_tasks, resources, captured_at",
    )
    .eq("org_id", orgId)
    .order("captured_at", { ascending: false })
    .limit(10)
    .then(
      (r) => r,
      () => ({ data: [] }),
    );
  type ResourcesSnapshot = {
    totalResources: number;
    totalTransferBytes: number;
    totalThirdPartyBytes: number;
    thirdParty: Array<{ host: string; count: number; bytes: number; avgMs: number }>;
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
  };
  type LongTasksSnapshot = {
    count: number;
    totalBlockingMs: number;
    offenders: Array<{ src: string; duration: number; count: number }>;
  };
  type ClsSource = {
    selector: string;
    tag: string;
    shift: number;
    count: number;
  };
  type RuntimeRow = {
    url: string;
    lcp_ms: number | null;
    cls: number | null;
    inp_ms: number | null;
    lcp_element: string | null;
    cls_sources: ClsSource[] | null;
    long_tasks: LongTasksSnapshot | null;
    resources: ResourcesSnapshot | null;
    captured_at: string;
  };
  const runtime = (runtimeRows as RuntimeRow[] | null) ?? [];

  // Search Console connection + last-28d aggregation
  const { data: oauthRow } = await admin
    .from("google_oauth_tokens")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()
    .then(
      (r) => r,
      () => ({ data: null }),
    );
  const gscConnected = Boolean(oauthRow);

  type GscMetric = {
    repo_id: string;
    page: string;
    query: string | null;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  };
  let gscData: GscMetric[] = [];
  if (gscConnected) {
    const { data } = await admin
      .from("gsc_metrics")
      .select("repo_id, page, query, impressions, clicks, ctr, position")
      .gte(
        "date",
        new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .in(
        "repo_id",
        (
          await admin
            .from("repositories")
            .select("id")
            .eq("org_id", orgId)
        ).data?.map((r: { id: string }) => r.id) ?? [],
      )
      .then(
        (r) => r,
        () => ({ data: [] }),
      );
    gscData = (data as GscMetric[]) ?? [];
  }
  const gscSummary = gscConnected ? aggregateGsc(gscData) : null;

  // AI citation history (latest per brand)
  const { data: citationRows } = await admin
    .from("ai_citations")
    .select(
      "id, model, brand, cited, sentiment, own_citations, competitor_citations, competitors_mentioned, response_text, queried_at",
    )
    .eq("org_id", orgId)
    .order("queried_at", { ascending: false })
    .limit(10)
    .then(
      (r) => r,
      () => ({ data: [] }),
    );
  const citations = (citationRows as CitationRow[] | null) ?? [];

  // All org repos (used to populate the "Add site" dialog)
  const { data: repoRows } = await admin
    .from("repositories")
    .select("id, name, owner, live_url")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .then(
      (r) => r,
      () => ({ data: [] }),
    );
  type RepoRow = {
    id: string;
    name: string;
    owner: string;
    live_url: string | null;
  };
  const allRepos = (repoRows as RepoRow[] | null) ?? [];
  const connectableRepos = allRepos.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
  }));

  // Tracked subset (live_url set) — enriched with GSC binding
  const trackedBase = allRepos.filter((r) => r.live_url);
  const { data: gscBindingRows } = await admin
    .from("gsc_properties")
    .select("repo_id, site_url")
    .in(
      "repo_id",
      trackedBase.map((r) => r.id),
    )
    .then(
      (r) => r,
      () => ({ data: [] }),
    );
  type GBR = { repo_id: string; site_url: string };
  const gscByRepo = new Map(
    ((gscBindingRows as GBR[] | null) ?? []).map((g) => [g.repo_id, g.site_url]),
  );
  const trackedSites: TrackedRepo[] = trackedBase.map((r) => ({
    id: r.id,
    name: r.name,
    owner: r.owner,
    liveUrl: r.live_url!,
    gscSiteUrl: gscByRepo.get(r.id) ?? null,
  }));

  // AI citations dropdown only sees SEO-tracked repos.
  const aiReposList = trackedSites.map((t) => ({ id: t.id, name: t.name }));

  const { overall, subGrades } = computeScores(seoIssues);

  const hasData = seoIssues.length > 0 || runtime.length > 0;
  const hasTracked = trackedSites.length > 0;

  return (
    <>
      <Topbar
        title="SEO"
        subtitle={
          hasData
            ? `${seoIssues.length} open SEO issues · ${runtime.length} live measurement${runtime.length === 1 ? "" : "s"}`
            : "Run a scan to see SEO posture"
        }
      />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-6 py-8">
        {/* ── TRACKED SITES MANAGER — top of every /seo view ── */}
        <SeoTrackedSites
          tracked={trackedSites}
          connectable={connectableRepos}
        />

        {/* ── PRIMARY: SCORE + SUB-GRADES, only when data exists ── */}
        {seoIssues.length > 0 && (
          <div className="mt-8">
            <ScoreHero
              score={overall}
              subGrades={subGrades}
              issueCount={seoIssues.length}
            />
          </div>
        )}

        {/* ── REAL-USER CORE WEB VITALS ── */}
        {runtime.length > 0 && (
          <Section
            eyebrow="Real-user measurements"
            title="Core Web Vitals"
            meta={`captured ${timeAgo(runtime[0]!.captured_at)}`}
            tight
            className={seoIssues.length > 0 ? "mt-12" : "mt-8"}
          >
            <CwvStrip latest={runtime[0]!} />
          </Section>
        )}

        {/* ── PERFORMANCE BREAKDOWN ── */}
        {runtime[0] &&
          (runtime[0].cls_sources?.length ||
            runtime[0].long_tasks ||
            runtime[0].resources) && (
            <Section
              eyebrow="Root-cause"
              title="Performance breakdown"
              meta="What Lighthouse skips"
              tight
              className="mt-10"
            >
              <div className="grid gap-3 lg:grid-cols-3">
                <ClsSourcesPanel sources={runtime[0].cls_sources ?? []} />
                <LongTasksPanel data={runtime[0].long_tasks} />
                <ResourcesPanel data={runtime[0].resources} />
              </div>
            </Section>
          )}

        {/* ── INTEGRATIONS — only meaningful when ≥1 SEO-tracked site ── */}
        {hasTracked && (
          <div className={hasData ? "mt-12" : "mt-10"}>
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
                  Integrations
                </div>
                <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)]">
                  Bring in real data
                </h2>
              </div>
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:inline">
                Across {trackedSites.length} tracked site
                {trackedSites.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <IntegrationCard
                eyebrow="Google Search Console"
                meta={
                  gscConnected ? (
                    <GscSyncButton />
                  ) : (
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Not connected
                    </span>
                  )
                }
              >
                <GscPanel connected={gscConnected} summary={gscSummary} />
              </IntegrationCard>
              <IntegrationCard
                eyebrow="LLM citations"
                meta={
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Claude · GPT · Perplexity
                  </span>
                }
              >
                <AiCitationsPanel initial={citations} repos={aiReposList} />
              </IntegrationCard>
            </div>
          </div>
        )}

        {/* ── ISSUES TABLE — only when issues exist ── */}
        {seoIssues.length > 0 && (
          <Section
            eyebrow="Findings"
            title={`${seoIssues.length} open SEO issues`}
            meta={
              <Link
                href="/issues?dimension=seo"
                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            }
            tight
            className="mt-12"
          >
            {autofixableFrom(seoIssues).length > 0 && (
              <div className="mb-4">
                <SeoAutofixButton issues={autofixableFrom(seoIssues)} />
              </div>
            )}
            <IssuesList issues={seoIssues.slice(0, 30)} />
          </Section>
        )}

        {/* ── AI BOT SNIPPET — collapsed by default at the very bottom ── */}
        {hasTracked && (
        <div className="mt-12">
          <details className="group rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--text-dim)] hover:text-[var(--text)]">
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Detect AI crawler traffic
                <span className="text-[var(--text-muted)] normal-case tracking-normal">
                  · middleware.ts snippet
                </span>
              </span>
              <span className="font-mono text-[10px] tracking-[0.18em] text-[var(--text-muted)] group-open:hidden">
                Expand
              </span>
              <span className="hidden font-mono text-[10px] tracking-[0.18em] text-[var(--text-muted)] group-open:inline">
                Collapse
              </span>
            </summary>
            <div className="border-t border-[var(--border)] px-5 py-4">
              <AiBotSnippet />
            </div>
          </details>
        </div>
        )}
      </main>
    </>
  );
}

/* ============================== UI ============================== */

/** Compact section wrapper — eyebrow + title + optional meta on the right. */
function Section({
  eyebrow,
  title,
  meta,
  children,
  tight,
  className = "",
}: {
  eyebrow: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  tight?: boolean;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className={`${tight ? "mb-4" : "mb-5"} flex items-baseline justify-between gap-4`}>
        <div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
            {eyebrow}
          </div>
          <h2 className="mt-1 text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)]">
            {title}
          </h2>
        </div>
        {meta && (
          <div className="shrink-0 self-end pb-0.5 text-right">{meta}</div>
        )}
      </div>
      {children}
    </section>
  );
}

/** Standardised wrapper for the two integration cards (GSC + AI). */
function IntegrationCard({
  eyebrow,
  meta,
  children,
}: {
  eyebrow: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/70 px-5 py-3">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
          {eyebrow}
        </span>
        {meta}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}

/**
 * Score hero: large radial gauge on the left, sub-grade list on the right.
 * Single panel — cleaner than the old two-card grid.
 */
function ScoreHero({
  score,
  subGrades,
  issueCount,
}: {
  score: number;
  subGrades: Record<keyof typeof SUB_DIM_META, number>;
  issueCount: number;
}) {
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const tone =
    score >= 75 ? "var(--success)" : score >= 50 ? "var(--accent)" : "var(--danger)";

  return (
    <div className="relative grid gap-6 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 p-6 lg:grid-cols-[280px_1fr]">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      {/* Gauge */}
      <div className="flex flex-col items-center justify-center gap-3">
        <RadialGauge value={score} color={tone} />
        <div className="text-center">
          <div
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: tone }}
          >
            Grade {grade}
          </div>
          <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {issueCount} open SEO issue{issueCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {/* Sub-grade list */}
      <div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
          Sub-grades · weighted average
        </div>
        <div className="mt-4 space-y-3">
          {(Object.keys(SUB_DIM_META) as Array<keyof typeof SUB_DIM_META>).map(
            (k) => (
              <SubGradeRow key={k} k={k} value={subGrades[k]} />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function SubGradeRow({
  k,
  value,
}: {
  k: keyof typeof SUB_DIM_META;
  value: number;
}) {
  const meta = SUB_DIM_META[k];
  const tone =
    value >= 75
      ? "bg-[var(--success)] text-[var(--success)]"
      : value >= 50
        ? "bg-[var(--accent)] text-[var(--accent)]"
        : "bg-[var(--danger)] text-[var(--danger)]";
  const [bgClass, textClass] = tone.split(" ");
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[148px_1fr_44px]">
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-[var(--text)]">
          {meta.label}
        </div>
        <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {meta.weight}% weight
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className={`h-full rounded-full ${bgClass}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <div
        className={`text-right font-mono text-[13px] font-semibold tabular-nums ${textClass}`}
      >
        <NumberTicker value={value} duration={1400} />
      </div>
    </div>
  );
}

/** Compact circular progress with the score in the middle. */
function RadialGauge({ value, color }: { value: number; color: string }) {
  const size = 200;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (circ * Math.max(0, Math.min(100, value))) / 100;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{
            transition: "stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
            filter: `drop-shadow(0 0 12px ${color})`,
          }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <div
          className="font-mono text-[56px] font-semibold leading-none tabular-nums"
          style={{ color }}
        >
          <NumberTicker value={value} duration={1600} />
        </div>
        <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          EDITH SEO score
        </div>
      </div>
    </div>
  );
}

/** Zero-state banner — clean, single-purpose, replaces the old full-page empty state. */
function CwvStrip({
  latest,
}: {
  latest: {
    url: string;
    lcp_ms: number | null;
    cls: number | null;
    inp_ms: number | null;
  };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <CwvTile
        label="LCP"
        value={latest.lcp_ms !== null ? `${latest.lcp_ms}ms` : "—"}
        threshold={{ good: 2500, poor: 4000 }}
        raw={latest.lcp_ms ?? undefined}
        hint="Largest Contentful Paint"
      />
      <CwvTile
        label="CLS"
        value={latest.cls !== null ? latest.cls.toFixed(3) : "—"}
        threshold={{ good: 0.1, poor: 0.25 }}
        raw={latest.cls ?? undefined}
        hint="Cumulative Layout Shift"
      />
      <CwvTile
        label="INP"
        value={latest.inp_ms !== null ? `${latest.inp_ms}ms` : "—"}
        threshold={{ good: 200, poor: 500 }}
        raw={latest.inp_ms ?? undefined}
        hint="Interaction to Next Paint"
      />
    </div>
  );
}

function CwvTile({
  label,
  value,
  hint,
  threshold,
  raw,
}: {
  label: string;
  value: string;
  hint: string;
  threshold: { good: number; poor: number };
  raw: number | undefined;
}) {
  const status =
    raw === undefined
      ? "muted"
      : raw <= threshold.good
        ? "good"
        : raw <= threshold.poor
          ? "warn"
          : "bad";
  const toneMap = {
    good: "text-[var(--success)]",
    warn: "text-[var(--accent)]",
    bad: "text-[var(--danger)]",
    muted: "text-[var(--text-muted)]",
  } as const;
  const dotMap = {
    good: "bg-[var(--success)]",
    warn: "bg-[var(--accent)]",
    bad: "bg-[var(--danger)]",
    muted: "bg-[var(--text-muted)]",
  } as const;
  return (
    <SpotlightCard className="p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {label}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${dotMap[status]}`} />
      </div>
      <div
        className={`mt-3 font-mono text-[28px] font-semibold leading-none tabular-nums ${toneMap[status]}`}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </SpotlightCard>
  );
}

function IssuesList({ issues }: { issues: SeoIssueRow[] }) {
  if (issues.length === 0) {
    return (
      <SpotlightCard className="p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--success)]/40 bg-[rgba(74,222,128,0.08)] text-[var(--success)]">
          <Sparkles className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h3 className="mt-4 text-[16px] font-semibold text-[var(--text)]">
          No open SEO issues
        </h3>
        <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
          Your last scan came up clean. Re-run any time to confirm.
        </p>
      </SpotlightCard>
    );
  }
  return (
    <MagicCard className="overflow-hidden">
      <ul className="divide-y divide-[var(--border)]">
        {issues.map((i) => (
          <IssueRow key={i.id} issue={i} />
        ))}
      </ul>
    </MagicCard>
  );
}

function IssueRow({ issue }: { issue: SeoIssueRow }) {
  const sev = SEV_COLOR[issue.severity];
  const meta = SUB_DIM_META[issue.subDimension];
  return (
    <li className="group relative">
      <Link
        href={`/issues?repo=${encodeURIComponent(issue.repo.name)}`}
        className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[var(--bg-elev-2)]/50"
      >
        <span
          aria-hidden
          className={`mt-1 h-4 w-[3px] shrink-0 rounded-full ${sev.dot}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${sev.text} ${sev.pill}`}
            >
              {issue.severity}
            </span>
            <span className="text-[13.5px] font-medium text-[var(--text)]">
              {issue.title}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] text-[var(--text-muted)]">
            <span className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 text-[var(--text-dim)]">
              {issue.repo.name}
            </span>
            <span className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 uppercase tracking-[0.15em] text-[var(--text-dim)]">
              {meta.label}
            </span>
            <span className="truncate">
              {issue.file_path}
              {issue.line_number ? `:${issue.line_number}` : ""}
            </span>
          </div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:flex">
          {timeAgo(issue.created_at)}
          <ArrowRight
            className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
            strokeWidth={2}
          />
        </div>
      </Link>
    </li>
  );
}

type GscSummaryShape = {
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
  avgPosition: number;
  topPages: Array<{ page: string; impressions: number; clicks: number; position: number }>;
  topQueries: Array<{ query: string; impressions: number; clicks: number; position: number }>;
  lowHangingFruit: Array<{ query: string; impressions: number; position: number }>;
};

function aggregateGsc(
  rows: Array<{
    page: string;
    query: string | null;
    impressions: number;
    clicks: number;
    ctr: number;
    position: number;
  }>,
): GscSummaryShape {
  let totalImpressions = 0;
  let totalClicks = 0;
  let weightedPos = 0;

  const pageMap = new Map<
    string,
    { impressions: number; clicks: number; posSum: number }
  >();
  const queryMap = new Map<
    string,
    { impressions: number; clicks: number; posSum: number }
  >();

  for (const r of rows) {
    totalImpressions += r.impressions;
    totalClicks += r.clicks;
    weightedPos += r.position * r.impressions;

    const pRow = pageMap.get(r.page) ?? {
      impressions: 0,
      clicks: 0,
      posSum: 0,
    };
    pRow.impressions += r.impressions;
    pRow.clicks += r.clicks;
    pRow.posSum += r.position * r.impressions;
    pageMap.set(r.page, pRow);

    if (r.query) {
      const qRow = queryMap.get(r.query) ?? {
        impressions: 0,
        clicks: 0,
        posSum: 0,
      };
      qRow.impressions += r.impressions;
      qRow.clicks += r.clicks;
      qRow.posSum += r.position * r.impressions;
      queryMap.set(r.query, qRow);
    }
  }

  const topPages = Array.from(pageMap.entries())
    .map(([page, v]) => ({
      page,
      impressions: v.impressions,
      clicks: v.clicks,
      position: v.impressions > 0 ? v.posSum / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  const topQueries = Array.from(queryMap.entries())
    .map(([query, v]) => ({
      query,
      impressions: v.impressions,
      clicks: v.clicks,
      position: v.impressions > 0 ? v.posSum / v.impressions : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Low-hanging fruit: queries at position 11-20 (first-page-adjacent) with
  // measurable impressions. A small content + on-page tweak can move them up.
  const lowHangingFruit = Array.from(queryMap.entries())
    .map(([query, v]) => ({
      query,
      impressions: v.impressions,
      position: v.impressions > 0 ? v.posSum / v.impressions : 0,
    }))
    .filter((q) => q.position >= 11 && q.position <= 20 && q.impressions >= 50)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  return {
    totalImpressions,
    totalClicks,
    avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
    avgPosition: totalImpressions > 0 ? weightedPos / totalImpressions : 0,
    topPages,
    topQueries,
    lowHangingFruit,
  };
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function ClsSourcesPanel({
  sources,
}: {
  sources: Array<{ selector: string; tag: string; shift: number; count: number }>;
}) {
  return (
    <MagicCard className="relative overflow-hidden p-5">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
        CLS source attribution
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-[var(--text)]">
        What shifted?
      </h3>
      {sources.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--text-dim)]">
          No layout shifts captured. Either the page is stable or no CLS-observable
          mutations occurred during the probe window.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {sources.slice(0, 5).map((s) => (
            <li
              key={s.selector + s.shift}
              className="flex items-center justify-between gap-3"
            >
              <code className="truncate font-mono text-[11px] text-[var(--text)]">
                {s.selector}
              </code>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--accent)]">
                {s.shift.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </MagicCard>
  );
}

function LongTasksPanel({
  data,
}: {
  data:
    | {
        count: number;
        totalBlockingMs: number;
        offenders: Array<{ src: string; duration: number; count: number }>;
      }
    | null;
}) {
  return (
    <MagicCard className="relative overflow-hidden p-5">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
        Main-thread blockers
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-[var(--text)]">
        Long tasks
      </h3>
      {!data || data.count === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--text-dim)]">
          No tasks &gt; 50ms observed. INP should be fine.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-mono text-[24px] font-semibold tabular-nums text-[var(--text)]">
              {data.totalBlockingMs}
              <span className="text-[12px] text-[var(--text-muted)]">ms</span>
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              across {data.count} task{data.count === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {data.offenders.slice(0, 3).map((o) => (
              <li key={o.src} className="flex items-center justify-between gap-3">
                <code className="truncate font-mono text-[11px] text-[var(--text-dim)]">
                  {o.src.split("/").at(-1) || o.src}
                </code>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--accent)]">
                  {o.duration}ms
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </MagicCard>
  );
}

function ResourcesPanel({
  data,
}: {
  data:
    | {
        totalResources: number;
        totalTransferBytes: number;
        totalThirdPartyBytes: number;
        thirdParty: Array<{ host: string; count: number; bytes: number; avgMs: number }>;
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
      }
    | null;
}) {
  return (
    <MagicCard className="relative overflow-hidden p-5">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
        Network waterfall
      </div>
      <h3 className="mt-2 text-[14px] font-semibold text-[var(--text)]">
        Resources
      </h3>
      {!data ? (
        <p className="mt-3 text-[12px] text-[var(--text-dim)]">
          No resource data captured yet. Reload the page with the extension active.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Mini
              label="Total"
              value={fmtBytes(data.totalTransferBytes)}
            />
            <Mini
              label="3rd party"
              value={fmtBytes(data.totalThirdPartyBytes)}
            />
          </div>
          {data.renderBlocking.length > 0 && (
            <div className="mt-4">
              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Render-blocking
              </div>
              <ul className="mt-1.5 space-y-1">
                {data.renderBlocking.slice(0, 3).map((r) => (
                  <li key={r.url} className="flex items-center justify-between gap-2">
                    <code className="truncate font-mono text-[10.5px] text-[var(--text-dim)]">
                      {r.url.split("/").at(-1) || r.url}
                    </code>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--accent)]">
                      {r.duration}ms
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </MagicCard>
  );
}

const AI_BOT_SNIPPET = `// middleware.ts — log AI crawlers so you can see who's reading your content.
// Posts a beacon to /api/probe/ai-bot whenever a known AI UA hits any page.

import { NextResponse, type NextRequest } from "next/server";

const AI_BOTS = [
  // OpenAI
  /GPTBot/i, /ChatGPT-User/i, /OAI-SearchBot/i,
  // Anthropic
  /ClaudeBot/i, /anthropic-ai/i, /Claude-Web/i,
  // Google AI training
  /Google-Extended/i,
  // Perplexity
  /PerplexityBot/i,
  // Common Crawl (used to train most foundation models)
  /CCBot/i,
  // Bytedance / TikTok
  /Bytespider/i,
  // Meta
  /Meta-ExternalAgent/i, /FacebookBot/i,
  // Apple Intelligence
  /Applebot-Extended/i,
];

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  const match = AI_BOTS.find((re) => re.test(ua));
  if (match) {
    // Fire-and-forget beacon. Don't block the response.
    fetch(new URL("/api/probe/ai-bot", req.nextUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ua,
        path: req.nextUrl.pathname,
        ts: Date.now(),
      }),
    }).catch(() => undefined);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon\\\\.ico|api).*)"],
};`;

function AiBotSnippet() {
  return (
    <MagicCard className="relative overflow-hidden p-5">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <p className="max-w-[70ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
        Paste this into your Next.js <code className="font-mono text-[12px] text-[var(--text)]">middleware.ts</code>.
        EDITH will then know exactly when GPTBot, ClaudeBot, PerplexityBot,
        Google-Extended, and friends actually visit your site — and which
        pages they read. Useful for understanding why your LLM citations are
        (or aren&apos;t) appearing.
      </p>
      <pre className="mt-4 max-h-[440px] overflow-auto rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-[1.5] text-[var(--text-dim)]">
        {AI_BOT_SNIPPET}
      </pre>
    </MagicCard>
  );
}

function GscPanel({
  connected,
  summary,
}: {
  connected: boolean;
  summary: GscSummaryShape | null;
}) {
  if (!connected) {
    return (
      <div className="flex h-full flex-col gap-4">
        <p className="text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
          Real ranking data — impressions, clicks, CTR, position per page
          and query. EDITH cross-references it with your on-page issues.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Pill>impressions</Pill>
          <Pill>clicks</Pill>
          <Pill>position</Pill>
        </div>
        <div className="mt-auto pt-2">
          <GscConnectButton />
        </div>
      </div>
    );
  }

  if (!summary || summary.totalImpressions === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
        <Search
          className="h-6 w-6 text-[var(--text-muted)]"
          strokeWidth={1.5}
        />
        <p className="max-w-[40ch] text-[12.5px] text-[var(--text-dim)]">
          Connected — but no metrics synced yet. Click <b className="text-[var(--text)]">Sync now</b> in the header, or bind a repo to a Search Console property.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CompactStat
          label="Impressions"
          value={summary.totalImpressions.toLocaleString()}
        />
        <CompactStat
          label="Clicks"
          value={summary.totalClicks.toLocaleString()}
        />
        <CompactStat
          label="Avg CTR"
          value={`${(summary.avgCtr * 100).toFixed(2)}%`}
        />
        <CompactStat
          label="Avg pos"
          value={summary.avgPosition.toFixed(1)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <GscListColumn
          title="Top pages"
          rows={summary.topPages.slice(0, 5).map((p) => ({
            primary: shortPath(p.page),
            secondary: `${p.impressions.toLocaleString()} imp · pos ${p.position.toFixed(1)}`,
          }))}
        />
        <GscListColumn
          title="Top queries"
          rows={summary.topQueries.slice(0, 5).map((q) => ({
            primary: q.query,
            secondary: `${q.impressions.toLocaleString()} imp · pos ${q.position.toFixed(1)}`,
          }))}
        />
      </div>

      {summary.lowHangingFruit.length > 0 && (
        <GscListColumn
          title="Low-hanging fruit"
          subtitle="pos 11-20 with ≥50 impressions — one tweak away from page 1"
          rows={summary.lowHangingFruit.slice(0, 5).map((q) => ({
            primary: q.query,
            secondary: `pos ${q.position.toFixed(1)} · ${q.impressions.toLocaleString()} imp`,
          }))}
        />
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {children}
    </span>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]/60 px-3 py-2">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[15px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function GscListColumn({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: Array<{ primary: string; secondary: string }>;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]/40 p-3">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {title}
      </div>
      {subtitle && (
        <div className="mt-0.5 font-mono text-[9px] text-[var(--text-muted)]">
          {subtitle}
        </div>
      )}
      {rows.length === 0 ? (
        <p className="mt-3 text-[11.5px] text-[var(--text-dim)]">No data.</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {rows.slice(0, 8).map((r, i) => (
            <li key={r.primary + i} className="min-w-0">
              <div className="truncate text-[12px] text-[var(--text)]">
                {r.primary}
              </div>
              <div className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                {r.secondary}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[22px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

function shortPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname === "/" ? u.hostname : u.pathname;
  } catch {
    return url;
  }
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[16px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

// Suppress unused — kept for future filter-by-severity overlay
void AlertTriangle;
