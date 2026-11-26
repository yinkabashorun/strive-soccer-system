import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { ConfirmEmailScreen } from "@/components/elite/ConfirmEmailScreen";
import { CONFIRM_EMAIL_PATH } from "@/lib/elite/email-confirm";

export const metadata = { title: "Check your email · Strive Elite" };
export const dynamic = "force-dynamic";

// Email confirmation (093) on the website, outside the member and free
// shells so their own redirect here cannot loop. The member shell, the free
// shell and the quiz send a new account here until the 6 digit code from
// its email is typed (viewer.emailDue). Anyone who owes nothing goes on to
// the front door, which knows where they belong. Account (and deleting the
// account) and Sign out stay one tap away, like the agreement screen.
export default async function ConfirmEmailPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${CONFIRM_EMAIL_PATH}`);
  if (!viewer.emailDue) redirect("/");
  return <ConfirmEmailScreen email={viewer.profile.email} signOut={signOut} />;
}
