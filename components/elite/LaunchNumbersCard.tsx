import {
  ACTIVATED_RULE,
  activatedLine,
  fmtCameBack,
  fmtTypical,
  type LaunchNumbers,
  type LaunchWindow,
} from "@/lib/elite/launch-numbers";
import { fmtCount, type Count } from "@/lib/elite/squad-numbers";
import { cn } from "@/lib/utils";

// The launch numbers (lib/elite/launch-numbers.ts) at the top of the
// coach's free page: is a new player getting going, and is each club its
// own small network yet. Counts and club names only; no player is named
// or ranked. Coach side only; counted from what the app stores, never
// estimated.

const tone = (c?: Count) => {
  if (!c) return "text-bone";
  if (c.of === 0) return "text-white/30";
  return c.n === c.of ? "text-accent" : "text-bone";
};
// A count is set big; words ("Too early to tell", "Under an hour") smaller,
// so they sit on one line in the same column.
const size = (text: string) => (text.length > 9 ? "text-xs font-semibold sm:text-sm" : "font-display text-base font-bold sm:text-lg");
const COL = "w-28 shrink-0 text-right sm:w-32";

function Row({ label, note, recent, all }: { label: string; note?: string; recent: [string, Count?]; all: [string, Count?] }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-5 py-2">
      <div className="min-w-0">
        <div className="text-sm text-white/80">{label}</div>
        {note ? <div className="mt-0.5 text-xs text-white/40">{note}</div> : null}
      </div>
      {[recent, all].map(([text, count], i) => (
        <div
          key={i}
          className={cn(COL, "tabular-nums", size(text), tone(count))}
        >
          {text}
        </div>
      ))}
    </li>
  );
}

const count = (c: Count): [string, Count] => [fmtCount(c), c];
const cameBack = (w: LaunchWindow): [string, Count] => [fmtCameBack(w.cameBack), w.cameBack];

export function LaunchNumbersCard({ numbers }: { numbers: LaunchNumbers }) {
  const { last30: r, allTime: a, clubs } = numbers;
  return (
    <div className="elite-card mt-6 p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Launch numbers</div>
      <p className="mt-1.5 text-sm text-white/70">
        A new player joins, sets up, finds their club and posts a timed training. These say whether that is happening.
      </p>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">
        <div>New players</div>
        <div className={COL}>Last 30 days</div>
        <div className={COL}>All time</div>
      </div>
      <ul className="mt-1 divide-y divide-white/6">
        <Row label="Joined" recent={[String(r.joined)]} all={[String(a.joined)]} />
        <Row label="Photo and username set" recent={count(r.setUp)} all={count(a.setUp)} />
        <Row label="In a club" recent={count(r.inClub)} all={count(a.inClub)} />
        <Row label="3 friends or more" note="Club teammates are friends." recent={count(r.threeFriends)} all={count(a.threeFriends)} />
        <Row
          label="Posted a timed training"
          note="Training that counts on the boards. Gym and typed time do not."
          recent={count(r.posted)}
          all={count(a.posted)}
        />
        <Row label="Posted inside 48 hours" note="Of joining." recent={count(r.postedIn48h)} all={count(a.postedIn48h)} />
        <Row
          label="Came back within a week"
          note="Trained again on a later day. Of players whose first training is a week old."
          recent={cameBack(r)}
          all={cameBack(a)}
        />
        <Row
          label="Typical time to a first post"
          note="From joining. Half of the players who posted were this fast or faster."
          recent={[fmtTypical(r.medianHours)]}
          all={[fmtTypical(a.medianHours)]}
        />
      </ul>

      <div className="mt-4 border-t border-white/6 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent/80">Clubs</div>
        <p className="mt-1.5 text-sm text-white/80">{activatedLine(numbers.clubsActivated)}</p>
        <p className="mt-0.5 text-xs text-white/40">{ACTIVATED_RULE}</p>
        {clubs.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.16em] text-white/40">
                <tr className="border-b border-white/6">
                  <th className="py-2 pr-4 font-semibold">Club</th>
                  <th className="px-3 py-2 text-right font-semibold">Players</th>
                  <th className="px-3 py-2 text-right font-semibold">Trained this week</th>
                  <th className="px-3 py-2 text-right font-semibold">Have posted</th>
                  <th className="py-2 pl-3 text-right font-semibold">Activated</th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c) => (
                  <tr key={c.id} className="border-b border-white/6 last:border-0">
                    <td className="py-2 pr-4 text-white/80">{c.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-bone">{c.members}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/70">{c.trainedThisWeek}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/70">{c.posted}</td>
                    <td className={cn("py-2 pl-3 text-right", c.activated ? "font-semibold text-accent" : "text-white/40")}>
                      {c.activated ? "Yes" : "Not yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
