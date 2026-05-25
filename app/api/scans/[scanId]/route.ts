/**
 * GET /api/scans/[scanId]
 * Returns a scan with its issues. The scan detail page polls this.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { dbGetScan } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await ctx.params;

  // Require a session (RLS will scope this anyway when we wire it through anon client).
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const scan = await dbGetScan(scanId);
  if (!scan) return new NextResponse("not found", { status: 404 });
  return NextResponse.json({ scan });
}
