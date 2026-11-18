import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ChangePasswordForm } from "@/components/elite/ChangePasswordForm";
import { getViewer } from "@/lib/elite/session";

export const metadata = { title: "Change password · Strive Elite" };

// "Change password": the current one, the new one, done. A member never
// has to sign out and use "Forgot your password" to set a new one. Like
// the rest of Account it sits outside the player shell, so it is reachable
// whatever the membership's state.
export default async function ChangePasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account/password");

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-5 pt-safe sm:px-6">
        <Link
          href="/account"
          className="inline-flex h-11 items-center gap-1 pr-3 text-[15px] font-medium text-white/70"
        >
          <ChevronLeft className="h-5 w-5" /> Account
        </Link>

        <h1 className="mt-3 font-display text-4xl font-black uppercase leading-none">
          Change password
        </h1>

        {viewer.demo ? (
          <p className="mt-4 text-[15px] leading-relaxed text-white/75">
            This is the example player, not a real account, so there is no password to change.
          </p>
        ) : (
          <>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              Enter the password you sign in with now, then the new one. You stay signed in on
              this phone.
            </p>
            <div className="mt-6">
              <ChangePasswordForm />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
