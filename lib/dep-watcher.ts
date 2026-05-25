/**
 * Dependency vulnerability watcher.
 *
 * Reads a repo's package.json via GitHub Contents API, queries GitHub's
 * GraphQL Security Advisory database for known vulnerabilities affecting
 * the installed versions, returns a list of advisories.
 *
 * Runs daily via /api/cron/dep-scan (cron'd by Vercel Cron or a manual hit).
 *
 * Persists results into a synthetic scan row (kind metadata in dimension_scores
 * for v0; dedicated table later if we expand).
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";

const GH_GRAPHQL = "https://api.github.com/graphql";

export type DepAdvisory = {
  ghsaId: string;
  packageName: string;
  installedVersion: string;
  vulnerableRange: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  summary: string;
  references: string[];
  firstPatchedVersion: string | null;
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

async function ghPackageJson(
  token: string,
  owner: string,
  repo: string,
  branch: string,
): Promise<PackageJson | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/package.json?ref=${branch}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.raw+json",
      "User-Agent": "edith-dep-watcher",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as PackageJson;
  } catch {
    return null;
  }
}

function stripVersion(spec: string): string {
  return spec.replace(/^[\^~>=<\s]+/, "").trim();
}

async function ghAdvisoriesForPackage(
  token: string,
  packageName: string,
): Promise<
  Array<{
    ghsaId: string;
    summary: string;
    severity: DepAdvisory["severity"];
    vulnerableVersionRange: string;
    firstPatchedVersion: { identifier: string } | null;
    references: { url: string }[];
  }>
> {
  const q = `
    query($name: String!) {
      securityVulnerabilities(first: 5, ecosystem: NPM, package: $name) {
        nodes {
          advisory {
            ghsaId
            summary
            severity
            references { url }
          }
          vulnerableVersionRange
          firstPatchedVersion { identifier }
        }
      }
    }
  `;
  const res = await fetch(GH_GRAPHQL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "edith-dep-watcher",
    },
    body: JSON.stringify({ query: q, variables: { name: packageName } }),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: {
      securityVulnerabilities?: {
        nodes: Array<{
          advisory: {
            ghsaId: string;
            summary: string;
            severity: string;
            references: { url: string }[];
          };
          vulnerableVersionRange: string;
          firstPatchedVersion: { identifier: string } | null;
        }>;
      };
    };
  };
  const nodes = data.data?.securityVulnerabilities?.nodes ?? [];
  return nodes.map((n) => ({
    ghsaId: n.advisory.ghsaId,
    summary: n.advisory.summary,
    severity: n.advisory.severity as DepAdvisory["severity"],
    vulnerableVersionRange: n.vulnerableVersionRange,
    firstPatchedVersion: n.firstPatchedVersion,
    references: n.advisory.references.map((r) => r.url),
  }));
}

/**
 * Naive semver-range membership check. Handles the common forms used in
 * GitHub Advisory ranges: `<X.Y.Z`, `<=X.Y.Z`, `>=X.Y.Z, <X.Y.Z`, `=X.Y.Z`.
 */
function versionInRange(installed: string, range: string): boolean {
  const v = installed.split(".").map((p) => parseInt(p, 10));
  const parts = range.split(",").map((p) => p.trim());
  const compare = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const ai = a[i] ?? 0;
      const bi = b[i] ?? 0;
      if (ai > bi) return 1;
      if (ai < bi) return -1;
    }
    return 0;
  };
  for (const p of parts) {
    const m = p.match(/^(<=|<|>=|>|=)\s*([0-9]+(?:\.[0-9]+){0,2})/);
    if (!m) continue;
    const op = m[1];
    const target = m[2].split(".").map((x) => parseInt(x, 10));
    const cmp = compare(v, target);
    if (op === "<" && !(cmp < 0)) return false;
    if (op === "<=" && !(cmp <= 0)) return false;
    if (op === ">" && !(cmp > 0)) return false;
    if (op === ">=" && !(cmp >= 0)) return false;
    if (op === "=" && cmp !== 0) return false;
  }
  return true;
}

export async function scanRepoDependencies(args: {
  providerToken: string;
  owner: string;
  repo: string;
  defaultBranch: string;
}): Promise<DepAdvisory[]> {
  const pkg = await ghPackageJson(
    args.providerToken,
    args.owner,
    args.repo,
    args.defaultBranch,
  );
  if (!pkg) return [];

  const installed: Record<string, string> = {};
  for (const [k, v] of Object.entries(pkg.dependencies ?? {})) {
    installed[k] = stripVersion(v);
  }
  for (const [k, v] of Object.entries(pkg.devDependencies ?? {})) {
    installed[k] = stripVersion(v);
  }

  const out: DepAdvisory[] = [];
  // Query advisories with limited concurrency to stay nice on rate limits.
  const names = Object.keys(installed);
  const CONCURRENCY = 4;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < names.length) {
        const idx = cursor++;
        const name = names[idx];
        const advisories = await ghAdvisoriesForPackage(
          args.providerToken,
          name,
        );
        for (const a of advisories) {
          if (!versionInRange(installed[name], a.vulnerableVersionRange)) continue;
          out.push({
            ghsaId: a.ghsaId,
            packageName: name,
            installedVersion: installed[name],
            vulnerableRange: a.vulnerableVersionRange,
            severity: a.severity,
            summary: a.summary,
            references: a.references,
            firstPatchedVersion: a.firstPatchedVersion?.identifier ?? null,
          });
        }
      }
    }),
  );
  return out;
}

/** Persist advisories as drift_alerts of kind 'new_critical' so they show up in the dashboard. */
export async function persistAdvisoriesAsAlerts(
  repoId: string,
  advisories: DepAdvisory[],
): Promise<void> {
  if (advisories.length === 0) return;
  const admin = getSupabaseAdmin();
  for (const a of advisories.filter(
    (x) => x.severity === "CRITICAL" || x.severity === "HIGH",
  )) {
    const title = `CVE ${a.ghsaId}: ${a.packageName}@${a.installedVersion} — ${a.summary.slice(0, 80)}`;
    const { data: existing } = await admin
      .from("drift_alerts")
      .select("id")
      .eq("repo_id", repoId)
      .eq("kind", "new_critical")
      .eq("title", title)
      .is("acknowledged_at", null)
      .maybeSingle();
    if (existing) continue;
    await admin.from("drift_alerts").insert({
      repo_id: repoId,
      kind: "new_critical",
      severity:
        a.severity === "CRITICAL"
          ? "critical"
          : a.severity === "HIGH"
            ? "high"
            : "medium",
      title,
      detail: {
        ghsaId: a.ghsaId,
        packageName: a.packageName,
        installedVersion: a.installedVersion,
        firstPatchedVersion: a.firstPatchedVersion,
        references: a.references,
      },
    });
  }
}
