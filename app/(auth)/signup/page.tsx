import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/elite/SignupForm";
import { createServiceClient, isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { getViewer } from "@/lib/elite/session";
import { inviteLanding, inviteRoleOf, type InviteRole } from "@/lib/elite/invite-link";

export const metadata: Metadata = {
  title: "Get started · Strive Elite",
};

// An invite link gets tapped more than once. A signed-in viewer never
// sees this form, and a code that already created an account sends the
// family to sign-in instead of "invalid invite code" (lib/elite/invite-link).
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: { code?: string };
}) {
  const code = (searchParams?.code ?? "").trim().toUpperCase();
  const viewer = await getViewer();

  // The link's code also tells the form what it creates (054): a coach
  // code shows the coach form (no parent phone) and lands on /coach.
  let inviteUsed = false;
  let inviteRole: InviteRole = "player";
  if (code && !viewer) {
    const admin = createServiceClient();
    if (admin) {
      const { data } = await admin
        .from("elite_invite_codes")
        .select("used_by, role")
        .eq("code", code)
        .maybeSingle();
      inviteUsed = Boolean(data?.used_by);
      inviteRole = inviteRoleOf(data?.role);
    }
  }

  const landing = inviteLanding({
    viewerRole: viewer?.role ?? null,
    demo: viewer?.demo ?? false,
    inviteUsed,
  });
  if (landing) redirect(landing);

  return <SignupForm configured={isSupabaseConfigured()} initialCode={code} inviteRole={inviteRole} />;
}
