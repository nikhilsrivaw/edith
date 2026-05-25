/**
 * Server-side GitHub fetchers using the OAuth provider_token from Supabase.
 *
 * The user signed in via GitHub OAuth (read:user user:email repo). Supabase
 * stores their GitHub access token in the session; we read it here to call
 * GitHub's REST API directly.
 *
 * NOTE: This is a discovery-time mechanism. Actual scanning will use the
 * GitHub App installation token instead.
 */
import "server-only";
import { getSupabaseServer } from "./supabase-server";

export type GitHubUser = {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  bio: string | null;
  public_repos: number;
  total_private_repos?: number;
  followers: number;
  following: number;
  html_url: string;
};

export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  fork: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  pushed_at: string;
  updated_at: string;
  topics: string[];
  owner: { login: string; avatar_url: string };
};

async function getProviderToken(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getSession();
  return data.session?.provider_token ?? null;
}

async function ghFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = await getProviderToken();
  if (!token) return null;
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "edith-app",
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 60, ...(init as { next?: object })?.next },
  });
  if (!res.ok) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[github-fetch] ${path} → ${res.status}`);
    }
    return null;
  }
  return res.json() as Promise<T>;
}

export async function fetchGithubUser(): Promise<GitHubUser | null> {
  return ghFetch<GitHubUser>("/user");
}

export async function fetchGithubRepos(): Promise<GitHubRepo[]> {
  const repos = await ghFetch<GitHubRepo[]>(
    "/user/repos?sort=pushed&per_page=30&affiliation=owner,collaborator",
  );
  return repos ?? [];
}

export async function isProviderTokenPresent(): Promise<boolean> {
  return (await getProviderToken()) !== null;
}
