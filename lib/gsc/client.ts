/**
 * Google Search Console client.
 *
 * Wraps the Search Console / Webmasters API with:
 *   – Refresh-token → access-token exchange (cached in-process for ~50 min)
 *   – Typed helpers for the three endpoints we need: listSites,
 *     searchAnalytics.query, urlInspection.inspect.
 *   – Conservative timeouts + soft error returns (never throws on transient
 *     failures; callers handle null).
 *
 * Why custom client instead of `googleapis` SDK: that package is 80+MB and
 * not edge-runtime compatible. The endpoints we need are 4 REST calls.
 */
import "server-only";
import { env } from "../env";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GSC_BASE = "https://www.googleapis.com/webmasters/v3";
const URL_INSPECT_BASE = "https://searchconsole.googleapis.com/v1";

const TIMEOUT_MS = 12_000;

export type GoogleSite = {
  siteUrl: string;
  permissionLevel:
    | "siteOwner"
    | "siteFullUser"
    | "siteRestrictedUser"
    | "siteUnverifiedUser";
};

export type SearchAnalyticsRow = {
  keys: string[];
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
};

export type SearchAnalyticsQuery = {
  startDate: string; // YYYY-MM-DD
  endDate: string;
  dimensions: Array<"date" | "query" | "page" | "country" | "device">;
  rowLimit?: number; // max 25000
  startRow?: number;
};

export type UrlInspectionResult = {
  inspectionResultUrl?: string;
  indexStatusResult?: {
    verdict?: "PASS" | "PARTIAL" | "FAIL" | "NEUTRAL";
    coverageState?: string;
    robotsTxtState?: "ALLOWED" | "DISALLOWED" | "BLOCKED";
    indexingState?: string;
    lastCrawlTime?: string;
    pageFetchState?: string;
    googleCanonical?: string;
    userCanonical?: string;
    referringUrls?: string[];
  };
  mobileUsabilityResult?: {
    verdict?: "PASS" | "FAIL";
    issues?: Array<{ issueType: string; severity: string; message: string }>;
  };
  richResultsResult?: {
    verdict?: "PASS" | "FAIL";
    detectedItems?: Array<{ richResultType: string; items: Array<{ name?: string }> }>;
  };
};

/* ================================================================
 * Access-token cache
 * ============================================================== */
const tokenCache = new Map<
  string,
  { access: string; expiresAt: number }
>();

async function fetchAccessToken(refreshToken: string): Promise<string | null> {
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.access;

  if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
    console.warn("[gsc] GOOGLE_OAUTH_CLIENT_ID/SECRET not set");
    return null;
  }

  const body = new URLSearchParams({
    client_id: env.GOOGLE_OAUTH_CLIENT_ID,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[gsc] token refresh failed", res.status);
      return null;
    }
    const j = (await res.json()) as { access_token: string; expires_in: number };
    tokenCache.set(refreshToken, {
      access: j.access_token,
      expiresAt: Date.now() + j.expires_in * 1000,
    });
    return j.access_token;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function gscFetch<T>(
  refreshToken: string,
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const access = await fetchAccessToken(refreshToken);
  if (!access) return null;

  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      console.warn("[gsc] request failed", res.status, url);
      return null;
    }
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

/* ================================================================
 * Public API
 * ============================================================== */

export async function listSites(refreshToken: string): Promise<GoogleSite[]> {
  type R = { siteEntry?: GoogleSite[] };
  const r = await gscFetch<R>(refreshToken, `${GSC_BASE}/sites`);
  return r?.siteEntry ?? [];
}

export async function searchAnalytics(
  refreshToken: string,
  siteUrl: string,
  query: SearchAnalyticsQuery,
): Promise<SearchAnalyticsRow[]> {
  type R = { rows?: SearchAnalyticsRow[] };
  const encoded = encodeURIComponent(siteUrl);
  const r = await gscFetch<R>(
    refreshToken,
    `${GSC_BASE}/sites/${encoded}/searchAnalytics/query`,
    {
      method: "POST",
      body: JSON.stringify({
        rowLimit: 5000,
        ...query,
      }),
    },
  );
  return r?.rows ?? [];
}

export async function inspectUrl(
  refreshToken: string,
  siteUrl: string,
  inspectionUrl: string,
): Promise<UrlInspectionResult | null> {
  type R = { inspectionResult?: UrlInspectionResult };
  const r = await gscFetch<R>(
    refreshToken,
    `${URL_INSPECT_BASE}/urlInspection/index:inspect`,
    {
      method: "POST",
      body: JSON.stringify({
        inspectionUrl,
        siteUrl,
      }),
    },
  );
  return r?.inspectionResult ?? null;
}

/* ================================================================
 * Convenience: 28-day summary for /seo dashboard
 * ============================================================== */
export type GscSummary = {
  totals: { impressions: number; clicks: number; avgCtr: number; avgPosition: number };
  topPages: SearchAnalyticsRow[];
  topQueries: SearchAnalyticsRow[];
  lowHangingFruit: SearchAnalyticsRow[]; // position 11-20 = first-page-adjacent
  startDate: string;
  endDate: string;
};

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function gscSummary(
  refreshToken: string,
  siteUrl: string,
): Promise<GscSummary | null> {
  const endDate = dateOffset(2); // GSC has 2-day lag
  const startDate = dateOffset(30);

  const [byPage, byQuery] = await Promise.all([
    searchAnalytics(refreshToken, siteUrl, {
      startDate,
      endDate,
      dimensions: ["page"],
      rowLimit: 100,
    }),
    searchAnalytics(refreshToken, siteUrl, {
      startDate,
      endDate,
      dimensions: ["query"],
      rowLimit: 100,
    }),
  ]);

  if (byPage.length === 0 && byQuery.length === 0) return null;

  const totals = byPage.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.ctrSum += r.ctr * r.impressions;
      acc.posSum += r.position * r.impressions;
      return acc;
    },
    { impressions: 0, clicks: 0, ctrSum: 0, posSum: 0 },
  );
  const avgCtr =
    totals.impressions > 0 ? totals.ctrSum / totals.impressions : 0;
  const avgPosition =
    totals.impressions > 0 ? totals.posSum / totals.impressions : 0;

  const topPages = [...byPage]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
  const topQueries = [...byQuery]
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);
  const lowHangingFruit = byQuery
    .filter(
      (r) =>
        r.position >= 11 &&
        r.position <= 20 &&
        r.impressions >= 100,
    )
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  return {
    totals: {
      impressions: totals.impressions,
      clicks: totals.clicks,
      avgCtr,
      avgPosition,
    },
    topPages,
    topQueries,
    lowHangingFruit,
    startDate,
    endDate,
  };
}
