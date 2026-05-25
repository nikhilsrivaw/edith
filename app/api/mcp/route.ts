/**
 * POST /api/mcp
 *
 * EDITH's MCP server endpoint. Speaks JSON-RPC 2.0 over HTTP — the simplest
 * MCP transport. Compatible with Cursor (remote MCP), Claude Desktop (via
 * stdio shim), Windsurf, and any other agent that supports MCP.
 *
 * Auth: Authorization: Bearer edith_<token>
 * Create tokens at /settings (or via POST /api/tokens).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  RPC_ERRORS,
  PROTOCOL_VERSION,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "@/lib/mcp/protocol";
import { authenticateBearer, type AuthedToken } from "@/lib/mcp/auth";
import { TOOL_HANDLERS, TOOL_SCHEMAS } from "@/lib/mcp/tools";
import { rateLimit, rateLimited, clientIp } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const RPM_PER_IP = 120;
const RPM_PER_TOKEN = 240;

async function logMcpCall(
  auth: AuthedToken,
  tool: string,
  args: Record<string, unknown> | undefined,
  durationMs: number,
  status: "ok" | "error",
  errorMessage?: string,
  resultSize?: number,
) {
  try {
    const admin = getSupabaseAdmin();
    await admin.from("mcp_calls").insert({
      token_id: auth.tokenId,
      org_id: auth.orgId,
      user_id: auth.userId,
      tool,
      arguments: args ?? null,
      result_size: resultSize ?? null,
      duration_ms: durationMs,
      status,
      error_message: errorMessage ?? null,
    });
  } catch {
    /* logging is best-effort */
  }
}

export const runtime = "nodejs";
export const maxDuration = 60;

function rpcError(
  id: JsonRpcRequest["id"],
  error: { code: number; message: string },
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { ...error, ...(data ? { data } : {}) },
  };
}

function rpcOk(id: JsonRpcRequest["id"], result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export async function POST(req: NextRequest) {
  // Per-IP rate limit (before auth — protects token-validation path).
  const ipRl = rateLimit(`mcp:ip:${clientIp(req)}`, RPM_PER_IP);
  if (!ipRl.ok) return rateLimited(ipRl);

  // Auth
  const auth = await authenticateBearer(req.headers.get("authorization"));
  if (!auth) {
    return new NextResponse(
      JSON.stringify(rpcError(null, RPC_ERRORS.UNAUTHORISED)),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Per-token rate limit (one noisy client can't exhaust the IP pool).
  const tokenRl = rateLimit(`mcp:tok:${auth.tokenId}`, RPM_PER_TOKEN);
  if (!tokenRl.ok) return rateLimited(tokenRl);

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return NextResponse.json(rpcError(null, RPC_ERRORS.PARSE_ERROR));
  }

  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return NextResponse.json(rpcError(body.id ?? null, RPC_ERRORS.INVALID_REQUEST));
  }

  try {
    switch (body.method) {
      case "initialize": {
        return NextResponse.json(
          rpcOk(body.id, {
            protocolVersion: PROTOCOL_VERSION,
            serverInfo: { name: "edith", version: "1.0.0" },
            capabilities: { tools: {} },
            instructions:
              "EDITH audits AI-built Next.js apps. Use edith_list_repos first to see what's connected; then edith_get_issues to fetch issues for a repo; then edith_get_fix_prompt for any issue_id to get a paste-ready fix prompt for your agent.",
          }),
        );
      }
      case "notifications/initialized":
      case "initialized": {
        // No-op notification — return empty success.
        return new NextResponse(null, { status: 204 });
      }
      case "tools/list": {
        return NextResponse.json(
          rpcOk(body.id, { tools: TOOL_SCHEMAS }),
        );
      }
      case "tools/call": {
        const params = (body.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        if (!params.name) {
          return NextResponse.json(
            rpcError(body.id, RPC_ERRORS.INVALID_PARAMS, "tool name required"),
          );
        }
        const handler = TOOL_HANDLERS[params.name];
        if (!handler) {
          await logMcpCall(
            auth,
            params.name,
            params.arguments,
            0,
            "error",
            "tool unknown",
          );
          return NextResponse.json(
            rpcError(body.id, RPC_ERRORS.METHOD_NOT_FOUND, `tool '${params.name}' unknown`),
          );
        }
        const t0 = Date.now();
        try {
          const result = await handler(params.arguments ?? {}, auth);
          const dur = Date.now() - t0;
          const size = JSON.stringify(result).length;
          await logMcpCall(
            auth,
            params.name,
            params.arguments,
            dur,
            result.isError ? "error" : "ok",
            undefined,
            size,
          );
          return NextResponse.json(rpcOk(body.id, result));
        } catch (e) {
          const dur = Date.now() - t0;
          const msg = e instanceof Error ? e.message : String(e);
          await logMcpCall(auth, params.name, params.arguments, dur, "error", msg);
          throw e;
        }
      }
      case "resources/list":
      case "prompts/list":
        // Declared no capabilities for these — return empty.
        return NextResponse.json(rpcOk(body.id, { resources: [], prompts: [] }));
      case "ping":
        return NextResponse.json(rpcOk(body.id, {}));
      default:
        return NextResponse.json(
          rpcError(body.id, RPC_ERRORS.METHOD_NOT_FOUND, `method '${body.method}' not supported`),
        );
    }
  } catch (err) {
    return NextResponse.json(
      rpcError(body.id, RPC_ERRORS.INTERNAL_ERROR, err instanceof Error ? err.message : String(err)),
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: "edith-mcp",
    version: "1.0.0",
    protocol: PROTOCOL_VERSION,
    transport: "http-jsonrpc",
    tools: TOOL_SCHEMAS.map((t) => t.name),
    hint: "POST JSON-RPC 2.0 to this URL with Authorization: Bearer edith_<token>",
  });
}
