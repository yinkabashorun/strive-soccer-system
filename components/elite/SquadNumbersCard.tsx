import Link from "next/link";
import { fmtCount, fmtWait, type Count, type SquadNumbers } from "@/lib/elite/squad-numbers";
import { cn } from "@/lib/utils";

// The seven numbers the app is built to move (lib/elite/squad-numbers.ts),
// on the first screen the coach opens: is a new player winning in the
// first week, and is everyone still winning after it. Under them, the
// players each number is pointing at, each a tap from their page. Coach
// side only; counted from what the app stores, never estimated.
const SHOWN = 6;

function Row({ label, count, note }: { label: string; count: Count; note?: string }) {
  const none = count.of === 0;
  const all = !none && count.n === count.of;
  return (
    <li className="flex items-baseline justify-between gap-4 py-2">
      <div className="min-w-0">
        <div className="text-sm text-white/80">{label}</div>
        {note ? <div className="mt-0.5 text-xs text-white/40">{note}</div> : null}
      </div>
      <div className={cn("shrink-0 font-display text-lg font-bold tabular-nums", none ? "text-white/30" : all ? "text-accent" : "text-bone")}>
        {fmtCount(count)}
      </div>
    </li>
  );
}

export function SquadNumbersCard({ numbers }: { numbers: SquadNumbers }) {
  const n = numbers;
  const flags = n.flags.slice(0, SHOWN);
  const more = n.flags.length - flags.length;
  return (
    <div className="elite-card p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">The numbers</div>
      <p className="mt-1.5 text-sm text-white/70">
        A player opens the app, trains, and sees proof they are getting better. These say whether that is happening.
      </p>

      <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">The first week</div>
          <ul className="mt-1 divide-y divide-white/6">
            <Row label="Started training" count={n.started} note={fmtWait(n.started.typicalDays) || "Did at least one drill."} />
            <Row label="Finished a first session" count={n.firstSession} />
            <Row label="Finished a whole week" count={n.firstWeek} note="Of players past their first week." />
          </ul>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">Every week</div>
          <ul className="mt-1 divide-y divide-white/6">
            <Row
              label="Sessions finished this week"
              count={n.thisWeekSessions}
              note={n.thisWeekPlayers.of > 0 ? `${fmtCount(n.thisWeekPlayers)} players have trained this week.` : undefined}
            />
            <Row label="Weeks trained" count={n.weeksTrained} note="Weeks with training in them, out of every week each player has had." />
            <Row label="A first clip and a later one" count={n.proof} note="Of players three weeks in or more." />
          </ul>
        </div>
      </div>

      <div className="mt-4 border-t border-white/6 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">Still a member</div>
        <ul className="mt-1.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
          {n.staying.map((s) => (
            <li key={s.week}>
              <span className="text-white/40">Week {s.week}: </span>
              <span className="tabular-nums">{fmtCount(s)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-white/40">Of everyone who started at least that long ago. A deleted account is not counted.</p>
      </div>

      <div className="mt-4 border-t border-white/6 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">Who to look at</div>
        {flags.length === 0 ? (
          <p className="mt-1.5 text-sm text-white/70">Nobody right now. Everyone who is training has trained in the last week.</p>
        ) : (
          <ul className="mt-1.5 space-y-1.5">
            {flags.map((f) => (
              <li key={`${f.id}:${f.reason}`}>
                <Link href={`/coach/players/${f.id}`} className="text-sm text-white/80 underline decoration-white/20 underline-offset-4 hover:decoration-white/60">
                  {f.reason}
                </Link>
              </li>
            ))}
            {more > 0 ? <li className="text-xs text-white/40">And {more} more.</li> : null}
          </ul>
        )}
      </div>
    </div>
  );
}
