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
import { NO_PROFILE_GATE, gateFor, type GateCopy } from "@/lib/elite/gates";
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
  if (!viewer.playerId) {
    const tracker = viewer.demo ? null : await getTracker(viewer.profile.id);
    if (tracker) redirect(freeLanding(quizDone(tracker)));
    return <GateScreen gate={NO_PROFILE_GATE} />;
  }

  // Agreement gate (068): a member who has not accepted the current Terms
  // and Privacy Policy does that first, once. New accounts accept at
  // sign-up; this catches everyone who joined before, and everyone again
  // when the terms change. The Account page (and deleting the account)
  // stays reachable without it.
  if (!viewer.demo && (await consentDue(viewer.profile.id))) {
    return (
      <div className="member-ui">
        <AgreementScreen signOut={signOut} />
      </div>
    );
  }

  const player = await getPlayer(viewer.playerId);

  // A Strive Pro member (074) pays first, then takes the quiz: an unpaid
  // or ended Pro membership sees the checkout before onboarding.
  const gate = gateFor(player?.subscription_status ?? "none", player?.tier);
  if (gate?.startPro) return <GateScreen gate={gate} />;

  // Onboarding gate: a redeemed player who hasn't completed intake is sent
  // to the standalone onboarding flow first (demo players are pre-onboarded).
  // Strict `=== null` so that before 012 is applied (column absent → the key
  // is undefined) we degrade to the old behavior instead of trapping players.
  if (!viewer.demo && player && player.onboarded_at === null) {
    redirect("/onboarding");
  }

  // Membership gate: access requires an active/trialing subscription. This
  // lets the coach revoke access by flipping a player to inactive. A
  // membership that was never switched on and one that was paused read
  // differently (lib/elite/gates.ts).
  if (gate) return <GateScreen gate={gate} />;

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
      <main className="relative mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:px-6 lg:pb-12 lg:pt-8">
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
