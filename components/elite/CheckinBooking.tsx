"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Loader2, Video } from "lucide-react";
import { bookCheckinSlot, cancelCheckinSlot } from "@/lib/elite/film-room-actions";
import { canCancelSlot, fmtDayWindow, fmtWhen } from "@/lib/elite/film-room";
import type { PlayerCheckin } from "@/lib/elite/film-room-data";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// The monthly check-in call (062): the call you hold, with the Join link,
// and the open times to pick from. One call a month; give it back up to
// 24 hours before. Renders nothing when there is nothing to show.
export function CheckinBooking({ checkin, firstName }: { checkin: PlayerCheckin; firstName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const { booked, open } = checkin;
  if (!booked && open.length === 0) return null;

  const byDay = new Map<string, PlayerCheckin["open"]>();
  for (const o of open) byDay.set(o.day.id, [...(byDay.get(o.day.id) ?? []), o]);

  function book(slotId: string, startsAt: string) {
    if (!window.confirm(`Book ${fmtWhen(startsAt)} for ${firstName}?`)) return;
    setError(null);
    start(async () => {
      const res = await bookCheckinSlot(slotId);
      if (!res.ok) setError(res.error ?? "Couldn't book that time.");
      router.refresh();
    });
  }

  function giveBack(slotId: string) {
    if (!window.confirm("Give this call back so someone else can take the time?")) return;
    setError(null);
    start(async () => {
      const res = await cancelCheckinSlot(slotId);
      if (!res.ok) setError(res.error ?? "Couldn't give it back.");
      router.refresh();
    });
  }

  return (
    <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
        <CalendarClock className="h-3.5 w-3.5" /> Monthly check-in call
      </div>

      {booked && (
        <div className="mt-2">
          <p className="font-medium text-bone">{fmtWhen(booked.slot.starts_at)}</p>
          <p className="mt-0.5 text-sm text-white/55">
            With {booked.day.coach_name || "Coach Yinka and Coach Gary"}. {booked.day.slot_minutes} minutes. Come with your
            questions.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {booked.day.zoom_url ? (
              <a href={booked.day.zoom_url} target="_blank" rel="noreferrer" className="btn inline-flex px-5 py-2 text-sm">
                <Video className="mr-1.5 h-4 w-4" /> Join on Zoom
              </a>
            ) : (
              <span className="text-sm text-white/45">The Zoom link will show up here before the call.</span>
            )}
            {canCancelSlot(booked.slot.starts_at) && (
              <button
                onClick={() => giveBack(booked.slot.id)}
                disabled={pending}
                className="text-xs font-semibold text-white/50 underline-offset-2 hover:text-bone hover:underline disabled:opacity-60"
              >
                Give it back
              </button>
            )}
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div className={booked ? "mt-5 border-t border-white/10 pt-4" : "mt-2"}>
          <p className="text-sm font-medium text-bone">
            {booked ? "Book another month" : `Pick a time for ${firstName}`}
          </p>
          <p className="mt-0.5 text-xs text-white/50">One call a month. Tap a time to book it.</p>
          <div className="mt-3 space-y-3">
            {[...byDay.values()].map((slots) => (
              <div key={slots[0].day.id}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {fmtDayWindow(slots[0].day.starts_at, slots[0].day.ends_at)}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {slots.map(({ slot }) => (
                    <button
                      key={slot.id}
                      onClick={() => book(slot.id, slot.starts_at)}
                      disabled={pending}
                      className="rounded-full border border-white/15 px-3.5 py-1.5 text-sm text-bone transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-60"
                    >
                      {pending ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : time(slot.starts_at)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
