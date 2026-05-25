/**
 * GET /api/fix-prompts/[issueId]?tool=cursor
 * Returns the fix prompt for an issue, generating via Claude on first call.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOrGenerateFixPrompt, type AiTool } from "@/lib/claude";

export const runtime = "nodejs";
export const maxDuration = 30;

const TOOLS: AiTool[] = ["cursor", "claude_code", "windsurf", "v0"];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ issueId: string }> },
) {
  const { issueId } = await ctx.params;
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("unauthorised", { status: 401 });

  const toolParam = req.nextUrl.searchParams.get("tool") ?? "cursor";
  const tool = (TOOLS.includes(toolParam as AiTool)
    ? toolParam
    : "cursor") as AiTool;

  const admin = getSupabaseAdmin();
  const { data: issue, error } = await admin
    .from("issues")
    .select(
      "id,title,description,severity,dimension,file_path,line_number,code_snippet",
    )
    .eq("id", issueId)
    .single();
  if (error || !issue) {
    return NextResponse.json(
      { ok: false, error: "issue-not-found" },
      { status: 404 },
    );
  }

  type IssueRow = {
    id: string;
    title: string;
    description: string | null;
    severity: string;
    dimension: string;
    file_path: string;
    line_number: number | null;
    code_snippet: string | null;
  };
  const i = issue as IssueRow;

  const result = await getOrGenerateFixPrompt({
    issueId: i.id,
    tool,
    title: i.title,
    description: i.description ?? "",
    filePath: i.file_path,
    lineNumber: i.line_number ?? undefined,
    codeSnippet: i.code_snippet ?? undefined,
    severity: i.severity,
    dimension: i.dimension,
  });

  return NextResponse.json({
    ok: true,
    issueId: i.id,
    tool,
    prompt: result.prompt,
    cached: result.cached,
    generated: result.generated,
  });
}
