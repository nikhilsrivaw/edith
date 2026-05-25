"use client";
import { Globe, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";

const AI_TOOLS = [
  { id: "cursor", label: "Cursor" },
  { id: "claude-code", label: "Claude Code" },
  { id: "windsurf", label: "Windsurf" },
  { id: "v0", label: "v0" },
] as const;

export default function RepoSettingsPage() {
  const params = useParams<{ repoId: string }>();
  const repoName = params.repoId;

  const [autoScan, setAutoScan] = useState(true);
  const [aiTool, setAiTool] = useState<string>("cursor");
  const [scanFrequency, setScanFrequency] = useState("on-push");

  return (
    <>
      <Topbar
        title="Repository settings"
        subtitle={repoName}
      />
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <Section title="Auto-scan" desc="Run a fresh scan whenever code changes.">
            <CleanCard className="p-5">
              <ToggleRow
                label="Enable auto-scan"
                desc="Triggered by GitHub push events on the default branch."
                value={autoScan}
                onChange={setAutoScan}
              />
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <Field label="Frequency">
                  <Radio
                    name="freq"
                    options={[
                      { id: "on-push", label: "On every push" },
                      { id: "daily", label: "Daily at 09:00 IST" },
                      { id: "weekly", label: "Weekly · Sunday" },
                    ]}
                    value={scanFrequency}
                    onChange={setScanFrequency}
                  />
                </Field>
              </div>
            </CleanCard>
          </Section>

          <Section title="AI tool" desc="Format of generated fix prompts.">
            <CleanCard className="p-5">
              <Field label="Preferred editor">
                <div className="grid grid-cols-2 gap-2">
                  {AI_TOOLS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setAiTool(t.id)}
                      className={`flex h-10 items-center justify-center rounded-md border px-3 font-mono text-[11px] uppercase tracking-[0.18em] transition-colors ${
                        aiTool === t.id
                          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "border-[var(--border)] bg-[var(--bg-elev-2)] text-[var(--text-dim)] hover:border-[var(--border-hot)] hover:text-[var(--text)]"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Field>
            </CleanCard>
          </Section>

          <Section title="Webhook" desc="EDITH-bot posts comments to your PRs from this address.">
            <CleanCard className="p-5">
              <Field label="Webhook URL">
                <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[12px] text-[var(--text-dim)]">
                  <code>
                    https://edith.expert/api/github/webhook/{repoName}
                  </code>
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Configured automatically. Read-only.
                </div>
              </Field>
            </CleanCard>
          </Section>

          <Section
            title="Browser-extension origins"
            desc="Bind the live URLs where this repo is deployed. The EDITH browser extension uses these to recognise the page you're on and link findings back to this repo."
          >
            <OriginBindings repoName={repoName} />
          </Section>

          <Section title="Danger zone" desc="Reversible — but it stops scans immediately.">
            <CleanCard
              className="p-5"
              withAccent={false}
              hoverable={false}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-semibold text-[var(--text)]">
                    Disconnect repository
                  </div>
                  <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
                    Stops auto-scanning and revokes the GitHub App for this
                    repo. History is retained.
                  </p>
                </div>
                <button className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] px-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--danger)] transition-colors hover:bg-[rgba(248,113,113,0.16)]">
                  <Trash2 className="h-3 w-3" strokeWidth={1.75} /> Disconnect
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
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
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
        <div className="text-[14px] font-medium text-[var(--text)]">
          {label}
        </div>
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

type Binding = {
  id: string;
  origin: string;
  label: string | null;
  created_at: string;
};

function OriginBindings({ repoName }: { repoName: string }) {
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/repos/${repoName}/origins`);
      if (res.ok) {
        const j = (await res.json()) as { ok: boolean; origins: Binding[] };
        setBindings(j.origins ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [repoName]);

  const add = async () => {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/repos/${repoName}/origins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, label: label || undefined }),
      });
      const j = (await res.json()) as { ok: boolean; error?: string };
      if (!j.ok) {
        setError(j.error ?? "Failed to add origin.");
      } else {
        setOrigin("");
        setLabel("");
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/repos/${repoName}/origins?id=${id}`, {
      method: "DELETE",
    });
    await load();
  };

  return (
    <CleanCard className="p-5">
      {bindings.length > 0 && (
        <ul className="mb-5 divide-y divide-[var(--border)]">
          {bindings.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-2.5">
              <Globe
                className="h-3.5 w-3.5 shrink-0 text-[var(--text-dim)]"
                strokeWidth={1.75}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[12.5px] text-[var(--text)]">
                  {b.origin}
                </div>
                {b.label && (
                  <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {b.label}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove(b.id)}
                aria-label="Remove"
                className="text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <div className="text-[12.5px] text-[var(--text-dim)]">Loading…</div>
      ) : bindings.length === 0 ? (
        <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
          No origins bound yet. Add the production URL where this repo runs
          (and optionally your staging and preview URLs).
        </p>
      ) : null}

      <div className="grid grid-cols-[2fr_1fr_auto] items-start gap-2">
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Origin
          </label>
          <input
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="https://app.example.com"
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 font-mono text-[12px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Label (opt.)
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="prod"
            className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[12.5px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
          />
        </div>
        <button
          onClick={add}
          disabled={saving || !origin.trim()}
          className="mt-[22px] inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3 w-3" strokeWidth={2.5} /> Bind
        </button>
      </div>
      {error && (
        <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] px-3 py-2 font-mono text-[11px] text-[var(--danger)]">
          {error}
        </div>
      )}
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        Tip: use http://localhost:3000 for local dev. Add staging + preview URLs too.
      </p>
    </CleanCard>
  );
}

function Radio({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label
          key={o.id}
          className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
            value === o.id
              ? "border-[var(--accent)]/60 bg-[var(--accent-soft)]"
              : "border-[var(--border)] bg-[var(--bg-elev-2)] hover:border-[var(--border-hot)]"
          }`}
        >
          <input
            type="radio"
            name={name}
            checked={value === o.id}
            onChange={() => onChange(o.id)}
            className="sr-only"
          />
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
              value === o.id
                ? "border-[var(--accent)]"
                : "border-[var(--border-hot)]"
            }`}
          >
            {value === o.id && (
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            )}
          </span>
          <span className="text-[13px] text-[var(--text)]">{o.label}</span>
        </label>
      ))}
    </div>
  );
}
