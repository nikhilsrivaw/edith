/**
 * POST /api/plan-check
 * Body: { plan: string, owner?: string, repo?: string }
 *
 * The pre-code product. User pastes a plan; EDITH returns a ranked list of
 * pitfalls + a one-line prompt hint per pitfall. Repo context is optional —
 * if provided, we include a brief repo summary (stack, presence of webhooks
 * etc.) so the pitfalls cite the user's actual situation.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { validatePlan } from "@/lib/plan-validator";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { plan?: string; owner?: string; repo?: string };

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.plan || body.plan.trim().length < 20) {
    return NextResponse.json(
      { ok: false, error: "plan must be at least 20 characters" },
      { status: 400 },
    );
  }

  // Repo summary is optional — keep it short for the prompt.
  let repoSummary: string | undefined;
  if (body.owner && body.repo) {
    repoSummary = `Repo: ${body.owner}/${body.repo}. Stack: inferred Next.js + Supabase + likely PayU.`;
  }

  const result = await validatePlan({
    plan: body.plan,
    repoSummary,
  });

  return NextResponse.json({ ok: true, ...result });
}
