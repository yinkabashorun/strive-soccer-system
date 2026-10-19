import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/elite/SignupForm";
import { createServiceClient, isSupabaseConfigured } from "@/lib/elite/supabase/server";
import { getViewer } from "@/lib/elite/session";
import { inviteLanding } from "@/lib/elite/invite-link";

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

  let inviteUsed = false;
  if (code && !viewer) {
    const admin = createServiceClient();
    if (admin) {
      const { data } = await admin
        .from("elite_invite_codes")
        .select("used_by")
        .eq("code", code)
        .maybeSingle();
      inviteUsed = Boolean(data?.used_by);
    }
  }

  const landing = inviteLanding({
    viewerRole: viewer?.role ?? null,
    demo: viewer?.demo ?? false,
    inviteUsed,
  });
  if (landing) redirect(landing);

  return <SignupForm configured={isSupabaseConfigured()} initialCode={code} />;
}
