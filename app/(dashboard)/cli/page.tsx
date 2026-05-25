import { redirect } from "next/navigation";

/**
 * /cli — CLI feature is not yet available.
 *
 * Hidden from the sidebar and docs. Anyone hitting this URL gets bounced to
 * the dashboard. Re-enable by restoring the original page (see git history)
 * once @edith/cli is actually published to npm.
 */
export default function CliPage(): never {
  redirect("/dashboard");
}
