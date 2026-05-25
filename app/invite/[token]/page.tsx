import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { CleanCard } from "@/components/edith/clean-card";
import { EdithLogo } from "@/components/edith/logo";
import { getSupabaseServer } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = getSupabaseAdmin();
  const { data: inv } = await admin
    .from("org_invites")
    .select("id, org_id, email, role, expires_at, accepted_at, organizations(name)")
    .eq("token", token)
    .maybeSingle();
  type Row = {
    id: string;
    org_id: string;
    email: string;
    role: string;
    expires_at: string;
    accepted_at: string | null;
    organizations: { name: string } | null;
  };
  const invite = inv as Row | null;

  if (!invite) return <InviteState ok={false} title="Invite not found" body="The link may be wrong or the invite was revoked." />;
  if (invite.accepted_at)
    return <InviteState ok={false} title="Already accepted" body="This invite has already been used." />;
  if (new Date(invite.expires_at) < new Date())
    return <InviteState ok={false} title="Invite expired" body="Ask the inviter to send a new one." />;

  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=/invite/${token}`);

  // Accept the invite — add membership + mark accepted.
  await admin.from("org_members").upsert(
    {
      user_id: user.id,
      org_id: invite.org_id,
      role: invite.role,
    },
    { onConflict: "org_id,user_id" },
  );
  await admin
    .from("org_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return (
    <InviteState
      ok
      title={`Joined ${invite.organizations?.name ?? "the team"}`}
      body={`Role: ${invite.role}. You can now see everything the team has scanned.`}
      cta="Open dashboard"
    />
  );
}

function InviteState({
  ok,
  title,
  body,
  cta = "Back home",
}: {
  ok: boolean;
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-block">
          <EdithLogo />
        </Link>
        <CleanCard className="mt-6 p-8">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[rgba(74,222,128,0.12)]">
            {ok ? (
              <Check className="h-6 w-6 text-[var(--success)]" strokeWidth={2.5} />
            ) : (
              <X className="h-6 w-6 text-[var(--danger)]" strokeWidth={2.5} />
            )}
          </div>
          <h1 className="mt-4 text-[22px] font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--text-dim)]">
            {body}
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-5 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--bg)] hover:brightness-110"
          >
            {cta}
          </Link>
        </CleanCard>
      </div>
    </div>
  );
}
