import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Film as FilmIcon,
  MessageSquare,
  StickyNote,
  Target,
  Users,
} from "lucide-react";
import {
  getFilm,
  getHomework,
  getMessages,
  getNotes,
  getParentReports,
  getPlayer,
  getProgress,
  homeworkCompletion,
} from "@/lib/elite/data";
import {
  addCoachNote,
  sendCoachMessage,
  setFilmNotes,
} from "@/lib/elite/coach-actions";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/elite/StatTile";
import { ProgressPanel } from "@/components/elite/ProgressPanel";
import { SessionNotesStudio } from "@/components/elite/SessionNotesStudio";
import { EditableChips } from "@/components/elite/EditableChips";
import { QuickComposer } from "@/components/elite/QuickComposer";
import { StatusControl } from "@/components/elite/StatusControl";
import { cn, formatSessionDate, relativeDay, timeAgo } from "@/lib/utils";

export default async function PlayerProfile({
  params,
}: {
  params: { id: string };
}) {
  const player = await getPlayer(params.id);
  if (!player) notFound();

  const [homework, progress, notes, messages, film, reports] = await Promise.all([
    getHomework(player.id),
    getProgress(player.id),
    getNotes(player.id),
    getMessages(player.id),
    getFilm(player.id),
    getParentReports(player.id),
  ]);

  const hwPct = homeworkCompletion(homework);

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
              Age {player.age} · {player.position} · {player.level} · Week{" "}
              {player.current_week}
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

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Homework" value={`${hwPct}%`} sub="This week" accent />
        <StatTile label="Film" value={film.length} sub="Clips uploaded" />
        <StatTile
          label="Last session"
          value={relativeDay(player.last_session_at)}
          sub={player.last_session_at ? "" : "—"}
        />
        <StatTile
          label="Next session"
          value={relativeDay(player.next_session_at)}
          sub=""
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-3">
          <SessionNotesStudio playerId={player.id} />

          <section>
            <h2 className="mb-3 font-display text-xl font-bold uppercase tracking-tight">
              Progress
            </h2>
            <ProgressPanel progress={progress} />
          </section>

          {/* Film review */}
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
              <FilmIcon className="h-4 w-4 text-accent" /> Film
            </h2>
            {film.length === 0 ? (
              <div className="elite-card p-6 text-sm text-white/45">
                No film uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {film.map((f) => (
                  <div key={f.id} className="elite-card p-5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold text-bone">{f.title}</span>
                      <span className="text-xs text-white/40">
                        {timeAgo(f.created_at)}
                      </span>
                    </div>
                    {f.coach_notes ? (
                      <p className="mt-2 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-sm text-white/70">
                        {f.coach_notes}
                      </p>
                    ) : (
                      <div className="mt-3">
                        <QuickComposer
                          action={setFilmNotes.bind(null, f.id, player.id)}
                          placeholder="Add coach notes tied to this film…"
                          cta="Save notes"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

          {/* Today's focus */}
          <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              <Target className="h-3.5 w-3.5" /> Today&apos;s focus
            </div>
            <p className="mt-1.5 font-medium text-bone">{player.today_focus}</p>
          </div>

          {/* Sessions */}
          <div className="elite-card p-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <CalendarClock className="h-3.5 w-3.5" /> Sessions
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Row label="Next" value={formatSessionDate(player.next_session_at)} />
              <Row label="Last" value={formatSessionDate(player.last_session_at)} />
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

          {/* Message player */}
          <div className="elite-card p-5">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
              <MessageSquare className="h-3.5 w-3.5" /> Message {player.full_name.split(" ")[0]}
            </div>
            <QuickComposer
              action={sendCoachMessage.bind(null, player.id)}
              placeholder="Send an encouraging message…"
              cta="Send"
            />
            {messages.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-white/6 pt-3">
                {messages.slice(0, 3).map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="text-white/70">{m.body}</span>
                    <span className="ml-1 text-xs text-white/30">
                      · {timeAgo(m.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coach notes */}
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
