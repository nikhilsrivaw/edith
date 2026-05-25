"use client";
/**
 * NavBar — fixed top navigation for marketing pages.
 *
 * - Becomes more solid on scroll (border thickens + bg gets less transparent)
 * - Hover state on links shows a sliding amber underline
 * - "Connect GitHub" CTA shows the GitHub mark on the left
 * - Auth-aware: when signed in, swaps both CTAs for a single "Open dashboard"
 *
 * Designed to sit over the fixed HeroBackground — the backdrop-blur lets the
 * rich background show through with a frosted-glass effect.
 */
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { EdithLogo } from "./logo";
import { GithubMark } from "./github-mark";

type NavLink = { href: string; label: string };

const NAV_LINKS: NavLink[] = [
  { href: "/coverage", label: "Coverage" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compliance", label: "Compliance" },
  { href: "/docs", label: "Docs" },
  { href: "/changelog", label: "Changelog" },
];

export function NavBar() {
  const pathname = usePathname();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (!cancelled) setSignedIn(Boolean(data.user));
      } catch {
        if (!cancelled) setSignedIn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--border)] bg-[var(--bg)]/85 backdrop-blur-xl"
          : "border-b border-[var(--border)]/30 bg-[var(--bg)]/40 backdrop-blur-md"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-6">
        {/* Left — logo + version pill */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[var(--text)] transition-opacity hover:opacity-90"
          >
            <EdithLogo />
          </Link>
          <span className="hidden h-4 w-px bg-[var(--border)] sm:block" />
          <span className="hidden font-mono text-[9px] font-medium uppercase tracking-[0.22em] text-[var(--text-muted)] sm:inline">
            v1.0 · <span className="text-[var(--accent)]">live</span>
          </span>
        </div>

        {/* Centre — primary nav (desktop only) */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <NavItem
              key={link.href}
              link={link}
              active={isActive(pathname, link.href)}
            />
          ))}
        </nav>

        {/* Right — auth CTAs */}
        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
            >
              Open dashboard
              <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                href="/signin"
                className="hidden rounded-md px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:text-[var(--text)] sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/signin"
                className="group inline-flex items-center gap-2 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)] px-3.5 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_24px_-8px_var(--accent-glow)] transition-all hover:brightness-110"
              >
                <GithubMark className="h-3 w-3" />
                <span className="hidden sm:inline">Connect</span>
                <span className="sm:hidden">Start</span>
                <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavItem({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      className={`group relative rounded-md px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] transition-colors ${
        active
          ? "text-[var(--text)]"
          : "text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
    >
      {link.label}
      <span
        aria-hidden
        className={`absolute bottom-0.5 left-3 right-3 h-px origin-left bg-[var(--accent)] transition-transform duration-300 ${
          active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
        }`}
      />
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return false; // anchor links never appear active
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
