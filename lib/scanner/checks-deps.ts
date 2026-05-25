/**
 * Dependency-hygiene checks.
 *
 * AI-generated repos pull deprecated, abandoned, or vulnerable packages
 * because the agent's training data is months old. This file inspects
 * package.json + lockfile presence and emits issues for the worst
 * offenders. Curated lists below — kept small and high-confidence to
 * avoid false-positive noise.
 *
 * For real CVE data (Snyk-quality), Phase 2 will wire to osv.dev's free
 * API at scan time. This file only catches the obvious stuff statically.
 */
import "server-only";
import type { Dimension, Severity } from "../mock-data";
import type { FetchedFile } from "./github-tree";

export type DepIssue = {
  checkId: string;
  dimension: Dimension;
  severity: Severity;
  title: string;
  description: string;
  filePath: string;
  lineNumber?: number;
  codeSnippet?: string;
};

const file = (files: FetchedFile[], path: string) =>
  files.find((f) => f.path === path);

type PackageJson = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Curated set of packages the JS ecosystem has formally deprecated, replaced,
 * or where the package itself is a known footgun. Each entry has the
 * recommended replacement so EDITH can give a real fix prompt.
 */
const DEPRECATED: Record<string, { reason: string; replaceWith: string }> = {
  request: {
    reason: "request was deprecated in 2020 — unmaintained, has known CVEs.",
    replaceWith: "fetch (native), undici, or axios",
  },
  "node-uuid": {
    reason: "node-uuid was renamed to `uuid` years ago. node-uuid is unmaintained.",
    replaceWith: "uuid",
  },
  moment: {
    reason:
      "moment is in maintenance mode. It's 290kb minified (huge), mutable, and the maintainers themselves recommend alternatives.",
    replaceWith: "date-fns, dayjs, or Temporal (when available)",
  },
  "babel-preset-es2015": {
    reason: "Old Babel preset, replaced by @babel/preset-env in Babel 7.",
    replaceWith: "@babel/preset-env",
  },
  "left-pad": {
    reason: "left-pad — `String.prototype.padStart` is native since Node 8.",
    replaceWith: "''.padStart()",
  },
  "core-js-pure": {
    reason: "core-js-pure pulls polyfills you almost never need with modern targets.",
    replaceWith: "Tighten your browserslist config",
  },
  bcrypt: {
    reason:
      "Native bcrypt has C++ build issues across Windows/Linux/Vercel. bcryptjs is pure JS, same API, no native binary.",
    replaceWith: "bcryptjs",
  },
  jsonwebtoken: {
    reason:
      "Jsonwebtoken has had multiple verify-bypass CVEs and runs heavyweight crypto. Jose is modern, faster, edge-runtime compatible.",
    replaceWith: "jose",
  },
  rimraf: {
    reason:
      "Node 14.14+ has `fs.rm({recursive:true})`. rimraf is a 14-deep dep tree for one stdlib call.",
    replaceWith: "fs.promises.rm(path, {recursive: true, force: true})",
  },
  glob: {
    reason:
      "Node 20+ has `fs.glob`. The `glob` package is a heavy dep tree if you're already on modern Node.",
    replaceWith: "fs.glob (Node 22+) or fast-glob",
  },
  axios: {
    reason:
      "Axios has multiple SSRF / prototype-pollution CVEs across 0.x and 1.x. Native fetch is now stable in Node 18+ and the browser.",
    replaceWith: "fetch (native) or undici for advanced needs",
  },
  lodash: {
    reason:
      "Whole-lodash imports ship ~70KB. Most lodash functions have native equivalents. Tree-shaking only works if you use named imports.",
    replaceWith: "Native ES methods, or lodash-es with named imports",
  },
};

/**
 * Packages with verified high-severity CVEs that AI agents *still* write
 * because the vulnerable version was the most-recent at training cutoff.
 * Format: minimum-safe version. Anything below is flagged.
 */
const KNOWN_VULNERABLE: Array<{
  name: string;
  minSafe: string;
  cve: string;
  description: string;
}> = [
  {
    name: "next",
    minSafe: "14.2.10",
    cve: "GHSA-7gfc-8cq8-jh5f",
    description:
      "Next.js < 14.2.10 has an authorization bypass in the middleware fallback.",
  },
  {
    name: "axios",
    minSafe: "1.7.4",
    cve: "GHSA-wf5p-g6vw-rhxx",
    description:
      "Axios < 1.7.4 has a server-side request forgery (SSRF) via absolute URL.",
  },
  {
    name: "form-data",
    minSafe: "4.0.4",
    cve: "GHSA-fjxv-7rqg-78g4",
    description: "form-data < 4.0.4 has unsafe random boundary generation.",
  },
];

/**
 * Suspicious typosquats — common AI-agent fingerprints.
 * Format: typo → correct name.
 */
const TYPOSQUATS: Record<string, string> = {
  reactt: "react",
  reactdom: "react-dom",
  "next-js": "next",
  shadcn: "@shadcn/ui (or use the CLI, not the package)",
  taliwind: "tailwindcss",
  "tailwind-css": "tailwindcss",
  "supabase-js": "@supabase/supabase-js",
  "framer-motion-react": "framer-motion (or motion)",
  "openai-api": "openai",
  anthropics: "@anthropic-ai/sdk",
};

/**
 * GPL / AGPL packages — fine for personal projects, problematic for SaaS.
 * AGPL especially: if you serve it over a network, you must open-source
 * everything that touches it. AI agents pull these without warning.
 */
const COPYLEFT: Record<string, string> = {
  // Confirmed AGPL-3.0 (re-verify per release if pinning matters)
  "@nestjs/cli": "MIT alternatives exist for most CLI needs",
};

function semverGte(a: string, b: string): boolean {
  // Strip leading ^ ~ >= etc.
  const clean = (v: string) => v.replace(/^[\^~>=<\s]+/, "").split("-")[0];
  const ap = clean(a).split(".").map(Number);
  const bp = clean(b).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export function runDependencyChecks(files: FetchedFile[]): DepIssue[] {
  const pkgFile = file(files, "package.json");
  if (!pkgFile) return [];
  let pkg: PackageJson;
  try {
    pkg = JSON.parse(pkgFile.content);
  } catch {
    return [{
      checkId: "dependencies/package-json-invalid",
      dimension: "dependencies",
      severity: "high",
      title: "package.json is not valid JSON",
      description:
        "Your package.json failed to parse. Run `pnpm install` locally — if it works there, an editor or merge conflict may have corrupted the file.",
      filePath: "package.json",
    }];
  }

  const out: DepIssue[] = [];
  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  /* 1. Deprecated packages */
  for (const [name, info] of Object.entries(DEPRECATED)) {
    if (!(name in allDeps)) continue;
    out.push({
      checkId: `dependencies/deprecated-${name}`,
      dimension: "dependencies",
      severity: "medium",
      title: `Deprecated package: ${name}`,
      description: `${info.reason} Recommended: ${info.replaceWith}.`,
      filePath: "package.json",
      codeSnippet: `"${name}": "${allDeps[name]}"`,
    });
  }

  /* 2. Known-CVE versions */
  for (const cve of KNOWN_VULNERABLE) {
    const installed = allDeps[cve.name];
    if (!installed) continue;
    if (semverGte(installed, cve.minSafe)) continue;
    out.push({
      checkId: `dependencies/cve-${cve.name}`,
      dimension: "dependencies",
      severity: "critical",
      title: `${cve.name} ${installed} has a known CVE (${cve.cve})`,
      description: `${cve.description} Upgrade to ${cve.name} >= ${cve.minSafe}. Run \`pnpm up ${cve.name}@latest\` and re-test.`,
      filePath: "package.json",
      codeSnippet: `"${cve.name}": "${installed}"  →  "^${cve.minSafe}"`,
    });
  }

  /* 3. Typosquats */
  for (const [typo, real] of Object.entries(TYPOSQUATS)) {
    if (!(typo in allDeps)) continue;
    out.push({
      checkId: `dependencies/typosquat-${typo}`,
      dimension: "dependencies",
      severity: "critical",
      title: `Suspicious package name: "${typo}"`,
      description: `"${typo}" is a known typosquat or wrong name. Did you mean "${real}"? Typosquats can be malicious — remove this immediately and verify your install steps.`,
      filePath: "package.json",
      codeSnippet: `"${typo}": "${allDeps[typo]}"  →  "${real}"`,
    });
  }

  /* 4. Copyleft licenses */
  for (const [name, note] of Object.entries(COPYLEFT)) {
    if (!(name in allDeps)) continue;
    out.push({
      checkId: `dependencies/copyleft-${name}`,
      dimension: "dependencies",
      severity: "low",
      title: `${name} is copyleft (AGPL/GPL)`,
      description: `Copyleft licenses can require you to release source code of anything that links to them — including SaaS deployments under AGPL. ${note}`,
      filePath: "package.json",
      codeSnippet: `"${name}": "${allDeps[name]}"`,
    });
  }

  /* 5. Lockfile missing */
  const hasLock =
    file(files, "pnpm-lock.yaml") ||
    file(files, "package-lock.json") ||
    file(files, "yarn.lock") ||
    file(files, "bun.lock") ||
    file(files, "bun.lockb");
  if (!hasLock) {
    out.push({
      checkId: "dependencies/no-lockfile",
      dimension: "dependencies",
      severity: "high",
      title: "No lockfile committed",
      description:
        "Without a lockfile (pnpm-lock.yaml / package-lock.json / yarn.lock / bun.lock), every install resolves transitive versions independently. CI gets different versions than your laptop — and prod gets different versions than CI. Commit your lockfile.",
      filePath: "package.json",
    });
  }

  /* 6. Same package in both deps and devDeps */
  const both = Object.keys(pkg.dependencies ?? {}).filter(
    (d) => d in (pkg.devDependencies ?? {}),
  );
  for (const name of both) {
    out.push({
      checkId: "dependencies/dupe-dep-devdep",
      dimension: "dependencies",
      severity: "low",
      title: `"${name}" declared in both dependencies and devDependencies`,
      description:
        "Listing a package in both sections is a footgun — npm/pnpm pick one and the other is silently ignored. Decide if it's runtime (`dependencies`) or build-time-only (`devDependencies`) and remove the other entry.",
      filePath: "package.json",
      codeSnippet: name,
    });
  }

  /* 7. Wildcard / latest versions (no pinning) */
  for (const [name, range] of Object.entries(allDeps)) {
    if (range === "*" || range === "latest" || range === "") {
      out.push({
        checkId: "dependencies/wildcard-version",
        dimension: "dependencies",
        severity: "medium",
        title: `"${name}" uses unpinned version "${range}"`,
        description:
          "Wildcard or `latest` versions mean every install can pull a different (potentially breaking) version. Pin to a caret range (`^x.y.z`) or exact version.",
        filePath: "package.json",
        codeSnippet: `"${name}": "${range}"`,
      });
    }
  }

  return out;
}
