import type { Metadata } from "next";
import { ResetForm } from "@/components/elite/ResetForm";

export const metadata: Metadata = {
  title: "Set a new password · Strive Elite",
};

// Landing page for the recovery-email link. The /auth/callback route has
// already exchanged the one-time code for a session by the time the user
// arrives here, so they just set the new password.
export default function ResetPage() {
  return <ResetForm />;
}
