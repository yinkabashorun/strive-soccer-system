"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { deleteLog, logTraining } from "@/lib/elite/tracker-actions";
import { fmtDuration } from "@/lib/elite/time-trained";
import { feel } from "@/lib/elite/native";
import { KINDS, LOG_CHIPS, dayLabel, gymThisWeekLine, type Kind, type TrainingLog } from "@/lib/elite/tracker";
import { ShareWeek } from "./ShareWeek";
import { InviteRow } from "./InviteRow";

const UNDO_MS = 6000;

// The free training log, whole: the week's ring, five buttons that log
// with one tap, what was logged this week, share it, invite a teammate.
// A tap shows up at once and is saved behind the screen; if the save
// fails, the entry comes back off and the screen says so.
//
// Gym work is tracked apart, for high school and college players only
// (`gym`): they get a Training | Gym switch above the buttons. The ring
// and its number are training alone; gym never fills the ring.
export function TrackerHome({
  logs: serverLogs,
  target,
  gym,
  week,
  inviteLink,
  joined,
  showProgramLine,
}: {
  logs: TrainingLog[]; // this week's, newest first
  target: number; // training minutes a week
  gym: boolean; // this player logs gym work too
  week: string; // "Nov 16 to Nov 22"
  inviteLink: string;
  joined: string;
  showProgramLine: boolean;
}) {
  const [logs, setLogs] = useState<TrainingLog[]>(serverLogs);
  const [kind, setKind] = useState<Kind>("training");
  const [undo, setUndo] = useState<{ id: string; minutes: number; kind: Kind } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Saves still on their way, by the id the screen is showing for them.
  const saving = useRef(new Map<string, Promise<string | null>>());
  const undoWait = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the server hands over a newer week (the app was reopened), show
  // it, unless a save is still on its way.
  useEffect(() => {
    if (saving.current.size === 0) setLogs(serverLogs);
  }, [serverLogs]);

  useEffect(() => () => void (undoWait.current && clearTimeout(undoWait.current)), []);

  const minutes = logs.reduce((s, l) => (l.kind === "training" ? s + l.minutes : s), 0);
  const gymLine = gym
    ? gymThisWeekLine(logs.reduce((s, l) => (l.kind === "gym" ? s + l.minutes : s), 0))
    : null;
  const percent = target > 0 ? Math.min(100, (minutes / target) * 100) : 0;

  function log(amount: number) {
    setError(null);
    const tempId = `new-${Date.now()}`;
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const as: Kind = gym ? kind : "training";
    setLogs((cur) => [{ id: tempId, trained_on: today, minutes: amount, kind: as }, ...cur]);
    setKind("training"); // the switch goes back to Training after every log
    feel("drill");

    const saved = logTraining(amount, as).then(
      (res) => {
        saving.current.delete(tempId);
        if (!res.ok) {
          setLogs((cur) => cur.filter((l) => l.id !== tempId));
          setUndo((u) => (u?.id === tempId ? null : u));
          setError(`${fmtDuration(amount)} was not saved. ${res.error}`);
          return null;
        }
        setLogs((cur) =>
          cur.map((l) => (l.id === tempId ? { ...l, id: res.id, trained_on: res.trained_on } : l))
        );
        setUndo((u) => (u?.id === tempId ? { ...u, id: res.id } : u));
        return res.id;
      },
      () => {
        saving.current.delete(tempId);
        setLogs((cur) => cur.filter((l) => l.id !== tempId));
        setUndo((u) => (u?.id === tempId ? null : u));
        setError(`${fmtDuration(amount)} was not saved. Check your connection and tap it again.`);
        return null;
      }
    );
    saving.current.set(tempId, saved);

    setUndo({ id: tempId, minutes: amount, kind: as });
    if (undoWait.current) clearTimeout(undoWait.current);
    undoWait.current = setTimeout(() => setUndo(null), UNDO_MS);
  }

  async function remove(entry: TrainingLog) {
    setError(null);
    setUndo((u) => (u?.id === entry.id ? null : u));
    setLogs((cur) => cur.filter((l) => l.id !== entry.id));
    // An entry still being saved has to land before it can be taken out.
    const pending = saving.current.get(entry.id);
    const id = pending ? await pending : entry.id;
    if (!id) return;
    const res = await deleteLog(id).catch(() => ({ ok: false as const, error: "" }));
    if (!res.ok) {
      setLogs((cur) => (cur.some((l) => l.id === id) ? cur : [{ ...entry, id }, ...cur]));
      setError("That entry was not removed. Check your connection and try again.");
    }
  }

  const R = 104;
  const C = 2 * Math.PI * R;

  return (
    <div>
      {/* The week */}
      <section className="flex flex-col items-center pt-2 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
          This week · {week}
        </div>
        <div className="relative mt-5 grid h-60 w-60 place-items-center">
          <svg viewBox="0 0 232 232" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
            <circle cx="116" cy="116" r={R} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="12" />
            <circle
              cx="116"
              cy="116"
              r={R}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C - (percent / 100) * C}
              style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)" }}
            />
          </svg>
          <div className="relative">
            <div className="font-display text-6xl font-black leading-none tabular-nums">
              {fmtDuration(minutes)}
            </div>
            <div className="mt-2 text-sm text-white/60">of {fmtDuration(target)}</div>
          </div>
        </div>
        {gymLine && <div className="mt-3 text-[15px] text-white/70">{gymLine}</div>}
      </section>

      {/* One tap logs it */}
      <section className="mt-7">
        <h2 className="text-center text-[15px] font-semibold text-bone">
          Tap how long you trained today
        </h2>
        {gym && (
          <div
            role="radiogroup"
            aria-label="What you are logging"
            className="mx-auto mt-3 grid max-w-[260px] grid-cols-2 rounded-2xl border border-white/15 p-1"
          >
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={
                  "h-11 rounded-xl text-[15px] font-semibold " +
                  (kind === k.id ? "bg-white/[0.14] text-bone" : "text-white/60")
                }
              >
                {k.label}
              </button>
            ))}
          </div>
        )}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {LOG_CHIPS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => log(m)}
              className="flex h-14 items-center justify-center rounded-2xl bg-white font-display text-lg font-black text-black active:scale-[0.97]"
            >
              {fmtDuration(m)}
            </button>
          ))}
        </div>
        <div className="mt-2 flex min-h-[44px] items-center justify-center gap-3 text-sm" aria-live="polite">
          {undo ? (
            <>
              <span className="text-white/70">
                Logged {fmtDuration(undo.minutes)}
                {undo.kind === "gym" ? " of gym work" : ""}.
              </span>
              <button
                type="button"
                onClick={() => {
                  const entry = logs.find((l) => l.id === undo.id);
                  if (entry) void remove(entry);
                }}
                className="tap font-semibold text-bone underline underline-offset-4"
              >
                Undo
              </button>
            </>
          ) : (
            error && <span className="text-red-400">{error}</span>
          )}
        </div>
      </section>

      {/* What was logged this week */}
      <section className="mt-3">
        {logs.length === 0 ? (
          <p className="text-center text-sm text-white/60">Nothing logged yet this week.</p>
        ) : (
          <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
            {logs.map((l) => (
              <li key={l.id} className="flex min-h-[48px] items-center gap-3 pl-1">
                <span className="flex-1 text-[15px] text-white/70">
                  {dayLabel(l.trained_on)}
                  {gym && <span className="text-white/50"> · {l.kind === "gym" ? "Gym" : "Training"}</span>}
                </span>
                <span className="font-display text-xl font-bold tabular-nums text-bone">
                  {fmtDuration(l.minutes)}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(l)}
                  aria-label={`Delete ${fmtDuration(l.minutes)}${l.kind === "gym" ? " of gym work" : ""} on ${dayLabel(l.trained_on)}`}
                  className="grid h-11 w-11 place-items-center text-white/50"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-7">
        <ShareWeek stamp={`${minutes}:${logs.length}`} />
      </div>

      <InviteRow link={inviteLink} joined={joined} />

      {showProgramLine && (
        <p className="mt-8 text-center text-sm leading-relaxed text-white/60">
          Want to know exactly what to do in those hours? Coach Gary and I build a week around you.{" "}
          <Link href="/demo" className="tap text-bone underline underline-offset-4">
            See how it works
          </Link>
        </p>
      )}
    </div>
  );
}
