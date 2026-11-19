"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { deleteLog } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import {
  dayLabel,
  gymThisWeekLine,
  stripDayLabel,
  todayLine,
  weekStrip,
  type BoardEntry,
  type TrainingLog,
} from "@/lib/elite/tracker";
import { FriendsBoard } from "./FriendsBoard";
import { ShareWeek } from "./ShareWeek";
import { TrackerSheet } from "./TrackerSheet";
import { usePostLauncher } from "./FreeShell";

// My week (mock screen 4), the accountability piece: the week's training
// against the target, the seven days (planned outlined, trained filled,
// today ringed), one line about today and what is next, gym on its own
// line, the week next to your friends, then share it. A day opens its
// entries, each with a delete.
export function MyWeek({
  logs: serverLogs,
  target,
  planDays,
  today,
  gym,
  week,
  me,
  friends,
  inviteLink,
  programHref,
}: {
  logs: TrainingLog[]; // this week's, newest first
  target: number; // training minutes a week
  planDays: number[]; // 0 = Monday
  today: string;
  gym: boolean;
  week: string; // "Nov 16 to Nov 22"
  me: { id: string; name: string; initials: string };
  friends: BoardEntry[];
  inviteLink: string;
  // Where the one line about the coached program leads; null inside the
  // App Store app, where the line is not drawn (programLink in tracker.ts).
  programHref: string | null;
}) {
  const router = useRouter();
  const { logOnly } = usePostLauncher();
  const [logs, setLogs] = useState(serverLogs);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setLogs(serverLogs), [serverLogs]);

  const minutes = logs.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0);
  const gymLine = gym ? gymThisWeekLine(logs.reduce((s, l) => (l.kind === "gym" ? s + l.minutes : s), 0)) : null;
  const percent = target > 0 ? Math.min(100, (minutes / target) * 100) : 0;
  const strip = weekStrip(logs, planDays, today);
  const guide = todayLine(logs, planDays, target, today);
  const dayEntries = openDay ? logs.filter((l) => l.trained_on === openDay) : [];

  async function remove(entry: TrainingLog) {
    setError(null);
    setLogs((cur) => cur.filter((l) => l.id !== entry.id));
    const res = await deleteLog(entry.id).catch(() => ({ ok: false as const, error: "" }));
    if (!res.ok) {
      setLogs((cur) => [entry, ...cur]);
      setError("That entry was not removed. Check your connection and try again.");
      return;
    }
    router.refresh();
  }

  const R = 106;
  const C = 2 * Math.PI * R;

  return (
    <div>
      <header className="flex items-end justify-between px-[18px] pt-[34px]">
        <div>
          <h1 className="font-display text-[44px] font-black uppercase leading-[0.9] tracking-[-0.5px]">My week</h1>
          <p className="mt-1.5 text-[13px] tracking-[0.2px] text-white/60">{week}</p>
        </div>
        <Link
          href="/account"
          aria-label="Account"
          className="grid h-[46px] w-[46px] place-items-center rounded-full bg-[#2a2a2a] text-[13px] font-bold"
        >
          {me.initials}
        </Link>
      </header>

      <div className="relative mx-auto mt-[18px] h-[204px] w-[204px]">
        <svg viewBox="0 0 236 236" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle cx="118" cy="118" r={R} fill="none" stroke="#1c1c1c" strokeWidth="14" />
          <circle
            cx="118"
            cy="118"
            r={R}
            fill="none"
            stroke="#D4AF37"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * C} ${C}`}
            transform="rotate(-90 118 118)"
            style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="font-display text-[68px] font-black leading-[0.85] tracking-[-1px] tabular-nums">{fmtDuration(minutes)}</b>
          <span className="mt-2 text-[14px] text-white/60">of {fmtDuration(target)} this week</span>
        </div>
      </div>

      <div className="flex justify-between px-[22px] pt-5">
        {strip.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setOpenDay(d.day)}
            aria-label={stripDayLabel(d)}
            className={"flex w-11 flex-col items-center text-[11.5px] font-semibold " + (d.today ? "text-bone" : "text-white/60")}
          >
            <span
              className={
                "mb-[7px] block h-[34px] w-[34px] rounded-full border-[1.5px] " +
                (d.trained ? "border-accent bg-accent" : d.planned ? "border-white/60" : "border-white/[0.14]") +
                (d.today ? " shadow-[0_0_0_3px_#000,0_0_0_4.5px_#F5F4EF]" : "")
              }
            />
            {d.letter}
          </button>
        ))}
      </div>

      {guide && (
        <p className="mt-3.5 px-[18px] text-center text-[15px]">
          {guide.strong && <b className="font-bold">{guide.strong}</b>} {guide.rest}
        </p>
      )}
      {gymLine && <p className="mt-1.5 text-center text-[13px] text-white/60">{gymLine}</p>}

      <FriendsBoard me={me} myMinutes={minutes} friends={friends} inviteLink={inviteLink} />

      <div className="mx-[18px] mt-3">
        <ShareWeek stamp={`${minutes}:${logs.length}`} />
      </div>

      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={logOnly}
          className="inline-flex min-h-[44px] items-center px-3 text-[14px] font-semibold text-white/70 underline underline-offset-4"
        >
          Log training without a photo
        </button>
      </div>

      {programHref && (
        <p className="mx-[18px] mt-6 text-center text-sm leading-relaxed text-white/60">
          Want to know exactly what to do in those hours? Coach Gary and I build a week around you.{" "}
          <Link href={programHref} className="tap text-bone underline underline-offset-4">
            See how it works
          </Link>
        </p>
      )}

      {/* A day's entries, with the delete on each */}
      {openDay && (
        <TrackerSheet title={dayLabel(openDay)} onClose={() => setOpenDay(null)}>
          {dayEntries.length === 0 ? (
            <p className="py-3 text-[15px] text-white/70">Nothing logged on this day.</p>
          ) : (
            <ul className="divide-y divide-white/[0.08]">
              {dayEntries.map((l) => (
                <li key={l.id} className="flex min-h-[52px] items-center gap-3">
                  <span className="flex-1 text-[15px] text-white/70">
                    {l.kind === "gym" ? "Gym" : "Training"}
                    {l.photo ? ", with a photo" : ""}
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums text-bone">{fmtDuration(l.minutes)}</span>
                  <button
                    type="button"
                    onClick={() => void remove(l)}
                    aria-label={`Delete ${fmtDuration(l.minutes)}${l.kind === "gym" ? " of gym work" : ""}`}
                    className="grid h-11 w-11 place-items-center text-white/60"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </TrackerSheet>
      )}
    </div>
  );
}
