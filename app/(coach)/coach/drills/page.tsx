import { getDrillBank } from "@/lib/elite/data";
import { DrillBank } from "@/components/elite/DrillBank";

export const metadata = { title: "Drill bank · Strive Elite" };

// The coach's drill bank: the complete set of drills the AI may prescribe.
export default async function DrillBankPage() {
  const { drills, fromDb } = await getDrillBank();

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Coach tools
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Drill bank
        </h1>
      </header>
      <DrillBank initial={drills} fromDb={fromDb} />
    </div>
  );
}
