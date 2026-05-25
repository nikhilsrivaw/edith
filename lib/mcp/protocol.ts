/**
 * MCP (Model Context Protocol) JSON-RPC types.
 *
 * Spec: https://spec.modelcontextprotocol.io/
 *
 * We implement the HTTP transport — single POST endpoint, JSON-RPC 2.0
 * envelope, no SSE (yet). All EDITH operations complete in <30s so we
 * don't need streaming.
 */

export const PROTOCOL_VERSION = "2024-11-05";

export type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: string | number | null;
  method: string;
  params?: unknown;
};

export type JsonRpcResponse<T = unknown> = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

export const RPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: "Parse error" },
  INVALID_REQUEST: { code: -32600, message: "Invalid Request" },
  METHOD_NOT_FOUND: { code: -32601, message: "Method not found" },
  INVALID_PARAMS: { code: -32602, message: "Invalid params" },
  INTERNAL_ERROR: { code: -32603, message: "Internal error" },
  UNAUTHORISED: { code: -32001, message: "Unauthorised" },
};

/* MCP tool shape */

export type ToolSchema = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export type ToolContent =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType?: string; text?: string } };

export type ToolCallResult = {
  content: ToolContent[];
  isError?: boolean;
};
