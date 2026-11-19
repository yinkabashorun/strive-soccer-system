import {
  CheckCircle2,
  Eye,
  Flame,
  Sparkles,
  Target,
  Trophy,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Achievement } from "@/lib/elite/types";

const ICONS: Record<string, LucideIcon> = {
  Eye,
  CheckCircle2,
  Flame,
  Zap,
  Trophy,
  Sparkles,
  Target,
};

// What the player has earned, in gold, on the Progress page (it left Home
// on Nov 18 2026 so Home could be one screen). Every badge is something
// the app can prove from the training done, and none can be lost
// (lib/elite/achievement-rules.ts).
export function Achievements({ achievements }: { achievements: Achievement[] }) {
  if (achievements.length === 0) return null;
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
        <Trophy className="h-4 w-4 text-accent" /> Earned
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {achievements.map((a) => {
          const Icon = ICONS[a.icon] ?? Trophy;
          return (
            <li key={a.id} className="elite-card p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                <Icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-[15px] font-semibold leading-snug text-bone">{a.title}</div>
              <div className="mt-0.5 text-[13px] leading-snug text-white/60">{a.detail}</div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
