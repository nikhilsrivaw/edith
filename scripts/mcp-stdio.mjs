#!/usr/bin/env node
/**
 * Stdio bridge for the EDITH MCP server.
 *
 * Speaks MCP over stdin/stdout. Forwards each JSON-RPC request to the
 * EDITH HTTP endpoint and writes the response back to stdout.
 *
 * Used by agents that only support stdio MCP transport (Claude Desktop,
 * Claude Code). Cursor supports remote MCP directly — point it at the
 * URL instead.
 *
 * Env:
 *   EDITH_API_URL    — defaults to https://edith.dev/api/mcp
 *   EDITH_API_TOKEN  — required, the edith_<token> from the dashboard
 *
 * Usage in Claude Desktop config:
 *   "edith": {
 *     "command": "node",
 *     "args": ["/abs/path/to/scripts/mcp-stdio.mjs"],
 *     "env": {
 *       "EDITH_API_TOKEN": "edith_..."
 *     }
 *   }
 */
import { createInterface } from "node:readline";

const API_URL = process.env.EDITH_API_URL ?? "https://edith.dev/api/mcp";
const API_TOKEN = process.env.EDITH_API_TOKEN ?? "";

if (!API_TOKEN) {
  process.stderr.write(
    "[edith-mcp-stdio] EDITH_API_TOKEN env var is required.\n",
  );
  process.exit(1);
}

const rl = createInterface({ input: process.stdin });

async function forward(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return; // ignore non-JSON lines
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });
    if (res.status === 204) return; // notifications
    const text = await res.text();
    process.stdout.write(text + "\n");
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: request.id ?? null,
        error: {
          code: -32603,
          message:
            err instanceof Error ? err.message : String(err),
        },
      }) + "\n",
    );
  }
}

rl.on("line", (line) => {
  if (line.trim()) void forward(line);
});

rl.on("close", () => {
  process.exit(0);
});
