import { getDrillBank, getPlayers, getSessionTemplates } from "@/lib/elite/data";
import { DrillBank } from "@/components/elite/DrillBank";
import { SessionTemplates } from "@/components/elite/SessionTemplates";
import { sessionsFor } from "@/lib/elite/training";

export const metadata = { title: "Drill bank · Strive Elite" };

// The coach's drill bank: the complete set of drills the AI may prescribe,
// plus the hand-built few-yards sessions (035).
export default async function DrillBankPage() {
  const [{ drills, fromDb }, templates, players] = await Promise.all([
    getDrillBank(),
    getSessionTemplates({ space: "tight", includeInactive: true }),
    getPlayers(),
  ]);
  // How many sessions a few-yards week needs: the biggest load on the
  // roster's tight-space players (4 In-Season, 6 Off-Season); 4 when none.
  const needed = Math.max(
    4,
    ...players.filter((p) => p.space === "tight").map((p) => sessionsFor(p.training_load))
  );

  return (
    <div className="space-y-8">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Coach tools
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Drill bank
        </h1>
      </header>
      <SessionTemplates templates={templates} bank={drills} needed={needed} />
      <DrillBank initial={drills} fromDb={fromDb} />
    </div>
  );
}
