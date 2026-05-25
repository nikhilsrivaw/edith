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

  // Repos list for the panel's selector
  const { data: repoRows } = await admin
    .from("repositories")
    .select("id, name")
    .eq("org_id", orgId)
    .order("name", { ascending: true })
    .then(
      (r) => r,
      () => ({ data: [] }),
    );
  const reposList = (repoRows as Array<{ id: string; name: string }> | null) ?? [];

  const { overall, subGrades } = computeScores(seoIssues);

  const hasData = seoIssues.length > 0 || runtime.length > 0;

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
      <main className="flex-1 px-6 py-8">
        {/* === SCAN-FIRST PROMPT — shown only if no SEO issues yet ===
             We keep this above the GSC / AI panels so the user knows they
             still need to scan for the issue-driven sections to populate,
             but the rest of the page (GSC, citations, snippet) is usable
             immediately so they can configure those independently.        */}
        {seoIssues.length === 0 && runtime.length === 0 && (
          <div className="mb-8">
            <EmptyState />
          </div>
        )}

        {/* === HERO — only when there are issues to score ============== */}
        {seoIssues.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <ScoreCard score={overall} count={seoIssues.length} />
            <SubGradeGrid subGrades={subGrades} />
          </div>
        )}

        {/* === LIVE CWV STRIP === */}
        {runtime.length > 0 && (
          <div className={seoIssues.length > 0 ? "mt-8" : ""}>
            <SectionHeader
              eyebrow="Real-user measurements"
              title="Core Web Vitals from your extension"
              right={
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {timeAgo(runtime[0]!.captured_at)}
                </span>
              }
            />
            <CwvStrip latest={runtime[0]!} />
          </div>
        )}

        {/* === PERFORMANCE BREAKDOWN === */}
        {runtime[0] &&
          (runtime[0].cls_sources?.length ||
            runtime[0].long_tasks ||
            runtime[0].resources) && (
            <div className="mt-8">
              <SectionHeader
                eyebrow="Root-cause"
                title="Performance breakdown"
                right={
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Lighthouse doesn&apos;t tell you this
                  </span>
                }
              />
              <div className="grid gap-3 lg:grid-cols-3">
                <ClsSourcesPanel sources={runtime[0].cls_sources ?? []} />
                <LongTasksPanel data={runtime[0].long_tasks} />
                <ResourcesPanel data={runtime[0].resources} />
              </div>
            </div>
          )}

        {/* === SEARCH CONSOLE — ALWAYS rendered, has its own empty state */}
        <div className={hasData ? "mt-10" : ""}>
          <SectionHeader
            eyebrow="Real Google data"
            title="Search Console — last 28 days"
            right={
              gscConnected ? (
                <GscSyncButton />
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Not connected
                </span>
              )
            }
          />
          <GscPanel connected={gscConnected} summary={gscSummary} />
        </div>

        {/* === AI CITATIONS — ALWAYS rendered, panel handles empty state */}
        <div className="mt-10">
          <SectionHeader
            eyebrow="AI search positioning"
            title="What LLMs say about your brand"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                No other tool does this
              </span>
            }
          />
          <AiCitationsPanel initial={citations} repos={reposList} />
        </div>

        {/* === AI BOT DETECTION SNIPPET — ALWAYS rendered, educational */}
        <div className="mt-10">
          <SectionHeader
            eyebrow="Detect AI crawlers"
            title="Middleware snippet for AI bot traffic"
            right={
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                Drop into middleware.ts
              </span>
            }
          />
          <AiBotSnippet />
        </div>

        {/* === ISSUES TABLE — only when issues exist ===================== */}
        {seoIssues.length > 0 && (
          <div className="mt-10">
            <SectionHeader
              eyebrow="Findings"
              title="Open SEO issues"
              right={
                <Link
                  href="/issues?dimension=seo"
                  className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110 sm:inline-flex"
                >
                  View in Issues <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            {autofixableFrom(seoIssues).length > 0 && (
              <div className="mb-4">
                <SeoAutofixButton issues={autofixableFrom(seoIssues)} />
              </div>
            )}
            <IssuesList issues={seoIssues.slice(0, 30)} />
          </div>
        )}
      </main>
    </>
  );
}

/* ============================== UI ============================== */

function ScoreCard({ score, count }: { score: number; count: number }) {
  const grade =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const tone =
    score >= 75
      ? "text-[var(--success)]"
      : score >= 50
        ? "text-[var(--accent)]"
        : "text-[var(--danger)]";

  return (
    <MagicCard className="relative overflow-hidden p-6">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
        EDITH SEO Score
      </div>
      <div className="mt-4 flex items-baseline gap-3">
        <span
          className={`font-mono text-[72px] font-semibold leading-none tabular-nums ${tone}`}
        >
          <NumberTicker value={score} duration={1800} />
        </span>
        <span className="font-mono text-[14px] text-[var(--text-dim)]">/100</span>
        <span
          className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[12px] font-semibold tabular-nums ${tone} border-[var(--border)] bg-[var(--bg-elev-2)]`}
        >
          {grade}
        </span>
      </div>
      <p className="mt-4 max-w-[36ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
        Weighted across six sub-grades. We block-merge PRs that drop this more than 8 points.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
        <Mini label="Open issues" value={count.toString()} />
        <Mini label="Grading" value={grade} />
      </div>
    </MagicCard>
  );
}

function SubGradeGrid({
  subGrades,
}: {
  subGrades: Record<keyof typeof SUB_DIM_META, number>;
}) {
  const order = Object.keys(SUB_DIM_META) as Array<keyof typeof SUB_DIM_META>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {order.map((k) => {
        const meta = SUB_DIM_META[k];
        const v = subGrades[k];
        const tone =
          v >= 75
            ? "text-[var(--success)]"
            : v >= 50
              ? "text-[var(--accent)]"
              : "text-[var(--danger)]";
        return (
          <SpotlightCard key={k} className="p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
                {meta.label}
              </span>
              <span className="font-mono text-[9px] tabular-nums text-[var(--text-muted)]">
                {meta.weight}%
              </span>
            </div>
            <div
              className={`mt-3 font-mono text-[30px] font-semibold leading-none tabular-nums ${tone}`}
            >
              <NumberTicker value={v} duration={1400} />
              <span className="ml-1 text-[12px] text-[var(--text-muted)]">/100</span>
            </div>
            <p className="mt-3 line-clamp-2 text-[11.5px] leading-[1.5] text-[var(--text-dim)]">
              {meta.blurb}
            </p>
            {/* sub-grade bar */}
            <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
              <div
                className={`h-full rounded-full ${
                  v >= 75
                    ? "bg-[var(--success)]"
                    : v >= 50
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--danger)]"
                }`}
                style={{ width: `${v}%` }}
              />
            </div>
          </SpotlightCard>
        );
      })}
    </div>
  );
}

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
      <MagicCard className="relative overflow-hidden p-6">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[14.5px] font-semibold text-[var(--text)]">
              Connect Google Search Console
            </h3>
            <p className="mt-1 max-w-[60ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
              Pulls real ranking data — impressions, clicks, CTR, average
              position per page and query. EDITH then cross-references it
              with on-page issues so &ldquo;page ranks #14 for X with weak
              meta description&rdquo; becomes one actionable card.
            </p>
          </div>
          <GscConnectButton />
        </div>
      </MagicCard>
    );
  }

  if (!summary || summary.totalImpressions === 0) {
    return (
      <SpotlightCard className="p-8 text-center">
        <Search
          className="mx-auto h-6 w-6 text-[var(--text-muted)]"
          strokeWidth={1.5}
        />
        <p className="mt-3 text-[13px] text-[var(--text-dim)]">
          Connected — but no metrics synced yet. Click &ldquo;Sync now&rdquo;
          above, or bind a repo to a Search Console property first.
        </p>
      </SpotlightCard>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_1.9fr]">
      <SpotlightCard className="relative overflow-hidden p-5">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
          Totals (28d)
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <BigStat
            label="Impressions"
            value={summary.totalImpressions.toLocaleString()}
          />
          <BigStat
            label="Clicks"
            value={summary.totalClicks.toLocaleString()}
          />
          <BigStat
            label="Avg CTR"
            value={`${(summary.avgCtr * 100).toFixed(2)}%`}
          />
          <BigStat
            label="Avg pos"
            value={summary.avgPosition.toFixed(1)}
          />
        </div>
      </SpotlightCard>

      <MagicCard className="overflow-hidden">
        <div className="grid divide-y divide-[var(--border)] md:grid-cols-3 md:divide-y-0 md:divide-x">
          <GscListColumn
            title="Top pages"
            rows={summary.topPages.map((p) => ({
              primary: shortPath(p.page),
              secondary: `${p.impressions.toLocaleString()} imp · pos ${p.position.toFixed(1)}`,
            }))}
          />
          <GscListColumn
            title="Top queries"
            rows={summary.topQueries.map((q) => ({
              primary: q.query,
              secondary: `${q.impressions.toLocaleString()} imp · pos ${q.position.toFixed(1)}`,
            }))}
          />
          <GscListColumn
            title="Low-hanging fruit"
            subtitle="pos 11-20 with ≥50 imp"
            rows={summary.lowHangingFruit.map((q) => ({
              primary: q.query,
              secondary: `pos ${q.position.toFixed(1)} · ${q.impressions.toLocaleString()} imp`,
            }))}
          />
        </div>
      </MagicCard>
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
    <div className="px-5 py-4">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
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
        <ul className="mt-3 space-y-2">
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

function EmptyState() {
  return (
    <SpotlightCard className="relative overflow-hidden p-10 text-center">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
        <Globe className="h-6 w-6" strokeWidth={1.5} />
      </div>
      <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.015em] text-[var(--text)]">
        Run a scan to see SEO posture.
      </h2>
      <p className="mx-auto mt-3 max-w-[58ch] text-[13px] leading-[1.6] text-[var(--text-dim)]">
        EDITH audits SEO across three vantage points: your repo source (metadata
        exports, robots.txt, llms.txt), your deployed HTML (titles, canonicals,
        X-Robots-Tag), and real-user Core Web Vitals via the browser extension.
        No agency, Lighthouse, or Snyk does all three.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/repos"
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
        >
          Pick a repo to scan <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/extension"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
        >
          Install the extension
        </Link>
      </div>
    </SpotlightCard>
  );
}

function SectionHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4">
      <div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
          {eyebrow}
        </div>
        <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
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
