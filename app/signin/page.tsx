"use client";
import { ArrowRight, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EdithLogo } from "@/components/edith/logo";
import { GithubMark } from "@/components/edith/github-mark";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function SignInPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          scopes: "read:user user:email repo read:org",
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
      }
      // On success, Supabase redirects away — no further action needed.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh bg-[var(--bg)] md:grid-cols-2">
      {/* Left side — credibility */}
      <div className="relative hidden border-r border-[var(--border)] bg-[var(--bg-elev)] p-10 md:flex md:flex-col">
        <Link href="/" className="text-[var(--text)]">
          <EdithLogo />
        </Link>
        <div className="my-auto">
          <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--accent)]">
            What you get
          </div>
          <h2 className="mt-3 max-w-md text-[32px] font-semibold leading-[1.15] tracking-[-0.02em] text-[var(--text)]">
            The calmest senior engineer you&apos;ve ever worked with.
          </h2>
          <ul className="mt-6 max-w-md space-y-3 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-sm bg-[var(--accent)]" />
              30 checks across security, performance, business logic.
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-sm bg-[var(--accent)]" />
              Fix prompts written for Cursor, Claude Code, Windsurf, v0.
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-sm bg-[var(--accent)]" />
              Posts to your PRs. Never pushes code. Never opens issues you didn&apos;t ask for.
            </li>
          </ul>
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
          v1.0 · Built in India · Powered by PayU
        </div>
      </div>

      {/* Right side — sign in */}
      <div className="flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <Link href="/" className="md:hidden">
            <EdithLogo />
          </Link>
          <div className="mt-8 md:mt-0">
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--accent)]">
              Sign in
            </div>
            <h1 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[var(--text)]">
              Connect your GitHub.
            </h1>
            <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-dim)]">
              EDITH uses GitHub as your identity. Read-only repo access. Cancel
              and revoke whenever you like.
            </p>

            <button
              onClick={onSignIn}
              disabled={loading}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <GithubMark className="h-4 w-4" />
              )}
              {loading ? "Redirecting to GitHub…" : "Continue with GitHub"}
            </button>

            {error && (
              <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] p-3 font-mono text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
              <p className="text-[12px] leading-[1.55] text-[var(--text-dim)]">
                Scopes:{" "}
                <span className="font-mono text-[11px] text-[var(--text)]">
                  read:user, user:email, repo, read:org
                </span>
                . The repo scope lets EDITH list your repos and read their
                contents to scan. We never write to your code.
              </p>
            </div>

            <div className="mt-7 text-[12.5px] text-[var(--text-dim)]">
              New here?{" "}
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1 text-[var(--accent)] hover:brightness-110"
              >
                See pricing <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          <p className="mt-12 text-[11px] leading-[1.55] text-[var(--text-muted)]">
            By continuing you agree to our{" "}
            <Link href="#" className="text-[var(--text-dim)] hover:text-[var(--text)]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-[var(--text-dim)] hover:text-[var(--text)]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
