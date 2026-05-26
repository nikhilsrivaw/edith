"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

export type TrackedRepo = {
  id: string;
  name: string;
  owner: string;
  liveUrl: string;
  gscSiteUrl: string | null;
};

export type ConnectableRepo = {
  id: string;
  name: string;
  owner: string;
};

export function SeoTrackedSites({
  tracked,
  connectable,
}: {
  tracked: TrackedRepo[];
  connectable: ConnectableRepo[];
}) {
  const [dialogState, setDialogState] = useState<
    | { kind: "closed" }
    | { kind: "add" }
    | { kind: "edit"; repo: TrackedRepo }
  >({ kind: "closed" });

  if (tracked.length === 0) {
    return (
      <>
        <EmptyState
          connectable={connectable}
          onAdd={() => setDialogState({ kind: "add" })}
        />
        {dialogState.kind !== "closed" && (
          <SiteDialog
            state={dialogState}
            connectable={connectable}
            tracked={tracked}
            onClose={() => setDialogState({ kind: "closed" })}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/70 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
              SEO-tracked sites
            </span>
            <span className="font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
              {tracked.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDialogState({ kind: "add" })}
            disabled={connectable.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Add site
          </button>
        </div>
        <ul className="divide-y divide-[var(--border)]/70">
          {tracked.map((r) => (
            <TrackedRow
              key={r.id}
              repo={r}
              onEdit={() => setDialogState({ kind: "edit", repo: r })}
            />
          ))}
        </ul>
      </div>

      {dialogState.kind !== "closed" && (
        <SiteDialog
          state={dialogState}
          connectable={connectable}
          tracked={tracked}
          onClose={() => setDialogState({ kind: "closed" })}
        />
      )}
    </>
  );
}

/* ============== Row ============== */
function TrackedRow({
  repo,
  onEdit,
}: {
  repo: TrackedRepo;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  function remove() {
    start(async () => {
      await fetch("/api/seo/repos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId: repo.id }),
      });
      router.refresh();
    });
  }

  return (
    <li className="group relative">
      <div className="flex items-center gap-4 px-5 py-3.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
          <Globe className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-[var(--text)]">
              {repo.owner}/{repo.name}
            </span>
            {repo.gscSiteUrl && (
              <span className="inline-flex items-center gap-1 rounded border border-[var(--success)]/40 bg-[rgba(74,222,128,0.08)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--success)]">
                <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
                GSC
              </span>
            )}
          </div>
          <a
            href={repo.liveUrl}
            target="_blank"
            rel="noopener"
            className="mt-0.5 inline-flex items-center gap-1 truncate font-mono text-[10px] text-[var(--text-muted)] transition-colors hover:text-[var(--accent)]"
          >
            {repo.liveUrl.replace(/^https?:\/\//, "")}
            <ExternalLink className="h-2.5 w-2.5" strokeWidth={1.75} />
          </a>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {confirmingRemove ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Remove?
              </span>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="inline-flex h-7 items-center rounded-md border border-[rgba(248,113,113,0.40)] bg-[rgba(248,113,113,0.08)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--danger)] hover:brightness-110 disabled:opacity-50"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(false)}
                className="inline-flex h-7 items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
              >
                <Pencil className="h-3 w-3" strokeWidth={1.75} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => setConfirmingRemove(true)}
                aria-label="Remove from SEO tracking"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-muted)] transition-colors hover:border-[rgba(248,113,113,0.40)] hover:text-[var(--danger)]"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

/* ============== Empty state ============== */
function EmptyState({
  connectable,
  onAdd,
}: {
  connectable: ConnectableRepo[];
  onAdd: () => void;
}) {
  if (connectable.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 p-8 text-center">
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
          <Globe className="h-5 w-5" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold tracking-[-0.01em] text-[var(--text)]">
          Connect a repo first
        </h2>
        <p className="mx-auto mt-1.5 max-w-[58ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
          SEO tracking sits on top of a connected repo. Install the EDITH
          GitHub App on at least one repo, then come back here to mark it
          for SEO.
        </p>
        <Link
          href="/repos"
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110"
        >
          Connect a repo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]/55 p-6">
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
            <Globe className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[var(--text)]">
              Add a site to SEO tracking
            </h2>
            <p className="mt-1 max-w-[60ch] text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
              Pick one of your connected repos and tell EDITH where it&apos;s
              deployed. Live-probe, multi-page crawl, Search Console binding,
              and AI citation tracking all run against tracked sites only.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="shrink-0 inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110"
        >
          <Plus className="h-3 w-3" strokeWidth={2} />
          Add site
        </button>
      </div>
    </div>
  );
}

/* ============== Add / Edit dialog ============== */
function SiteDialog({
  state,
  connectable,
  tracked,
  onClose,
}: {
  state: { kind: "add" } | { kind: "edit"; repo: TrackedRepo };
  connectable: ConnectableRepo[];
  tracked: TrackedRepo[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const editing = state.kind === "edit";
  const initialRepo = editing ? state.repo.id : connectable[0]?.id ?? "";
  const initialUrl = editing ? state.repo.liveUrl : "";

  const [repoId, setRepoId] = useState(initialRepo);
  const [liveUrl, setLiveUrl] = useState(initialUrl);

  // For ADD mode, exclude already-tracked repos.
  const trackedIds = new Set(tracked.map((t) => t.id));
  const selectable = editing
    ? connectable
    : connectable.filter((r) => !trackedIds.has(r.id));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!repoId) {
      setErr("Pick a repo");
      return;
    }
    const trimmed = liveUrl.trim();
    if (!/^https?:\/\//.test(trimmed)) {
      setErr("URL must start with http:// or https://");
      return;
    }
    start(async () => {
      const res = await fetch("/api/seo/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, liveUrl: trimmed }),
      });
      const j = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (j.ok) {
        onClose();
        router.refresh();
      } else {
        setErr(j.error ?? "Failed to save");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] shadow-2xl"
      >
        <span
          aria-hidden
          className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
        />
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
            {editing ? "Edit site" : "Add site to SEO"}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 place-items-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label
              htmlFor="seo-repo"
              className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Repository
            </label>
            <select
              id="seo-repo"
              value={repoId}
              onChange={(e) => setRepoId(e.target.value)}
              disabled={editing}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-hot)] disabled:opacity-60"
            >
              {selectable.length === 0 ? (
                <option value="">— all repos already tracked —</option>
              ) : (
                <>
                  {!editing && <option value="">Pick a repo…</option>}
                  {selectable.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.owner}/{r.name}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="seo-url"
              className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]"
            >
              Deployed URL
            </label>
            <input
              id="seo-url"
              type="url"
              required
              placeholder="https://your-site.com"
              value={liveUrl}
              onChange={(e) => setLiveUrl(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 py-2 text-[13px] text-[var(--text)] outline-none focus:border-[var(--border-hot)]"
            />
            <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
              EDITH probes this URL each scan and on the daily cron — live
              HTTP headers, multi-page crawl, image audit, AI conventions.
            </p>
          </div>

          {err && (
            <div className="rounded-md border border-[rgba(248,113,113,0.40)] bg-[rgba(248,113,113,0.08)] px-3 py-2 font-mono text-[11px] text-[var(--danger)]">
              {err}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || selectable.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110 disabled:opacity-50"
          >
            {pending ? "Saving…" : editing ? "Save" : "Track site"}
          </button>
        </div>
      </form>
    </div>
  );
}
