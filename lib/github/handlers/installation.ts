/**
 * Handles `installation` and `installation_repositories` webhook events.
 *
 * - installation.created     → store installation_id on a yet-unassociated org
 * - installation.deleted     → clear installation_id (App removed)
 * - installation_repositories.added/removed → keep repo list in sync
 *
 * The org is identified by:
 *   1. `sender.id` (GitHub user id) → match users.github_id
 *   2. fall back: installation.account.id → match against orgs by org slug
 */
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type InstallationPayload = {
  action: string;
  installation: {
    id: number;
    account: { id: number; login: string; type: "User" | "Organization" };
  };
  sender?: { id: number; login: string };
  repositories?: Array<{ id: number; name: string; full_name: string; private: boolean }>;
  repositories_added?: Array<{ id: number; name: string; full_name: string }>;
  repositories_removed?: Array<{ id: number; name: string; full_name: string }>;
};

export async function handleInstallation(raw: Record<string, unknown>) {
  const payload = raw as unknown as InstallationPayload;
  const admin = getSupabaseAdmin();
  const installationId = payload.installation.id;

  if (payload.action === "deleted") {
    await admin
      .from("organizations")
      .update({ github_installation_id: null })
      .eq("github_installation_id", installationId);
    return;
  }

  if (payload.action === "created" || payload.action === "added") {
    const githubAccountId = payload.installation.account.id;

    // Find the user whose github_id matches the installer.
    const senderId = payload.sender?.id ?? githubAccountId;
    const { data: userRow } = await admin
      .from("users")
      .select("id")
      .eq("github_id", senderId)
      .maybeSingle();

    if (!userRow) {
      console.log(
        `[webhook/installation] no matching user for github_id=${senderId} — installation_id=${installationId} will attach via the install callback flow`,
      );
      return;
    }

    // Get their org via membership.
    const { data: member } = await admin
      .from("org_members")
      .select("org_id")
      .eq("user_id", userRow.id)
      .limit(1)
      .maybeSingle();

    if (!member) return;

    await admin
      .from("organizations")
      .update({ github_installation_id: installationId })
      .eq("id", member.org_id);
  }

  // installation_repositories.added / .removed — could pre-warm the repos table.
  // Skipping for now; we lazy-upsert on first scan.
}
