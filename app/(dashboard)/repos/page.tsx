import { ArrowRight, GitBranch, Globe, Lock, Search } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanButton } from "@/components/edith/scan-button";
import { Topbar } from "@/components/edith/topbar";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchGithubRepos, fetchGithubUser } from "@/lib/github-fetch";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ReposPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const [ghUser, repos] = await Promise.all([
    fetchGithubUser(),
    fetchGithubRepos(),
  ]);

  const privateCount = repos.filter((r) => r.private).length;
  const publicCount = repos.length - privateCount;
  const langs = new Set(repos.map((r) => r.language).filter(Boolean));

  return (
    <>
      <Topbar
        title="Repositories"
        subtitle={
          ghUser
            ? `Pulled from @${ghUser.login} · ${repos.length} total`
            : "GitHub access required"
        }
      />
      <main className="flex-1 px-6 py-8">
        {/* === STATS STRIP === */}
        <div className="mb-7 grid gap-3 sm:grid-cols-3">
          <RepoStat
            label="Total repos"
            value={repos.length}
            hint={`${publicCount} public · ${privateCount} private`}
            icon={GitBranch}
            accent
          />
          <RepoStat
            label="Languages"
            value={langs.size}
            hint="distinct"
            icon={Globe}
          />
          <RepoStat
            label="Scanned"
            value={0}
            hint="run your first scan"
            icon={Search}
            muted
          />
        </div>

        {/* === SEARCH BAR === */}
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-elev)] px-4 py-2.5 transition-colors hover:border-[var(--border-hot)]">
          <Search
            className="h-3.5 w-3.5 text-[var(--text-muted)]"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="Filter by name or language…"
            className="flex-1 bg-transparent font-mono text-[12px] text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <kbd className="rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--text-muted)]">
            /
          </kbd>
        </div>

        {/* === LIST === */}
        {repos.length === 0 ? (
          <SpotlightCard className="p-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
              <GitBranch className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--text)]">
              No repositories visible.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              If you have repos on GitHub, re-authorise EDITH with the{" "}
              <span className="font-mono text-[11px] text-[var(--text)]">
                repo
              </span>{" "}
              scope.
            </p>
            <Link
              href="/api/auth/signout"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Sign out & re-authorise <ArrowRight className="h-3 w-3" />
            </Link>
          </SpotlightCard>
        ) : (
          <MagicCard className="overflow-hidden">
            <div className="grid grid-cols-[1fr_90px_120px_70px_110px_90px] items-center gap-3 border-b border-[var(--border)] bg-[var(--bg)]/40 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
              <span>Repository</span>
              <span>Visibility</span>
              <span>Language</span>
              <span className="text-right">Stars</span>
              <span>Pushed</span>
              <span className="text-right">Scan</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {repos.map((r) => (
                <li
                  key={r.id}
                  className="group relative grid grid-cols-[1fr_90px_120px_70px_110px_90px] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-elev-2)]/50"
                >
                  {/* hover rail */}
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-0 w-[2px] -translate-y-1/2 bg-[var(--accent)] transition-all group-hover:h-6"
                  />
                  <Link
                    href={`/repos/${r.name}`}
                    className="min-w-0"
                  >
                    <div className="truncate text-[13.5px] font-medium text-[var(--text)] transition-colors group-hover:text-[var(--accent)]">
                      {r.name}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
                      {r.full_name}
                      {r.fork && (
                        <span className="ml-2 inline-flex items-center rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-1.5 font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                          Fork
                        </span>
                      )}
                    </div>
                  </Link>

                  <span className="truncate">
                    {r.private ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        <Lock className="h-2.5 w-2.5" strokeWidth={2} />
                        Private
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        Public
                      </span>
                    )}
                  </span>

                  <span className="truncate">
                    {r.language ? (
                      <span className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-dim)]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                        {r.language}
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-[var(--text-muted)]">
                        —
                      </span>
                    )}
                  </span>

                  <span className="text-right font-mono text-[11px] tabular-nums text-[var(--text-dim)]">
                    ★ {r.stargazers_count}
                  </span>

                  <span className="truncate font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
                    {timeAgo(r.pushed_at)}
                  </span>

                  <div className="flex items-center justify-end gap-1">
                    <ScanButton owner={r.owner.login} repo={r.name} />
                  </div>
                </li>
              ))}
            </ul>
          </MagicCard>
        )}
      </main>
    </>
  );
}

function RepoStat({
  label,
  value,
  hint,
  icon: Icon,
  accent,
  muted,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof GitBranch;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <SpotlightCard className="p-5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
          {label}
        </span>
        <div
          className={`grid h-7 w-7 place-items-center rounded-md border ${
            accent
              ? "border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </div>
      </div>
      <div
        className={`mt-4 font-mono text-[32px] font-semibold leading-none tabular-nums ${
          muted ? "text-[var(--text-dim)]" : "text-[var(--text)]"
        }`}
      >
        <NumberTicker value={value} duration={1300} />
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </SpotlightCard>
  );
}
