"use client";

import { useState, useTransition } from "react";
import { Bot, RefreshCw, Sparkles } from "lucide-react";

export type CitationRow = {
  id: string;
  model: string;
  brand: string;
  cited: boolean;
  sentiment: string | null;
  own_citations: Array<{ url: string; title?: string }>;
  competitor_citations: Array<{ url: string; domain: string; title?: string }>;
  competitors_mentioned: string[];
  response_text: string;
  queried_at: string;
};

const SENTIMENT_TONE: Record<string, string> = {
  positive: "text-[var(--success)] border-[var(--success)]/40 bg-[rgba(74,222,128,0.08)]",
  neutral: "text-[var(--text-dim)] border-[var(--border)] bg-[var(--bg-elev-2)]",
  negative: "text-[var(--danger)] border-[rgba(248,113,113,0.40)] bg-[rgba(248,113,113,0.08)]",
  mixed: "text-[var(--accent)] border-[var(--accent)]/40 bg-[var(--accent-soft)]",
  unknown: "text-[var(--text-muted)] border-[var(--border)] bg-[var(--bg-elev-2)]",
};

export function AiCitationsPanel({
  initial,
  repos,
}: {
  initial: CitationRow[];
  repos: Array<{ id: string; name: string }>;
}) {
  const [citations, setCitations] = useState(initial);
  const [selectedRepo, setSelectedRepo] = useState(repos[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  function runCheck() {
    if (!selectedRepo) {
      setMsg("Pick a repo first");
      return;
    }
    start(async () => {
      setMsg("Asking Claude…");
      const res = await fetch("/api/ai-citations/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: selectedRepo }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        cached?: boolean;
        citation?: CitationRow;
        error?: string;
      };
      if (j.ok && j.citation) {
        setCitations((prev) => [j.citation!, ...prev.filter((c) => c.id !== j.citation!.id)]);
        setMsg(j.cached ? "Showing today's result (rate-limited)" : "Done");
      } else {
        setMsg(j.error ?? "Check failed");
      }
    });
  }

  if (citations.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/80 p-6 backdrop-blur-sm">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              First-of-its-kind
            </div>
            <h3 className="mt-2 text-[14.5px] font-semibold text-[var(--text)]">
              Ask Claude what it knows about your brand
            </h3>
            <p className="mt-1 max-w-[60ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
              EDITH queries Claude (with web search) about your brand and
              records: is your own domain cited? which competitor domains
              are cited instead? what&apos;s the overall sentiment? Run
              weekly to track AI-search visibility — the new SEO.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {repos.length > 0 && (
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text)] focus:outline-none"
              >
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={runCheck}
              disabled={pending || !selectedRepo}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" strokeWidth={2} />
              {pending ? "Asking…" : "Run check"}
            </button>
          </div>
        </div>
        {msg && (
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {msg}
          </div>
        )}
      </div>
    );
  }

  const latest = citations[0]!;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {repos.length > 0 && (
            <select
              value={selectedRepo}
              onChange={(e) => setSelectedRepo(e.target.value)}
              className="h-8 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text)] focus:outline-none"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={runCheck}
            disabled={pending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
              strokeWidth={1.75}
            />
            {pending ? "Asking" : "Re-run"}
          </button>
        </div>
        {msg && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {msg}
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/80 p-5">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot
              className="h-4 w-4 text-[var(--accent)]"
              strokeWidth={1.75}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              {latest.model} · {new Date(latest.queried_at).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${
                SENTIMENT_TONE[latest.sentiment ?? "unknown"] ??
                SENTIMENT_TONE.unknown
              }`}
            >
              {latest.sentiment ?? "unknown"}
            </span>
            <span
              className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${
                latest.cited
                  ? SENTIMENT_TONE.positive
                  : SENTIMENT_TONE.negative
              }`}
            >
              {latest.cited ? "Own-site cited" : "Not cited"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <CiteList
            title="Cited from your domain"
            items={latest.own_citations}
            empty="Claude didn't cite your domain — work on your llms.txt, sitemap, and Q&A structure."
          />
          <CiteList
            title="Cited from competitors"
            items={latest.competitor_citations.map((c) => ({
              url: c.url,
              title: c.domain,
            }))}
            empty="No competitor sites cited in the response."
          />
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Competitors named
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {latest.competitors_mentioned.length === 0 ? (
                <span className="font-mono text-[11px] text-[var(--text-dim)]">
                  —
                </span>
              ) : (
                latest.competitors_mentioned.slice(0, 12).map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-dim)]"
                  >
                    {c}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>

        <details
          className="mt-4"
          open={expanded === latest.id}
          onToggle={(e) =>
            setExpanded((e.target as HTMLDetailsElement).open ? latest.id : null)
          }
        >
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110">
            View full response
          </summary>
          <pre className="mt-3 max-h-[380px] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border)] bg-[var(--bg)] p-3 font-mono text-[11px] leading-[1.55] text-[var(--text-dim)]">
            {latest.response_text}
          </pre>
        </details>
      </div>
    </div>
  );
}

function CiteList({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ url: string; title?: string }>;
  empty: string;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {title}
      </div>
      {items.length === 0 ? (
        <p className="mt-2 max-w-[28ch] text-[11.5px] text-[var(--text-dim)]">
          {empty}
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.slice(0, 6).map((c, i) => (
            <li key={c.url + i} className="min-w-0">
              <a
                href={c.url}
                target="_blank"
                rel="noopener"
                className="block truncate font-mono text-[11px] text-[var(--accent)] hover:brightness-110"
              >
                {c.title ?? c.url}
              </a>
              {c.title && (
                <div className="truncate font-mono text-[9.5px] text-[var(--text-muted)]">
                  {c.url}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
