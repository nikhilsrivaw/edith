/**
 * Fetch the full file tree of a repo at a commit, then pull all scannable
 * files via the GitHub Blobs API in parallel. Used by the v1 (AST) scanner.
 */
import "server-only";

type TreeEntry = {
  path: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
};

const FETCH_CONCURRENCY = 8;
const MAX_FILE_BYTES = 200_000;
const MAX_FILES = 400;

const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "edith-scanner",
});

export type FetchedFile = { path: string; content: string };

export async function fetchScannableFiles(
  token: string,
  owner: string,
  repo: string,
  ref: string,
): Promise<{
  files: FetchedFile[];
  truncated: boolean;
  totalFilesInRepo: number;
}> {
  const tree = await fetchTree(token, owner, repo, ref);
  const blobs = tree.tree.filter((e) => e.type === "blob");
  const scannable = blobs
    .filter((e) => isScannablePath(e.path))
    .filter((e) => (e.size ?? 0) < MAX_FILE_BYTES);
  const targets = scannable.slice(0, MAX_FILES);

  const out: FetchedFile[] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: FETCH_CONCURRENCY }, async () => {
      while (cursor < targets.length) {
        const idx = cursor++;
        const entry = targets[idx];
        try {
          const content = await fetchBlob(token, owner, repo, entry.sha);
          out.push({ path: entry.path, content });
        } catch {
          // per-file errors are silent — we keep going
        }
      }
    }),
  );

  return {
    files: out,
    truncated: scannable.length > MAX_FILES || tree.truncated,
    totalFilesInRepo: blobs.length,
  };
}

async function fetchTree(
  token: string,
  owner: string,
  repo: string,
  ref: string,
): Promise<{ tree: TreeEntry[]; truncated: boolean }> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
    { headers: GH_HEADERS(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`tree fetch ${res.status}`);
  return res.json();
}

async function fetchBlob(
  token: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<string> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/blobs/${sha}`,
    { headers: GH_HEADERS(token), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`blob fetch ${res.status}`);
  const j = (await res.json()) as { content: string; encoding: string };
  if (j.encoding === "base64") {
    return Buffer.from(j.content, "base64").toString("utf-8");
  }
  return j.content;
}

function isScannablePath(path: string): boolean {
  if (/(^|\/)(node_modules|dist|build|\.next|out|coverage|\.git)\//.test(path))
    return false;
  if (path.endsWith(".d.ts")) return false;
  if (/\.(tsx?|jsx?|mjs|cjs)$/.test(path)) return true;
  if (/(^|\/)\.env(\.|$)/.test(path)) return true;
  if (/\.sql$/.test(path)) return true;
  if (/(^|\/)(package|tsconfig|next\.config|vercel)\.(json|ts|js|mjs)$/.test(path))
    return true;
  if (path.startsWith(".github/workflows/") && /\.ya?ml$/.test(path))
    return true;
  return false;
}
