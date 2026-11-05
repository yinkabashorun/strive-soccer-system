"use client";

import { useState, useTransition } from "react";
import { Check, Clapperboard, Loader2, Megaphone, Trash2 } from "lucide-react";
import { announceFilmRoom, deleteFilmRoom, saveFilmRoom } from "@/lib/elite/film-room-actions";
import { FILM_CLIPS_MAX, FILM_CLIPS_MIN, fmtWhen } from "@/lib/elite/film-room";
import type { FilmRoomWithClips } from "@/lib/elite/film-room-data";
import { cn } from "@/lib/utils";

const input =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none";

// Coach side of the weekly Film Room (062): add the next one (Sunday 7pm
// ET by default), paste the Zoom link, announce it to every member, and
// watch the clips come in. Clips are private; the links expire in an hour.
export function FilmRoomAdmin({
  rooms,
  defaultDay,
  defaultTime,
}: {
  rooms: FilmRoomWithClips[];
  defaultDay: string;
  defaultTime: string;
}) {
  const [day, setDay] = useState(defaultDay);
  const [time, setTime] = useState(defaultTime);
  const [link, setLink] = useState("");
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const res = await saveFilmRoom({ day, time, zoom_url: link, topic });
      if (!res.ok) {
        setError(res.error ?? "Couldn't save.");
        return;
      }
      setLink("");
      setTopic("");
    });
  }

  const now = Date.now();
  const upcoming = rooms.filter((r) => new Date(r.scheduled_at).getTime() >= now - 3 * 3_600_000);
  const past = rooms.filter((r) => !upcoming.includes(r)).reverse();

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-tight">
        <Clapperboard className="h-4 w-4 text-accent" /> Weekly Film Room
      </h2>

      <div className="elite-card space-y-2 p-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Add a Film Room</div>
        <div className="grid grid-cols-2 gap-2">
          <input aria-label="Film Room day" type="date" value={day} onChange={(e) => setDay(e.target.value)} className={input} />
          <input aria-label="Film Room time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
        </div>
        <input
          type="url"
          inputMode="url"
          placeholder="Zoom link (add it now or later)"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          className={input}
        />
        <input
          type="text"
          placeholder="Topic (optional)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          className={input}
        />
        <p className="text-xs text-white/40">Times are Virginia time. Clips are asked for by 9 PM the night before.</p>
        {error && <p className="text-xs text-red-300">{error}</p>}
        <button onClick={add} disabled={pending} className="btn w-full py-2 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Film Room"}
        </button>
      </div>

      {upcoming.length === 0 && <p className="text-sm text-white/45">No Film Room scheduled yet.</p>}
      {upcoming.map((r) => (
        <RoomCard key={r.id} room={r} />
      ))}

      {past.length > 0 && (
        <details className="elite-card p-4">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Past Film Rooms ({past.length})
          </summary>
          <div className="mt-3 space-y-3">
            {past.map((r) => (
              <RoomCard key={r.id} room={r} past />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function RoomCard({ room, past = false }: { room: FilmRoomWithClips; past?: boolean }) {
  const [link, setLink] = useState(room.zoom_url);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const announced = Boolean(room.announced_at);

  const byPlayer = new Map<string, FilmRoomWithClips["clips"]>();
  for (const c of room.clips) byPlayer.set(c.player_name, [...(byPlayer.get(c.player_name) ?? []), c]);

  function saveLink() {
    setNote(null);
    start(async () => {
      const d = new Date(room.scheduled_at);
      const day = d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      const time = d.toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" });
      const res = await saveFilmRoom({ id: room.id, day, time, zoom_url: link, topic: room.topic });
      setNote(res.ok ? "Link saved." : res.error ?? "Couldn't save.");
    });
  }

  function announce(again: boolean) {
    if (again && !window.confirm("Send this announcement to every active member again?")) return;
    setNote(null);
    start(async () => {
      const res = await announceFilmRoom(room.id, again);
      setNote(
        res.ok
          ? `Sent to ${res.members} member${res.members === 1 ? "" : "s"}: ${res.texted} texted, ${res.pushed} push.`
          : res.error ?? "Couldn't send."
      );
    });
  }

  function remove() {
    if (!window.confirm("Delete this Film Room and its clips?")) return;
    start(async () => {
      await deleteFilmRoom(room.id);
    });
  }

  return (
    <div className="elite-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-bone">{fmtWhen(room.scheduled_at)}</div>
          <div className="text-xs text-white/45">
            Clips due {fmtWhen(room.clips_due_at)}
            {room.topic ? ` · ${room.topic}` : ""}
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

      {!past && (
        <div className="mt-3 flex gap-2">
          <input
            type="url"
            inputMode="url"
            placeholder="Zoom link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className={input}
            aria-label="Zoom link"
          />
          <button onClick={saveLink} disabled={pending || link === room.zoom_url} className="btn px-4 py-2 text-sm">
            Save
          </button>
        </div>
      )}

      {!past && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => announce(announced)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 px-4 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
            {announced ? "Send again" : "Announce to members"}
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-4 py-1.5 text-xs font-semibold text-white/55 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}
      {note && <p className="mt-2 flex items-center gap-1.5 text-xs text-accent"><Check className="h-3.5 w-3.5" /> {note}</p>}

      <div className="mt-4 border-t border-white/8 pt-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
          Clips in ({room.clips.length}) · {FILM_CLIPS_MIN} to {FILM_CLIPS_MAX} asked per member
        </div>
        {byPlayer.size === 0 ? (
          <p className="mt-2 text-xs text-white/40">Nothing yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {[...byPlayer.entries()].map(([name, clips]) => (
              <details key={name} className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                <summary className="cursor-pointer text-sm text-bone">
                  {name} <span className="text-white/45">· {clips.length} clip{clips.length === 1 ? "" : "s"}</span>
                </summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {clips.map((c) =>
                    c.url ? (
                      <video key={c.id} src={c.url} controls preload="none" playsInline className="w-full rounded-lg bg-black" />
                    ) : (
                      <p key={c.id} className="text-xs text-white/40">Clip not available.</p>
                    )
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
