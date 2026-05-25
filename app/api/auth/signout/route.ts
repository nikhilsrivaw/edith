/**
 * Sign-out endpoint. Clears the Supabase session cookie and redirects to /signin.
 *
 * Linked from the dashboard re-auth banner so users can drop the old token
 * and grant the expanded repo scope.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

async function handle(req: NextRequest) {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/signin", req.url));
}

export const GET = handle;
export const POST = handle;
