import Link from "next/link";
import { EdithLogo } from "@/components/edith/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <div className="max-w-md text-center">
        <EdithLogo className="mx-auto" />
        <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
          404 — not found
        </div>
        <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.02em] text-[var(--text)]">
          EDITH didn&apos;t find this page.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.6] text-[var(--text-dim)]">
          The link may be stale or the resource may have been removed. Head
          back to the dashboard to continue.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--accent)] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
          >
            Go to dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-5 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
          >
            View landing
          </Link>
        </div>
      </div>
    </div>
  );
}
