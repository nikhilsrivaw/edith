/**
 * Server-side Supabase client.
 *
 * Use in Server Components, Server Actions, Route Handlers.
 * Reads + writes the session cookie via next/headers.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { env } from "./env";

export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — setting cookies is not allowed
          // here. The middleware will handle the refresh on the next request.
        }
      },
    },
  });
}
