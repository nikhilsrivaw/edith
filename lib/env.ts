/**
 * Centralised env access with friendly fallbacks for dev.
 *
 * When EDITH_USE_FIXTURES=1, server code should fall back to mock-data.ts
 * instead of calling real APIs. This keeps the dashboard functional without
 * Supabase / GitHub / Claude credentials.
 */

export const env = {
  // Supabase
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  // GitHub App
  GITHUB_APP_ID: process.env.GITHUB_APP_ID ?? "",
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG ?? "",
  GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID ?? "",
  GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET ?? "",
  GITHUB_APP_WEBHOOK_SECRET: process.env.GITHUB_APP_WEBHOOK_SECRET ?? "",
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY ?? "",

  // Claude
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
  FIX_PROMPT_MODEL:
    process.env.EDITH_FIX_PROMPT_MODEL ?? "claude-haiku-4-5",

  // Inngest
  INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY ?? "",
  INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY ?? "",

  // Google OAuth (Search Console integration)
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID ?? "",
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
  GOOGLE_OAUTH_REDIRECT_URI:
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/oauth/google/callback`,

  // PayU
  PAYU_MERCHANT_KEY: process.env.PAYU_MERCHANT_KEY ?? "",
  PAYU_MERCHANT_SALT: process.env.PAYU_MERCHANT_SALT ?? "",
  PAYU_MODE: (process.env.PAYU_MODE ?? "test") as "test" | "production",

  // App
  APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  SESSION_SECRET: process.env.EDITH_SESSION_SECRET ?? "",

  // Cron protection
  CRON_SECRET: process.env.CRON_SECRET ?? "",

  // Optional
  SLACK_OPS_WEBHOOK_URL: process.env.SLACK_OPS_WEBHOOK_URL ?? "",
  USE_FIXTURES: process.env.EDITH_USE_FIXTURES === "1",
};

export function hasRealBackend(): boolean {
  return (
    !env.USE_FIXTURES &&
    env.SUPABASE_URL.length > 0 &&
    env.SUPABASE_SERVICE_ROLE_KEY.length > 0
  );
}
