import { redirect } from "next/navigation";
import { FreshOnReturn } from "@/components/elite/FreshOnReturn";
import { FreeShell } from "@/components/elite/FreeShell";
import { PushKeepAlive } from "@/components/elite/PushOptIn";
import { AgreementScreen } from "@/components/elite/AgreementScreen";
import { getViewer } from "@/lib/elite/session";
import { signOut } from "@/lib/elite/auth-actions";
import { consentDue } from "@/lib/elite/legal-server";
import { freeSideOf } from "@/lib/elite/tracker-server";
import { FREE_HOME, tracksGym } from "@/lib/elite/tracker";
import { ProfileSetupScreen } from "@/components/elite/ProfileSetupScreen";
import { profileSetupDue, setupSteps } from "@/lib/elite/account-profile";
import { suggestUsernames } from "@/lib/elite/account-profile-server";
import { initials } from "@/lib/utils";
import { CONFIRM_EMAIL_PATH } from "@/lib/elite/email-confirm";

// The free app's shell (migration 069): two tabs, Friends and My week, and
// the plus between them that posts today's training. A free account gets
// in, and so does a Strive Pro member who came through it (they also get a
// Train tab that opens their week). A coach goes to the coach side, and a
// member with no free account (or a player still waiting on a profile)
// goes to the member side, which knows what to show.
// Account (password, blocked players, sign out, delete account) is behind
// the initials on My week.
export default async function FreeLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${FREE_HOME}`);
  if (viewer.role !== "player") redirect("/coach");
  // A new account confirms its email first (093): before the agreement,
  // the photo and @username, and everything after. False for coaches, the
  // example tour, and while no sender is set up (email-confirm.ts).
  if (viewer.emailDue) redirect(CONFIRM_EMAIL_PATH);

  // A free account, and a Strive Pro member who came through it (ONE APP,
  // lib/elite/one-app.ts): they keep these pages, and get a Train tab on
  // them that opens their week.
  const side = await freeSideOf(viewer);
  if (!side) redirect("/dashboard");
  const tracker = side.tracker;
  const train = !side.lives;

  // The agreement gate (068), the same one members pass. A free account
  // accepts at sign-up, so this shows only when the terms change.
  if (!viewer.demo && (await consentDue(viewer.profile.id))) {
    return <AgreementScreen signOut={signOut} />;
  }

  // The profile photo and @username (081), both required: a new account
  // sees these first, right after sign-up and before the quiz; an account
  // made before sees them once. The example tour is never asked, and an
  // unreadable profile row opens the app anyway (account-profile.ts). This
  // replaces the free app's old "never asked for at sign-up" photo.
  if (!viewer.demo && profileSetupDue(viewer.setup)) {
    return (
      <ProfileSetupScreen
        steps={setupSteps(viewer.setup)}
        ideas={viewer.setup.username ? [] : await suggestUsernames(viewer.profile.id, viewer.profile.full_name).catch(() => [])}
        initials={initials(viewer.profile.full_name)}
        seenBy="your friends and the coaches"
        signOut={signOut}
      />
    );
  }

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <FreshOnReturn />
      {/* A phone that said yes to notifications is kept on file (078). */}
      {!viewer.demo && <PushKeepAlive />}
      <FreeShell gym={tracksGym(tracker.grade)} train={train}>
        <main className="mx-auto w-full max-w-md pb-[calc(120px+env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)]">
          {children}
        </main>
      </FreeShell>
    </div>
  );
}
