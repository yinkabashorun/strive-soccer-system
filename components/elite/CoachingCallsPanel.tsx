"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus, Trash2, Video } from "lucide-react";
import {
  addCoachingCall,
  deleteCoachingCall,
  saveCoachingCallNote,
} from "@/lib/elite/coach-actions";
import type { CoachingCall } from "@/lib/elite/types";
import { cn } from "@/lib/utils";

const COACHES = ["Coach Yinka", "Gary"];

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

// Coach-side: schedule a 1:1 call (booked on Calendly, recorded here), and
// write the note afterward. The note is fed into the player's next weekly
// plan, so what gets said on the call actually shapes the training.
export function CoachingCallsPanel({
  playerId,
  calls,
}: {
  playerId: string;
  calls: CoachingCall[];
}) {
  const [open, setOpen] = useState(calls.length === 0);
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [coach, setCoach] = useState(COACHES[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    if (!when) {
      setError("Pick a date and time for the call.");
      return;
    }
    start(async () => {
      const res = await addCoachingCall(playerId, {
        scheduled_at: new Date(when).toISOString(),
        join_url: link,
        coach_name: coach,
      });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the call.");
        return;
      }
      setWhen("");
      setLink("");
      setOpen(false);
    });
  }

  const now = Date.now();
  const upcoming = calls.filter((c) => new Date(c.scheduled_at).getTime() >= now);
  const past = calls.filter((c) => new Date(c.scheduled_at).getTime() < now);

  return (
    <div className="elite-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Video className="h-3.5 w-3.5" /> Coaching calls
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 text-[11px] font-semibold text-white/60 hover:text-bone"
        >
          <Plus className="h-3.5 w-3.5" /> Add call
        </button>
      </div>

      {open && (
        <div className="mb-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <input
            id={`call-when-${playerId}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone focus:border-accent/40 focus:outline-none"
          />
          <input
            id={`call-link-${playerId}`}
            type="url"
            inputMode="url"
            placeholder="Zoom link (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            {COACHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCoach(c)}
                className={cn(
                  "rounded-lg border px-2 py-1.5 text-sm transition-all",
                  coach === c
                    ? "border-accent/40 bg-accent/[0.08] text-accent"
                    : "border-white/10 text-white/45 hover:border-white/20"
                )}
              >
                {c}
              </button>
            ))}
          </div>
          {error && <p className="text-xs text-red-300">{error}</p>}
          <button onClick={add} disabled={pending} className="btn w-full py-2 text-sm">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save call"}
          </button>
        </div>
      )}

      {calls.length === 0 && !open && (
        <p className="text-xs text-white/40">No calls scheduled yet.</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Upcoming
          </div>
          {upcoming.map((c) => (
            <CallRow key={c.id} playerId={playerId} call={c} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className={cn("space-y-2", upcoming.length > 0 && "mt-4")}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
            Past - add your note, it steers next week&apos;s plan
          </div>
          {past.map((c) => (
            <CallRow key={c.id} playerId={playerId} call={c} withNote />
          ))}
        </div>
      )}
    </div>
  );
}

function CallRow({
  playerId,
  call,
  withNote = false,
}: {
  playerId: string;
  call: CoachingCall;
  withNote?: boolean;
}) {
  const [note, setNote] = useState(call.notes);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const dirty = note !== call.notes && !saved;

  function save() {
    start(async () => {
      await saveCoachingCallNote(playerId, call.id, note);
      setSaved(true);
    });
  }
  function remove() {
    start(async () => {
      await deleteCoachingCall(playerId, call.id);
    });
  }

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-bone">{fmt(call.scheduled_at)}</div>
          <div className="text-xs text-white/45">
            {call.coach_name || "Coach"}
            {call.join_url && (
              <>
                {" · "}
                <a
                  href={call.join_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Zoom link
                </a>
              </>
            )}
          </div>
        </div>
        <button
          onClick={remove}
          disabled={pending}
          title="Remove call"
          className="shrink-0 text-white/30 hover:text-red-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {withNote && (
        <div className="mt-2">
          <textarea
            id={`call-note-${call.id}`}
            rows={3}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setSaved(false);
            }}
            onBlur={() => dirty && save()}
            placeholder="What you covered, what to push next week."
            className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between text-[11px]">
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white/40" />
            ) : saved ? (
              <span className="flex items-center gap-1 text-accent">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : (
              <span />
            )}
            {dirty && (
              <button onClick={save} className="font-semibold text-accent">
                Save note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
