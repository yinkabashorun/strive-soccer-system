import Link from "next/link";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/elite/session";
import {
  ArrowLeft,
  CalendarClock,
  Clapperboard,
  MessageSquare,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
import {
  getCheckins,
  getFilm,
  getGames,
  getHomework,
  getMessages,
  getNotes,
  getParentReports,
  getPlayer,
  getPlayerSummary,
  getProgress,
  getWeeklyPlans,
} from "@/lib/elite/data";
import { fmtMonday, nextMondayNY } from "@/lib/elite/time";
import { addCoachNote, sendCoachMessage } from "@/lib/elite/coach-actions";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/elite/StatTile";
import { ProgressPanel } from "@/components/elite/ProgressPanel";
import { CoachWeekView } from "@/components/elite/CoachWeekView";
import { SessionNotesStudio } from "@/components/elite/SessionNotesStudio";
import { WeekRecapCard } from "@/components/elite/WeekRecapCard";
import { buildWeekRecap } from "@/lib/elite/recap";
import { EditableChips } from "@/components/elite/EditableChips";
import { EditableMemory } from "@/components/elite/EditableMemory";
import { CheckinsPanel } from "@/components/elite/CheckinsPanel";
import { CoachFilmPanel } from "@/components/elite/CoachFilmPanel";
import { CoachGamesPanel } from "@/components/elite/CoachGamesPanel";
import { MessageThread } from "@/components/elite/MessageThread";
import { IntakePanel } from "@/components/elite/IntakePanel";
import { QuickComposer } from "@/components/elite/QuickComposer";
import { StatusControl } from "@/components/elite/StatusControl";
import { DuplicateWeekButton } from "@/components/elite/DuplicateWeekButton";
import { cn, formatSessionDate, relativeDay, timeAgo } from "@/lib/utils";

export default async function PlayerProfile({
  params,
}: {
  params: { id: string };
}) {
  const viewer = await getViewer();
  const player = await getPlayer(params.id);
  if (!player) notFound();

  const [homework, progress, notes, messages, reports, summary, checkins, plans, films, games] =
    await Promise.all([
      getHomework(player.id),
      getProgress(player.id),
      getNotes(player.id),
      getMessages(player.id),
      getParentReports(player.id),
      getPlayerSummary(player.id),
      getCheckins(player.id),
      getWeeklyPlans(player.id),
      getFilm(player.id),
      getGames(player.id),
    ]);

  // A week approved but not yet unlocked (drops Monday morning VA time).
  const scheduled = plans.find(
    (p) =>
      p.week > player.current_week &&
      p.unlocks_at &&
      new Date(p.unlocks_at).getTime() > Date.now()
  );

  async function sendMessage(body: string) {
    "use server";
    return sendCoachMessage(player!.id, body);
  }

  // this-week session completion
  const thisWeek = homework.filter((h) => h.week === player.current_week);
  const sess = new Map<number, boolean>();
  const sessAll = new Map<number, boolean[]>();
  for (const h of thisWeek) {
    const s = h.session ?? 1;
    const arr = sessAll.get(s) ?? [];
    arr.push(h.completed);
    sessAll.set(s, arr);
  }
  for (const [s, arr] of sessAll) sess.set(s, arr.every(Boolean));
  const totalSessions = sessAll.size || 0;
  const doneSessions = [...sess.values()].filter(Boolean).length;

  // Last week's accountability recap for the parent (null in week 1).
  const recap = buildWeekRecap(player, homework);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/coach"
          className="inline-flex items-center gap-1.5 text-sm text-white/45 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Roster
        </Link>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Avatar name={player.full_name} color={player.avatar_color} size={64} />
          <div className="flex-1">
            <h1 className="font-display text-3xl font-black leading-none sm:text-4xl">
              {player.full_name}
            </h1>
            <div className="mt-1.5 text-sm text-white/50">
              {player.age ? `Age ${player.age} · ` : ""}
              {player.position || "Player"} · Week {player.current_week} · Last
              active {summary.last_active ? relativeDay(summary.last_active) : "-"}
            </div>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
              player.subscription_status === "active"
                ? "border-accent/30 text-accent"
                : player.subscription_status === "trialing"
                  ? "border-blue-400/30 text-blue-300"
                  : "border-white/15 text-white/50"
            )}
          >
            {player.subscription_status}
          </span>
        </div>
      </div>

      {/* Snapshot - real numbers once training exists; a clear next step
          before then, not a row of zeros. */}
      {homework.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Streak"
            value={summary.current_streak}
            sub={summary.current_streak === 1 ? "day" : "days"}
            accent
          />
          <StatTile
            label="This week"
            value={`${doneSessions}/${totalSessions || 4}`}
            sub="Sessions done"
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
        </div>
      ) : (
        <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5 text-sm text-white/70">
          No training assigned yet. Type your session notes below and build
          their first week.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-3">
          {/* This week - are they doing the work */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
              <CalendarClock className="h-4 w-4 text-accent" /> This week
            </h2>
            {scheduled && (
              <div className="mb-3 rounded-2xl border border-accent/25 bg-accent/[0.05] px-4 py-3 text-sm text-white/75">
                Week {scheduled.week} is approved and scheduled. Unlocks{" "}
                {fmtMonday(nextMondayNY())} morning. Re-publish below anytime
                before then to change it.
              </div>
            )}
            <CoachWeekView
              homework={homework}
              currentWeek={player.current_week}
            />
          </section>

          {/* Weekly check-ins - the player's own words */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
              <MessageSquare className="h-4 w-4 text-accent" /> Weekly check-ins
            </h2>
            <CheckinsPanel playerId={player.id} checkins={checkins} />
          </section>

          {/* Monthly film review */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
              <Clapperboard className="h-4 w-4 text-accent" /> Monthly film
            </h2>
            <CoachFilmPanel playerId={player.id} films={films} />
          </section>

          {/* Upcoming games - pull up to NoVA ones */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
              <CalendarClock className="h-4 w-4 text-accent" /> Upcoming games
            </h2>
            <CoachGamesPanel playerId={player.id} games={games} />
          </section>

          {/* Last week's parent recap - the accountability text */}
          {recap && <WeekRecapCard recap={recap} />}

          {/* Build next week */}
          <SessionNotesStudio playerId={player.id} />

          {/* Progress */}
          <section>
            <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-tight">
              Progress
            </h2>
            <ProgressPanel progress={progress} />
          </section>

          {/* Parent reports */}
          {reports.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
                <Users className="h-4 w-4 text-accent" /> Parent reports
              </h2>
              <div className="space-y-3">
                {reports.map((r) => (
                  <div key={r.id} className="elite-card p-5">
                    <ReportRow label="Summary" value={r.summary} />
                    <ReportRow label="Improvement" value={r.improvement} />
                    <ReportRow label="Homework" value={r.homework} />
                    <ReportRow label="Next focus" value={r.next_focus} />
                    <div className="mt-2 text-xs text-white/35">
                      {timeAgo(r.created_at)} · ready to send
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Side column */}
        <div className="space-y-5 lg:col-span-2">
          <StatusControl
            playerId={player.id}
            initial={player.subscription_status}
          />

          {/* AI memory note - steers every generated week */}
          <EditableMemory
            playerId={player.id}
            initial={player.coach_memory ?? ""}
          />

          {/* Intake snapshot */}
          <IntakePanel player={player} />

          <DuplicateWeekButton
            playerId={player.id}
            currentWeek={player.current_week}
          />

          {/* This week's focus */}
          <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              <Target className="h-3.5 w-3.5" /> This week&apos;s focus
            </div>
            <p className="mt-1.5 font-medium text-bone">
              {player.today_focus || "Not set yet. Build a plan below."}
            </p>
          </div>

          <EditableChips
            playerId={player.id}
            field="goals"
            label="Goals"
            initial={player.goals}
            accent
          />
          <EditableChips
            playerId={player.id}
            field="strengths"
            label="Strengths"
            initial={player.strengths}
          />
          <EditableChips
            playerId={player.id}
            field="weaknesses"
            label="Weaknesses"
            initial={player.weaknesses}
          />

          {/* Message player - full thread */}
          <div className="elite-card p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <MessageSquare className="h-3.5 w-3.5" /> Message{" "}
              {player.full_name.split(" ")[0]}
            </div>
            <MessageThread
              messages={messages}
              meRole="coach"
              meName={viewer?.profile.full_name ?? "Coach"}
              send={sendMessage}
              placeholder="Send an encouraging message…"
            />
          </div>

          {/* Private notes */}
          <div className="elite-card p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <StickyNote className="h-3.5 w-3.5" /> Private notes
            </div>
            <QuickComposer
              action={addCoachNote.bind(null, player.id)}
              placeholder="Add a coaching note…"
              cta="Add note"
            />
            {notes.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-white/6 pt-3">
                {notes.map((n) => (
                  <div key={n.id} className="text-sm text-white/70">
                    {n.body}
                    <span className="ml-1 text-xs text-white/30">
                      · {timeAgo(n.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sessions dates */}
          <div className="elite-card p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <CalendarClock className="h-3.5 w-3.5" /> 1-on-1 sessions
            </div>
            <div className="mt-3 space-y-2 text-sm">
              {/* Only real dates - no "to be scheduled" filler rows. */}
              {player.next_session_at && (
                <Row label="Next" value={formatSessionDate(player.next_session_at)} />
              )}
              {player.last_session_at && (
                <Row label="Last" value={formatSessionDate(player.last_session_at)} />
              )}
              <Row
                label="Joined"
                value={new Date(player.joined_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-white/40">{label}</span>
      <span className="text-right text-white/75">{value}</span>
    </div>
  );
}

function ReportRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mb-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        {label}
      </div>
      <p className="mt-0.5 text-sm leading-relaxed text-white/70">{value}</p>
    </div>
  );
}
