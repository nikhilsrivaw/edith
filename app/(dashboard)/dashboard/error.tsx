"use client";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--danger)]">
          Something went wrong
        </div>
        <h1 className="mt-3 text-[24px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          EDITH hit an error loading this page.
        </h1>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
          {error.message || "Unknown error."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            digest: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
