/**
 * Sentry init — edge runtime (middleware / proxy.ts).
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "dev",
    tracesSampleRate: 0.1,
  });
}
