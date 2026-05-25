import { redirect } from "next/navigation";
import {
  Database,
  GitBranch,
  Globe,
  KeyRound,
  Layers,
  Network,
  Sparkles,
} from "lucide-react";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";

export const dynamic = "force-dynamic";

type RepoInfo = {
  id: string;
  name: string;
  default_branch: string;
  stack: string[];
};

export default async function GraphPage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const orgId = await userOrgId(user.id);

  const admin = getSupabaseAdmin();
  const { data: repos } = orgId
    ? await admin
        .from("repositories")
        .select("id, name, default_branch, stack")
        .eq("org_id", orgId)
    : { data: [] };
  const repoRows = (repos as RepoInfo[]) ?? [];

  // Pull recent issues to extract route + table mentions
  type IssueRow = {
    file_path: string;
    title: string;
    check_id: string;
    repo_id: string;
  };
  let issues: IssueRow[] = [];
  if (repoRows.length > 0) {
    const repoIds = repoRows.map((r) => r.id);
    const { data } = await admin
      .from("issues")
      .select("file_path, title, check_id, repo_id, resolved_at")
      .in("repo_id", repoIds)
      .is("resolved_at", null)
      .limit(500);
    issues = ((data as (IssueRow & { resolved_at: string | null })[]) ?? []).map(
      (i) => ({
        file_path: i.file_path,
        title: i.title,
        check_id: i.check_id,
        repo_id: i.repo_id,
      }),
    );
  }

  // Derive surface-area sets from the data we already have
  const routes = new Set<string>();
  const tables = new Set<string>();
  const envVars = new Set<string>();
  const externals = new Set<string>();
  for (const i of issues) {
    const m = i.file_path.match(/^app\/api\/(.+?)\/route\.tsx?$/);
    if (m) routes.add("/api/" + m[1]);
    const tableMatch = i.title.match(/public\.([a-z_][a-z0-9_]*)/i);
    if (tableMatch) tables.add(tableMatch[1]);
    const envMatch = i.title.match(/process\.env\.([A-Z_][A-Z0-9_]+)/);
    if (envMatch) envVars.add(envMatch[1]);
    if (/stripe/i.test(i.title)) externals.add("Stripe");
    if (/razorpay/i.test(i.title)) externals.add("Razorpay");
    if (/supabase/i.test(i.title)) externals.add("Supabase");
    if (/openai|anthropic|claude/i.test(i.title)) externals.add("LLM API");
    if (/aws|s3/i.test(i.title)) externals.add("AWS");
  }

  const totalSurface =
    repoRows.length + routes.size + tables.size + envVars.size + externals.size;

  return (
    <>
      <Topbar
        title="Knowledge graph"
        subtitle="The surface area EDITH inferred from your code"
      />
      <main className="flex-1 px-6 py-8">
        {/* === ABOUT === */}
        <AboutCard
          icon={Network}
          title="What you're looking at"
          body="EDITH cross-references every finding to extract the four primary attack surfaces in your code: repos, API routes, database tables, and external dependencies. This page is the live projection — the things your code actually touches in production, derived from real issue data."
          uses={[
            "See which API routes are showing up in findings most often",
            "Catch env vars referenced in code but undocumented in .env.example",
            "Understand which external services (Stripe, OpenAI, AWS) your repos depend on",
            "Map blast radius before a migration — what tables / routes will be affected",
          ]}
        />

        {/* === STATS === */}
        <SectionHeader
          eyebrow="Inferred surface"
          title="Live cross-reference"
          className="mt-10"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Repos"
            value={repoRows.length}
            hint="connected"
            tone="accent"
          />
          <Stat
            label="API routes"
            value={routes.size}
            hint="from issues"
            tone={routes.size > 0 ? "good" : "muted"}
          />
          <Stat
            label="DB tables"
            value={tables.size}
            hint="referenced"
            tone={tables.size > 0 ? "good" : "muted"}
          />
          <Stat
            label="External deps"
            value={externals.size}
            hint="services"
            tone={externals.size > 0 ? "good" : "muted"}
          />
        </div>

        {/* === PILLARS === */}
        <SectionHeader
          eyebrow="The four pillars"
          title={`${totalSurface} surface elements identified`}
          className="mt-10"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Pillar
            icon={GitBranch}
            label="Repositories"
            description="Repos connected to EDITH and currently being scanned. Each repo gets its own context — its own scans, its own compliance projection."
            items={repoRows.map((r) => r.name)}
            empty="No repos connected yet."
          />
          <Pillar
            icon={Globe}
            label="API routes"
            description="App-router route handlers that have appeared in at least one EDITH finding. These are the request entry-points where auth, CSRF, and rate-limit issues land."
            items={Array.from(routes).sort()}
            empty="No routes flagged in findings yet."
          />
          <Pillar
            icon={Database}
            label="Tables"
            description="Postgres / Supabase tables mentioned in findings. Useful for spotting which tables are missing RLS, which have schema-drift risk."
            items={Array.from(tables).sort()}
            empty="No tables referenced in current findings."
          />
          <Pillar
            icon={KeyRound}
            label="Env vars + externals"
            description="Environment variables and external SaaS services your code depends on. Compare against .env.example to spot undocumented secrets."
            items={[
              ...Array.from(envVars).map((e) => `process.env.${e}`),
              ...Array.from(externals).map((e) => `external: ${e}`),
            ]}
            empty="No external dependencies surfaced yet."
          />
        </div>

        {/* === WHY THIS MATTERS === */}
        <SectionHeader
          eyebrow="Method"
          title="How we infer the graph"
          className="mt-12"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SpotlightCard className="p-5">
            <div className="flex items-center gap-3">
              <Sparkles
                className="h-4 w-4 text-[var(--accent)]"
                strokeWidth={1.75}
              />
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                Why we derive — not parse
              </h3>
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
              We don't crawl your full source tree. The graph is built from
              what EDITH's checks already touched — meaning what you see here
              is precisely the surface area that has shown up in at least one
              audit. It's a finding-weighted view, not an exhaustive index.
            </p>
          </SpotlightCard>
          <SpotlightCard className="p-5">
            <div className="flex items-center gap-3">
              <Layers
                className="h-4 w-4 text-[var(--accent)]"
                strokeWidth={1.75}
              />
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                What v2 will add
              </h3>
            </div>
            <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
              A real node-link diagram with clickable edges — "this route
              writes to this table"; "this env var is read in three files";
              "this external is called from these routes". The pillars
              already have the data; the visualisation is next.
            </p>
          </SpotlightCard>
        </div>
      </main>
    </>
  );
}

/* ============================== UI ============================== */

function AboutCard({
  icon: Icon,
  title,
  body,
  uses,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  uses: string[];
}) {
  return (
    <MagicCard className="overflow-hidden p-0">
      <div className="grid gap-0 md:grid-cols-[1fr_1fr]">
        <div className="border-r border-[var(--border)] p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
              <Icon className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
              About this page
            </div>
          </div>
          <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.015em] text-[var(--text)]">
            {title}
          </h2>
          <p className="mt-3 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
            {body}
          </p>
        </div>
        <div className="p-6">
          <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
            What you'll use this for
          </div>
          <ul className="mt-4 space-y-2">
            {uses.map((u) => (
              <li
                key={u}
                className="flex items-start gap-2.5 text-[12.5px] leading-[1.55] text-[var(--text)]"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]"
                />
                <span className="min-w-0 flex-1">{u}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MagicCard>
  );
}

function SectionHeader({
  eyebrow,
  title,
  className = "",
}: {
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={`mb-5 ${className}`}>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--accent)]">
        {eyebrow}
      </div>
      <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.015em] text-[var(--text)]">
        {title}
      </h2>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "accent" | "good" | "muted";
}) {
  const color =
    tone === "good"
      ? "text-[var(--success)]"
      : tone === "muted"
        ? "text-[var(--text-dim)]"
        : "text-[var(--accent)]";
  return (
    <SpotlightCard className="p-5">
      <div className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </div>
      <div
        className={`mt-3 font-mono text-[34px] font-semibold leading-none tabular-nums ${color}`}
      >
        <NumberTicker value={value} duration={1400} />
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </SpotlightCard>
  );
}

function Pillar({
  icon: Icon,
  label,
  description,
  items,
  empty,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  description: string;
  items: string[];
  empty: string;
}) {
  return (
    <MagicCard className="h-full p-5">
      <div className="flex items-center gap-2">
        <Icon
          className="h-4 w-4 text-[var(--accent)]"
          strokeWidth={1.75}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--text)]">
          {label}
        </span>
        <span className="ml-auto rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tabular-nums text-[var(--accent)]">
          {items.length}
        </span>
      </div>
      <p className="mt-3 text-[11.5px] leading-[1.5] text-[var(--text-dim)]">
        {description}
      </p>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        {items.length === 0 ? (
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {empty}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.slice(0, 10).map((it) => (
              <li
                key={it}
                className="flex items-start gap-2 truncate font-mono text-[11px] leading-tight text-[var(--text-dim)]"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]"
                />
                <span className="truncate">{it}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {items.length > 10 && (
        <div className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          +{items.length - 10} more
        </div>
      )}
    </MagicCard>
  );
}
