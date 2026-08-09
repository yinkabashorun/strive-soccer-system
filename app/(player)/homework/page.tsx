import { Clipboard } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getHomework, getPlayer } from "@/lib/elite/data";
import { HomeworkList } from "@/components/elite/HomeworkList";

export default async function HomeworkPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null;
  const player = await getPlayer(viewer.playerId);
  const homework = await getHomework(viewer.playerId);

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Week {player?.current_week} · Assigned by Coach Ramella
        </div>
        <h1 className="mt-1 flex items-center gap-2.5 font-display text-3xl font-black sm:text-4xl">
          <Clipboard className="h-7 w-7 text-accent" /> Homework
        </h1>
        <p className="mt-2 text-white/50">
          Complete each drill and check it off. Your progress updates the moment
          you do.
        </p>
      </header>

      <HomeworkList items={homework} />
    </div>
  );
}
