import { redirect } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import { getPlayer } from "@/lib/elite/data";
import { Wordmark } from "@/components/elite/Wordmark";
import { OnboardingForm } from "@/components/elite/OnboardingForm";

export const metadata = { title: "Set up your profile · Strive Elite" };

// Standalone route (outside the player app shell, so the dashboard gate
// doesn't loop). Collects the full intake, then unlocks the dashboard.
export default async function OnboardingPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/onboarding");
  if (viewer.role !== "player" || !viewer.playerId) redirect("/coach");

  const player = await getPlayer(viewer.playerId);
  if (player?.onboarded_at) redirect("/dashboard");

  return (
    <div className="min-h-[100svh] bg-black text-bone">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <Wordmark href={null} size="lg" />
          <div className="mt-6 chip-accent inline-flex">Welcome to Strive Elite</div>
          <h1 className="mt-3 font-display text-3xl font-black uppercase tracking-tight sm:text-4xl">
            Let&apos;s build your profile
          </h1>
          <p className="mt-2 max-w-md text-white/55">
            A few quick things so your coach can plan every session around you.
            This takes two minutes and only happens once.
          </p>
        </div>
        <div className="mt-8">
          <OnboardingForm
            defaultName={player?.full_name ?? viewer.profile.full_name}
          />
        </div>
      </div>
    </div>
  );
}
