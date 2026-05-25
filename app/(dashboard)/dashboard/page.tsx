import {
  ArrowRight,
  GitBranch,
  Globe,
  Lock,
  Plug,
  ShieldAlert,
  Sparkles as SparklesIcon,
  Star,
  TrendingUp,
  Wand2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ScanButton } from "@/components/edith/scan-button";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  fetchGithubRepos,
  fetchGithubUser,
  type GitHubRepo,
} from "@/lib/github-fetch";
import { hasGithubApp } from "@/lib/github-app";
import { timeAgo } from "@/lib/format";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const ghUser = await fetchGithubUser();
  const repos = await fetchGithubRepos();

  // Has the user installed the GitHub App on any org?
  let appInstalled = false;
  if (hasGithubApp()) {
    try {
      const admin = getSupabaseAdmin();
      const { data: org } = await admin
        .from("org_members")
        .select("organizations!inner(github_installation_id)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      type OrgRow = { organizations: { github_installation_id: number | null } } | null;
      const installId = (org as OrgRow)?.organizations?.github_installation_id;
      appInstalled = Boolean(installId);
    } catch {
      appInstalled = false;
    }
  }

  const scopeMissing = ghUser === null;
  const firstName =
    ghUser?.name?.split(" ")[0] ??
    ghUser?.login ??
    user.email?.split("@")[0] ??
    "there";

  const totalRepos = repos.length;
  const totalPrivate = repos.filter((r) => r.private).length;
  const totalPublic = totalRepos - totalPrivate;
  const langCount = new Set(repos.map((r) => r.language).filter(Boolean)).size;

  return (
    <>
      <Topbar
        title={`Welcome back, ${firstName}`}
        subtitle={
          scopeMissing
            ? "GitHub access not granted — see banner below"
            : `${totalRepos} repos available · 0 scanned yet`
        }
      />
      <main className="flex-1 px-6 py-8">
        {scopeMissing && <ReAuthBanner />}
        {!scopeMissing && !appInstalled && hasGithubApp() && <InstallAppBanner />}

        {/* === STATS STRIP === */}
        <SectionHeader
          eyebrow="At a glance"
          title="Your audit posture"
          right={
            <Link
              href="/issues"
              className="hidden items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110 sm:inline-flex"
            >
              View all issues <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Repositories"
            value={totalRepos}
            hint={`${totalPublic} public · ${totalPrivate} private`}
            icon={GitBranch}
            accent
          />
          <Stat
            label="Languages"
            value={langCount}
            hint="across all repos"
            icon={Star}
          />
          <Stat
            label="EDITH scans"
            value={0}
            hint="run your first below"
            icon={TrendingUp}
            muted
          />
          <Stat
            label="Open issues"
            value={0}
            hint="after first scan"
            icon={ShieldAlert}
            muted
          />
        </div>

        {/* === QUICK LINKS === */}
        <SectionHeader
          eyebrow="Get started"
          title="Pick where to go"
          className="mt-12"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink
            href="/repos"
            title="Repositories"
            blurb="Browse and scan your repos"
            icon={GitBranch}
          />
          <QuickLink
            href="/plan-check"
            title="Plan Check"
            blurb="Validate a plan before your agent writes code"
            icon={Wand2}
          />
          <QuickLink
            href="/integrations/mcp"
            title="MCP Server"
            blurb="Plug EDITH into Cursor / Claude Code"
            icon={Plug}
          />
          <QuickLink
            href="/extension"
            title="Browser extension"
            blurb="Live audit any page in DevTools"
            icon={Globe}
          />
        </div>

        {/* === REPOS + PROFILE === */}
        <SectionHeader
          eyebrow="Workspace"
          title="Your repositories"
          className="mt-12"
        />
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <MagicCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-semibold text-[var(--text)]">
                  Pulled from github.com/{ghUser?.login ?? "you"}
                </h2>
                <div className="mt-0.5 truncate font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Sorted by most recently pushed
                </div>
              </div>
              <span className="shrink-0 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--accent)]">
                {totalRepos} total
              </span>
            </div>
            {repos.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-[13px] text-[var(--text-dim)]">
                  No repositories returned. {scopeMissing && "Grant repo access first."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {repos.slice(0, 10).map((r) => (
                  <RepoRow key={r.id} repo={r} />
                ))}
              </ul>
            )}
            {repos.length > 10 && (
              <div className="border-t border-[var(--border)] px-5 py-3 text-right">
                <Link
                  href="/repos"
                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] hover:brightness-110"
                >
                  See all {repos.length} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </MagicCard>

          <MagicCard className="p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--accent)]">
              GitHub account
            </div>
            <div className="mt-4 flex items-center gap-3">
              {ghUser?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ghUser.avatar_url}
                  alt={ghUser.login}
                  className="h-14 w-14 rounded-md border border-[var(--border)]"
                />
              ) : (
                <div className="grid h-14 w-14 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] font-mono text-[16px] font-semibold text-[var(--accent)]">
                  {(ghUser?.login ?? "?")[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-[var(--text)]">
                  {ghUser?.name ?? ghUser?.login ?? "Unknown"}
                </div>
                <div className="font-mono text-[11px] text-[var(--text-dim)]">
                  @{ghUser?.login ?? "—"}
                </div>
              </div>
            </div>
            {ghUser?.bio && (
              <p className="mt-4 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
                {ghUser.bio}
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4">
              <Mini label="Public" value={ghUser?.public_repos?.toString() ?? "—"} />
              <Mini
                label="Private"
                value={ghUser?.total_private_repos?.toString() ?? "—"}
              />
              <Mini label="Followers" value={ghUser?.followers?.toString() ?? "—"} />
            </div>
            <Link
              href={ghUser?.html_url ?? "#"}
              target="_blank"
              rel="noopener"
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              View on GitHub
              <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
            </Link>
          </MagicCard>
        </div>
      </main>
    </>
  );
}

/* ============================== UI ============================== */

function SectionHeader({
  eyebrow,
  title,
  right,
  className = "",
}: {
  eyebrow: string;
  title: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex items-baseline justify-between gap-4 ${className}`}>
      <div>
        <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
          {eyebrow}
        </div>
        <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.015em] text-[var(--text)]">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  hint,
  accent,
  muted,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  hint: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <SpotlightCard className="p-5" radius={200}>
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
        className={`mt-4 font-mono text-[36px] font-semibold leading-none tabular-nums ${
          muted ? "text-[var(--text-dim)]" : "text-[var(--text)]"
        }`}
      >
        <NumberTicker value={value} duration={1400} />
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </SpotlightCard>
  );
}

function QuickLink({
  href,
  title,
  blurb,
  icon: Icon,
}: {
  href: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
}) {
  return (
    <Link href={href} className="group block h-full">
      <SpotlightCard className="h-full p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-[13.5px] font-semibold text-[var(--text)]">
                {title}
              </h3>
              <ArrowRight
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-all group-hover:translate-x-0.5 group-hover:text-[var(--accent)]"
                strokeWidth={2}
              />
            </div>
            <p className="mt-1 text-[12px] leading-[1.5] text-[var(--text-dim)]">
              {blurb}
            </p>
          </div>
        </div>
      </SpotlightCard>
    </Link>
  );
}

function InstallAppBanner() {
  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="mt-0.5 h-4 w-[2px] shrink-0 bg-[var(--accent)]"
        />
        <Zap
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
          strokeWidth={1.75}
        />
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            One-time setup: install the EDITH GitHub App
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
            Right now you have to click Scan manually. Install the GitHub App and
            EDITH will auto-review every PR you open — inline comments, score,
            quality gate. One install, then forever.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/api/github/install"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] shadow-[0_0_20px_-8px_var(--accent-glow)] hover:brightness-110"
            >
              <SparklesIcon className="h-3 w-3" strokeWidth={2} />
              Install on GitHub
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReAuthBanner() {
  return (
    <div className="mb-6 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-5">
      <div className="flex items-start gap-3">
        <Lock
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]"
          strokeWidth={1.75}
        />
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            One more step — grant repo access
          </h3>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
            You signed in but EDITH can&apos;t read your repos yet. Sign out and
            sign back in to grant the{" "}
            <span className="font-mono text-[11px] text-[var(--text)]">repo</span>{" "}
            scope.
          </p>
          <div className="mt-3 flex gap-2">
            <Link
              href="/api/auth/signout"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Sign out &amp; re-authorise
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function RepoRow({ repo }: { repo: GitHubRepo }) {
  return (
    <li className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--bg-elev-2)]/50">
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-0 w-[2px] -translate-y-1/2 bg-[var(--accent)] transition-all group-hover:h-6"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13.5px] font-medium text-[var(--text)]">
            {repo.name}
          </span>
          {repo.private && (
            <span className="inline-flex h-4 items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-1.5 font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
              <Lock className="h-2.5 w-2.5" strokeWidth={2} /> Private
            </span>
          )}
          {repo.fork && (
            <span className="inline-flex h-4 items-center rounded border border-[var(--border)] bg-[var(--bg-elev-2)] px-1.5 font-mono text-[8.5px] uppercase tracking-[0.15em] text-[var(--text-muted)]">
              Fork
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] text-[var(--text-muted)]">
          {repo.language && (
            <span className="text-[var(--text-dim)]">{repo.language}</span>
          )}
          <span>★ {repo.stargazers_count}</span>
          <span>pushed {timeAgo(repo.pushed_at)}</span>
        </div>
        {repo.description && (
          <div className="mt-1 truncate text-[12.5px] text-[var(--text-dim)]">
            {repo.description}
          </div>
        )}
      </div>
      <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:inline">
        Not scanned
      </span>
      <ScanButton owner={repo.owner.login} repo={repo.name} />
    </li>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="mt-1 font-mono text-[14px] font-semibold tabular-nums text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}
