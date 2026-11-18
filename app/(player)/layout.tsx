import Link from "next/link";
import { redirect } from "next/navigation";
import { AppNav, type NavItem } from "@/components/elite/AppNav";
import { Wordmark } from "@/components/elite/Wordmark";
import { FreshOnReturn } from "@/components/elite/FreshOnReturn";
import { PushKeepAlive } from "@/components/elite/PushOptIn";
import { getViewer } from "@/lib/elite/session";
import { getNotifications, getPlayer } from "@/lib/elite/data";
import { signOut } from "@/lib/elite/auth-actions";
import { unlockDueWeeks } from "@/lib/elite/unlock";
import { AgreementScreen } from "@/components/elite/AgreementScreen";
import { consentDue } from "@/lib/elite/legal-server";
import { NO_PROFILE_GATE, membershipGate, type GateCopy } from "@/lib/elite/gates";
import { SUPPORT_EMAIL } from "@/lib/elite/support";

// Five tabs, the most an iPhone tab bar should carry (Apple HIG). Progress
// lives one tap away: the time-trained strip on Home and the Account page.
const PLAYER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "Home" },
  { href: "/homework", label: "Training", icon: "Clipboard" },
  { href: "/courses", label: "Courses", icon: "BookOpen" },
  { href: "/film", label: "Film", icon: "Film" },
  { href: "/messages", label: "Coach", icon: "MessageSquare" },
];

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
  if (!viewer.playerId) {
    return <GateScreen gate={NO_PROFILE_GATE} />;
  }

  // Agreement gate (068): a member who has not accepted the current Terms
  // and Privacy Policy does that first, once. New accounts accept at
  // sign-up; this catches everyone who joined before, and everyone again
  // when the terms change. The Account page (and deleting the account)
  // stays reachable without it.
  if (!viewer.demo && (await consentDue(viewer.profile.id))) {
    return <AgreementScreen signOut={signOut} />;
  }

  const player = await getPlayer(viewer.playerId);

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
  const gate = membershipGate(player?.subscription_status ?? "none");
  if (gate) return <GateScreen gate={gate} />;

  const notifications = await getNotifications(viewer.playerId);

  return (
    <div className="min-h-[100svh] bg-black text-bone lg:flex">
      <FreshOnReturn />
      {/* A phone that already said yes to notifications stays on file.
          The ask itself is on the finish screen of a session (A8). */}
      {!viewer.demo && <PushKeepAlive />}
      <AppNav
        items={PLAYER_NAV}
        name={viewer.profile.full_name}
        color={viewer.profile.avatar_color}
        roleLabel="Player"
        notifications={notifications}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:pb-12 lg:pt-8">
        {children}
      </main>
    </div>
  );
}

function GateScreen({ gate }: { gate: GateCopy }) {
  return (
    <div className="flex min-h-[100svh] flex-col items-center justify-center bg-black px-6 py-10 text-center text-bone">
      <Wordmark href={null} size="lg" />
      <h1 className="mt-8 font-display text-3xl font-black uppercase tracking-tight">
        {gate.title}
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/70">{gate.body}</p>
      {gate.emailCoach && (
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="mt-7 flex h-14 w-full max-w-xs items-center justify-center rounded-2xl bg-white font-display text-xl font-black uppercase tracking-wide text-black"
        >
          Email your coach
        </a>
      )}
      <form action={signOut} className={gate.emailCoach ? "mt-3" : "mt-8"}>
        <button className="btn min-h-[44px] px-6 py-3">Sign out</button>
      </form>
      <Link href="/account" className="mt-2 inline-flex min-h-[44px] items-center px-3 text-sm text-white/60 underline-offset-4 hover:underline">
        Account
      </Link>
    </div>
  );
}
