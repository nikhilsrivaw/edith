/**
 * Sane HTTP fetcher for runtime probes.
 *
 * - timeout
 * - records duration, status, body (capped), headers
 * - never throws — returns a structured ProbeResponse even on error
 */
import "server-only";
import type { ProbeResponse } from "./types";

const MAX_BODY_BYTES = 4000;

export async function probeFetch(
  url: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<ProbeResponse> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init?.timeoutMs ?? 10_000);
  const method = (init?.method ?? "GET").toUpperCase();

  try {
    const res = await fetch(url, {
      ...init,
      method,
      signal: controller.signal,
      // Be honest about ourselves.
      headers: {
        "User-Agent": "EDITH-probe/1.0",
        ...((init?.headers ?? {}) as Record<string, string>),
      },
    });
    clearTimeout(t);

    const bodyText = await safeReadBody(res);
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });

    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers,
      bodyText,
      durationMs: Date.now() - startedAt,
      url,
      method,
      requestBody:
        typeof init?.body === "string"
          ? init.body.slice(0, MAX_BODY_BYTES)
          : undefined,
    };
  } catch (e) {
    clearTimeout(t);
    return {
      ok: false,
      status: 0,
      statusText: e instanceof Error ? e.message : "network-error",
      headers: {},
      bodyText: "",
      durationMs: Date.now() - startedAt,
      url,
      method,
      requestBody:
        typeof init?.body === "string"
          ? init.body.slice(0, MAX_BODY_BYTES)
          : undefined,
    };
  }
}

async function safeReadBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, MAX_BODY_BYTES);
  } catch {
    return "";
  }
}
