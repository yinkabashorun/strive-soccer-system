import Link from "next/link";
import { keptOutOfThisApp } from "@/lib/elite/native-request";
import { redirect } from "next/navigation";
import { MemberNav } from "@/components/elite/MemberNav";
import { Wordmark } from "@/components/elite/Wordmark";
import { FreshOnReturn } from "@/components/elite/FreshOnReturn";
import { PushKeepAlive } from "@/components/elite/PushOptIn";
import { getViewer } from "@/lib/elite/session";
import { getHomework, getNotifications, getPlayer } from "@/lib/elite/data";
import { signOut } from "@/lib/elite/auth-actions";
import { unlockDueWeeks } from "@/lib/elite/unlock";
import { AgreementScreen } from "@/components/elite/AgreementScreen";
import { consentDue } from "@/lib/elite/legal-server";
import { NO_PROFILE_GATE, type GateCopy } from "@/lib/elite/gates";
import { memberState } from "@/lib/elite/member-gate";
import { memberTabs } from "@/lib/elite/experience";
import { groupSessions } from "@/lib/elite/session-flow";
import { liveWeekFor } from "@/lib/elite/time";
import { ProCheckoutButton } from "@/components/elite/ProCheckoutButton";
import { SUPPORT_EMAIL } from "@/lib/elite/support";
import { getTracker, quizDone } from "@/lib/elite/tracker-server";
import { freeLanding } from "@/lib/elite/tracker";

// The tabs (approved mock v4, Nov 20 2026): Home, Week, Courses and You
// for Strive Pro; Coach before You for an offer with the coach chat. The
// Film Room is a card on Home and a link on Coach, not a tab. One rule,
// memberTabs in lib/elite/experience.ts; Progress and Account sit under You.

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/dashboard");
  // Coaches AND admins live in the coach app, never the player shell.
  if (viewer.role !== "player") redirect("/coach");

  // Process any weeks due to unlock (Monday-morning flip, VA time).
  await unlockDueWeeks().catch(() => undefined);

  // Authenticated player whose coach hasn't set up their profile yet.
  // A free account (069) has no player record on purpose and lives in the
  // training log, never in the member app. Sign-in lands every player on
  // /dashboard (lib/elite/sign-in.ts); this is the one redirect that takes
  // a free account from there to the screen it opens on.
  const tracker = !viewer.playerId && !viewer.demo ? await getTracker(viewer.profile.id) : null;
  if (!viewer.playerId) {
    if (tracker) redirect(freeLanding(quizDone(tracker)));
    return <GateScreen gate={NO_PROFILE_GATE} />;
  }

  const [player, due] = await Promise.all([
    getPlayer(viewer.playerId),
    viewer.demo ? Promise.resolve(false) : consentDue(viewer.profile.id),
  ]);

  // Who gets in, and which screen everyone else sees, is ONE rule shared
  // with the native iPhone app's API (lib/elite/member-gate.ts):
  //   - the agreement (068), once, before anything else; the Account page
  //     (and deleting the account) stays reachable without it
  //   - a Strive Pro member (074) pays first, then takes the quiz
  //   - a redeemed player who has not finished intake takes the quiz
  //     (demo players are pre-onboarded)
  //   - any other membership not switched on sees the coach screen
  const state = memberState({
    role: viewer.role,
    playerId: viewer.playerId,
    isFree: Boolean(tracker),
    consentDue: due,
    player: viewer.demo && player ? { ...player, onboarded_at: player.onboarded_at ?? "demo" } : player,
  });
  if (state.kind === "consent") {
    return (
      <div className="member-ui">
        <AgreementScreen signOut={signOut} />
      </div>
    );
  }
  if (state.kind === "pro_checkout" || state.kind === "membership" || state.kind === "no_profile") {
    return <GateScreen gate={state.gate} />;
  }
  if (state.kind === "onboarding") redirect("/onboarding");

  const [notifications, homework] = await Promise.all([
    getNotifications(viewer.playerId),
    getHomework(viewer.playerId),
  ]);
  // The ring around the member's initials: this week's sessions done.
  const live = liveWeekFor(player?.week1_monday, player?.current_week);
  const maxBuilt = homework.reduce((m, h) => Math.max(m, h.week), 0);
  const week = Math.max(1, Math.min(live, maxBuilt || 1));
  const sessions = groupSessions(homework.filter((h) => h.week === week && !h.is_extra));
  const weekDone = sessions.length ? sessions.filter((s) => s.list.every((h) => h.completed)).length / sessions.length : 0;

  return (
    <div className="member-ui min-h-[100svh] bg-black text-bone lg:flex">
      <FreshOnReturn />
      {/* A phone that already said yes to notifications stays on file.
          The ask itself is on the finish screen of a session (A8). */}
      {!viewer.demo && <PushKeepAlive />}
      <MemberNav
        tabs={memberTabs(player?.tier).filter((t) => !keptOutOfThisApp(t.href))}
        name={viewer.profile.full_name}
        weekDone={weekDone}
        notifications={notifications}
      />
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:pb-12 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function GateScreen({ gate }: { gate: GateCopy }) {
  return (
    <div className="member-ui flex min-h-[100svh] flex-col items-center justify-center bg-black px-6 py-10 text-center text-bone">
      <Wordmark href={null} size="lg" />
      <h1 className="mt-8 m-head text-[34px] leading-none">
        {gate.title}
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">{gate.body}</p>
      {gate.startPro && <ProCheckoutButton className="mt-7 w-full max-w-xs" />}
      {gate.emailCoach && (
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="m-button mt-7 max-w-xs"
        >
          Email your coach
        </a>
      )}
      <form action={signOut} className={gate.emailCoach || gate.startPro ? "mt-3" : "mt-8"}>
        <button className="btn min-h-[44px] px-6 py-3">Sign out</button>
      </form>
      <Link href="/account" className="mt-2 inline-flex min-h-[44px] items-center px-3 text-sm text-white/60 underline-offset-4 hover:underline">
        Account
      </Link>
    </div>
  );
}
