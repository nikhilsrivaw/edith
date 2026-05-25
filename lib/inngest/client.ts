/**
 * Inngest client. One per app. Functions are registered through the
 * /api/inngest route handler.
 *
 * In dev: Inngest runs without keys against the local dev server.
 * In prod: requires INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "edith",
  // Keys auto-read from env. We don't pass them explicitly so the local
  // dev server (npx inngest-cli dev) works without configuration.
});

/* ============ Event type union ============ */

export type EdithEvents = {
  "edith/scan.requested": {
    data: {
      repoIdInDb: string;
      owner: string;
      repo: string;
      defaultBranch?: string;
      commit?: string;
      triggeredBy: "manual" | "webhook" | "cli" | "schedule";
      triggeredByUser?: string;
      installationId?: number;
      prNumber?: number;
      prHeadSha?: string;
      checkRunId?: number;
    };
  };
  "edith/fix-prompt.requested": {
    data: { issueId: string; tool: string };
  };
  "edith/scan.completed": {
    data: {
      scanId: string;
      repoId: string;
      scoreEdith: number;
      owner: string;
      repo: string;
      installationId?: number;
      prNumber?: number;
      prHeadSha?: string;
      checkRunId?: number;
    };
  };
};
