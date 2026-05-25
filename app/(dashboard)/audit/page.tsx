import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronRight,
  Download,
  FileCheck,
  Info,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Topbar } from "@/components/edith/topbar";
import { SpotlightCard } from "@/components/spectrum-ui/spotlight-card";
import { MagicCard } from "@/components/spectrum-ui/magic-card";
import { NumberTicker } from "@/components/spectrum-ui/number-ticker";
import { getSupabaseServer } from "@/lib/supabase-server";
import { userOrgId } from "@/lib/db-aggregations";
import { complianceFor } from "@/lib/compliance";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const orgId = await userOrgId(user.id);
  if (!orgId) {
    return (
      <>
        <Topbar title="Compliance" />
        <main className="flex-1 px-6 py-8">
          <SpotlightCard className="p-10 text-center">
            <h2 className="text-[18px] font-semibold text-[var(--text)]">
              No org yet.
            </h2>
            <p className="mt-2 text-[13px] text-[var(--text-dim)]">
              Connect a repo first so EDITH can map issues to controls.
            </p>
          </SpotlightCard>
        </main>
      </>
    );
  }

  const frameworks = await complianceFor(orgId);

  const totalControls = frameworks.reduce((s, f) => s + f.totalControls, 0);
  const totalFailing = frameworks.reduce((s, f) => s + f.failing, 0);
  const totalPassing = totalControls - totalFailing;
  const avgPercent =
    frameworks.length > 0
      ? Math.round(
          frameworks.reduce((s, f) => s + f.percent, 0) / frameworks.length,
        )
      : 0;

  return (
    <>
      <Topbar
        title="Compliance"
        subtitle="PCI · SOC 2 · GDPR · Play Store · App Store — live readiness"
      />
      <main className="flex-1 px-6 py-8">
        {/* === ABOUT THIS PAGE === */}
        <AboutCard
          icon={ShieldCheck}
          title="What you're looking at"
          body="Every open issue EDITH finds is mapped to one or more compliance controls across five frameworks. This page is the live projection of those mappings — pass percentages, failing-control counts, and per-framework drill-downs."
          uses={[
            "Show your auditor where you stand without screenshots or spreadsheets",
            "Spot which framework needs attention first before a renewal date",
            "Hand a manager the % for the quarterly review",
            "Justify why a specific issue is high priority (it violates a control)",
          ]}
        />

        {/* === STATS STRIP === */}
        <SectionHeader
          eyebrow="At a glance"
          title="Live posture across all frameworks"
          className="mt-10"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Frameworks"
            value={frameworks.length}
            hint="actively tracked"
            tone="accent"
          />
          <Stat
            label="Controls passing"
            value={totalPassing}
            hint={`of ${totalControls} total`}
            tone="good"
          />
          <Stat
            label="Controls failing"
            value={totalFailing}
            hint="open issues mapped"
            tone={totalFailing === 0 ? "good" : "bad"}
          />
          <Stat
            label="Avg readiness"
            value={avgPercent}
            suffix="%"
            hint="across frameworks"
            tone={avgPercent >= 85 ? "good" : avgPercent >= 65 ? "accent" : "bad"}
          />
        </div>

        {/* === FRAMEWORK CARDS === */}
        <SectionHeader
          eyebrow="Coverage"
          title="Click any framework for control-level evidence"
          className="mt-10"
          right={
            <Link
              href="/reports"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              <Download className="h-3 w-3" strokeWidth={2} />
              Export report
            </Link>
          }
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {frameworks.map((f) => (
            <FrameworkCard key={f.id} f={f} />
          ))}
        </div>

        {/* === WHY === */}
        <SectionHeader
          eyebrow="How it works"
          title="From check to control"
          className="mt-12"
        />
        <div className="grid gap-4 md:grid-cols-3">
          <ExplainStep
            n="01"
            icon={Target}
            title="Map check IDs to control IDs"
            body="Every EDITH check (e.g. security/jwt-in-localstorage) is mapped to one or more controls across the five frameworks via the compliance_check_mapping table. 295+ rows today."
          />
          <ExplainStep
            n="02"
            icon={FileCheck}
            title="Project open issues onto controls"
            body="On every scan, EDITH counts open findings per check and projects them onto every control that check violates. A control with one or more open issues is marked failing."
          />
          <ExplainStep
            n="03"
            icon={ShieldCheck}
            title="Render live readiness"
            body="The percentage you see is passing-controls ÷ total-controls. Process-only controls (e.g. incident-response plan) count as passing — they need human attestation."
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
  suffix,
  hint,
  tone,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint: string;
  tone: "accent" | "good" | "bad";
}) {
  const color =
    tone === "good"
      ? "text-[var(--success)]"
      : tone === "bad"
        ? "text-[var(--danger)]"
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
        {suffix && <span className="text-[20px]">{suffix}</span>}
      </div>
      <div className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {hint}
      </div>
    </SpotlightCard>
  );
}

function FrameworkCard({
  f,
}: {
  f: {
    id: string;
    name: string;
    description: string | null;
    totalControls: number;
    passing: number;
    failing: number;
    percent: number;
  };
}) {
  const tone =
    f.percent >= 85
      ? { color: "var(--success)", chip: "bg-[rgba(74,222,128,0.08)] border-[rgba(74,222,128,0.4)] text-[var(--success)]" }
      : f.percent >= 65
        ? { color: "var(--accent)", chip: "bg-[var(--accent-soft)] border-[var(--accent)]/40 text-[var(--accent)]" }
        : { color: "var(--danger)", chip: "bg-[rgba(248,113,113,0.08)] border-[rgba(248,113,113,0.4)] text-[var(--danger)]" };

  return (
    <Link href={`/audit/${f.id}`} className="group block h-full">
      <MagicCard className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
              {f.name}
            </h3>
            {f.description && (
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--text-dim)]">
                {f.description}
              </p>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] ${tone.chip}`}
          >
            <ShieldCheck className="h-3 w-3" strokeWidth={1.75} />
            {f.percent >= 85 ? "Ready" : f.percent >= 65 ? "Watch" : "Risk"}
          </span>
        </div>

        <div className="mt-5 flex items-baseline gap-2">
          <span
            className="font-mono text-[40px] font-semibold leading-none tabular-nums"
            style={{ color: tone.color }}
          >
            <NumberTicker value={f.percent} duration={1500} />%
          </span>
          <span className="font-mono text-[10.5px] text-[var(--text-muted)]">
            {f.passing}/{f.totalControls} passing
          </span>
        </div>

        <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--border)]">
          <span
            className="block h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${f.percent}%`,
              background: tone.color,
              boxShadow: `0 0 8px color-mix(in srgb, ${tone.color} 40%, transparent)`,
            }}
          />
        </div>

        <div className="mt-4 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          <span>
            {f.failing === 0 ? "0 failing" : `${f.failing} failing`}
          </span>
          <span className="inline-flex items-center gap-1 text-[var(--accent)] transition-colors group-hover:text-[var(--text)]">
            View controls
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </MagicCard>
    </Link>
  );
}

function ExplainStep({
  n,
  icon: Icon,
  title,
  body,
}: {
  n: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <SpotlightCard className="h-full p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-[var(--accent)]/40 bg-[var(--bg)] font-mono text-[10px] font-semibold tabular-nums text-[var(--accent)]">
          {n}
        </span>
        <Icon
          className="h-4 w-4 text-[var(--text-dim)]"
          strokeWidth={1.75}
        />
      </div>
      <h3 className="mt-4 text-[14px] font-semibold text-[var(--text)]">
        {title}
      </h3>
      <p className="mt-2 text-[12.5px] leading-[1.55] text-[var(--text-dim)]">
        {body}
      </p>
    </SpotlightCard>
  );
}

/* Unused-import suppressor */
void Info;
