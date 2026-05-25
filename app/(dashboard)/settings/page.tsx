"use client";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";
import { CURRENT_USER, PLAN_META } from "@/lib/mock-data";

const MOCK_TOKENS = [
  {
    id: "tok_local_dev",
    name: "Local dev",
    last4: "·····xH7q",
    created: "2026-04-12",
    lastUsed: "12m ago",
  },
  {
    id: "tok_ci",
    name: "GitHub Actions CI",
    last4: "·····k9pB",
    created: "2026-03-02",
    lastUsed: "3h ago",
  },
];

export default function AccountSettingsPage() {
  const [name, setName] = useState(CURRENT_USER.name);
  const [email] = useState(CURRENT_USER.email);
  const [emailOnCritical, setEmailOnCritical] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(true);
  const plan = PLAN_META[CURRENT_USER.plan];

  return (
    <>
      <Topbar title="Account settings" subtitle={CURRENT_USER.email} />
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Profile */}
          <Section title="Profile" desc="Visible to teammates on your scans.">
            <CleanCard className="p-5">
              <Field label="Display name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--border-hot)] focus:outline-none"
                />
              </Field>
              <Field className="mt-4" label="Email">
                <input
                  value={email}
                  readOnly
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 text-[13px] text-[var(--text-dim)]"
                />
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Authenticated via GitHub · @{CURRENT_USER.github}
                </div>
              </Field>
            </CleanCard>
          </Section>

          {/* Notifications */}
          <Section title="Notifications" desc="How and when EDITH writes to you.">
            <CleanCard className="p-5">
              <ToggleRow
                label="Email on critical issue"
                desc="Send an email when a scan finds a new critical-severity issue."
                value={emailOnCritical}
                onChange={setEmailOnCritical}
              />
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <ToggleRow
                  label="Weekly digest"
                  desc="Monday morning summary of all repos."
                  value={weeklyDigest}
                  onChange={setWeeklyDigest}
                />
              </div>
            </CleanCard>
          </Section>

          {/* Org delivery */}
          <Section
            title="Delivery channels"
            desc="Where the weekly digest goes. Stored on your organization, not your user."
          >
            <OrgDeliveryCard />
          </Section>

          {/* Billing */}
          <Section
            title="Billing"
            desc="Manage your plan and view invoices. Billing via PayU."
          >
            <div id="billing">
            <CleanCard className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                    Current plan
                  </div>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-[20px] font-semibold text-[var(--text)]">
                      {plan.name}
                    </span>
                    <span className="font-mono text-[13px] text-[var(--text-dim)]">
                      {plan.priceInr}/mo · ≈ {plan.priceUsd}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[12.5px] text-[var(--text-dim)]">
                    {plan.repoLimit} · {plan.scanLimit} scans
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110">
                    Upgrade plan
                  </button>
                  <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]">
                    Manage in PayU
                  </button>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                <Usage label="Repos" value="6 / Unlimited" />
                <Usage label="Scans this month" value="186 / Unlimited" />
                <Usage label="Renews on" value="2026-06-02" />
              </div>
            </CleanCard>
            </div>
          </Section>

          {/* API tokens */}
          <Section
            title="API tokens"
            desc="Used by your CI, MCP clients, and the EDITH browser extension to trigger scans."
          >
            <CleanCard className="p-0">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  {MOCK_TOKENS.length} active
                </span>
                <button className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110">
                  <Plus className="h-3 w-3" strokeWidth={2.5} /> New token
                </button>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {MOCK_TOKENS.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-4 px-5 py-3.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-[var(--text)]">
                        {t.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                        Created {t.created} · last used {t.lastUsed}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-[var(--text-dim)]">
                      {t.last4}
                    </span>
                    <button
                      aria-label="Copy token id"
                      className="text-[var(--text-muted)] hover:text-[var(--text)]"
                    >
                      <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                    <button
                      aria-label="Revoke token"
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </CleanCard>
          </Section>

          {/* Danger */}
          <Section title="Danger zone" desc="Permanent. We email you a 7-day grace before purge.">
            <CleanCard className="p-5" withAccent={false} hoverable={false}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text)]">
                    Delete account
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
                    Removes all repos, scans, and tokens. Cannot be undone after grace period.
                  </p>
                </div>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--danger)] hover:bg-[rgba(248,113,113,0.16)]">
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} /> Delete
                </button>
              </div>
            </CleanCard>
          </Section>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-[15px] font-semibold text-[var(--text)]">
          {title}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-[14px] font-medium text-[var(--text)]">{label}</div>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">{desc}</p>
      </div>
      <button
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors ${
          value
            ? "border-[var(--accent)] bg-[var(--accent)]"
            : "border-[var(--border)] bg-[var(--bg-elev-2)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg)] transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function OrgDeliveryCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slack, setSlack] = useState("");
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/organization");
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const j = (await res.json()) as {
          ok: boolean;
          org: {
            slack_webhook_url: string | null;
            digest_email: string | null;
            digest_enabled: boolean;
          } | null;
        };
        if (j.ok && j.org) {
          setSlack(j.org.slack_webhook_url ?? "");
          setEmail(j.org.digest_email ?? "");
          setEnabled(j.org.digest_enabled);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slack_webhook_url: slack || null,
          digest_email: email || null,
          digest_enabled: enabled,
        }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setError(j.error ?? "Failed to save");
      } else {
        setSavedAt(Date.now());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CleanCard className="p-5 text-[13px] text-[var(--text-dim)]">
        Loading…
      </CleanCard>
    );
  }
  return (
    <CleanCard className="p-5">
      <Field label="Slack incoming-webhook URL">
        <input
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          placeholder="https://hooks.slack.com/services/..."
          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
        />
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Create one at api.slack.com/apps → Incoming Webhooks. EDITH delivers the Monday digest here.
        </div>
      </Field>
      <Field className="mt-4" label="Digest email recipient">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="team@your-company.com"
          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
        />
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
          Currently a stub — email delivery wires up when EDITH gets a Resend key.
        </div>
      </Field>
      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <ToggleRow
          label="Send weekly digest"
          desc="Monday 09:00 IST. Skipped if both Slack and email are empty."
          value={enabled}
          onChange={setEnabled}
        />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:opacity-50"
        >
          {saving ? "Saving" : "Save"}
        </button>
        {savedAt && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--success)]">
            Saved
          </span>
        )}
        {error && (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--danger)]">
            {error}
          </span>
        )}
      </div>
    </CleanCard>
  );
}

function Usage({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div>{label}</div>
      <div className="mt-1 font-sans text-[13px] font-semibold normal-case tracking-normal text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}
