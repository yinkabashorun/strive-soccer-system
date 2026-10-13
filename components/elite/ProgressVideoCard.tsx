"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Video } from "lucide-react";
import { submitProgressVideo } from "@/lib/elite/player-actions";
import { clipExtension, progressPath } from "@/lib/elite/clips";
import { uploadClip } from "@/lib/elite/clip-upload";
import { DrillVideo } from "./DrillVideo";

// Bi-weekly progress video (offer stack item 7): every second week the
// player films the same drill. The parent gets the link by text; the
// coach can post it in the community once the family says yes here.
export function ProgressVideoCard({
  playerId,
  week,
  firstName,
  parentFirst,
  benchmark,
  previousUrl,
}: {
  playerId: string;
  week: number;
  firstName: string;
  parentFirst: string;
  benchmark: { title: string; video_url: string | null };
  previousUrl: string | null; // two weeks ago, signed
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [shareOk, setShareOk] = useState(false);
  const [state, setState] = useState<"idle" | "uploading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setState("uploading");
    const path = progressPath(playerId, week, clipExtension(file.name, file.type));
    const up = await uploadClip(file, path);
    if (!up.ok) {
      setError(up.error);
      setState("error");
      return;
    }
    start(async () => {
      const res = await submitProgressVideo({ path, week, shareOk });
      if (!res.ok) {
        setError(res.error ?? "Couldn't send the video.");
        setState("error");
        return;
      }
      setState("sent");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl border border-accent/30 bg-accent/[0.05] p-5 sm:p-6">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-accent">
        <Video className="h-3.5 w-3.5" /> Week {week} progress video
      </div>
      {state === "sent" ? (
        <>
          <p className="mt-1.5 font-display text-2xl font-black uppercase leading-tight">
            Sent, {firstName}.
          </p>
          <p className="mt-2 text-sm text-white/65">
            {parentFirst ? `${parentFirst} gets the link by text.` : "Your family gets the link by text."} Same
            drill again in two weeks.
          </p>
        </>
      ) : (
        <>
          <p className="mt-1.5 font-display text-2xl font-black uppercase leading-tight">
            Film {benchmark.title}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-white/65">
            The same drill every two weeks, so you and your family can see the work
            adding up. One clip, phone propped up, full speed.
          </p>
          {benchmark.video_url && <DrillVideo src={benchmark.video_url} label="Watch the demo" />}
          {previousUrl && (
            <a
              href={previousUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-white/50 underline-offset-2 hover:text-bone hover:underline"
            >
              Your clip from two weeks ago
            </a>
          )}
          <label className="mt-4 flex items-start gap-2.5 text-sm text-white/70">
            <input
              type="checkbox"
              checked={shareOk}
              onChange={(e) => setShareOk(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#c8a858]"
            />
            <span>
              OK to share this clip in the Strive community. Leave it unchecked and it
              stays between you, your family and your coach.
            </span>
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={state === "uploading"}
            onClick={() => fileRef.current?.click()}
            className="btn-accent mt-4 inline-flex items-center gap-2 px-5 py-3 disabled:opacity-60"
          >
            {state === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {state === "uploading" ? "Sending…" : "Film it and send"}
          </button>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </>
      )}
    </section>
  );
}
