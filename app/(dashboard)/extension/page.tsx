import { ArrowRight, Check, Plug } from "lucide-react";
import Link from "next/link";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";

const CHECKS = [
  { sev: "critical", text: "Live Stripe / Razorpay / OpenAI / Anthropic / AWS / GitHub / Slack keys in the bundle" },
  { sev: "high", text: "NEXT_PUBLIC_* leaks of sensitive-named env vars (SECRET, PRIVATE, TOKEN, SERVICE_ROLE)" },
  { sev: "high", text: "Session cookies readable from JS (HttpOnly off)" },
  { sev: "high", text: "Session cookies missing Secure on HTTPS" },
  { sev: "high", text: "localStorage holding what looks like a token, secret, or JWT" },
  { sev: "high", text: "Form action posting to a different origin" },
  { sev: "high", text: "Content-Security-Policy header missing" },
  { sev: "medium", text: "CSP allows unsafe-inline / unsafe-eval" },
  { sev: "medium", text: "No clickjacking protection (X-Frame-Options or frame-ancestors)" },
  { sev: "medium", text: "HSTS missing on HTTPS" },
  { sev: "medium", text: "Mixed content (http resource on https page)" },
  { sev: "medium", text: "Cookies with weak SameSite" },
  { sev: "medium", text: "3+ runtime errors during first 4 seconds" },
  { sev: "low", text: 'target="_blank" links missing rel="noopener"' },
  { sev: "low", text: "Source maps publicly reachable in production" },
  { sev: "low", text: "X-Content-Type-Options: nosniff missing" },
];

const SEV_CLASS: Record<string, string> = {
  critical: "text-[var(--danger)] border-[var(--danger)]",
  high: "text-[var(--accent)] border-[var(--accent)]",
  medium: "text-[var(--cool-2)] border-[var(--cool-2)]",
  low: "text-[var(--text-dim)] border-[var(--border)]",
};

export default function ExtensionPage() {
  return (
    <>
      <Topbar
        title="Browser extension"
        subtitle="EDITH on every page you open — including localhost"
      />
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              The Lighthouse moment, but for AI-built apps
            </h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
              Static analysis catches the code you wrote. The extension catches
              what your code <em>does once it&apos;s running in a browser</em> — secrets
              that ended up in the bundle, cookies missing flags, CSP gone
              wrong, mixed content, localStorage holding auth tokens. Open your
              localhost. Click the EDITH icon. See what shipped.
            </p>
            <div className="mt-4 flex gap-2">
              <Link
                href="/extension/connect"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110"
              >
                <Plug className="h-3.5 w-3.5" strokeWidth={2} />
                Connect extension <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CleanCard>

          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Install (60 seconds, dev mode)
            </h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
              <li>
                Open{" "}
                <code className="rounded bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text)]">
                  chrome://extensions
                </code>{" "}
                (or{" "}
                <code className="rounded bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text)]">
                  edge://extensions
                </code>
                ).
              </li>
              <li>Toggle <strong>Developer mode</strong> in the top-right.</li>
              <li>Click <strong>Load unpacked</strong>.</li>
              <li>
                Pick the folder{" "}
                <code className="rounded bg-[var(--bg-elev-2)] px-1.5 py-0.5 font-mono text-[12px] text-[var(--text)]">
                  D:\desktop\edith\extension
                </code>
                .
              </li>
              <li>
                Pin EDITH to the toolbar (puzzle-piece icon → pin), open any
                site, click the EDITH icon.
              </li>
            </ol>
          </CleanCard>

          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              What it catches
            </h2>
            <ul className="mt-3 space-y-2">
              {CHECKS.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 inline-block rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${SEV_CLASS[c.sev]}`}
                  >
                    {c.sev}
                  </span>
                  <span className="text-[13px] text-[var(--text-dim)]">
                    {c.text}
                  </span>
                </li>
              ))}
            </ul>
          </CleanCard>

          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              How it works
            </h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                <span>
                  All checks are <strong>read-only</strong>. The extension never
                  mutates the page or fires requests against your app on its
                  own. (For active probes, use{" "}
                  <Link href="/repos" className="text-[var(--accent)] hover:brightness-110">
                    Runtime Probes
                  </Link>{" "}
                  per-repo.)
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                <span>
                  Findings live in your browser&apos;s local storage. They never
                  leave your machine unless you explicitly connect a token from{" "}
                  <Link href="/integrations/mcp" className="text-[var(--accent)] hover:brightness-110">
                    Integrations → MCP
                  </Link>
                  .
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent)]" strokeWidth={2.5} />
                <span>
                  Manifest V3, ~600 lines total, zero external dependencies.
                  Works on Chrome, Edge, Brave, and any Chromium browser
                  v111+.
                </span>
              </li>
            </ul>
          </CleanCard>
        </div>
      </main>
    </>
  );
}
