import Link from "next/link";
import { ArrowUpRight, Clock, Flame, Users } from "lucide-react";
import { getViewer } from "@/lib/elite/session";
import { getCoachInbox, getCoachRoster } from "@/lib/elite/data";
import { Avatar } from "@/components/Avatar";
import { StatTile } from "@/components/elite/StatTile";
import { InvitePanel } from "@/components/elite/InvitePanel";
import { listInviteCodes } from "@/lib/elite/invite-actions";
import { cn, relativeDay } from "@/lib/utils";

export default async function CoachDashboard() {
  const viewer = await getViewer();

  // One-call rollup: every player + their loop metrics + what needs a reply.
  const [roster, inviteCodes, inbox] = await Promise.all([
    getCoachRoster(),
    listInviteCodes(),
    getCoachInbox(),
  ]);

  const avgHw =
    roster.length > 0
      ? Math.round(roster.reduce((s, r) => s + r.homework_pct, 0) / roster.length)
      : 0;
  const active = roster.filter((r) => r.subscription_status === "active").length;
  const toAnswer = inbox.pendingCheckins + inbox.unreadMessages;

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
        <StatTile label="Players" value={roster.length} sub="On the program" accent />
        <StatTile label="Active" value={active} sub="Paying members" />
        <StatTile label="Avg homework" value={`${avgHw}%`} sub="Completion" />
        <StatTile
          label="To answer"
          value={toAnswer}
          sub="Check-ins + messages"
          accent={toAnswer > 0}
        />
      </section>

      <InvitePanel initial={inviteCodes} />

      <section>
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
          <Users className="h-4 w-4 text-accent" /> Roster
        </h2>

        {roster.length === 0 ? (
          <div className="elite-card p-8 text-center text-white/45">
            No players yet. Generate an invite code above and send it to your
            first client — they&apos;ll appear here the moment they sign up.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {roster.map((r) => {
              const needs = inbox.byPlayer[r.player_id];
              const needsCount = needs ? needs.checkins + needs.messages : 0;
              return (
              <Link
                key={r.player_id}
                href={`/coach/players/${r.player_id}`}
                className="group elite-card p-5 transition-all hover:border-white/15 hover:bg-white/[0.03]"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={r.full_name} color={r.avatar_color} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold text-bone">
                        {r.full_name}
                      </h3>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 transition-colors group-hover:text-accent" />
                    </div>
                    <div className="text-xs text-white/45">
                      Week {r.current_week}
                    </div>
                  </div>
                  {needsCount > 0 && (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-black">
                      {needsCount} new
                    </span>
                  )}
                  <StatusDot status={r.subscription_status} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <MiniStat
                    label="Streak"
                    value={r.current_streak}
                    highlight={r.current_streak > 0}
                  />
                  <MiniStat
                    label="Homework"
                    value={`${r.homework_pct}%`}
                    highlight={r.homework_pct >= 100}
                  />
                  <MiniStat label="Sessions" value={r.sessions_completed} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/6 pt-3 text-xs text-white/45">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {r.training_minutes} min trained
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5",
                      r.current_streak > 0 && "text-accent"
                    )}
                  >
                    <Flame className="h-3.5 w-3.5" />
                    {r.last_active ? relativeDay(r.last_active) : "No activity"}
                  </span>
                </div>
              </Link>
              );
            })}
          </div>
        )}
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
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        map[status] ?? "bg-white/20"
      )}
    />
  );
}
