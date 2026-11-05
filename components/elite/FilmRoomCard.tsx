"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Clapperboard, Loader2, Trash2, Upload, Video } from "lucide-react";
import { notifyCoachesOfFilmRoomClips, recordFilmRoomClip, removeFilmRoomClip } from "@/lib/elite/film-room-actions";
import { clipExtension, filmRoomPath } from "@/lib/elite/clips";
import { uploadClip } from "@/lib/elite/clip-upload";
import { FILM_CLIPS_MAX, FILM_CLIPS_MIN, fmtWhen } from "@/lib/elite/film-room";
import type { FilmRoom, FilmRoomClip } from "@/lib/elite/types";

// The member side of the weekly Film Room (062): when it is, the Zoom
// link, and the place to upload three to five clips for Coach Yinka and
// Coach Gary to go through. Clips go straight from the phone into the
// player's own folder of the private bucket, then are recorded against
// the room (five at most, held by the database).
export function FilmRoomCard({
  room,
  clips,
  playerId,
  firstName,
}: {
  room: FilmRoom | null;
  clips: FilmRoomClip[];
  playerId: string;
  firstName: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!room) {
    return (
      <div className="elite-card p-6">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
          <Clapperboard className="h-3.5 w-3.5" /> Film Room
        </div>
        <p className="mt-2 text-white/70">
          Every week, Coach Yinka and Coach Gary go through your clips on Zoom. The next one hasn&apos;t been
          announced yet. You and your parent will get a text the moment it is.
        </p>
      </div>
    );
  }

  const remaining = Math.max(0, FILM_CLIPS_MAX - clips.length);
  const started = new Date(room.scheduled_at).getTime() < Date.now();
  const enough = clips.length >= FILM_CLIPS_MIN;

  async function onFiles(list: FileList) {
    if (!room) return;
    setError(null);
    const files = Array.from(list).slice(0, remaining);
    const t0 = Date.now();
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setBusy(`Sending clip ${i + 1} of ${files.length}`);
      const path = filmRoomPath(playerId, room.id, clipExtension(f.name, f.type), t0 + i);
      const up = await uploadClip(f, path);
      if (!up.ok) {
        setError(up.error);
        break;
      }
      const res = await recordFilmRoomClip({ roomId: room.id, path });
      if (!res.ok) {
        setError(res.error ?? "Couldn't add the clip.");
        break;
      }
      added++;
    }
    if (added > 0) await notifyCoachesOfFilmRoomClips({ roomId: room.id, added });
    setBusy(null);
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    setBusy("Removing");
    const res = await removeFilmRoomClip(id);
    if (!res.ok) setError(res.error ?? "Couldn't remove it.");
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-accent/20 bg-accent/[0.05] p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
        <Clapperboard className="h-3.5 w-3.5" /> This week&apos;s Film Room
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold text-bone">{fmtWhen(room.scheduled_at)}</p>
      <p className="mt-0.5 text-sm text-white/55">
        On Zoom with Coach Yinka and Coach Gary
        {room.topic ? `. ${room.topic}` : "."}
      </p>
      {room.zoom_url ? (
        <a href={room.zoom_url} target="_blank" rel="noreferrer" className="btn mt-3 inline-flex px-5 py-2 text-sm">
          <Video className="mr-1.5 h-4 w-4" /> Join on Zoom
        </a>
      ) : (
        <p className="mt-3 text-sm text-white/45">The Zoom link will show up here before the session.</p>
      )}

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="text-sm font-semibold text-bone">
          Upload {FILM_CLIPS_MIN} to {FILM_CLIPS_MAX} clips of {firstName}
        </div>
        <p className="mt-0.5 text-xs text-white/50">
          From games or training. Send them by {fmtWhen(room.clips_due_at)} so we can watch them first.
        </p>

        {clips.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {clips.map((c, i) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 text-white/80">
                  <Check className="h-3.5 w-3.5 text-accent" /> Clip {i + 1} sent
                </span>
                {!started && (
                  <button
                    onClick={() => remove(c.id)}
                    disabled={busy !== null}
                    aria-label={`Remove clip ${i + 1}`}
                    className="text-white/40 hover:text-red-300 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void onFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {!started && remaining > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => fileRef.current?.click()}
            className="btn mt-3 inline-flex px-5 py-2 text-sm disabled:opacity-60"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            {busy ?? (clips.length === 0 ? "Choose clips" : "Add more clips")}
          </button>
        )}
        {remaining === 0 && !started && (
          <p className="mt-3 text-xs text-white/50">That&apos;s {FILM_CLIPS_MAX} clips. Remove one to swap it.</p>
        )}
        {clips.length > 0 && !enough && (
          <p className="mt-2 text-xs text-white/50">
            {FILM_CLIPS_MIN - clips.length} more makes it a full set.
          </p>
        )}
        {enough && <p className="mt-2 text-xs text-accent">That&apos;s a full set. We&apos;ll go through them on the call.</p>}
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
