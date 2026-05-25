/**
 * Browser-side Supabase client.
 *
 * Use inside Client Components for the sign-in flow and any direct user
 * fetches. Reads from public env vars only — never the service-role key.
 */
"use client";
import { createBrowserClient } from "@supabase/ssr";

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
