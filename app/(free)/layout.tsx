import { redirect } from "next/navigation";
import { FreshOnReturn } from "@/components/elite/FreshOnReturn";
import { FreeShell } from "@/components/elite/FreeShell";
import { PushKeepAlive } from "@/components/elite/PushOptIn";
import { AgreementScreen } from "@/components/elite/AgreementScreen";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { consentDue } from "@/lib/elite/legal-server";
import { trackerFor } from "@/lib/elite/tracker-server";
import { FREE_HOME, tracksGym } from "@/lib/elite/tracker";

// The free app's shell (migration 069): two tabs, Friends and My week, and
// the plus between them that posts today's training. Only a free account
// gets in: a coach goes to the coach side, and a member (or a player still
// waiting on a profile) goes to the member side, which knows what to show.
// Account (password, blocked players, sign out, delete account) is behind
// the initials on My week.
export default async function FreeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  if (viewer.role !== "player") redirect("/coach");

  const tracker = await trackerFor(viewer);
  if (!tracker) redirect("/dashboard");

  // The agreement gate (068), the same one members pass. A free account
  // accepts at sign-up, so this shows only when the terms change.
  if (!viewer.demo && (await consentDue(viewer.profile.id))) {
    return <AgreementScreen signOut={signOut} />;
  }

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <FreshOnReturn />
      {/* A phone that said yes to notifications is kept on file (078). */}
      {!viewer.demo && <PushKeepAlive />}
      <FreeShell gym={tracksGym(tracker.grade)}>
        <main className="mx-auto w-full max-w-md pb-[calc(120px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
          {children}
        </main>
      </FreeShell>
    </div>
  );
}
