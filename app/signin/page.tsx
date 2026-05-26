"use client";
import { ArrowRight, Loader2, Shield } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EdithLogo } from "@/components/edith/logo";
import { GithubMark } from "@/components/edith/github-mark";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type Provider = "github" | "google";

export default function SignInPage() {
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signIn = async (provider: Provider) => {
    setError(null);
    setLoading(provider);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          // GitHub: repo + org access for scans. Google: identity only.
          scopes:
            provider === "github"
              ? "read:user user:email repo read:org"
              : "openid email profile",
        },
      });
      if (error) {
        setError(error.message);
        setLoading(null);
      }
      // On success, Supabase redirects away — no further action needed.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
      setLoading(null);
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
              Sign in to EDITH.
            </h1>
            <p className="mt-3 text-[14px] leading-[1.6] text-[var(--text-dim)]">
              GitHub is the fastest path — it gives EDITH read-only repo
              access so scans work immediately. Sign in with Google if you
              just want to browse and connect GitHub later.
            </p>

            <button
              onClick={() => signIn("github")}
              disabled={loading !== null}
              className="mt-7 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[var(--accent)] font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "github" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <GithubMark className="h-4 w-4" />
              )}
              {loading === "github"
                ? "Redirecting to GitHub…"
                : "Continue with GitHub"}
            </button>

            <div className="my-4 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <span className="h-px flex-1 bg-[var(--border)]" />
              or
              <span className="h-px flex-1 bg-[var(--border)]" />
            </div>

            <button
              onClick={() => signIn("google")}
              disabled={loading !== null}
              className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] font-mono text-[12px] font-semibold uppercase tracking-[0.15em] text-[var(--text)] transition-all hover:border-[var(--border-hot)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
              ) : (
                <GoogleMark className="h-4 w-4" />
              )}
              {loading === "google"
                ? "Redirecting to Google…"
                : "Continue with Google"}
            </button>

            {error && (
              <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] p-3 font-mono text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}

            <div className="mt-5 flex items-start gap-2.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-3">
              <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={1.75} />
              <p className="text-[12px] leading-[1.55] text-[var(--text-dim)]">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text)]">
                  GitHub scopes:
                </span>{" "}
                <span className="font-mono text-[11px] text-[var(--text)]">
                  read:user, user:email, repo, read:org
                </span>
                . The repo scope lets EDITH list your repos and read their
                contents to scan. We never write to your code. Google sign-in
                requests only{" "}
                <span className="font-mono text-[11px] text-[var(--text)]">
                  email, profile
                </span>
                .
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
            <Link
              href="/legal/tos"
              className="text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/legal/privacy"
              className="text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={className}
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.997 10.997 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.1A6.59 6.59 0 0 1 5.48 12c0-.73.13-1.44.36-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.83Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.3 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  );
}
