"use client";

import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { Copy, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/* ============================ TYPES =========================== */

type SquiggleId = "one" | "two" | "three";

type Issue = {
  id: SquiggleId;
  line: number;
  color: string;
  drawDelayMs: number;
  severityLabel: string;
  severityColor: string;
  title: string;
  body: string;
};

const ISSUES: Record<SquiggleId, Issue> = {
  one: {
    id: "one",
    line: 9,
    color: "#F87171",
    drawDelayMs: 1200,
    severityLabel: "Critical · Security",
    severityColor: "#F87171",
    title: "Webhook payload trusted without signature verification.",
    body: "Attackers can POST forged events to /webhooks/stripe and mark orders as paid. Verify the Stripe-Signature header.",
  },
  two: {
    id: "two",
    line: 14,
    color: "#F87171",
    drawDelayMs: 1700,
    severityLabel: "Critical · Data Safety",
    severityColor: "#F87171",
    title: "SQL injection via interpolated template literal.",
    body: "User-controlled IDs are concatenated into raw SQL. Use parameterised queries via db.query(text, [values]).",
  },
  three: {
    id: "three",
    line: 5,
    color: "#FFB627",
    drawDelayMs: 2200,
    severityLabel: "High · Deploy",
    severityColor: "#FFB627",
    title: "Webhook secret env var not validated.",
    body: "process.env.STRIPE_SECRET_KEY may be undefined at runtime. Validate required env vars on startup.",
  },
};

const STATUS_TICK_MS = 2700;
const POPOVER_AUTO_SHOW_MS = 2900;
const POPOVER_AUTO_DISMISS_MS = 6900;
const POPOVER_WIDTH = 320;
const POPOVER_GAP = 10;

/* ============================ MAIN ============================ */

export function CodeEditor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { amount: 0.3, once: true });
  const reducedMotion = useReducedMotion();

  const [drawn, setDrawn] = useState<Set<SquiggleId>>(new Set());
  const [issueCount, setIssueCount] = useState(0);
  const [activePopover, setActivePopover] = useState<SquiggleId | null>(null);
  const [hovered, setHovered] = useState<SquiggleId | null>(null);

  const squiggleRefs = useRef<Record<SquiggleId, HTMLSpanElement | null>>({
    one: null,
    two: null,
    three: null,
  });
  const [positions, setPositions] = useState<
    Record<
      SquiggleId,
      { left: number; top: number; width: number; height: number } | null
    >
  >({ one: null, two: null, three: null });

  const measure = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    const cardRect = card.getBoundingClientRect();
    const next: typeof positions = { one: null, two: null, three: null };
    (Object.keys(squiggleRefs.current) as SquiggleId[]).forEach((id) => {
      const el = squiggleRefs.current[id];
      if (!el) return;
      const rects = el.getClientRects();
      const r = rects[0] ?? el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      next[id] = {
        left: r.left - cardRect.left,
        top: r.top - cardRect.top,
        width: r.width,
        height: r.height,
      };
    });
    setPositions(next);
  }, []);

  /* measure after layout + after web fonts settle */
  useLayoutEffect(() => {
    measure();
    let cancelled = false;
    const ready = (
      document as unknown as { fonts?: { ready?: Promise<unknown> } }
    ).fonts?.ready;
    if (ready && typeof ready.then === "function") {
      ready.then(() => {
        if (!cancelled) measure();
      });
    }
    return () => {
      cancelled = true;
    };
  }, [measure]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(card);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /* draw / status / popover sequence */
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      setDrawn(new Set(["one", "two", "three"]));
      setIssueCount(3);
      return;
    }
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    (Object.keys(ISSUES) as SquiggleId[]).forEach((id) => {
      timeouts.push(
        setTimeout(() => {
          setDrawn((s) => {
            const next = new Set(s);
            next.add(id);
            return next;
          });
        }, ISSUES[id].drawDelayMs),
      );
    });
    timeouts.push(setTimeout(() => setIssueCount(3), STATUS_TICK_MS));
    timeouts.push(
      setTimeout(() => setActivePopover("one"), POPOVER_AUTO_SHOW_MS),
    );
    timeouts.push(
      setTimeout(() => {
        setActivePopover((cur) => (cur === "one" ? null : cur));
      }, POPOVER_AUTO_DISMISS_MS),
    );
    return () => timeouts.forEach(clearTimeout);
  }, [inView, reducedMotion]);

  const displayedId: SquiggleId | null = hovered ?? activePopover;
  const displayedPos = displayedId ? positions[displayedId] : null;
  const displayedIssue = displayedId ? ISSUES[displayedId] : null;

  return (
    <div ref={containerRef} className="w-full max-w-[560px]">
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, scale: 0.98, y: 12 }}
        animate={
          inView
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.98, y: 12 }
        }
        transition={{
          duration: reducedMotion ? 0 : 0.5,
          ease: "easeOut",
          delay: reducedMotion ? 0 : 0.4,
        }}
        className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elev)]"
      >
        {/* Single amber accent line, top-left */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-2 top-2 z-20 h-4 w-[2px] bg-[var(--accent)]"
        />

        <ChromeBar />

        <CodeArea
          assignRef={(id, el) => {
            squiggleRefs.current[id] = el;
          }}
          onSquiggleHover={setHovered}
        />

        <div className="pointer-events-none absolute inset-0 z-10">
          <Squiggles
            positions={positions}
            drawn={drawn}
            reducedMotion={!!reducedMotion}
          />
        </div>

        <AnimatePresence>
          {displayedIssue && displayedPos && (
            <Popover
              key={displayedIssue.id}
              issue={displayedIssue}
              anchor={displayedPos}
              cardWidth={cardRef.current?.clientWidth ?? 560}
              cardHeight={cardRef.current?.clientHeight ?? 480}
            />
          )}
        </AnimatePresence>

        <StatusBar count={issueCount} />
      </motion.div>
    </div>
  );
}

/* =========================== CHROME =========================== */

function ChromeBar() {
  return (
    <div className="flex h-9 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg-elev-2)] px-4">
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]/60" />
      </div>
      <div className="ml-1.5 flex items-center gap-1.5 rounded-md bg-[var(--bg)] px-3 py-1">
        <span className="font-mono text-[11px] text-[var(--accent)]">{"</>"}</span>
        <span className="font-mono text-[12px] text-[var(--text)]">
          stripe/route.ts
        </span>
        <X
          className="ml-1 h-3 w-3 text-[var(--text-muted)]"
          strokeWidth={1.75}
        />
      </div>
      <Plus
        className="ml-auto h-3.5 w-3.5 text-[var(--text-muted)]"
        strokeWidth={1.75}
      />
    </div>
  );
}

/* ============================ CODE ============================ */

function CodeArea({
  assignRef,
  onSquiggleHover,
}: {
  assignRef: (id: SquiggleId, el: HTMLSpanElement | null) => void;
  onSquiggleHover: (id: SquiggleId | null) => void;
}) {
  return (
    <div className="relative overflow-hidden bg-[var(--bg)]">
      <div className="py-3 [mask-image:linear-gradient(180deg,#000_94%,transparent_100%)]">
        <Line num={1}>
          <K>import</K>
          <P> {"{ "}</P>
          <T>NextRequest</T>
          <P>, </P>
          <T>NextResponse</T>
          <P>{" } "}</P>
          <K>from</K>
          <P> </P>
          <S>{`"next/server"`}</S>
          <P>;</P>
        </Line>
        <Line num={2}>
          <K>import</K>
          <P> </P>
          <T>Stripe</T>
          <P> </P>
          <K>from</K>
          <P> </P>
          <S>{`"stripe"`}</S>
          <P>;</P>
        </Line>
        <Line num={3}>
          <K>import</K>
          <P>{" { "}</P>
          <span className="text-[var(--text)]">db</span>
          <P>{" } "}</P>
          <K>from</K>
          <P> </P>
          <S>{`"@/lib/db"`}</S>
          <P>;</P>
        </Line>
        <Line num={4}> </Line>
        <Line num={5}>
          <K>const</K>
          <P> </P>
          <span className="text-[var(--text)]">stripe</span>
          <P> = </P>
          <Hit id="three" assignRef={assignRef} onHover={onSquiggleHover}>
            <K>new</K>
            <P> </P>
            <T>Stripe</T>
            <P>(</P>
            <span className="text-[var(--text)]">process</span>
            <P>.</P>
            <span className="text-[var(--text)]">env</span>
            <P>.</P>
            <span className="text-[var(--text)]">STRIPE_SECRET_KEY</span>
            <P>!)</P>
          </Hit>
          <P>;</P>
        </Line>
        <Line num={6}> </Line>
        <Line num={7}>
          <K>export</K>
          <P> </P>
          <K>async</K>
          <P> </P>
          <K>function</K>
          <P> </P>
          <span className="text-[var(--text)]">POST</span>
          <P>(</P>
          <span className="text-[var(--text)]">req</span>
          <P>: </P>
          <T>NextRequest</T>
          <P>) {"{"}</P>
        </Line>
        <Line num={8}>
          <P>{"  "}</P>
          <K>const</K>
          <P> </P>
          <span className="text-[var(--text)]">body</span>
          <P> = </P>
          <K>await</K>
          <P> </P>
          <span className="text-[var(--text)]">req</span>
          <P>.</P>
          <span className="text-[var(--text)]">json</span>
          <P>();</P>
        </Line>
        <Line num={9}>
          <P>{"  "}</P>
          <K>const</K>
          <P> </P>
          <span className="text-[var(--text)]">event</span>
          <P> = </P>
          <Hit id="one" assignRef={assignRef} onHover={onSquiggleHover}>
            <span className="text-[var(--text)]">body</span>
            <P> </P>
            <K>as</K>
            <P> </P>
            <T>Stripe</T>
            <P>.</P>
            <T>Event</T>
          </Hit>
          <P>;</P>
        </Line>
        <Line num={10}> </Line>
        <Line num={11}>
          <P>{"  "}</P>
          <K>if</K>
          <P> (</P>
          <span className="text-[var(--text)]">event</span>
          <P>.</P>
          <span className="text-[var(--text)]">type</span>
          <P> === </P>
          <S>{`"checkout.session.completed"`}</S>
          <P>) {"{"}</P>
        </Line>
        <Line num={12}>
          <P>{"    "}</P>
          <K>const</K>
          <P> </P>
          <span className="text-[var(--text)]">orderId</span>
          <P> = </P>
          <span className="text-[var(--text)]">event</span>
          <P>.</P>
          <span className="text-[var(--text)]">data</span>
          <P>.</P>
          <span className="text-[var(--text)]">object</span>
          <P>.</P>
          <span className="text-[var(--text)]">id</span>
          <P>;</P>
        </Line>
        <Line num={13}>
          <P>{"    "}</P>
          <K>await</K>
          <P> </P>
          <span className="text-[var(--text)]">db</span>
          <P>.</P>
          <span className="text-[var(--text)]">query</span>
          <P>(</P>
        </Line>
        <Line num={14}>
          <P>{"      "}</P>
          <Hit id="two" assignRef={assignRef} onHover={onSquiggleHover}>
            <S>{"`UPDATE orders SET status="}</S>
            <S>{"'paid' WHERE id='"}</S>
            <P>{"${"}</P>
            <span className="text-[var(--text)]">orderId</span>
            <P>{"}"}</P>
            <S>{"'`"}</S>
          </Hit>
        </Line>
        <Line num={15}>
          <P>{"    "}</P>
          <P>);</P>
        </Line>
        <Line num={16}>
          <P>{"  "}</P>
          <P>{"}"}</P>
        </Line>
        <Line num={17}> </Line>
        <Line num={18}>
          <P>{"  "}</P>
          <K>return</K>
          <P> </P>
          <T>NextResponse</T>
          <P>.</P>
          <span className="text-[var(--text)]">json</span>
          <P>{"({ "}</P>
          <span className="text-[var(--text)]">received</span>
          <P>: </P>
          <K>true</K>
          <P>{" });"}</P>
        </Line>
        <Line num={19}>
          <P>{"}"}</P>
        </Line>
      </div>
    </div>
  );
}

/* === atomic token components === */

function K({ children }: { children: ReactNode }) {
  return <span className="text-[#6BAED6]">{children}</span>;
}
function S({ children }: { children: ReactNode }) {
  return <span className="text-[#E8B86B]">{children}</span>;
}
function T({ children }: { children: ReactNode }) {
  return <span className="text-[#B4D4F0]">{children}</span>;
}
function P({ children }: { children: ReactNode }) {
  return <span className="text-[var(--text-dim)]">{children}</span>;
}

function Line({ num, children }: { num: number; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[44px_1fr] items-baseline">
      <div className="border-r border-[var(--border)] pr-3 text-right font-mono text-[12px] leading-[1.7] text-[var(--text-muted)] select-none">
        {num}
      </div>
      <div className="overflow-hidden whitespace-pre pl-3 pr-3 font-mono text-[12.5px] leading-[1.7] text-[var(--text)]">
        {children}
      </div>
    </div>
  );
}

function Hit({
  id,
  children,
  assignRef,
  onHover,
}: {
  id: SquiggleId;
  children: ReactNode;
  assignRef: (id: SquiggleId, el: HTMLSpanElement | null) => void;
  onHover: (id: SquiggleId | null) => void;
}) {
  return (
    <span
      ref={(el) => assignRef(id, el)}
      tabIndex={0}
      role="button"
      aria-label={ISSUES[id].title}
      data-squiggle={id}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(id)}
      onBlur={() => onHover(null)}
      className="relative inline rounded-sm outline-none transition-colors focus-visible:bg-[var(--accent-soft)]"
    >
      {children}
    </span>
  );
}

/* ========================= SQUIGGLES ========================== */

function Squiggles({
  positions,
  drawn,
  reducedMotion,
}: {
  positions: Record<
    SquiggleId,
    { left: number; top: number; width: number; height: number } | null
  >;
  drawn: Set<SquiggleId>;
  reducedMotion: boolean;
}) {
  return (
    <>
      {(Object.keys(ISSUES) as SquiggleId[]).map((id) => {
        const pos = positions[id];
        if (!pos) return null;
        const isDrawn = drawn.has(id);
        return (
          <Squiggle
            key={id}
            x={pos.left}
            y={pos.top + pos.height}
            width={pos.width}
            color={ISSUES[id].color}
            drawn={isDrawn}
            instant={reducedMotion}
          />
        );
      })}
    </>
  );
}

function Squiggle({
  x,
  y,
  width,
  color,
  drawn,
  instant,
}: {
  x: number;
  y: number;
  width: number;
  color: string;
  drawn: boolean;
  instant: boolean;
}) {
  const amplitude = 1.5;
  const wavelength = 5;
  const path = buildSquigglePath(width, amplitude, wavelength);
  const svgHeight = amplitude * 2 + 3;
  return (
    <svg
      width={width}
      height={svgHeight}
      viewBox={`0 0 ${width} ${svgHeight}`}
      style={{
        position: "absolute",
        left: x,
        top: y - 1,
        overflow: "visible",
      }}
      aria-hidden
    >
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={instant ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: drawn ? 1 : 0 }}
        transition={{ duration: instant ? 0 : 0.28, ease: [0.4, 0, 0.2, 1] }}
      />
    </svg>
  );
}

function buildSquigglePath(
  width: number,
  amplitude: number,
  wavelength: number,
) {
  const steps = Math.max(2, Math.ceil((width / wavelength) * 2));
  const stepX = width / steps;
  let p = `M 0 ${amplitude}`;
  for (let i = 0; i < steps; i++) {
    const ex = (i + 1) * stepX;
    const cx = ex - stepX / 2;
    const cy = i % 2 === 0 ? 0 : amplitude * 2;
    p += ` Q ${cx} ${cy}, ${ex} ${amplitude}`;
  }
  return p;
}

/* ========================== POPOVER =========================== */

function Popover({
  issue,
  anchor,
  cardWidth,
  cardHeight,
}: {
  issue: Issue;
  anchor: { left: number; top: number; width: number; height: number };
  cardWidth: number;
  cardHeight: number;
}) {
  const POPOVER_ESTIMATED_HEIGHT = 156;
  const PAD = 12;

  // Decide above vs below based on remaining space
  const spaceBelow =
    cardHeight - (anchor.top + anchor.height) - POPOVER_GAP - PAD;
  const placeBelow = spaceBelow >= POPOVER_ESTIMATED_HEIGHT;

  const arrowX = anchor.left + anchor.width / 2;
  let left = arrowX - POPOVER_WIDTH / 2;
  left = Math.max(PAD, Math.min(cardWidth - POPOVER_WIDTH - PAD, left));
  const top = placeBelow
    ? anchor.top + anchor.height + POPOVER_GAP
    : anchor.top - POPOVER_ESTIMATED_HEIGHT - POPOVER_GAP;
  const arrowOffset = arrowX - left;

  return (
    <motion.div
      role="dialog"
      aria-label={issue.title}
      initial={{ opacity: 0, y: placeBelow ? -6 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: placeBelow ? -4 : 4 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      style={{
        position: "absolute",
        left,
        top,
        width: POPOVER_WIDTH,
        zIndex: 30,
      }}
      className="rounded-xl border border-[var(--border-hot)] bg-[var(--bg-elev)] p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]"
    >
      {/* triangle */}
      <span
        aria-hidden
        style={{
          left: arrowOffset - 4,
          ...(placeBelow ? { top: -4 } : { bottom: -4 }),
        }}
        className="absolute h-2 w-2 rotate-45 border-[var(--border-hot)] bg-[var(--bg-elev)]"
        // tiny rotated square forming the triangle effect
      />
      {/* signature accent bar */}
      <span
        aria-hidden
        className="absolute left-2 top-2 h-4 w-[2px] bg-[var(--accent)]"
      />
      <div className="flex items-center gap-2 pl-3">
        <span
          aria-hidden
          className="h-2 w-2 rounded-full"
          style={{ background: issue.severityColor }}
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: issue.severityColor }}
        >
          {issue.severityLabel}
        </span>
      </div>
      <h4 className="mt-3 text-[13px] font-semibold leading-snug text-[var(--text)]">
        {issue.title}
      </h4>
      <p className="mt-1.5 text-[12px] leading-[1.55] text-[var(--text-dim)]">
        {issue.body}
      </p>
      <button
        type="button"
        className="mt-3 inline-flex h-7 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
      >
        <Copy className="h-3 w-3" strokeWidth={2.25} />
        Copy fix prompt
      </button>
    </motion.div>
  );
}

/* ========================== STATUS BAR ========================= */

function StatusBar({ count }: { count: number }) {
  return (
    <div className="flex h-8 items-center justify-between border-t border-[var(--border)] bg-[var(--bg-elev-2)] px-4 font-mono text-[11px] uppercase tracking-[0.15em]">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-2 w-2"
          style={{
            background: count > 0 ? "var(--danger)" : "var(--text-muted)",
          }}
        />
        <span className="text-[var(--text)] tabular-nums">
          {count} {count === 1 ? "issue" : "issues"} found
        </span>
        {count > 0 && (
          <>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--text-dim)]">2 critical · 1 high</span>
          </>
        )}
      </div>
      <button
        type="button"
        className="group inline-flex items-center gap-1.5 text-[var(--accent)] transition-colors hover:text-[var(--accent)]/85"
      >
        Copy fix prompt
        <span className="inline-block transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </button>
    </div>
  );
}
