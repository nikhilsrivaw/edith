/**
 * POST /api/auto-docs
 * Body: { owner: string, repo: string, ref?: string }
 *
 * Discovers undocumented exported functions in the repo and returns
 * Claude-written JSDoc suggestions for each. The PR handler can use these
 * to post review suggestions directly.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { fetchScannableFiles } from "@/lib/scanner/github-tree";
import { createRepoProject } from "@/lib/scanner/project";
import { findUndocumentedExports, generateDocstrings } from "@/lib/auto-docs";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { owner?: string; repo?: string; ref?: string };

export async function POST(req: NextRequest) {
  const supabase = await getSupabaseServer();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.provider_token) {
    return NextResponse.json({ ok: false, error: "unauthorised" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.owner || !body.repo) {
    return NextResponse.json(
      { ok: false, error: "owner+repo required" },
      { status: 400 },
    );
  }
  const branch = body.ref ?? "HEAD";
  const { files } = await fetchScannableFiles(
    session.provider_token,
    body.owner,
    body.repo,
    branch,
  );
  const project = createRepoProject(files);
  const suggestions = await findUndocumentedExports(project);
  const withDocs = await generateDocstrings(project, suggestions);
  return NextResponse.json({
    ok: true,
    count: withDocs.length,
    suggestions: withDocs,
  });
}
