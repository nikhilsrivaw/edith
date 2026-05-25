/**
 * GitHub App authentication.
 *
 * Generates a JWT from App ID + private key, exchanges for an installation
 * access token, returns an Octokit instance scoped to that installation.
 *
 * The user's GitHub OAuth token (provider_token from Supabase) is for
 * sign-in only. ALL repo-data writes (PR comments, check runs) go through
 * the GitHub App via installation tokens — that's the principal that
 * `edith-bot` shows up as in PR review comments.
 */
import "server-only";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { env } from "./env";

function unescapePem(s: string): string {
  return s.replace(/\\n/g, "\n");
}

export function hasGithubApp(): boolean {
  return Boolean(
    env.GITHUB_APP_ID &&
      env.GITHUB_APP_PRIVATE_KEY &&
      env.GITHUB_APP_CLIENT_ID,
  );
}

export function getAppAuth() {
  if (!hasGithubApp()) {
    throw new Error(
      "GitHub App not configured — set GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY in .env.local",
    );
  }
  return createAppAuth({
    appId: env.GITHUB_APP_ID,
    privateKey: unescapePem(env.GITHUB_APP_PRIVATE_KEY),
    clientId: env.GITHUB_APP_CLIENT_ID,
    clientSecret: env.GITHUB_APP_CLIENT_SECRET,
  });
}

/** Octokit authenticated as the App itself (limited — for listing installations). */
export async function getOctokitAsApp(): Promise<Octokit> {
  const auth = getAppAuth();
  const { token } = await auth({ type: "app" });
  return new Octokit({ auth: token });
}

/** Octokit authenticated as a specific installation — use for all repo operations. */
export async function getOctokitForInstallation(
  installationId: number,
): Promise<Octokit> {
  const auth = getAppAuth();
  const { token } = await auth({ type: "installation", installationId });
  return new Octokit({ auth: token });
}

/** Build the GitHub App install URL — user is sent here to authorize on their orgs/repos. */
export function getInstallUrl(state?: string): string {
  if (!env.GITHUB_APP_CLIENT_ID) {
    throw new Error("GITHUB_APP_CLIENT_ID not set");
  }
  // The "slug" is the App's slug on github.com — for now we redirect to the
  // generic install URL via the App's client id. GitHub determines the slug.
  const base = `https://github.com/apps/${env.GITHUB_APP_SLUG ?? "edith-bot-dev"}/installations/new`;
  return state ? `${base}?state=${encodeURIComponent(state)}` : base;
}
