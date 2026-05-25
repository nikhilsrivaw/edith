import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { userOrgId } from "@/lib/db-aggregations";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

type Repo = { id: string; name: string; owner: string; updated_at: string };

export default async function ReportsPage() {
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
        .select("id, name, owner, updated_at")
        .eq("org_id", orgId)
    : { data: [] };
  const repoRows = (repos as Repo[]) ?? [];

  // Count latest scans across repos to show in stats
  let scanCount = 0;
  if (repoRows.length > 0) {
    const ids = repoRows.map((r) => r.id);
    const { count } = await admin
      .from("scans")
      .select("id", { count: "exact", head: true })
      .in("repo_id", ids)
      .eq("status", "completed");
    scanCount = count ?? 0;
  }

  return (
    <>
      <Topbar
        title="Reports"
        subtitle="Markdown + JSON audit reports for every repo you've connected"
      />
      <main className="flex-1 px-6 py-8">
        {/* === ABOUT === */}
        <AboutCard
          icon={FileText}
          title="What's in a report"
          body="Each report is a single deterministic snapshot of one repo's latest scan — scores, dimension breakdown, every open finding grouped by severity, and per-framework compliance summary. Generated on demand, signed by EDITH, ready to hand off."
          uses={[
            "Email to a security team during procurement / vendor reviews",
            "Attach to a SOC 2 or PCI auditor request",
            "Drop into a due-diligence data room for fundraising / acquisition",
            "Archive a snapshot before a risky migration so you can diff later",
          ]}
        />

        {/* === STATS STRIP === */}
        <SectionHeader
          eyebrow="At a glance"
          title="Available reports"
          className="mt-10"
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Repositories"
            value={repoRows.length}
            hint="have a report"
            tone={repoRows.length > 0 ? "accent" : "muted"}
          />
          <Stat
            label="Latest scans"
            value={scanCount}
            hint="across all repos"
            tone={scanCount > 0 ? "good" : "muted"}
          />
          <Stat
            label="Formats"
            value={2}
            hint=".md · .json (PDF on Pro)"
            tone="accent"
          />
        </div>

        {/* === REPORTS LIST === */}
        <SectionHeader
          eyebrow="Download"
          title="One repo · two formats"
          className="mt-10"
          right={
            <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)] sm:inline">
              ⏎ click any button to download
            </span>
          }
        />
        {repoRows.length === 0 ? (
          <SpotlightCard className="p-12 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[var(--accent)]/40 bg-[var(--accent-soft)] text-[var(--accent)]">
              <FileText className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h2 className="mt-4 text-[18px] font-semibold text-[var(--text)]">
              Connect a repo first.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              Reports are generated from the latest completed scan of each
              repo. Pick a repo to scan from the Repositories page.
            </p>
            <Link
              href="/repos"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--accent)] px-3.5 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
            >
              Browse repos <ArrowRight className="h-3 w-3" />
            </Link>
          </SpotlightCard>
        ) : (
          <MagicCard className="overflow-hidden">
            <ul className="divide-y divide-[var(--border)]">
              {repoRows.map((r) => (
                <ReportRow key={r.id} repo={r} />
              ))}
            </ul>
          </MagicCard>
        )}

        {/* === WHAT'S IN A REPORT === */}
        <SectionHeader
          eyebrow="Anatomy"
          title="What every report contains"
          className="mt-12"
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Anatomy
            icon={CheckCircle2}
            title="Scores"
            body="Headline EDITH score, Test score, Debt score, plus the per-dimension breakdown across all six dimensions."
          />
          <Anatomy
            icon={Layers}
            title="Findings"
            body="Every open finding from the latest scan, grouped by severity (critical / high / medium / low) with file:line + check ID."
          />
          <Anatomy
            icon={ShieldCheck}
            title="Compliance"
            body="Per-framework readiness (PCI / SOC 2 / GDPR / Play / App) with the specific failing controls listed under each."
          />
          <Anatomy
            icon={Briefcase}
            title="Provenance"
            body="Commit SHA, branch, generation timestamp — so auditors can verify the report against a specific state of the repo."
          />
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
        <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.015em] text-[var(--text)]">
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
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "accent" | "good" | "bad" | "muted";
}) {
  const color =
    tone === "good"
      ? "text-[var(--success)]"
      : tone === "bad"
        ? "text-[var(--danger)]"
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

function ReportRow({ repo }: { repo: Repo }) {
  return (
    <li className="group relative flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg-elev-2)]/50">
      <span
        aria-hidden
        className="absolute left-0 top-1/2 h-0 w-[2px] -translate-y-1/2 bg-[var(--accent)] transition-all group-hover:h-6"
      />
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--accent)]">
        <FileText className="h-4 w-4" strokeWidth={1.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-[var(--text)]">
          {repo.name}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
          {repo.owner}/{repo.name} · updated {timeAgo(repo.updated_at)}
        </div>
      </div>
      <Link
        href={`/api/reports/${repo.name}.md`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] transition-all hover:brightness-110"
      >
        <Download className="h-3 w-3" strokeWidth={2} /> .md
      </Link>
      <Link
        href={`/api/reports/${repo.name}.json`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-all hover:border-[var(--border-hot)] hover:text-[var(--text)]"
      >
        <Download className="h-3 w-3" strokeWidth={1.75} /> .json
      </Link>
    </li>
  );
}

function Anatomy({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <SpotlightCard className="h-full p-5">
      <div className="flex items-center gap-2.5">
        <Icon
          className="h-4 w-4 text-[var(--accent)]"
          strokeWidth={1.75}
        />
        <h3 className="text-[14px] font-semibold text-[var(--text)]">
          {title}
        </h3>
      </div>
      <p className="mt-3 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
        {body}
      </p>
    </SpotlightCard>
  );
}
