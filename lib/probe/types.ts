/**
 * EDITH Runtime Probes — Layer 3 / Wedge 2.
 *
 * Every other auditor reads your code. EDITH fires real requests at your
 * deployed app and reports what actually happened. Each probe is a one-line
 * spec; each finding includes the exact request that proved the issue.
 */
import type { Dimension, Severity } from "../mock-data";

export type ProbeStatus = "pass" | "fail" | "skipped" | "error";

export type Probe = {
  id: string;
  title: string;
  dimension: Dimension;
  severity: Severity; // severity if probe FAILS
  description: string;
  /** What we'd write to convince a reviewer this is exploitable. */
  exploitNarrative: (req: ProbeAttempt, res: ProbeResponse) => string;
  /** The actual probe — returns pass/fail with evidence. */
  run: (ctx: ProbeContext) => Promise<ProbeAttempt>;
};

export type ProbeContext = {
  baseUrl: string; // e.g. https://app.example.com
  fetcher: ProbeFetcher;
  /** Endpoints we discovered from the repo scan. */
  endpoints: DiscoveredEndpoint[];
  /** Soft timeout per probe (ms). */
  timeoutMs: number;
};

export type DiscoveredEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string; // /api/orders/refund
  filePath: string; // app/api/orders/refund/route.ts
  hasAuthInCode: boolean;
  isWebhook: boolean;
  isPayment: boolean;
};

export type ProbeFetcher = (
  url: string,
  init?: RequestInit & { timeoutMs?: number },
) => Promise<ProbeResponse>;

export type ProbeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  durationMs: number;
  url: string;
  method: string;
  /** Body sent with the request, in case we want to display in the receipts panel. */
  requestBody?: string;
};

export type ProbeAttempt = {
  probeId: string;
  status: ProbeStatus;
  finding?: ProbeFinding;
  /** The actual HTTP attempt(s) made by the probe. */
  requests: ProbeResponse[];
  /** When the probe couldn't run — wrong endpoint shape, base URL unreachable, etc. */
  reason?: string;
};

export type ProbeFinding = {
  title: string;
  severity: Severity;
  dimension: Dimension;
  description: string;
  /** The "I just exploited this — here's the proof" narrative. */
  exploitProof: string;
  /** Reproducer: a curl-style one-liner the reader can paste. */
  reproducer: string;
};

/* ============================================================ */
/* Probe runner result                                          */
/* ============================================================ */

export type ProbeRunResult = {
  baseUrl: string;
  startedAt: string;
  finishedAt: string;
  totalProbes: number;
  passed: number;
  failed: number;
  skipped: number;
  errored: number;
  attempts: ProbeAttempt[];
};
