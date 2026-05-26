import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-svh bg-[var(--bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)]/60 bg-[var(--bg-elev)]/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={1.75} />
            Back to EDITH
          </Link>
          <nav className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            <Link
              href="/legal/privacy"
              className="hover:text-[var(--text)]"
            >
              Privacy
            </Link>
            <Link href="/legal/tos" className="hover:text-[var(--text)]">
              Terms
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
      <footer className="border-t border-[var(--border)]/60 py-6">
        <div className="mx-auto max-w-3xl px-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          EDITH · edith.expert ·{" "}
          <a
            href="mailto:support@edith.expert"
            className="text-[var(--text-dim)] hover:text-[var(--accent)]"
          >
            support@edith.expert
          </a>
        </div>
      </footer>
    </div>
  );
}
