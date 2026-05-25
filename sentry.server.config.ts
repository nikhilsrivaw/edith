/**
 * Sentry init — server side. Loaded once at startup by @sentry/nextjs.
 * Only runs when SENTRY_DSN is set; otherwise no-ops cleanly.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "dev",
    tracesSampleRate: 0.1,
    // Don't ship full request bodies that may contain secrets.
    beforeSend(event) {
      if (event.request?.data) event.request.data = "[redacted]";
      return event;
    },
  });
}
