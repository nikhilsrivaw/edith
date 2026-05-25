/**
 * GET /api/cron/daily
 *
 * Daily orchestrator — runs the three jobs that keep SEO data fresh:
 *
 *   1. **Live HTTP probe** — for every gsc_properties.site_url, runs
 *      probeLiveSeo() and stores result in seo_http_signals.
 *   2. **GSC sync** — for every connected user, pulls last-28d
 *      search analytics into gsc_metrics (idempotent upsert).
 *   3. **LLM citation refresh** — once a week per repo (gated by row
 *      age) re-asks Claude about the brand and inserts into ai_citations.
 *
 * Auth: Bearer ${env.CRON_SECRET}.  Vercel cron sends this header when
 * configured in vercel.json.
 *
 * Designed to fail soft per-job. One repo failing must not stop the
 * others.
 */
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { probeLiveSeo } from "@/lib/probe/seo-http";
import { searchAnalytics } from "@/lib/gsc/client";
import { runCitationCheck } from "@/lib/ai-citations/checker";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min — generous since Vercel limits this anyway

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const GSC_LOOKBACK_DAYS = 30;

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function authorize(req: NextRequest): boolean {
  if (!env.CRON_SECRET) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 },
    );
  }

  const admin = getSupabaseAdmin();
  const summary = {
    httpProbes: { attempted: 0, succeeded: 0, issuesEmitted: 0 },
    gscSync: { users: 0, rowsUpserted: 0 },
    citations: { attempted: 0, recorded: 0 },
    errors: [] as Array<{ stage: string; detail: string }>,
  };

  /* ============ 1. Live HTTP probes ============ */
  try {
    const { data: properties } = await admin
      .from("gsc_properties")
      .select("repo_id, site_url, org_id")
      .limit(50);
    type P = { repo_id: string; site_url: string; org_id: string };
    const list = (properties as P[] | null) ?? [];
    for (const p of list) {
      summary.httpProbes.attempted++;
      try {
        // GSC site_url can be `sc-domain:example.com` — strip prefix.
        const url = p.site_url.startsWith("sc-domain:")
          ? `https://${p.site_url.slice("sc-domain:".length)}`
          : p.site_url;
        const report = await probeLiveSeo(url);
        await admin
          .from("seo_http_signals")
          .insert({
            org_id: p.org_id,
            base_url: report.baseUrl,
            home_status: report.homeStatus,
            home_headers: report.homeHeaders,
            robots_status: report.robotsTxt.status,
            robots_body: report.robotsTxt.body ?? null,
            sitemap_status: report.sitemap.status,
            sitemap_urls_found: report.sitemap.urlsFound,
            internal_crawl_checked: report.internalCrawl.checked,
            internal_crawl_broken: report.internalCrawl.broken,
            parsed_head: report.parsedHead,
            issues: report.issues,
            fetched_at: report.fetchedAt,
          })
          .then(
            () => undefined,
            () => undefined,
          );
        summary.httpProbes.succeeded++;
        summary.httpProbes.issuesEmitted += report.issues.length;
      } catch (err) {
        summary.errors.push({
          stage: "http-probe",
          detail: `${p.site_url}: ${(err as Error).message}`,
        });
      }
    }
  } catch (err) {
    summary.errors.push({
      stage: "http-probe-list",
      detail: (err as Error).message,
    });
  }

  /* ============ 2. GSC sync ============ */
  try {
    const { data: tokenRows } = await admin
      .from("google_oauth_tokens")
      .select("user_id, refresh_token");
    type T = { user_id: string; refresh_token: string };
    const tokens = (tokenRows as T[] | null) ?? [];
    summary.gscSync.users = tokens.length;

    for (const t of tokens) {
      const { data: orgRows } = await admin
        .from("org_members")
        .select("org_id")
        .eq("user_id", t.user_id);
      const orgIds = (orgRows as Array<{ org_id: string }> | null)?.map(
        (r) => r.org_id,
      ) ?? [];
      if (orgIds.length === 0) continue;
      const { data: props } = await admin
        .from("gsc_properties")
        .select("repo_id, site_url, org_id")
        .in("org_id", orgIds);
      type P = { repo_id: string; site_url: string; org_id: string };
      const list = (props as P[] | null) ?? [];

      const startDate = daysAgo(GSC_LOOKBACK_DAYS);
      const endDate = daysAgo(2);

      for (const p of list) {
        const rows = await searchAnalytics(t.refresh_token, p.site_url, {
          startDate,
          endDate,
          dimensions: ["date", "page", "query", "device"],
          rowLimit: 5000,
        });
        if (rows.length === 0) continue;
        const upserts = rows.map((r) => ({
          repo_id: p.repo_id,
          date: r.keys[0]!,
          page: r.keys[1]!,
          query: r.keys[2] ?? null,
          device: r.keys[3] ?? null,
          country: null,
          impressions: r.impressions,
          clicks: r.clicks,
          ctr: r.ctr,
          position: r.position,
          pulled_at: new Date().toISOString(),
        }));
        for (let i = 0; i < upserts.length; i += 500) {
          const slice = upserts.slice(i, i + 500);
          const { error } = await admin
            .from("gsc_metrics")
            .upsert(slice, {
              onConflict: "repo_id,date,page,query,device,country",
              ignoreDuplicates: false,
            });
          if (error) {
            summary.errors.push({
              stage: "gsc-upsert",
              detail: `${p.site_url}: ${error.message}`,
            });
            break;
          }
          summary.gscSync.rowsUpserted += slice.length;
        }
      }
    }
  } catch (err) {
    summary.errors.push({
      stage: "gsc-sync",
      detail: (err as Error).message,
    });
  }

  /* ============ 3. LLM citation refresh (weekly per repo) ============ */
  try {
    const cutoff = new Date(Date.now() - ONE_WEEK_MS).toISOString();
    // Find repos whose latest citation is older than a week (or absent).
    const { data: repos } = await admin
      .from("repositories")
      .select("id, name, owner, org_id, github_html_url")
      .limit(100);
    type R = {
      id: string;
      name: string;
      owner: string;
      org_id: string;
      github_html_url?: string | null;
    };
    const list = (repos as R[] | null) ?? [];

    for (const r of list) {
      const { data: recent } = await admin
        .from("ai_citations")
        .select("queried_at")
        .eq("repo_id", r.id)
        .gte("queried_at", cutoff)
        .limit(1)
        .maybeSingle();
      if (recent) continue;

      summary.citations.attempted++;
      const result = await runCitationCheck({
        brand: r.name,
        ownDomain: `${r.owner.toLowerCase()}.com`,
      });
      if (!result.ok) continue;
      await admin
        .from("ai_citations")
        .insert({
          org_id: r.org_id,
          repo_id: r.id,
          brand: r.name,
          model: result.model,
          prompt: result.prompt,
          response_text: result.responseText,
          cited: result.cited,
          own_citations: result.ownCitations,
          competitor_citations: result.competitorCitations,
          competitors_mentioned: result.competitorsMentioned,
          sentiment: result.sentiment,
        })
        .then(
          () => undefined,
          () => undefined,
        );
      summary.citations.recorded++;
    }
  } catch (err) {
    summary.errors.push({
      stage: "citations",
      detail: (err as Error).message,
    });
  }

  return NextResponse.json({ ok: true, summary });
}
