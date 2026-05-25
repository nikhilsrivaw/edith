/**
 * MCP bearer-token authentication.
 *
 * Tokens are stored as SHA-256 hashes in api_tokens. The raw token is shown
 * once at creation and never persisted in plaintext.
 *
 * Token format: edith_<64 hex chars>
 */
import "server-only";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "../supabase-admin";

const PREFIX = "edith_";

export type AuthedToken = {
  tokenId: string;
  userId: string;
  orgId: string;
  scopes: string[];
};

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const bytes = crypto.randomBytes(32).toString("hex");
  const raw = `${PREFIX}${bytes}`;
  return {
    raw,
    hash: hashToken(raw),
    prefix: `${PREFIX}${bytes.slice(-4)}`,
  };
}

export async function authenticateBearer(
  authHeader: string | null,
): Promise<AuthedToken | null> {
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!m) return null;
  const raw = m[1];
  if (!raw.startsWith(PREFIX)) return null;
  const hash = hashToken(raw);

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("api_tokens")
    .select("id, user_id, org_id, scopes, revoked_at, expires_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (error || !data) return null;
  type Row = {
    id: string;
    user_id: string;
    org_id: string;
    scopes: string[] | null;
    revoked_at: string | null;
    expires_at: string | null;
  };
  const row = data as Row;
  if (row.revoked_at) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

  // Update last_used_at (best-effort, don't block).
  admin
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => undefined, () => undefined);

  return {
    tokenId: row.id,
    userId: row.user_id,
    orgId: row.org_id,
    scopes: row.scopes ?? ["scan:read"],
  };
}
