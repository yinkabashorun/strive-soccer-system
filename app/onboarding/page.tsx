import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { QuizFlow } from "@/components/elite/QuizFlow";
import { gateFor } from "@/lib/elite/gates";
import { confirmProReturn } from "@/lib/elite/pro-server";
import { isPro } from "@/lib/elite/tiers";
import { cardName, cardTierLabel, memberSinceLabel } from "@/lib/elite/experience";
import { setupSteps, type SetupStep } from "@/lib/elite/account-profile";
import { suggestUsernames } from "@/lib/elite/account-profile-server";
import { usernameIdeas } from "@/lib/elite/username";
import { initials } from "@/lib/utils";

export const metadata = { title: "Welcome · Strive Elite" };

// The building screen waits on the member's first week being built here
// (lib/elite/first-week-actions.ts), which can take a while; the screen
// itself stops waiting sooner and says so (FIRST_WEEK_WAIT_MS).
export const maxDuration = 120;

// Standalone route (outside the player app shell, so the dashboard gate
// doesn't loop). The first minutes of membership (Nov 21 2026): the door
// with the member card, the quiz one question a screen, then building and
// the week. It collects the full intake, then unlocks the dashboard.
//
// The example player is already set up; with ?tour=1 they can walk the
// same screens (nothing is saved, the week shown is the example week).
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { session_id?: string; tour?: string };
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.role !== "player" || !viewer.playerId) redirect("/coach");

  let player = await getPlayer(viewer.playerId);
  // Back from the Strive Pro checkout (074): Stripe's own word on the
  // session switches the membership on now, if the webhook is still on its
  // way (lib/elite/pro-server.ts confirmProReturn).
  const sessionId = searchParams?.session_id;
  if (!viewer.demo && sessionId && player && isPro(player.tier) && player.subscription_status !== "active") {
    if (await confirmProReturn(viewer.profile.id, sessionId)) player = await getPlayer(viewer.playerId);
  }
  const tour = viewer.demo && searchParams?.tour === "1";
  if (player?.onboarded_at && !tour) redirect("/dashboard");
  // A Strive Pro member pays first, then takes this quiz: until the
  // membership is on, the member shell shows the checkout instead.
  if (!viewer.demo && gateFor(player?.subscription_status ?? "none", player?.tier)?.startPro) {
    redirect("/dashboard");
  }

  const fullName = player?.full_name ?? viewer.profile.full_name;
  // The @username and the profile photo (081): the quiz's last screens,
  // both required. The example tour walks them too (nothing is saved);
  // nothing is owed before 081 is applied.
  const steps: SetupStep[] = tour ? ["username", "photo"] : setupSteps(viewer.setup);
  const ideas = !steps.includes("username")
    ? []
    : viewer.demo
      ? usernameIdeas(fullName).slice(0, 3)
      : await suggestUsernames(viewer.profile.id, fullName).catch(() => []);
  return (
    <div className="member-ui min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-md">
        <QuizFlow
          firstName={fullName.split(" ")[0]}
          cardName={cardName(fullName)}
          since={memberSinceLabel(player?.joined_at)}
          tier={cardTierLabel(player?.tier)}
          // Already collected at signup - never ask for it twice.
          knownParentPhone={player?.parent_phone ?? ""}
          setup={{ steps, ideas, initials: initials(fullName) }}
        />
      </div>
    </div>
  );
}
