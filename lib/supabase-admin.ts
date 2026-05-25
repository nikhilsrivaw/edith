/**
 * Service-role Supabase client.
 *
 * BYPASSES Row Level Security. Use ONLY in trusted server contexts:
 *   - Webhook handlers (after signature verification)
 *   - Background workers (Inngest functions)
 *   - Admin-only API routes
 *
 * Never import this from a Client Component.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

let cached: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin() {
  if (cached) return cached;
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase service role not configured. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  cached = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
