import { AnimatePresence, motion } from "motion/react";
import {
  Check,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BorderBeam, DotPattern, Particles, ShinyText } from "./magicui";
import {
  cn,
  colorFor,
  FALLBACK_PROMPT,
  FIX_PROMPTS,
  getHistory,
  recordHistory,
  scoreOf,
  sendMessage,
  SEV_RANK,
  SEV_WEIGHT,
  storageGet,
  storageSet,
  toneFor,
  type Finding,
  type HistoryEntry,
  type ScanPayload,
  type Severity,
  type Tone,
} from "./lib";

type SyncStatus = {
  connected: boolean;
  user?: { email: string | null; github: string | null; avatarUrl: string | null };
  org?: { name: string | null };
  repos?: { total: number; names: string[] };
  match?: { repoName: string; latestScore: number | null } | null;
  dashboardUrl?: string;
  repoUrl?: string;
  error?: string;
};

export default function App() {
  const [payload, setPayload] = useState<ScanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [drawer, setDrawer] = useState<"none" | "history" | "connect">("none");
  const [sync, setSync] = useState<SyncStatus>({ connected: false });

  const load = async () => {
    setLoading(true);
    const res = await sendMessage<ScanPayload>({
      type: "edith:get-active-findings",
    });
    if (res.ok) {
      const p: ScanPayload = {
        origin: res.origin,
        url: res.url,
        title: res.title,
        tools: res.tools || [],
        findings: res.findings || [],
        scannedAt: res.scannedAt,
      };
      setPayload(p);
      recordHistory(p);
    } else {
      setPayload({ findings: [] });
    }
    setLoading(false);

    // Sync status (the background fires the sync when scan-result arrives;
    // the popup just reads the cached result).
    const status = await sendMessage<SyncStatus>({
      type: "edith:get-sync-status",
    });
    if (status.ok) setSync(status as SyncStatus);
  };

  const rescan = async () => {
    setRescanning(true);
    await sendMessage({ type: "edith:rescan" });
    await new Promise((r) => setTimeout(r, 1400));
    setRescanning(false);
    load();
  };

  useEffect(() => {
    load();
  }, []);

  const findings = payload?.findings ?? [];
  const score = scoreOf(findings);
  const tone = toneFor(score);

  return (
    <div className="relative min-h-[200px] overflow-hidden bg-[var(--color-bg)]">
      <DotPattern className="opacity-30" />

      <Topbar
        onHistory={() => setDrawer("history")}
        rescanning={rescanning}
        onRescan={rescan}
      />

      <Hero payload={payload} score={score} tone={tone} loading={loading} />

      <SyncPanel sync={sync} onConnect={() => setDrawer("connect")} />

      <main className="relative max-h-[400px] overflow-y-auto">
        {findings.length === 0 ? (
          <Empty loading={loading} />
        ) : (
          <ul className="flex flex-col gap-2 p-3">
            <AnimatePresence>
              {findings
                .slice()
                .sort(
                  (a, b) =>
                    (SEV_RANK[a.severity] ?? 9) -
                    (SEV_RANK[b.severity] ?? 9),
                )
                .map((f, i) => (
                  <FindingCard key={`${f.checkId}-${i}`} f={f} delay={i * 0.04} />
                ))}
            </AnimatePresence>
          </ul>
        )}
      </main>

      <Footer onConnect={() => setDrawer("connect")} />

      <AnimatePresence>
        {drawer === "history" && (
          <HistoryDrawer onClose={() => setDrawer("none")} />
        )}
        {drawer === "connect" && (
          <ConnectDrawer onClose={() => setDrawer("none")} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============ SYNC PANEL ============ */

function SyncPanel({
  sync,
  onConnect,
}: {
  sync: SyncStatus;
  onConnect: () => void;
}) {
  if (!sync.connected) {
    return (
      <div className="relative z-10 flex items-center gap-3 border-b border-[var(--color-border-edith)] bg-[var(--color-bg)] px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] text-[var(--color-text-muted)]">
          <Plug className="h-3 w-3" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
            Not connected
          </div>
          <div className="truncate text-[11.5px] text-[var(--color-text-dim)]">
            Findings stay local. Connect to sync to your EDITH dashboard.
          </div>
        </div>
        <button
          onClick={onConnect}
          className="rounded-md bg-[var(--color-accent)] px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bg)] transition-all hover:brightness-110"
        >
          Connect
        </button>
      </div>
    );
  }

  const initials =
    (sync.user?.github || sync.user?.email || "EE")
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 2)
      .toUpperCase() || "EE";

  return (
    <div className="relative z-10 border-b border-[var(--color-border-edith)] bg-[var(--color-bg)]">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {sync.user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sync.user.avatarUrl}
            alt=""
            className="h-7 w-7 rounded-md border border-[var(--color-border-edith)]"
          />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-md bg-[var(--color-accent)] font-mono text-[10px] font-semibold text-[var(--color-bg)]">
            {initials}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-success)]">
            <Check className="h-3 w-3" strokeWidth={2.5} />
            Synced to EDITH
          </div>
          <div className="truncate text-[11.5px] text-[var(--color-text-dim)]">
            {sync.user?.github
              ? `@${sync.user.github}`
              : sync.user?.email || "—"}
            {sync.repos && ` · ${sync.repos.total} repos`}
          </div>
        </div>
        <a
          href={sync.dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-dim)] transition-colors hover:border-[var(--color-border-hot)] hover:text-[var(--color-text)]"
        >
          Open <ChevronRight className="h-2.5 w-2.5" />
        </a>
      </div>

      {sync.match && (
        <div className="border-t border-[var(--color-border-edith)] bg-[var(--color-accent-soft)] px-4 py-2">
          <div className="flex items-center gap-2">
            <Shield
              className="h-3 w-3 text-[var(--color-accent)]"
              strokeWidth={1.75}
            />
            <div className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--color-text)]">
              This page matches your{" "}
              <span className="font-mono font-semibold text-[var(--color-accent)]">
                {sync.match.repoName}
              </span>{" "}
              repo
              {sync.match.latestScore !== null && (
                <>
                  {" "}— EDITH{" "}
                  <span className="font-mono font-semibold">
                    {sync.match.latestScore}/100
                  </span>
                </>
              )}
            </div>
            {sync.repoUrl && (
              <a
                href={sync.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-accent)] hover:brightness-110"
              >
                View →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ TOPBAR ============ */

function Topbar({
  onHistory,
  onRescan,
  rescanning,
}: {
  onHistory: () => void;
  onRescan: () => void;
  rescanning: boolean;
}) {
  return (
    <header className="relative z-10 flex h-12 items-center justify-between border-b border-[var(--color-border-edith)] bg-[var(--color-bg)]/90 px-4 backdrop-blur-sm">
      <div className="flex items-center gap-2.5">
        <svg
          viewBox="0 0 36 16"
          className="h-3.5 w-8 text-[var(--color-text)]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="0.75" y="2.5" width="14" height="11" rx="2.5" />
          <rect x="21.25" y="2.5" width="14" height="11" rx="2.5" />
          <line x1="14.75" y1="8" x2="21.25" y2="8" />
          <circle
            cx="7.75"
            cy="8"
            r="1.6"
            fill="var(--color-accent)"
            stroke="none"
          />
          <circle
            cx="28.25"
            cy="8"
            r="1.6"
            fill="var(--color-accent)"
            stroke="none"
          />
        </svg>
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.22em] text-[var(--color-text)]">
          EDITH
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
          vibe audit
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton onClick={onHistory} label="History">
          <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
        <IconButton onClick={onRescan} label="Rescan" disabled={rescanning}>
          <motion.div
            animate={rescanning ? { rotate: 360 } : { rotate: 0 }}
            transition={{
              duration: 1.2,
              repeat: rescanning ? Infinity : 0,
              ease: "linear",
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
          </motion.div>
        </IconButton>
      </div>
    </header>
  );
}

function IconButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={disabled}
      className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-edith)] hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-text)] disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/* ============ HERO SCORE ============ */

function Hero({
  payload,
  score,
  tone,
  loading,
}: {
  payload: ScanPayload | null;
  score: number;
  tone: Tone;
  loading: boolean;
}) {
  const color = colorFor(tone);

  // Animated counting score — plain rAF loop, no MotionValue (which fights
  // React 19 in production builds and surfaces as hydration errors).
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (loading) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const to = score;
    const duration = 700;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4);
      setDisplay(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, loading]);

  const counts = useMemo(() => {
    const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of payload?.findings ?? []) c[f.severity]++;
    return c;
  }, [payload]);

  const originText = useMemo(() => {
    try {
      const u = new URL(payload?.url || payload?.origin || "");
      const t = u.host + (u.pathname !== "/" ? u.pathname : "");
      return t.length > 44 ? t.slice(0, 42) + "…" : t;
    } catch {
      return payload?.origin || "—";
    }
  }, [payload]);

  return (
    <section className="relative z-10 overflow-hidden border-b border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] p-5">
      {/* HUD bling */}
      <Particles quantity={20} color="#FFB627" />
      <BorderBeam size={180} duration={9} />
      {/* the bible signature: single 2x16 amber bar top-left */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-[2px] bg-[var(--color-accent)]"
      />

      <div className="relative">
        <div className="font-mono text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          EDITH SCORE · this page
        </div>

        <div className="mt-2 flex items-baseline gap-1.5">
          <span
            className="font-mono text-[58px] font-semibold leading-none tabular-nums"
            style={{ color, letterSpacing: "-0.04em" }}
          >
            {display}
          </span>
          <span className="font-mono text-[16px] font-medium text-[var(--color-text-muted)] tabular-nums">
            /100
          </span>
        </div>

        {/* score bar */}
        <div className="mt-3.5 h-1 overflow-hidden rounded-full bg-[var(--color-border-edith)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full"
            style={{
              background: color,
              boxShadow: `0 0 10px ${tone === "good" ? "rgba(74,222,128,.4)" : tone === "warn" ? "var(--color-accent-glow)" : "rgba(248,113,113,.4)"}`,
            }}
          />
        </div>

        {/* meta row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="flex-1 truncate font-mono text-[10.5px] text-[var(--color-text-dim)]">
            {originText}
          </span>
          {payload?.tools && payload.tools.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              <ShinyText>{payload.tools.slice(0, 3).join(" · ")}</ShinyText>
            </span>
          )}
        </div>

        {/* severity row */}
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          <SevChip sev="critical" count={counts.critical} />
          <SevChip sev="high" count={counts.high} />
          <SevChip sev="medium" count={counts.medium} />
          <SevChip sev="low" count={counts.low} />
        </div>
      </div>
    </section>
  );
}

function SevChip({ sev, count }: { sev: Severity; count: number }) {
  const active = count > 0;
  const colorClass: Record<Severity, string> = {
    critical:
      "border-[rgba(248,113,113,0.35)] text-[var(--color-danger)] [&_b]:text-[var(--color-danger)]",
    high:
      "border-[rgba(255,182,39,0.35)] text-[var(--color-accent)] [&_b]:text-[var(--color-accent)]",
    medium:
      "border-[rgba(107,174,214,0.35)] text-[var(--color-cool-2)] [&_b]:text-[var(--color-cool-2)]",
    low:
      "border-[var(--color-border-hot)] text-[var(--color-text-dim)] [&_b]:text-[var(--color-text-dim)]",
  };
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-md border border-[var(--color-border-edith)] bg-[var(--color-bg)] px-1 py-1.5 transition-colors",
        active && colorClass[sev],
      )}
    >
      <b className="text-[15px] font-semibold tabular-nums leading-none text-[var(--color-text-dim)]">
        {count}
      </b>
      <span className="font-mono text-[8.5px] font-medium uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
        {sev}
      </span>
    </div>
  );
}

/* ============ FINDING CARD ============ */

function FindingCard({ f, delay }: { f: Finding; delay: number }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const tpl = FIX_PROMPTS[f.checkId] ?? FALLBACK_PROMPT;
    try {
      await navigator.clipboard.writeText(tpl(f));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
      className="group relative overflow-hidden rounded-lg border border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] p-3 pl-4 transition-colors hover:border-[var(--color-border-hot)]"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute left-2 top-3 h-3.5 w-[2px] rounded bg-[var(--color-accent)] transition-all group-hover:h-5"
      />

      <div className="mb-1.5 flex items-center gap-1.5">
        <SeverityBadge sev={f.severity} />
        <span className="ml-auto font-mono text-[9px] font-medium text-[var(--color-text-muted)]">
          −{SEV_WEIGHT[f.severity]} score
        </span>
      </div>

      <p className="text-[12.5px] font-medium leading-snug text-[var(--color-text)]">
        {f.title}
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
        {f.description}
      </p>

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-[var(--color-border-edith)] pt-2.5">
        <button
          onClick={onCopy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.15em] transition-all",
            copied
              ? "border-[var(--color-success)] bg-[var(--color-success)] text-[var(--color-bg)]"
              : "border-[var(--color-border-hot)] bg-[var(--color-bg-elev-2)] text-[var(--color-text-dim)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg)]",
          )}
        >
          {copied ? (
            <>
              <Check className="h-2.5 w-2.5" strokeWidth={2.5} /> Copied
            </>
          ) : (
            <>
              <Copy className="h-2.5 w-2.5" strokeWidth={2.25} /> Fix prompt
            </>
          )}
        </button>
        <span className="ml-auto truncate font-mono text-[9px] text-[var(--color-text-muted)]">
          {f.checkId}
        </span>
      </div>
    </motion.li>
  );
}

function SeverityBadge({ sev }: { sev: Severity }) {
  const cls: Record<Severity, string> = {
    critical:
      "border-[rgba(248,113,113,0.45)] bg-[rgba(248,113,113,0.1)] text-[var(--color-danger)]",
    high:
      "border-[rgba(255,182,39,0.45)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    medium:
      "border-[rgba(107,174,214,0.45)] bg-[rgba(107,174,214,0.1)] text-[var(--color-cool-2)]",
    low:
      "border-[var(--color-border-edith)] bg-[var(--color-bg-elev-2)] text-[var(--color-text-dim)]",
  };
  return (
    <span
      className={cn(
        "inline-block rounded border px-1.5 py-0.5 font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em]",
        cls[sev],
      )}
    >
      {sev}
    </span>
  );
}

/* ============ EMPTY ============ */

function Empty({ loading }: { loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <Loader2
          className="h-5 w-5 animate-spin text-[var(--color-accent)]"
          strokeWidth={1.75}
        />
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          Scanning page…
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[rgba(74,222,128,0.12)] text-[var(--color-success)]">
        <Check className="h-6 w-6" strokeWidth={2.25} />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-[var(--color-text)]">
        Nothing to flag.
      </h3>
      <p className="mx-auto mt-1 max-w-[260px] text-[11.5px] leading-relaxed text-[var(--color-text-dim)]">
        EDITH walked the DOM, scripts, cookies, headers, storage, and network.
      </p>
    </div>
  );
}

/* ============ FOOTER ============ */

function Footer({ onConnect }: { onConnect: () => void }) {
  return (
    <footer className="relative z-10 border-t border-[var(--color-border-edith)] bg-[var(--color-bg)] px-3 py-2">
      <button
        onClick={onConnect}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
      >
        <Link2 className="h-3 w-3" strokeWidth={2} />
        Connect to your EDITH account
      </button>
    </footer>
  );
}

/* ============ HISTORY DRAWER ============ */

function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    getHistory().then(setEntries);
  }, []);

  return (
    <DrawerWrap title="Recent scans" onClose={onClose}>
      {entries.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-dim)]">
          No scans yet. Visit a page to start.
        </p>
      ) : (
        <ul className="flex flex-col">
          {entries.map((e) => (
            <li
              key={e.url}
              className="flex items-center gap-3 border-b border-[var(--color-border-edith)] py-3 last:border-b-0"
            >
              <HistoryScoreBadge score={e.score} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-[var(--color-text)]">
                  {e.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                  {e.origin}
                </div>
              </div>
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-text-dim)]">
                {e.counts.critical}·{e.counts.high}·{e.counts.medium}
              </span>
            </li>
          ))}
        </ul>
      )}
    </DrawerWrap>
  );
}

function HistoryScoreBadge({ score }: { score: number }) {
  const tone = toneFor(score);
  const cls = {
    good:
      "border-[rgba(74,222,128,0.45)] bg-[rgba(74,222,128,0.08)] text-[var(--color-success)]",
    warn:
      "border-[rgba(255,182,39,0.45)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
    bad:
      "border-[rgba(248,113,113,0.45)] bg-[rgba(248,113,113,0.08)] text-[var(--color-danger)]",
  }[tone];
  return (
    <div
      className={cn(
        "grid h-10 w-10 shrink-0 place-items-center rounded-md border font-mono text-[13px] font-semibold tabular-nums",
        cls,
      )}
    >
      {score}
    </div>
  );
}

/* ============ CONNECT DRAWER ============ */

function ConnectDrawer({ onClose }: { onClose: () => void }) {
  const [apiUrl, setApiUrl] = useState("http://localhost:3000/api/mcp");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  useEffect(() => {
    sendMessage<{ apiUrl: string; token: string }>({
      type: "edith:get-config",
    }).then((res) => {
      if (res.ok) {
        setApiUrl(res.apiUrl || "http://localhost:3000/api/mcp");
        setToken(res.token || "");
      }
    });
  }, []);

  const save = async () => {
    if (!apiUrl.trim()) {
      setMsg({ kind: "err", text: "Base URL required." });
      return;
    }
    await sendMessage({
      type: "edith:save-config",
      apiUrl: apiUrl.trim(),
      token: token.trim(),
    });
    setMsg({ kind: "ok", text: "Saved." });
    setTimeout(onClose, 800);
  };

  const setupBase = (() => {
    try {
      const u = new URL(apiUrl || "http://localhost:3000/api/mcp");
      return `${u.protocol}//${u.host}/extension/connect`;
    } catch {
      return "http://localhost:3000/extension/connect";
    }
  })();

  return (
    <DrawerWrap title="Connect to EDITH" onClose={onClose}>
      <p className="text-[12px] leading-relaxed text-[var(--color-text-dim)]">
        Findings on this page sync to your dashboard once connected.
      </p>

      <a
        href={setupBase}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bg)] transition-all hover:brightness-110"
      >
        <Plug className="h-3 w-3" strokeWidth={2} />
        Open one-click setup
      </a>
      <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
        Generates a token, no MCP knowledge needed
      </p>

      <div className="my-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--color-border-edith)]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          or paste manually
        </span>
        <span className="h-px flex-1 bg-[var(--color-border-edith)]" />
      </div>

      <Field label="EDITH base URL">
        <input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:3000/api/mcp"
          className="h-9 w-full rounded-md border border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] px-3 font-mono text-[11px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-hot)] focus:outline-none"
        />
      </Field>
      <Field label="API token">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="edith_..."
          className="h-9 w-full rounded-md border border-[var(--color-border-edith)] bg-[var(--color-bg-elev)] px-3 font-mono text-[11px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-hot)] focus:outline-none"
        />
      </Field>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={save}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-bg)] transition-all hover:brightness-110"
        >
          <Plug className="h-3 w-3" strokeWidth={2} />
          Save
        </button>
        {msg && (
          <span
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.18em]",
              msg.kind === "ok"
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]",
            )}
          >
            {msg.text}
          </span>
        )}
      </div>
    </DrawerWrap>
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
    <div className="mt-3.5">
      <label className="mb-1.5 block font-mono text-[9.5px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}

function DrawerWrap({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-0 z-30 flex flex-col overflow-y-auto bg-[var(--color-bg)] p-4"
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[14px] font-semibold tracking-tight text-[var(--color-text)]">
          {title}
        </h4>
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-border-edith)] hover:bg-[var(--color-bg-elev)] hover:text-[var(--color-text)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
      {children}
    </motion.div>
  );
}

/* === unused imports keep tree-shaker quiet === */
void Search;
void Shield;
void ChevronRight;
void storageGet;
void storageSet;
