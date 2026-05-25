"use client";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CleanCard } from "@/components/edith/clean-card";
import { Topbar } from "@/components/edith/topbar";

type Token = {
  id: string;
  name: string;
  token_prefix: string;
  scopes?: string[];
  created_at: string;
  last_used_at: string | null;
};

export default function McpIntegrationPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [name, setName] = useState("Cursor on MacBook");
  const [creating, setCreating] = useState(false);
  const [newRaw, setNewRaw] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/tokens");
    if (res.ok) {
      const j = (await res.json()) as { tokens: Token[] };
      setTokens(j.tokens);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    setCreating(true);
    setNewRaw(null);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        token?: { raw: string };
        error?: string;
      };
      if (j.ok && j.token?.raw) {
        setNewRaw(j.token.raw);
        await load();
      }
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    await load();
  };

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://edith.expert";

  return (
    <>
      <Topbar
        title="MCP integration"
        subtitle="Connect Cursor, Claude Code, or any MCP-compatible agent to your EDITH workspace"
      />
      <main className="flex-1 px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-5">
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              What this is
            </h2>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
              The EDITH MCP server gives your coding agent direct access to
              your EDITH workspace — repos, scans, issues, fix prompts,
              regression tests, plan validation. Instead of you copying
              prompts from this dashboard, the agent fetches them itself.
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--text-dim)]">
              Works with: Cursor (remote MCP), Claude Desktop / Claude Code
              (via the stdio shim below), Windsurf, and any agent that
              speaks MCP JSON-RPC.
            </p>
          </CleanCard>

          {/* Step 1: create a token */}
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Step 1 — Create an API token
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
              One token per device or environment. Revoke any time.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 flex-1 rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 text-[13px] text-[var(--text)] focus:border-[var(--border-hot)] focus:outline-none"
                placeholder="Token name (e.g. 'Cursor on MacBook')"
              />
              <button
                onClick={create}
                disabled={creating}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[var(--accent)] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] transition-all hover:brightness-110 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" strokeWidth={2.5} /> Create
              </button>
            </div>

            {newRaw && (
              <div className="mt-4 rounded-md border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-3">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
                  Your new token (copy it now — you won&apos;t see it again)
                </div>
                <div className="mt-2 flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 font-mono text-[12px] text-[var(--text)]">
                  <code className="flex-1 truncate">{newRaw}</code>
                  <CopyBtn text={newRaw} />
                </div>
              </div>
            )}

            {tokens.length > 0 && (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {tokens.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-[var(--text)]">
                        {t.name}
                      </div>
                      <div className="mt-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                        {t.token_prefix} · created{" "}
                        {t.created_at.slice(0, 10)} · last used{" "}
                        {t.last_used_at ? t.last_used_at.slice(0, 10) : "never"}
                      </div>
                    </div>
                    <button
                      onClick={() => revoke(t.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                      aria-label="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CleanCard>

          {/* Step 2: Cursor remote MCP */}
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Step 2 — Cursor (remote MCP)
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
              Cursor &gt; Settings &gt; MCP &gt; Add new server. Paste this
              config:
            </p>
            <ConfigBlock
              text={JSON.stringify(
                {
                  mcpServers: {
                    edith: {
                      url: `${baseUrl}/api/mcp`,
                      headers: {
                        Authorization: "Bearer edith_<paste-your-token-here>",
                      },
                    },
                  },
                },
                null,
                2,
              )}
            />
          </CleanCard>

          {/* Step 3: Claude Desktop / Code stdio */}
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Step 3 — Claude Desktop / Claude Code (stdio shim)
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
              Claude Desktop config lives at:
            </p>
            <ul className="mt-1 list-disc pl-5 font-mono text-[11px] text-[var(--text-dim)]">
              <li>macOS: ~/Library/Application Support/Claude/claude_desktop_config.json</li>
              <li>Windows: %APPDATA%\Claude\claude_desktop_config.json</li>
            </ul>
            <p className="mt-2 text-[12.5px] text-[var(--text-dim)]">
              Add this to <code className="font-mono text-[11px]">mcpServers</code>:
            </p>
            <ConfigBlock
              text={JSON.stringify(
                {
                  mcpServers: {
                    edith: {
                      command: "npx",
                      args: ["-y", "@edith-dev/mcp-stdio"],
                      env: {
                        EDITH_API_URL: `${baseUrl}/api/mcp`,
                        EDITH_API_TOKEN: "edith_<paste-your-token-here>",
                      },
                    },
                  },
                },
                null,
                2,
              )}
            />
            <p className="mt-2 text-[11px] text-[var(--text-muted)]">
              <em>
                Note: the stdio shim package (@edith-dev/mcp-stdio) is not yet
                published. For local testing, use the script at
                scripts/mcp-stdio.mjs (instructions below).
              </em>
            </p>
          </CleanCard>

          {/* Step 4: Test */}
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              Step 4 — Test the connection
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-dim)]">
              Curl your MCP endpoint with your token:
            </p>
            <ConfigBlock
              text={`curl -X POST "${baseUrl}/api/mcp" \\
  -H "Authorization: Bearer edith_<your-token>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
            />
            <p className="mt-2 text-[12.5px] text-[var(--text-dim)]">
              You should get back a JSON-RPC response with 6 tool definitions.
            </p>
          </CleanCard>

          {/* What the agent can do */}
          <CleanCard className="p-5">
            <h2 className="text-[15px] font-semibold text-[var(--text)]">
              What your agent can do once connected
            </h2>
            <ul className="mt-3 space-y-2 text-[13.5px] text-[var(--text-dim)]">
              <li>
                <strong className="text-[var(--text)]">edith_list_repos</strong> — see
                all your connected repos with current EDITH scores.
              </li>
              <li>
                <strong className="text-[var(--text)]">edith_get_issues</strong> — fetch
                open issues for a repo, optionally filtered by severity.
              </li>
              <li>
                <strong className="text-[var(--text)]">edith_get_fix_prompt</strong> —
                Claude-written, paste-ready fix prompt for any specific issue.
              </li>
              <li>
                <strong className="text-[var(--text)]">edith_get_regression_test</strong> —
                a Vitest test that proves the bug exists today and will catch its return.
              </li>
              <li>
                <strong className="text-[var(--text)]">edith_plan_check</strong> —
                pre-code product. Submit a plan, get pitfalls + a reinforced prompt.
              </li>
              <li>
                <strong className="text-[var(--text)]">edith_get_score_trend</strong> —
                EDITH score over the last N scans.
              </li>
            </ul>
          </CleanCard>
        </div>
      </main>
    </>
  );
}

function ConfigBlock({ text }: { text: string }) {
  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--bg)]">
      <div className="flex items-center justify-end border-b border-[var(--border)] px-2 py-1">
        <CopyBtn text={text} />
      </div>
      <pre className="overflow-auto p-3 font-mono text-[11.5px] leading-[1.6] text-[var(--text)]">
        {text}
      </pre>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* noop */
        }
      }}
      className="inline-flex h-6 items-center gap-1 rounded px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-dim)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
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
