"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";

export type AutoFixableIssue = {
  id: string;
  repoId: string;
  repoName: string;
  checkId: string;
  title: string;
};

export function SeoAutofixButton({
  issues,
}: {
  issues: AutoFixableIssue[];
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; url?: string } | null>(
    null,
  );

  if (issues.length === 0) return null;

  // Group by repo (one PR per repo).
  const byRepo = new Map<string, AutoFixableIssue[]>();
  for (const i of issues) {
    const arr = byRepo.get(i.repoId) ?? [];
    arr.push(i);
    byRepo.set(i.repoId, arr);
  }

  function runFix() {
    start(async () => {
      setMsg(null);
      const results: Array<{ repoName: string; pr?: string; error?: string }> = [];
      for (const [repoId, group] of byRepo) {
        const repoName = group[0]!.repoName;
        const res = await fetch("/api/seo/auto-fix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repoId,
            issueIds: group.map((g) => g.id),
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          pr?: { url: string };
          error?: string;
        };
        if (j.ok && j.pr) {
          results.push({ repoName, pr: j.pr.url });
        } else {
          results.push({ repoName, error: j.error ?? "Unknown error" });
        }
      }
      const successes = results.filter((r) => r.pr);
      if (successes.length > 0) {
        const first = successes[0]!;
        setMsg({
          kind: "ok",
          text: `Opened ${successes.length} PR${successes.length === 1 ? "" : "s"}`,
          url: first.pr,
        });
      } else {
        setMsg({
          kind: "err",
          text: results[0]?.error ?? "Auto-fix failed",
        });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={runFix}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110 disabled:opacity-50"
      >
        <Wand2 className="h-3 w-3" strokeWidth={2} />
        {pending
          ? `Opening PR${byRepo.size === 1 ? "" : "s"}…`
          : `Auto-fix ${issues.length} issue${issues.length === 1 ? "" : "s"}`}
      </button>
      {msg && (
        <span
          className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
            msg.kind === "ok" ? "text-[var(--success)]" : "text-[var(--danger)]"
          }`}
        >
          {msg.text}
          {msg.url && (
            <>
              {" · "}
              <a
                href={msg.url}
                target="_blank"
                rel="noopener"
                className="underline"
              >
                View PR
              </a>
            </>
          )}
        </span>
      )}
    </div>
  );
}
