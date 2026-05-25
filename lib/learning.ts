/**
 * EDITH Learning — noise reduction (features.md P2 #12).
 *
 * After a user dismisses the same check_id N times, we silence that pattern
 * for them. The dismissal record lives in issue_dismissals; the filter
 * lives in this module.
 *
 * Scopes:
 *   - 'user' (default): silence for the dismissing user across all their repos
 *   - 'repo': silence for everyone on a specific repo
 *   - 'org':  silence for everyone in the org
 */
import "server-only";
import { getSupabaseAdmin } from "./supabase-admin";

const SILENCE_THRESHOLD = 5;

type DismissalRow = {
  check_id: string;
  scope: "user" | "repo" | "org";
  repo_id: string | null;
};

export type SilencedChecks = {
  /** check_ids silenced for this user, full or by-repo. */
  byUser: Set<string>;
  /** check_ids silenced org-wide. */
  byOrg: Set<string>;
  /** map of repo_id → set of silenced check_ids on that repo. */
  byRepo: Map<string, Set<string>>;
};

export async function getSilencedChecks(args: {
  userId: string;
  orgId: string;
}): Promise<SilencedChecks> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("issue_dismissals")
    .select("check_id, scope, repo_id")
    .or(`user_id.eq.${args.userId},org_id.eq.${args.orgId}`);

  const rows = (data as DismissalRow[]) ?? [];
  // Tally per (scope, target, check_id).
  type Key = string;
  const tally = new Map<Key, number>();
  const keyFor = (
    scope: string,
    repoId: string | null,
    checkId: string,
  ): Key => `${scope}:${repoId ?? ""}:${checkId}`;
  for (const r of rows) {
    const k = keyFor(r.scope, r.repo_id, r.check_id);
    tally.set(k, (tally.get(k) ?? 0) + 1);
  }

  const byUser = new Set<string>();
  const byOrg = new Set<string>();
  const byRepo = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = keyFor(r.scope, r.repo_id, r.check_id);
    const n = tally.get(k) ?? 0;
    if (n < SILENCE_THRESHOLD) continue;
    if (r.scope === "user") byUser.add(r.check_id);
    else if (r.scope === "org") byOrg.add(r.check_id);
    else if (r.scope === "repo" && r.repo_id) {
      let s = byRepo.get(r.repo_id);
      if (!s) {
        s = new Set();
        byRepo.set(r.repo_id, s);
      }
      s.add(r.check_id);
    }
  }
  return { byUser, byOrg, byRepo };
}

export function isSilenced(
  s: SilencedChecks,
  args: { checkId: string; repoId: string },
): boolean {
  if (s.byOrg.has(args.checkId)) return true;
  if (s.byUser.has(args.checkId)) return true;
  if (s.byRepo.get(args.repoId)?.has(args.checkId)) return true;
  return false;
}

/** Insert a dismissal record. Idempotent — multiple identical inserts are fine; the count is what matters. */
export async function dismissIssue(args: {
  userId: string;
  orgId: string;
  checkId: string;
  scope?: "user" | "repo" | "org";
  repoId?: string;
  reason?: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  await admin.from("issue_dismissals").insert({
    user_id: args.userId,
    org_id: args.orgId,
    check_id: args.checkId,
    scope: args.scope ?? "user",
    repo_id: args.repoId ?? null,
    reason: args.reason,
  });
}
