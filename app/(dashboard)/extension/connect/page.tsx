"use client";
import { ArrowRight, Check, Copy, Loader2, Plug } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";

type StepState = "pending" | "active" | "done";

export default function ExtensionConnectPage() {
  const [token, setToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // After we create the token, present it once. The user pastes it into the
  // extension popup's "I have a token" field; we cannot push to the extension
  // from a webpage. (Chrome doesn't allow web→extension direct writes.)

  const generate = async () => {
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Browser extension · ${new Date().toISOString().slice(0, 10)}`,
        }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        token?: { raw: string };
        error?: string;
      };
      if (!j.ok || !j.token?.raw) {
        setError(j.error ?? "Failed to create token");
      } else {
        setToken(j.token.raw);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const apiUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "http://localhost:3000/api/mcp";

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* */
    }
  };

  return (
    <>
      <Topbar
        title="Connect the browser extension"
        subtitle="Two clicks. The extension syncs findings to your account from then on."
      />
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-5">
          {/* Steps */}
          <Step
            n={1}
            state={token ? "done" : generating ? "active" : "pending"}
            title="Generate your extension token"
            desc="One token per browser. Revoke any time."
          >
            {!token ? (
              <button
                onClick={generate}
                disabled={generating}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    Generating
                  </>
                ) : (
                  <>
                    <Plug className="h-3.5 w-3.5" strokeWidth={2} />
                    Generate token
                  </>
                )}
              </button>
            ) : (
              <div className="rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  Your token — copy now, won&apos;t be shown again
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[12px] text-[var(--text)]">
                  <code className="flex-1 truncate">{token}</code>
                  <CopyBtn text={token} onCopy={() => copy(token)} copied={copied} />
                </div>
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-md border border-[var(--danger)]/40 bg-[rgba(248,113,113,0.08)] p-3 font-mono text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}
          </Step>

          <Step
            n={2}
            state={token ? "active" : "pending"}
            title="Paste it into the extension"
            desc="Open the EDITH popup → Connect to your EDITH account."
          >
            <div className="space-y-3">
              <KvRow label="Base URL" value={apiUrl} onCopy={() => copy(apiUrl)} />
              <KvRow
                label="Token"
                value={token ?? "(generate above first)"}
                onCopy={token ? () => copy(token) : undefined}
                muted={!token}
              />
            </div>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[12.5px] leading-relaxed text-[var(--text-dim)]">
              <li>Click the EDITH icon in your Chrome toolbar.</li>
              <li>
                Click <span className="font-mono text-[11px] text-[var(--text)]">Connect to your EDITH account</span> at the bottom of the popup.
              </li>
              <li>Paste the Base URL + Token above, then Save.</li>
              <li>
                Reload any tab. The popup should now show{" "}
                <span className="font-mono text-[11px] text-[var(--success)]">Synced to EDITH ✓</span>.
              </li>
            </ol>
          </Step>

          <Step
            n={3}
            state="pending"
            title="(Optional) Bind your repo URLs"
            desc="Tell EDITH which URLs run which repo. The extension then shows the matching EDITH score on every visit."
          >
            <p className="text-[12.5px] leading-relaxed text-[var(--text-dim)]">
              Open any repo&apos;s settings page and find{" "}
              <span className="font-mono text-[11px] text-[var(--text)]">
                Browser-extension origins
              </span>
              . Add your prod / staging / local-dev URLs.
            </p>
            <Link
              href="/repos"
              className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg-elev)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:border-[var(--border-hot)] hover:text-[var(--text)]"
            >
              Open repositories <ArrowRight className="h-3 w-3" />
            </Link>
          </Step>

          <CleanCard className="p-5 text-[12.5px] text-[var(--text-dim)]">
            <h3 className="text-[13px] font-semibold text-[var(--text)]">
              What is &ldquo;MCP&rdquo; / why does the URL end in /api/mcp?
            </h3>
            <p className="mt-2 leading-relaxed">
              The extension uses the same authenticated API as our Cursor / Claude
              Code integration — the Model Context Protocol. You don&apos;t need
              to know anything about MCP to use the extension; the URL just
              points at the API endpoint your token authorises.
            </p>
          </CleanCard>
        </div>
      </main>
    </>
  );
}

function Step({
  n,
  state,
  title,
  desc,
  children,
}: {
  n: number;
  state: StepState;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <CleanCard className="p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[11px] font-semibold tabular-nums ${
            state === "done"
              ? "border-[var(--success)] bg-[var(--success)] text-[var(--bg)]"
              : state === "active"
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                : "border-[var(--border-hot)] text-[var(--text-muted)]"
          }`}
        >
          {state === "done" ? (
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
          ) : (
            n
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            {title}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">{desc}</p>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </CleanCard>
  );
}

function KvRow({
  label,
  value,
  onCopy,
  muted,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2">
        <code
          className={`flex-1 truncate font-mono text-[12px] ${muted ? "text-[var(--text-muted)]" : "text-[var(--text)]"}`}
        >
          {value}
        </code>
        {onCopy && <CopyBtn text={value} onCopy={onCopy} copied={false} />}
      </div>
    </div>
  );
}

function CopyBtn({
  onCopy,
  copied,
}: {
  text: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <button
      onClick={onCopy}
      aria-label="Copy"
      className="inline-flex h-7 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
    >
      {copied ? (
        <>
          <Check className="h-3 w-3" strokeWidth={2.5} /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3 w-3" strokeWidth={1.75} /> Copy
        </>
      )}
    </button>
  );
}
