"use client";
import {
  Bell,
  ChevronDown,
  CreditCard,
  LogOut,
  Plug,
  Search,
  Settings as SettingsIcon,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

type SessionUser = {
  email?: string;
  initials: string;
  github?: string;
  avatarUrl?: string;
};

export function Topbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser>({ initials: "EE" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;
        const meta = (data.user.user_metadata ?? {}) as {
          name?: string;
          user_name?: string;
          avatar_url?: string;
        };
        const name = meta.name ?? meta.user_name ?? data.user.email ?? "";
        const initials = name
          .split(" ")
          .filter(Boolean)
          .map((s) => s[0]!.toUpperCase())
          .slice(0, 2)
          .join("");
        setUser({
          email: data.user.email ?? undefined,
          initials: initials || "EE",
          github: meta.user_name,
          avatarUrl: meta.avatar_url,
        });
      } catch {
        /* keep default */
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[var(--border)] bg-[var(--bg)]/85 px-6 backdrop-blur-md">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold leading-none text-[var(--text)]">
          {title}
        </h1>
        {subtitle && (
          <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            {subtitle}
          </div>
        )}
      </div>

      <button
        aria-label="Search"
        className="hidden h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] sm:inline-flex"
      >
        <Search className="h-3 w-3" strokeWidth={1.75} />
        Search repos
        <span className="ml-3 rounded border border-[var(--border)] px-1 text-[var(--text-muted)]">
          ⌘K
        </span>
      </button>

      <span className="hidden h-7 items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)] sm:inline-flex">
        <Sparkles className="h-3 w-3" strokeWidth={1.75} />
        Pro · trial
      </span>

      <button
        aria-label="Notifications"
        className="grid h-8 w-8 place-items-center rounded-md border border-[var(--border)] bg-[var(--bg-elev)] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
      >
        <Bell className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex h-8 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] pl-1 pr-2 transition-colors hover:border-[var(--border-hot)]"
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="h-6 w-6 rounded"
            />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded bg-[var(--accent)] font-mono text-[10px] font-semibold text-[var(--bg)]">
              {user.initials}
            </span>
          )}
          <ChevronDown
            className="h-3 w-3 text-[var(--text-dim)]"
            strokeWidth={1.75}
          />
        </button>
        {open && (
          <div className="absolute right-0 top-10 z-40 w-60 overflow-hidden rounded-lg border border-[var(--border-hot)] bg-[var(--bg-elev)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
            <div className="border-b border-[var(--border)] px-3 py-3">
              <div className="truncate text-[13px] text-[var(--text)]">
                {user.email ?? "Signed in"}
              </div>
              {user.github && (
                <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                  @{user.github}
                </div>
              )}
            </div>
            <nav className="py-1">
              <MenuLink href="/settings" icon={SettingsIcon}>
                Account settings
              </MenuLink>
              <MenuLink href="/integrations" icon={Plug}>
                Integrations
              </MenuLink>
              <MenuLink href="/settings#billing" icon={CreditCard}>
                Billing
              </MenuLink>
              <MenuLink href="/pricing" icon={Sparkles}>
                View pricing
              </MenuLink>
            </nav>
            <div className="border-t border-[var(--border)] py-1">
              <MenuLink href="/api/auth/signout" icon={LogOut} danger>
                Sign out
              </MenuLink>
            </div>
          </div>
        )}
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

function MenuLink({
  href,
  icon: Icon,
  children,
  danger,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--bg-elev-2)] ${
        danger ? "text-[var(--danger)]" : "text-[var(--text-dim)] hover:text-[var(--text)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {children}
    </Link>
  );
}
