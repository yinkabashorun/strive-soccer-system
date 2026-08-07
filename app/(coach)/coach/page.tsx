import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Film,
  Users,
} from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import {
  getFilm,
  getHomework,
  getPlayers,
  getProgress,
  homeworkCompletion,
  overallProgress,
} from "@/lib/elite/data";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/elite/StatTile";
import { InvitePanel } from "@/components/elite/InvitePanel";
import { listInviteCodes } from "@/lib/elite/invite-actions";
import { cn, relativeDay } from "@/lib/utils";

export default async function CoachDashboard() {
  const viewer = await getViewer();
  const players = await getPlayers();

  const cards = await Promise.all(
    players.map(async (p) => {
      const [hw, progress, film] = await Promise.all([
        getHomework(p.id),
        getProgress(p.id),
        getFilm(p.id),
      ]);
      return {
        player: p,
        hwPct: homeworkCompletion(hw),
        overall: overallProgress(progress),
        filmCount: film.length,
        needsReview: film.filter((f) => f.status === "Uploaded").length,
      };
    })
  );

  const inviteCodes = await listInviteCodes();

  const avgHw =
    cards.length > 0
      ? Math.round(cards.reduce((s, c) => s + c.hwPct, 0) / cards.length)
      : 0;
  const totalReview = cards.reduce((s, c) => s + c.needsReview, 0);
  const active = players.filter(
    (p) => p.subscription_status === "active"
  ).length;

  const first = viewer?.profile.full_name.split(" ").slice(-1)[0] ?? "Coach";

  return (
    <div className="space-y-6">
      <header className="animate-fade-up">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Coach dashboard
        </div>
        <h1 className="mt-1 font-display text-3xl font-black sm:text-4xl">
          Your squad, {first}
        </h1>
        <p className="mt-2 text-white/50">
          Every player, at a glance. Tap a card to open their profile.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Players" value={players.length} sub="On the program" accent />
        <StatTile label="Active" value={active} sub="Paying members" />
        <StatTile label="Avg homework" value={`${avgHw}%`} sub="This week" />
        <StatTile label="Film to review" value={totalReview} sub="Awaiting notes" />
      </section>

      <InvitePanel initial={inviteCodes} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <Users className="h-4 w-4 text-accent" /> Roster
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map(({ player, hwPct, overall, filmCount, needsReview }) => (
            <Link
              key={player.id}
              href={`/coach/players/${player.id}`}
              className="group elite-card p-5 transition-all hover:border-white/15 hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-3">
                <Avatar name={player.full_name} color={player.avatar_color} size={46} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold text-bone">
                      {player.full_name}
                    </h3>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-accent" />
                  </div>
                  <div className="text-xs text-white/45">
                    Age {player.age} · {player.position}
                  </div>
                </div>
                <StatusDot status={player.subscription_status} />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Week" value={player.current_week} />
                <MiniStat label="Homework" value={`${hwPct}%`} highlight={hwPct >= 100} />
                <MiniStat label="Score" value={overall} />
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-xs text-white/45">
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {relativeDay(player.next_session_at)}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    needsReview > 0 && "text-accent"
                  )}
                >
                  <Film className="h-3.5 w-3.5" />
                  {needsReview > 0 ? `${needsReview} to review` : `${filmCount} clips`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] py-2">
      <div
        className={cn(
          "font-display text-xl font-black tabular-nums",
          highlight ? "text-accent" : "text-bone"
        )}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-white/40">
        {label}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-accent",
    trialing: "bg-blue-400",
    past_due: "bg-amber-400",
    canceled: "bg-white/20",
    none: "bg-white/20",
  };
  return (
    <span
      title={status}
      className={cn("h-2.5 w-2.5 shrink-0 rounded-full", map[status] ?? "bg-white/20")}
    />
  );
}
