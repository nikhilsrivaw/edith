/**
 * Auto-PR for trivial SEO fixes.
 *
 * Small allowlist of fix recipes that are safe to apply unattended:
 *
 *   – seo/html-lang-missing        → add lang="en" to <html> in app/layout.tsx
 *   – seo/robots-missing           → create app/robots.ts with sane defaults
 *   – seo/sitemap-missing          → create app/sitemap.ts walking app/ pages
 *   – seo/llms-txt-missing         → create public/llms.txt with stub
 *   – seo/missing-root-metadata    → add `export const metadata` to layout.tsx
 *
 * Each recipe is a pure function (sourceText → patchedText) so it can be
 * unit-tested. The engine opens one PR per scan with all applicable fixes.
 *
 * Designed to be cautious: if a recipe can't find its anchor or the file
 * looks unexpected, it skips that fix rather than guessing wrong.
 */
import "server-only";
import type { Octokit } from "@octokit/rest";

export type FixRecipeId =
  | "seo/html-lang-missing"
  | "seo/robots-missing"
  | "seo/sitemap-missing"
  | "seo/llms-txt-missing"
  | "seo/missing-root-metadata";

export type SeoFix = {
  checkId: FixRecipeId;
  /** Optional: hint at the file location. The engine still verifies. */
  filePath?: string;
};

export type FilePatch = {
  path: string;
  /** New full contents. */
  content: string;
  /** Display string for the PR body. */
  summary: string;
  recipeId: FixRecipeId;
};

const ROBOTS_TS = `import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard/"] },
    ],
    sitemap: \`\${base}/sitemap.xml\`,
    host: base,
  };
}
`;

const SITEMAP_TS = `import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
  const now = new Date();
  // Add your routes here. EDITH scaffold — refine per page priority/changefreq.
  return [
    { url: \`\${base}/\`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
  ];
}
`;

const LLMS_TXT = `# {{BRAND}}

> One-line description of what this app does and who it's for.

## Docs
- [Getting started]({{BASE}}/docs/getting-started)
- [API reference]({{BASE}}/docs/api)

## About
- [What is {{BRAND}}?]({{BASE}}/about)
- [Pricing]({{BASE}}/pricing)
`;

const ROOT_METADATA_BLOCK = `import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com",
  ),
  title: {
    default: "{{BRAND}}",
    template: "%s · {{BRAND}}",
  },
  description: "{{BRAND}} — replace this with a 150-160 char description.",
  openGraph: {
    title: "{{BRAND}}",
    description: "{{BRAND}} — replace this with a 150-160 char description.",
    images: ["/opengraph-image.png"],
  },
  twitter: { card: "summary_large_image" },
};

`;

/* ================================================================
 * Per-recipe patcher
 * ============================================================== */

function patchHtmlLang(content: string): string | null {
  if (!/<html\b/.test(content)) return null;
  if (/<html[^>]*\blang\s*=/.test(content)) return null;
  return content.replace(/<html\b/, '<html lang="en"');
}

function ensureMetadataExport(
  content: string,
  brand: string,
): string | null {
  if (/export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata)\b/.test(content))
    return null;
  // Place block right after the last import statement (or at top).
  const importBlockRe = /^(?:import [\s\S]*?from .*?;\s*\n)+/m;
  const m = importBlockRe.exec(content);
  const block = ROOT_METADATA_BLOCK.replace(/\{\{BRAND\}\}/g, brand);
  if (m) {
    return content.slice(0, m.index + m[0].length) + block + content.slice(m.index + m[0].length);
  }
  return block + content;
}

/* ================================================================
 * Repo file fetch (uses installation Octokit)
 * ============================================================== */

async function readFile(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const res = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref,
    });
    const data = res.data;
    if (Array.isArray(data) || data.type !== "file") return null;
    if (!("content" in data) || !data.content) return null;
    const decoded = Buffer.from(data.content, "base64").toString("utf8");
    return { content: decoded, sha: data.sha };
  } catch {
    return null;
  }
}

async function fileExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<boolean> {
  const r = await readFile(octokit, owner, repo, ref, path);
  return r !== null;
}

/* ================================================================
 * Engine
 * ============================================================== */

export async function buildSeoAutoPrPatches(args: {
  octokit: Octokit;
  owner: string;
  repo: string;
  baseBranch: string;
  brand: string;
  fixes: SeoFix[];
}): Promise<FilePatch[]> {
  const patches: FilePatch[] = [];
  const { octokit, owner, repo, baseBranch, brand, fixes } = args;
  const recipes = new Set(fixes.map((f) => f.checkId));

  // --- html-lang ---
  if (recipes.has("seo/html-lang-missing")) {
    const layoutPaths = ["app/layout.tsx", "src/app/layout.tsx"];
    for (const p of layoutPaths) {
      const file = await readFile(octokit, owner, repo, baseBranch, p);
      if (!file) continue;
      const next = patchHtmlLang(file.content);
      if (!next) continue;
      patches.push({
        path: p,
        content: next,
        summary: 'Added `lang="en"` to `<html>` in ' + p,
        recipeId: "seo/html-lang-missing",
      });
      break;
    }
  }

  // --- robots.ts ---
  if (recipes.has("seo/robots-missing")) {
    const candidates = ["app/robots.ts", "src/app/robots.ts"];
    const exists = await Promise.all(
      candidates.map((p) => fileExists(octokit, owner, repo, baseBranch, p)),
    );
    if (!exists.some(Boolean)) {
      // Pick path based on whether the repo uses src/.
      const usesSrc = await fileExists(
        octokit,
        owner,
        repo,
        baseBranch,
        "src/app/layout.tsx",
      );
      patches.push({
        path: usesSrc ? "src/app/robots.ts" : "app/robots.ts",
        content: ROBOTS_TS,
        summary: "Created `app/robots.ts` with sane defaults",
        recipeId: "seo/robots-missing",
      });
    }
  }

  // --- sitemap.ts ---
  if (recipes.has("seo/sitemap-missing")) {
    const candidates = ["app/sitemap.ts", "src/app/sitemap.ts"];
    const exists = await Promise.all(
      candidates.map((p) => fileExists(octokit, owner, repo, baseBranch, p)),
    );
    if (!exists.some(Boolean)) {
      const usesSrc = await fileExists(
        octokit,
        owner,
        repo,
        baseBranch,
        "src/app/layout.tsx",
      );
      patches.push({
        path: usesSrc ? "src/app/sitemap.ts" : "app/sitemap.ts",
        content: SITEMAP_TS,
        summary: "Created `app/sitemap.ts` scaffold",
        recipeId: "seo/sitemap-missing",
      });
    }
  }

  // --- llms.txt ---
  if (recipes.has("seo/llms-txt-missing")) {
    const has = await fileExists(octokit, owner, repo, baseBranch, "public/llms.txt");
    if (!has) {
      const content = LLMS_TXT.replace(/\{\{BRAND\}\}/g, brand).replace(
        /\{\{BASE\}\}/g,
        "https://example.com",
      );
      patches.push({
        path: "public/llms.txt",
        content,
        summary: "Created `public/llms.txt` (AI-crawler discovery)",
        recipeId: "seo/llms-txt-missing",
      });
    }
  }

  // --- metadata export ---
  if (recipes.has("seo/missing-root-metadata")) {
    const layoutPaths = ["app/layout.tsx", "src/app/layout.tsx"];
    for (const p of layoutPaths) {
      const file = await readFile(octokit, owner, repo, baseBranch, p);
      if (!file) continue;
      const next = ensureMetadataExport(file.content, brand);
      if (!next) continue;
      patches.push({
        path: p,
        content: next,
        summary: "Added root `metadata` export to " + p,
        recipeId: "seo/missing-root-metadata",
      });
      break;
    }
  }

  return patches;
}

/* ================================================================
 * Branch + PR creator
 * ============================================================== */

export async function openSeoAutoPr(args: {
  octokit: Octokit;
  owner: string;
  repo: string;
  baseBranch: string;
  brand: string;
  patches: FilePatch[];
}): Promise<{ url: string; number: number } | null> {
  const { octokit, owner, repo, baseBranch, patches } = args;
  if (patches.length === 0) return null;

  // 1. Resolve base SHA.
  const baseRef = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });
  const baseSha = baseRef.data.object.sha;

  // 2. Branch name.
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
  const branchName = `edith/seo-autofix-${stamp}`;

  // 3. Create the branch.
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  // 4. Commit each patch on the new branch via the contents API.
  for (const patch of patches) {
    // If file already exists on the branch, get its sha (for update).
    let existingSha: string | undefined;
    try {
      const res = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: patch.path,
        ref: branchName,
      });
      if (!Array.isArray(res.data) && res.data.type === "file") {
        existingSha = res.data.sha;
      }
    } catch {
      /* not present, create new */
    }
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: patch.path,
      branch: branchName,
      message: `seo: ${patch.summary}`,
      content: Buffer.from(patch.content, "utf8").toString("base64"),
      sha: existingSha,
    });
  }

  // 5. Open the PR.
  const bullets = patches.map((p) => `- ${p.summary}`).join("\n");
  const body = `EDITH auto-fixed ${patches.length} SEO issue${patches.length === 1 ? "" : "s"}:

${bullets}

Each fix is a small, safe template. Review the diffs and tweak the brand-specific copy (description, OG image path, sitemap routes) before merging.

<sub>Generated by EDITH SEO · auto-PR</sub>`;

  const pr = await octokit.rest.pulls.create({
    owner,
    repo,
    head: branchName,
    base: baseBranch,
    title: `seo: auto-fix ${patches.length} SEO issue${patches.length === 1 ? "" : "s"}`,
    body,
  });

  return { url: pr.data.html_url, number: pr.data.number };
}

export const AUTO_FIXABLE_RECIPES: ReadonlyArray<FixRecipeId> = [
  "seo/html-lang-missing",
  "seo/robots-missing",
  "seo/sitemap-missing",
  "seo/llms-txt-missing",
  "seo/missing-root-metadata",
];

export function isAutoFixable(checkId: string): checkId is FixRecipeId {
  return (AUTO_FIXABLE_RECIPES as readonly string[]).includes(checkId);
}
