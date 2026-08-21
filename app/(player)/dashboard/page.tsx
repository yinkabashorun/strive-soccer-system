import Link from "next/link";
import {
  Flame,
  MessageSquare,
  Sparkles,
  Trophy,
  type LucideIcon,
  Eye,
  CheckCircle2,
  Target,
  Zap,
} from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import {
  getAchievements,
  getCheckins,
  getHomework,
  getMessages,
  getPlayer,
  getPlayerSummary,
  getWeeklyPlans,
} from "@/lib/elite/data";
import { TodaySession, VictoryLap } from "@/components/elite/TodaySession";
import { CheckinCard } from "@/components/elite/CheckinCard";
import { StatTile } from "@/components/elite/StatTile";
import { fmtMonday, nextMondayNY } from "@/lib/elite/time";
import { greeting, timeAgo } from "@/lib/utils";
import { TourGuide } from "@/components/elite/TourGuide";

const ICONS: Record<string, LucideIcon> = {
  Eye,
  CheckCircle2,
  Flame,
  Zap,
  Trophy,
  Sparkles,
  Target,
};

// The player's home: one thing on screen - today's session. Everything
// else earns its place below or lives behind a tab.
export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null; // layout renders the "almost there" state

  const player = await getPlayer(viewer.playerId);
  if (!player) return null;

  const [allHomework, achievements, messages, summary, checkins, plans] =
    await Promise.all([
      getHomework(player.id),
      getAchievements(player.id),
      getMessages(player.id),
      getPlayerSummary(player.id),
      getCheckins(player.id),
      getWeeklyPlans(player.id),
    ]);

  const firstName = player.full_name.split(" ")[0];

  // Only unlocked weeks exist for the player.
  const homework = allHomework.filter((h) => h.week <= player.current_week);
  const thisWeek = homework.filter((h) => h.week === player.current_week);

  // Group the live week into its sessions; the hero is the first session
  // with anything left to do.
  const bySession = new Map<number, typeof thisWeek>();
  for (const h of thisWeek) {
    const s = h.session ?? 1;
    bySession.set(s, [...(bySession.get(s) ?? []), h]);
  }
  const sessions = [...bySession.entries()]
    .map(([n, list]) => ({ n, list: [...list].sort((a, b) => a.sort - b.sort) }))
    .sort((a, b) => a.n - b.n);
  const current = sessions.find((s) => s.list.some((h) => !h.completed));
  const weekDone = sessions.length > 0 && !current;

  // What to say about next week - never a false "it's ready".
  const nextScheduled = plans.find(
    (p) =>
      p.week > player.current_week &&
      p.unlocks_at &&
      new Date(p.unlocks_at).getTime() > Date.now()
  );
  const nextWeekLine = nextScheduled
    ? `Week ${nextScheduled.week} unlocks ${fmtMonday(nextMondayNY())}.`
    : `Your coach is building week ${player.current_week + 1}. It drops Monday.`;

  const latestMessage = messages[0];
  const checkedInThisWeek = checkins.some(
    (c) => c.week === player.current_week
  );

  return (
    <div className="space-y-5">
      {viewer.demo && <TourGuide page="home" />}

      {/* Header - name + streak, nothing else */}
      <header className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Week {player.current_week} · {player.level}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black leading-none sm:text-4xl">
            {greeting()}, {firstName}
          </h1>
        </div>
        {summary.current_streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.07] px-3.5 py-2">
            <Flame className="h-4 w-4 text-accent" />
            <span className="font-display text-xl font-black text-accent">
              {summary.current_streak}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-white/50">
              day{summary.current_streak === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </header>

      {/* THE thing: today's session (or the victory lap) */}
      {weekDone ? (
        <VictoryLap
          week={player.current_week}
          firstName={firstName}
          minutes={summary.training_minutes}
          streak={summary.current_streak}
          nextWeekLine={nextWeekLine}
        />
      ) : current ? (
        <TodaySession
          session={current.n}
          totalSessions={sessions.length || 4}
          drills={current.list}
          firstName={firstName}
        />
      ) : (
        <section className="elite-card p-6 text-center">
          <p className="font-display text-xl font-black uppercase">
            Your first week is coming, {firstName}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-white/50">
            Your coach is building it around your profile right now. You&apos;ll
            get a notification the moment it&apos;s live.
          </p>
        </section>
      )}

      {/* Full week, one tap away */}
      {sessions.length > 0 && (
        <Link
          href="/homework"
          className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 text-sm text-white/60 transition-colors hover:border-white/15 hover:text-bone"
        >
          <span>
            Full week ·{" "}
            {sessions.filter((s) => s.list.every((h) => h.completed)).length}/
            {sessions.length} sessions done
          </span>
          <span className="text-accent">→</span>
        </Link>
      )}

      {/* Check-in appears once the week is conquered */}
      {(weekDone || checkedInThisWeek) && (
        <CheckinCard
          week={player.current_week}
          alreadyDone={checkedInThisWeek}
          firstName={firstName}
        />
      )}

      {/* Compact truth strip */}
      {homework.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          <StatTile
            label="Sessions"
            value={summary.sessions_completed}
            sub="Completed"
          />
          <StatTile
            label="Homework"
            value={`${summary.homework_pct}%`}
            sub="Completion"
          />
          <StatTile
            label="Minutes"
            value={summary.training_minutes}
            sub="Trained"
          />
        </section>
      )}

      {/* Coach's latest word */}
      {latestMessage && (
        <Link href="/messages" className="block">
          <section className="elite-card p-5 transition-colors hover:border-white/15">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <MessageSquare className="h-3.5 w-3.5" /> From your coach
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              “{latestMessage.body}”
            </p>
            <div className="mt-2 text-xs text-white/35">
              {timeAgo(latestMessage.created_at)} · Reply →
            </div>
          </section>
        </Link>
      )}

      {/* Earned, in gold */}
      {achievements.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
            <Trophy className="h-4 w-4 text-accent" /> Recent achievements
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {achievements.slice(0, 3).map((a) => {
              const Icon = ICONS[a.icon] ?? Trophy;
              return (
                <div key={a.id} className="elite-card p-4">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 font-semibold text-bone">{a.title}</div>
                  <div className="mt-0.5 text-xs text-white/45">{a.detail}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
