"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";

export function GscConnectButton() {
  return (
    <Link
      href="/api/oauth/google/start?return=/seo"
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110"
    >
      <Sparkles className="h-3 w-3" strokeWidth={2} />
      Connect Search Console
      <ArrowRight className="h-3 w-3" strokeWidth={2} />
    </Link>
  );
}

export function GscSyncButton({ repoId }: { repoId?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function onClick() {
    start(async () => {
      setMsg("Syncing…");
      const res = await fetch("/api/gsc/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(repoId ? { repoId } : {}),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        rows?: number;
        syncedRepos?: number;
        error?: string;
      };
      if (j.ok) {
        setMsg(
          `Synced ${j.syncedRepos ?? 0} propert${j.syncedRepos === 1 ? "y" : "ies"} · ${j.rows ?? 0} rows`,
        );
        // Soft refresh after a beat so SSR data updates.
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg(j.error ?? "Sync failed");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:opacity-50`}
      >
        <RefreshCw
          className={`h-3 w-3 ${pending ? "animate-spin" : ""}`}
          strokeWidth={1.75}
        />
        {pending ? "Syncing" : "Sync now"}
      </button>
      {msg && (
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          {msg}
        </span>
      )}
    </div>
  );
}
