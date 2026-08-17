import Link from "next/link";
import {
  CalendarClock,
  Clipboard,
  Flame,
  MessageSquare,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
  Eye,
  CheckCircle2,
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
  getProgress,
  overallProgress,
} from "@/lib/elite/data";
import { ProgressRing } from "@/components/elite/ProgressRing";
import { WeekList } from "@/components/elite/WeekList";
import { CheckinCard } from "@/components/elite/CheckinCard";
import { StatTile } from "@/components/elite/StatTile";
import { greeting, relativeDay, timeAgo } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Eye,
  CheckCircle2,
  Flame,
  Zap,
  Trophy,
  Sparkles,
  Target,
};

export default async function DashboardPage() {
  const viewer = await getViewer();
  if (!viewer?.playerId) return null; // layout renders the "almost there" state

  const player = await getPlayer(viewer.playerId);
  if (!player) return null;

  const [homework, progress, achievements, messages, summary, checkins] =
    await Promise.all([
      getHomework(player.id),
      getProgress(player.id),
      getAchievements(player.id),
      getMessages(player.id),
      getPlayerSummary(player.id),
      getCheckins(player.id),
    ]);

  const checkedInThisWeek = checkins.some(
    (c) => c.week === player.current_week
  );

  const overall = overallProgress(progress);
  const latestMessage = messages[0];
  const firstName = player.full_name.split(" ")[0];

  // Only show numbers that mean something. No training assigned yet → no
  // stat zeros; no ratings yet → no 0% ring; no session booked → no card.
  const hasTraining = homework.length > 0;
  const hasRatings = progress.length > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Week {player.current_week} · {player.level}
          </div>
          <h1 className="mt-1 font-display text-3xl font-black leading-none sm:text-4xl">
            {greeting()}, {firstName}
          </h1>
        </div>
        {hasRatings && (
          <ProgressRing value={overall} size={78} stroke={7} sublabel="Overall" />
        )}
      </header>

      {/* Today's focus */}
      <section className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-br from-accent/[0.09] to-transparent p-5 sm:p-6 animate-fade-up">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            <Target className="h-3.5 w-3.5" /> Today&apos;s focus
          </div>
          <p className="mt-2 text-xl font-semibold leading-snug text-bone sm:text-2xl">
            {player.today_focus}
          </p>
        </div>
      </section>

      {/* Loop metrics — only once real training exists to measure */}
      {hasTraining && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Streak"
            value={summary.current_streak}
            sub={summary.current_streak === 1 ? "day" : "days in a row"}
            accent
          />
          <StatTile
            label="Sessions"
            value={summary.sessions_completed}
            sub="Weeks completed"
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

      {/* This week + upcoming/coach column */}
      <div className="grid gap-5 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <SectionHead icon={Clipboard} title="This week" href="/homework" />
          <WeekList
            items={homework}
            currentWeek={player.current_week}
            showPast={false}
          />
        </section>

        <div className="space-y-5 lg:col-span-2">
          {/* Upcoming session — only when one is actually booked */}
          {player.next_session_at && (
            <section className="elite-card p-5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                <CalendarClock className="h-3.5 w-3.5" /> Next session
              </div>
              <div className="mt-2 font-display text-2xl font-black">
                {relativeDay(player.next_session_at)}
              </div>
              <div className="mt-1 text-sm text-white/50">
                1-on-1 with your coach
              </div>
            </section>
          )}

          {/* Coach message */}
          {latestMessage && (
            <section className="elite-card p-5">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
                <MessageSquare className="h-3.5 w-3.5" /> From your coach
              </div>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                “{latestMessage.body}”
              </p>
              <div className="mt-2 text-xs text-white/35">
                {timeAgo(latestMessage.created_at)}
              </div>
            </section>
          )}

          {/* Weekly check-in */}
          <CheckinCard week={player.current_week} alreadyDone={checkedInThisWeek} />

          {/* Plyometrics reminder */}
          <section className="rounded-3xl border border-red-500/20 bg-red-500/[0.04] p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300">
              <Flame className="h-3.5 w-3.5" /> Every session starts here
            </div>
            <p className="mt-2 text-sm leading-relaxed text-white/75">
              Begin all four sessions with your plyometric warm-up — right in
              your room. Explosive, springy, soft landings. This is what turns
              training into results.
            </p>
          </section>
        </div>
      </div>

      {/* Achievements */}
      {achievements.length > 0 && (
        <section>
          <SectionHead icon={Trophy} title="Recent achievements" />
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

function SectionHead({
  icon: Icon,
  title,
  href,
}: {
  icon: LucideIcon;
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
        <Icon className="h-4 w-4 text-accent" /> {title}
      </h2>
      {href && (
        <Link
          href={href}
          className="text-xs font-medium text-white/45 hover:text-accent"
        >
          View all →
        </Link>
      )}
    </div>
  );
}
