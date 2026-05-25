/**
 * POST /api/ai-citations/check
 *
 * Triggers a fresh LLM citation check for the given repo. Asks Claude
 * (with web_search where available) about the brand, stores the result
 * in ai_citations.
 *
 * Rate limit: max 1 check per (repo, day) — re-checks before that
 * window return the existing row. Cron job will own scheduled refresh.
 *
 * Body: { repoId: string, brand?: string, ownDomain?: string, knownCompetitors?: string[] }
 *
 * If brand / ownDomain omitted, derived from the repo name + live_url.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { runCitationCheck } from "@/lib/ai-citations/checker";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  repoId?: string;
  brand?: string;
  ownDomain?: string;
  knownCompetitors?: string[];
};

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.repoId) {
    return NextResponse.json(
      { ok: false, error: "repoId required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  // Auth: caller must be a member of the repo's org.
  const { data: repo } = await admin
    .from("repositories")
    .select("id, name, owner, org_id")
    .eq("id", body.repoId)
    .maybeSingle();
  type R = { id: string; name: string; owner: string; org_id: string } | null;
  const repoRow = repo as R;
  if (!repoRow) {
    return NextResponse.json(
      { ok: false, error: "repo not found" },
      { status: 404 },
    );
  }
  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", repoRow.org_id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Derive brand + domain if not supplied
  const brand = body.brand?.trim() || repoRow.name;
  // ownDomain best-guess: <owner>.com if we don't know better. The user
  // can override per-request.
  const ownDomain = body.ownDomain?.trim() || `${repoRow.owner.toLowerCase()}.com`;

  // Rate limit: skip if a row exists for this brand in the last 23 hours.
  const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("ai_citations")
    .select(
      "id, queried_at, model, response_text, cited, own_citations, competitor_citations, competitors_mentioned, sentiment",
    )
    .eq("org_id", repoRow.org_id)
    .eq("brand", brand)
    .gte("queried_at", since)
    .order("queried_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recent) {
    return NextResponse.json({
      ok: true,
      cached: true,
      citation: recent,
    });
  }

  const result = await runCitationCheck({
    brand,
    ownDomain,
    knownCompetitors: body.knownCompetitors ?? [],
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.reason },
      { status: 502 },
    );
  }

  const insertRow = {
    org_id: repoRow.org_id,
    repo_id: repoRow.id,
    brand,
    model: result.model,
    prompt: result.prompt,
    response_text: result.responseText,
    cited: result.cited,
    own_citations: result.ownCitations,
    competitor_citations: result.competitorCitations,
    competitors_mentioned: result.competitorsMentioned,
    sentiment: result.sentiment,
  };
  // Supabase JS without a typed Database schema infers `never` for unknown
  // tables — cast through unknown to bypass while preserving runtime payload.
  const { data: inserted } = await admin
    .from("ai_citations")
    .insert(insertRow as unknown as never)
    .select()
    .maybeSingle();

  return NextResponse.json({ ok: true, cached: false, citation: inserted });
}
