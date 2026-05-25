/**
 * Inngest's serve endpoint. Inngest's cloud (or local dev server) hits this
 * to discover functions + invoke them. Manifest V3 of MCP it isn't, but
 * the spec is similar — single endpoint, JSON-RPC-ish dispatch.
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
