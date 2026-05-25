"use client";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Database,
  GitBranch,
  Rocket,
  Shield,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BorderBeam } from "@/components/magicui/border-beam";

const SIZE = 320;
const RADIUS = 140;
const STROKE = 6;
const CX = SIZE / 2;
const CY = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SCORE = 87;
const TARGET_DASH = CIRCUMFERENCE * (SCORE / 100);

const TICK_OUTER = RADIUS + 12;
const TICK_INNER_MINOR = RADIUS + 7;
const TICK_INNER_MAJOR = RADIUS + 4;
const TICK_COUNT = 60;

const DIMENSIONS: { name: string; icon: LucideIcon; value: number }[] = [
  { name: "Security", icon: Shield, value: 92 },
  { name: "Performance", icon: Zap, value: 78 },
  { name: "Reliability", icon: Activity, value: 85 },
  { name: "Data Safety", icon: Database, value: 94 },
  { name: "Business Logic", icon: GitBranch, value: 81 },
  { name: "Deploy Ready", icon: Rocket, value: 88 },
];

export function ScoreGauge() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [count, setCount] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  useEffect(() => {
    if (!inView) {
      setCount(0);
      setScanComplete(false);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const duration = 1800;
    const tick = (t: number) => {
      if (start === null) start = t;
      const elapsed = t - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(SCORE * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setScanComplete(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView]);

  return (
    <div ref={ref} className="w-full max-w-[480px]">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elev)]/80 backdrop-blur-sm">
        <BorderBeam size={260} duration={9} />

        {/* L-bracket corners */}
        <Corner pos="tl" />
        <Corner pos="tr" />
        <Corner pos="bl" />
        <Corner pos="br" />

        {/* inner top gradient */}
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] [background:linear-gradient(180deg,var(--accent-soft),transparent_25%)] opacity-50" />

        {/* header bar */}
        <div className="relative flex items-center justify-between border-b border-[var(--border)]/60 px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em]">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                scanComplete
                  ? "bg-[var(--success)] shadow-[0_0_6px_var(--success)]"
                  : "animate-pulse bg-[var(--accent)] shadow-[0_0_6px_var(--accent-glow)]"
              }`}
            />
            <span
              className={
                scanComplete ? "text-[var(--success)]" : "text-[var(--accent)]"
              }
            >
              {scanComplete ? "Complete" : "Scanning"}
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--text-muted)]">main / a3f9c2e</span>
          </div>
          <div className="text-[var(--text-muted)]">v1.0.0</div>
        </div>

        {/* gauge */}
        <div className="relative px-6 pt-7">
          <div
            className="relative mx-auto"
            style={{ width: SIZE, height: SIZE }}
          >
            {/* center radial glow */}
            <div className="pointer-events-none absolute inset-8 rounded-full bg-[radial-gradient(circle,var(--accent-glow),transparent_70%)] opacity-40 blur-md" />

            <svg
              width={SIZE}
              height={SIZE}
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              className="relative"
            >
              <defs>
                <linearGradient
                  id="score-arc-gradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FFD27F" />
                  <stop offset="50%" stopColor="#FFB627" />
                  <stop offset="100%" stopColor="#FF6B27" />
                </linearGradient>
                <linearGradient
                  id="score-text-gradient"
                  x1="0%"
                  y1="0%"
                  x2="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#FFE9C5" />
                  <stop offset="100%" stopColor="#FFB627" />
                </linearGradient>
                <radialGradient id="sweep-gradient">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
                  <stop
                    offset="70%"
                    stopColor="var(--accent)"
                    stopOpacity="0.05"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--accent)"
                    stopOpacity="0.18"
                  />
                </radialGradient>
              </defs>

              {/* outer tick ring */}
              <g transform={`rotate(-90 ${CX} ${CY})`}>
                {Array.from({ length: TICK_COUNT }).map((_, i) => {
                  const isMajor = i % 5 === 0;
                  const inner = isMajor ? TICK_INNER_MAJOR : TICK_INNER_MINOR;
                  const angle = (i / TICK_COUNT) * Math.PI * 2;
                  const x1 = CX + Math.cos(angle) * TICK_OUTER;
                  const y1 = CY + Math.sin(angle) * TICK_OUTER;
                  const x2 = CX + Math.cos(angle) * inner;
                  const y2 = CY + Math.sin(angle) * inner;
                  const active = i / TICK_COUNT < SCORE / 100;
                  return (
                    <motion.line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={active ? "var(--accent)" : "var(--border-hot)"}
                      strokeWidth={isMajor ? 1.5 : 0.8}
                      strokeLinecap="round"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: inView ? (active ? 1 : 0.45) : 0,
                      }}
                      transition={{
                        duration: 0.4,
                        delay: inView ? 0.4 + (i / TICK_COUNT) * 1.2 : 0,
                      }}
                    />
                  );
                })}
              </g>

              {/* rotating scan sweep */}
              <motion.g
                animate={{ rotate: inView ? 360 : 0 }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{
                  transformOrigin: `${CX}px ${CY}px`,
                }}
              >
                <line
                  x1={CX}
                  y1={CY}
                  x2={CX}
                  y2={CY - RADIUS - 2}
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  opacity={0.55}
                  style={{
                    filter: "drop-shadow(0 0 6px var(--accent-glow))",
                  }}
                />
                <circle
                  cx={CX}
                  cy={CY - RADIUS - 2}
                  r={2}
                  fill="var(--accent)"
                  style={{
                    filter: "drop-shadow(0 0 8px var(--accent-glow))",
                  }}
                />
              </motion.g>

              {/* background ring */}
              <circle
                cx={CX}
                cy={CY}
                r={RADIUS}
                stroke="var(--border)"
                strokeWidth={STROKE}
                fill="none"
              />

              {/* animated score arc */}
              <motion.circle
                cx={CX}
                cy={CY}
                r={RADIUS}
                stroke="url(#score-arc-gradient)"
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                initial={{ strokeDashoffset: CIRCUMFERENCE }}
                animate={{
                  strokeDashoffset: inView
                    ? CIRCUMFERENCE - TARGET_DASH
                    : CIRCUMFERENCE,
                }}
                transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                transform={`rotate(-90 ${CX} ${CY})`}
                style={{
                  filter: "drop-shadow(0 0 14px var(--accent-glow))",
                }}
              />

              {/* inner ring (depth) */}
              <circle
                cx={CX}
                cy={CY}
                r={RADIUS - 18}
                stroke="var(--border)"
                strokeWidth={1}
                fill="none"
                opacity={0.5}
                strokeDasharray="2 4"
              />

              {/* dot at arc end */}
              <motion.circle
                r={5}
                fill="var(--accent)"
                initial={{ opacity: 0 }}
                animate={
                  inView
                    ? {
                        opacity: 1,
                        cx:
                          CX +
                          Math.cos(
                            -Math.PI / 2 + (SCORE / 100) * Math.PI * 2,
                          ) *
                            RADIUS,
                        cy:
                          CY +
                          Math.sin(
                            -Math.PI / 2 + (SCORE / 100) * Math.PI * 2,
                          ) *
                            RADIUS,
                      }
                    : { opacity: 0, cx: CX, cy: CY - RADIUS }
                }
                transition={{
                  duration: 1.8,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  filter: "drop-shadow(0 0 10px var(--accent))",
                }}
              />
            </svg>

            {/* center text overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex items-baseline gap-1">
                <span
                  className="font-mono text-[72px] font-semibold leading-none tabular-nums bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg,#FFE9C5,#FFB627)",
                    filter:
                      "drop-shadow(0 2px 12px rgba(255, 182, 39, 0.35))",
                  }}
                >
                  {count.toString().padStart(2, "0")}
                </span>
                <span className="font-mono text-[16px] text-[var(--text-dim)] tabular-nums">
                  /100
                </span>
              </div>
              <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-[var(--text-dim)]">
                <span className="h-px w-4 bg-[var(--accent)]/40" />
                EDITH Score
                <span className="h-px w-4 bg-[var(--accent)]/40" />
              </div>
            </div>
          </div>
        </div>

        {/* dimensions */}
        <div className="relative space-y-2 px-6 pt-7 pb-5">
          {DIMENSIONS.map((d, i) => (
            <DimensionRow
              key={d.name}
              {...d}
              inView={inView}
              delay={0.5 + i * 0.07}
            />
          ))}
        </div>

        {/* footer stats */}
        <div className="relative grid grid-cols-3 gap-px border-t border-[var(--border)]/60 bg-[var(--border)]/40">
          <StatCell label="Files" value="172" />
          <StatCell label="Scan" value="4.2s" />
          <StatCell label="Critical" value="3" tone="danger" />
        </div>
      </div>
    </div>
  );
}

function DimensionRow({
  name,
  icon: Icon,
  value,
  inView,
  delay,
}: {
  name: string;
  icon: LucideIcon;
  value: number;
  inView: boolean;
  delay: number;
}) {
  const segments = 14;
  const filled = Math.round((value / 100) * segments);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className="flex items-center gap-3"
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-2)]">
        <Icon className="h-3 w-3 text-[var(--text-dim)]" strokeWidth={1.75} />
      </div>
      <span className="w-[110px] shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {name}
      </span>
      <div className="flex flex-1 items-center gap-[3px]">
        {Array.from({ length: segments }).map((_, i) => {
          const active = i < filled;
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, scaleY: 0.3 }}
              animate={
                inView
                  ? { opacity: active ? 1 : 0.35, scaleY: 1 }
                  : { opacity: 0, scaleY: 0.3 }
              }
              transition={{
                duration: 0.25,
                delay: delay + i * 0.018,
                ease: "easeOut",
              }}
              className={`h-3 flex-1 rounded-[1px] ${
                active
                  ? "bg-[var(--accent)] shadow-[0_0_5px_var(--accent-glow)]"
                  : "bg-[var(--border-hot)]"
              }`}
            />
          );
        })}
      </div>
      <span className="w-9 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-[var(--text)]">
        {value}
        <span className="text-[var(--text-muted)]">%</span>
      </span>
    </motion.div>
  );
}

function StatCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  const valueColor =
    tone === "danger" ? "text-[var(--danger)]" : "text-[var(--text)]";
  return (
    <div className="flex flex-col items-center justify-center gap-1 bg-[var(--bg-elev)] py-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--text-muted)]">
        {label}
      </span>
      <span
        className={`font-mono text-[15px] font-semibold tabular-nums ${valueColor}`}
      >
        {value}
      </span>
    </div>
  );
}

function Corner({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof pos, string> = {
    tl: "top-2 left-2 border-l border-t",
    tr: "top-2 right-2 border-r border-t",
    bl: "bottom-2 left-2 border-l border-b",
    br: "bottom-2 right-2 border-r border-b",
  };
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute h-3 w-3 border-[var(--accent)]/50 ${map[pos]}`}
    />
  );
}
