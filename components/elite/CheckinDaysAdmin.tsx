"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Check, Loader2, Megaphone, Trash2 } from "lucide-react";
import {
  announceCheckinDay,
  deleteCheckinDay,
  releaseCheckinSlot,
  saveCheckinDay,
} from "@/lib/elite/film-room-actions";
import { CHECKIN_SLOT_MINUTES, fmtDayWindow } from "@/lib/elite/film-room";
import type { CheckinDayWithSlots } from "@/lib/elite/film-room-data";
import { cn } from "@/lib/utils";

const input =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

function slotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// Coach side of the monthly check-in calls (062): publish a day, split
// into 30-minute slots; members pick one a month. Announce it, see who
// booked, give a slot back if you have to.
export function CheckinDaysAdmin({ days, defaultDay }: { days: CheckinDayWithSlots[]; defaultDay: string }) {
  const [day, setDay] = useState(defaultDay);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("12:00");
  const [minutes, setMinutes] = useState(CHECKIN_SLOT_MINUTES);
  const [link, setLink] = useState("");
  const [coach, setCoach] = useState("Coach Yinka and Coach Gary");
  const [error, setError] = useState<string | null>(null);
  const [pending, start_] = useTransition();

  function add() {
    setError(null);
    start_(async () => {
      const res = await saveCheckinDay({ day, start, end, minutes, zoom_url: link, coach_name: coach });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      setLink("");
    });
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
        <CalendarClock className="h-4 w-4 text-accent" /> Monthly check-in calls
      </h2>

      <div className="elite-card space-y-2 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Add a check-in day</div>
        <input aria-label="Check-in day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={input} />
        <div className="grid grid-cols-3 gap-2">
          <input aria-label="From" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={input} />
          <input aria-label="To" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={input} />
          <select
            aria-label="Minutes per call"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className={input}
          >
            {[15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </div>
        <input
          type="url"
          inputMode="url"
          placeholder="Zoom link (one link for the day, optional)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={input}
        />
        <input type="text" value={coach} onChange={(e) => setCoach(e.target.value)} className={input} aria-label="Who is on the call" />
        <p className="text-xs text-white/40">
          Virginia time. Each member can book one call a month. Slots are made back to back inside the window.
        </p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button onClick={add} disabled={pending} className="btn w-full py-2 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save check-in day"}
        </button>
      </div>

      {days.length === 0 && <p className="text-sm text-white/45">No check-in days yet.</p>}
      {days.map((d) => (
        <DayCard key={d.id} day={d} />
      ))}
    </section>
  );
}

function DayCard({ day }: { day: CheckinDayWithSlots }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const announced = Boolean(day.announced_at);
  const booked = day.slots.filter((s) => s.player_id).length;
  const past = new Date(day.ends_at).getTime() < Date.now();

  function announce(again: boolean) {
    if (again && !window.confirm("Send this announcement to every active member again?")) return;
    setNote(null);
    start(async () => {
      const res = await announceCheckinDay(day.id, again);
      setNote(
        res.ok
          ? `Sent to ${res.members} member${res.members === 1 ? "" : "s"}: ${res.texted} texted, ${res.pushed} push.`
          : res.error ?? "Couldn't send."
      );
    });
  }

  return (
    <div className="elite-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-bone">{fmtDayWindow(day.starts_at, day.ends_at)}</div>
          <div className="text-xs text-white/45">
            {day.slot_minutes} min calls · {booked} of {day.slots.length} booked · {day.coach_name}
            {day.zoom_url && (
              <>
                {" · "}
                <a href={day.zoom_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                  Zoom link
                </a>
              </>
            )}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]",
            announced ? "border-accent/40 text-accent" : "border-white/15 text-white/50"
          )}
        >
          {announced ? "Announced" : "Not announced"}
        </span>
      </div>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {day.slots.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5 text-sm"
          >
            <span className="text-white/70">{slotTime(s.starts_at)}</span>
            {s.player_id ? (
              <span className="flex items-center gap-2">
                <span className="text-bone">{s.player_name ?? "Member"}</span>
                <button
                  onClick={() => start(async () => void (await releaseCheckinSlot(s.id)))}
                  disabled={pending}
                  className="text-[11px] font-semibold text-white/45 hover:text-red-300"
                >
                  Release
                </button>
              </span>
            ) : (
              <span className="text-white/35">Open</span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {!past && (
          <button
            onClick={() => announce(announced)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
            {announced ? "Send again" : "Announce to members"}
          </button>
        )}
        <button
          onClick={() => {
            if (window.confirm("Delete this day? Booked calls on it are removed too.")) {
              start(async () => void (await deleteCheckinDay(day.id)));
            }
          }}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold text-white/55 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete day
        </button>
      </div>
      {note && <p className="mt-2 flex items-center gap-1.5 text-xs text-accent"><Check className="h-3.5 w-3.5" /> {note}</p>}
    </div>
  );
}
