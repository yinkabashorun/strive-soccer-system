import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { Wordmark } from "@/components/elite/Wordmark";
import { OnboardingForm } from "@/components/elite/OnboardingForm";
import { gateFor } from "@/lib/elite/gates";
import { confirmProReturn } from "@/lib/elite/pro-server";
import { isPro } from "@/lib/elite/tiers";

export const metadata = { title: "Set up your profile · Strive Elite" };

// Standalone route (outside the player app shell, so the dashboard gate
// doesn't loop). Collects the full intake, then unlocks the dashboard.
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: { session_id?: string };
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
  if (player?.onboarded_at) redirect("/dashboard");
  // A Strive Pro member pays first, then takes this quiz: until the
  // membership is on, the member shell shows the checkout instead.
  if (!viewer.demo && gateFor(player?.subscription_status ?? "none", player?.tier)?.startPro) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-4 pb-10 pt-[calc(2.5rem+env(safe-area-inset-top))] sm:px-6">
        <div className="flex flex-col items-center text-center">
          <Wordmark href={null} size="lg" />
          <div className="mt-6 chip-accent inline-flex">
            {isPro(player?.tier) ? "Welcome to Strive Pro" : "Welcome to Strive Elite"}
          </div>
          <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Let&apos;s build your profile
          </h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white/65">
            A few quick things so your coach can plan every session around you.
            This takes two minutes and only happens once.
          </p>
        </div>
        <div className="mt-8">
          <OnboardingForm
            defaultName={player?.full_name ?? viewer.profile.full_name}
            // Already collected at signup - never ask for it twice.
            knownParentPhone={player?.parent_phone ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
