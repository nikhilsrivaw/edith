"use client";
import { Mail, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";

type Member = {
  user_id: string;
  role: string;
  joined_at: string;
  user: { email: string | null; github_login: string | null; avatar_url: string | null };
};

type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const j = (await res.json()) as {
          ok: boolean;
          members: Member[];
          invites: Invite[];
        };
        setMembers(j.members);
        setInvites(j.invites);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    setError(null);
    setLastLink(null);
    setBusy(true);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        error?: string;
        inviteUrl?: string;
      };
      if (!j.ok) setError(j.error ?? "Failed");
      else {
        setEmail("");
        setLastLink(j.inviteUrl ?? null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch(`/api/team/invite?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <>
      <Topbar
        title="Team"
        subtitle={loading ? "…" : `${members.length} member${members.length === 1 ? "" : "s"} · ${invites.length} pending invite${invites.length === 1 ? "" : "s"}`}
      />
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Invite form */}
          <CleanCard className="p-5">
            <h2 className="text-[14px] font-semibold text-[var(--text)]">
              Invite a teammate
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
              They&apos;ll get an invite link valid for 7 days.
            </p>
            <div className="mt-4 grid grid-cols-[2fr_1fr_auto] items-end gap-2">
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-hot)] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Role
                </label>
                <select
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as "member" | "admin")
                  }
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-[13px] text-[var(--text)] focus:border-[var(--border-hot)] focus:outline-none"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                onClick={invite}
                disabled={busy || !email.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} />
                Invite
              </button>
            </div>
            {error && (
              <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] px-3 py-2 font-mono text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}
            {lastLink && (
              <div className="mt-3 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  Invite link · share manually until email delivery is wired
                </div>
                <code className="mt-1 block break-all font-mono text-[11px] text-[var(--text)]">
                  {lastLink}
                </code>
              </div>
            )}
          </CleanCard>

          {/* Members */}
          <CleanCard className="p-0">
            <div className="border-b border-[var(--border)] px-5 py-4">
              <h2 className="text-[14px] font-semibold text-[var(--text)]">
                Members
              </h2>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3 px-5 py-3">
                  {m.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.user.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-md border border-[var(--border)]"
                    />
                  ) : (
                    <span className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)] font-mono text-[12px] text-[var(--text-dim)]">
                      {(m.user.github_login || m.user.email || "?")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-[var(--text)]">
                      {m.user.github_login
                        ? `@${m.user.github_login}`
                        : m.user.email || "—"}
                    </div>
                    {m.user.github_login && m.user.email && (
                      <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
                        {m.user.email}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          </CleanCard>

          {/* Pending invites */}
          {invites.length > 0 && (
            <CleanCard className="p-0">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <h2 className="text-[14px] font-semibold text-[var(--text)]">
                  Pending invites
                </h2>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {invites.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-5 py-3">
                    <Mail
                      className="h-3.5 w-3.5 text-[var(--text-dim)]"
                      strokeWidth={1.75}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] text-[var(--text)]">
                        {inv.email}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {inv.role} · expires {inv.expires_at.slice(0, 10)}
                      </div>
                    </div>
                    <button
                      onClick={() => revoke(inv.id)}
                      aria-label="Revoke"
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            </CleanCard>
          )}
        </div>
      </main>
    </>
  );
}
