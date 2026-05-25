/**
 * POST /api/seo/auto-fix
 *
 * Takes a list of EDITH issue ids, filters down to those with auto-fix
 * recipes, opens one PR with all applicable patches. Returns the PR URL.
 *
 * Body: { repoId: string, issueIds: string[] }
 *
 * Auth: signed-in user must be a member of the repo's org.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  getOctokitForInstallation,
  hasGithubApp,
} from "@/lib/github-app";
import {
  AUTO_FIXABLE_RECIPES,
  buildSeoAutoPrPatches,
  isAutoFixable,
  openSeoAutoPr,
  type FixRecipeId,
  type SeoFix,
} from "@/lib/seo/auto-pr";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  repoId?: string;
  issueIds?: string[];
};

export async function POST(req: NextRequest) {
  if (!hasGithubApp()) {
    return NextResponse.json(
      { ok: false, error: "GitHub App not configured" },
      { status: 500 },
    );
  }
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
  if (!body.repoId || !body.issueIds?.length) {
    return NextResponse.json(
      { ok: false, error: "repoId and issueIds required" },
      { status: 400 },
    );
  }

  const admin = getSupabaseAdmin();

  // Auth: caller must be in the repo's org.
  const { data: repoRow } = await admin
    .from("repositories")
    .select("id, name, owner, org_id, default_branch")
    .eq("id", body.repoId)
    .maybeSingle();
  type R = {
    id: string;
    name: string;
    owner: string;
    org_id: string;
    default_branch: string | null;
  };
  const repo = repoRow as R | null;
  if (!repo) {
    return NextResponse.json(
      { ok: false, error: "repo not found" },
      { status: 404 },
    );
  }
  const { data: member } = await admin
    .from("org_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", repo.org_id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  // Resolve installation_id from the org.
  const { data: org } = await admin
    .from("organizations")
    .select("github_installation_id")
    .eq("id", repo.org_id)
    .maybeSingle();
  type O = { github_installation_id: number | null } | null;
  const installationId = (org as O)?.github_installation_id;
  if (!installationId) {
    return NextResponse.json(
      {
        ok: false,
        error: "EDITH GitHub App not installed on this org — install it first at /dashboard",
      },
      { status: 400 },
    );
  }

  // Fetch the selected issues; filter to auto-fixable.
  const { data: issues } = await admin
    .from("issues")
    .select("id, check_id, file_path")
    .in("id", body.issueIds)
    .eq("repo_id", repo.id);
  type I = { id: string; check_id: string; file_path: string };
  const list = (issues as I[] | null) ?? [];
  const fixable: SeoFix[] = list
    .filter((i) => isAutoFixable(i.check_id))
    .map((i) => ({
      checkId: i.check_id as FixRecipeId,
      filePath: i.file_path,
    }));

  if (fixable.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `No auto-fixable issues in selection. Supported: ${AUTO_FIXABLE_RECIPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Open the PR.
  const octokit = await getOctokitForInstallation(installationId);
  const baseBranch = repo.default_branch ?? "main";

  const patches = await buildSeoAutoPrPatches({
    octokit,
    owner: repo.owner,
    repo: repo.name,
    baseBranch,
    brand: repo.name,
    fixes: fixable,
  });
  if (patches.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Nothing to patch — fixes may already be applied on the base branch.",
      },
      { status: 200 },
    );
  }

  const pr = await openSeoAutoPr({
    octokit,
    owner: repo.owner,
    repo: repo.name,
    baseBranch,
    brand: repo.name,
    patches,
  });
  if (!pr) {
    return NextResponse.json({ ok: false, error: "PR creation failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pr,
    appliedRecipes: patches.map((p) => p.recipeId),
  });
}
