import type { Metadata } from "next";
import { ResetForm } from "@/components/elite/ResetForm";
import { createClient } from "@/lib/elite/supabase/server";

export const metadata: Metadata = {
  title: "Set a new password · Strive Elite",
};

// Reads the session cookie on every visit; never a cached page.
export const dynamic = "force-dynamic";

// Is there a recovery session to set a password for? Asked here, on the
// server, so the form never has to ask the sign-in service from the
// browser (lib/elite/sign-in.ts).
async function hasSession(): Promise<boolean> {
  const supabase = createClient();
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return Boolean(user);
  } catch {
    return false;
  }
}

// Landing page for the recovery-email link. /auth/confirm (or
// /auth/callback) has already turned the link into a session by the time
// the person arrives here, so they just set the new password.
export default async function ResetPage() {
  return <ResetForm hasSession={await hasSession()} />;
}
