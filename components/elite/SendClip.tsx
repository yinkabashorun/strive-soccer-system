"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Video } from "lucide-react";
import { sendClip } from "@/lib/elite/player-actions";
import { clipExtension, clipPath } from "@/lib/elite/clips";
import { uploadClip } from "@/lib/elite/clip-upload";
import { cn } from "@/lib/utils";

// "Send a clip" on a drill card (offer stack item 5): the player films
// the drill, it uploads straight from the phone into their own folder of
// the private elite-film bucket (storage RLS, 036), then lands in their
// chat with the coach, who replies by text. No server hop for the file.
export function SendClip({
  playerId,
  homeworkId,
  title,
  compact = false,
}: {
  playerId: string;
  homeworkId: string;
  title: string;
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onFile(file: File) {
    setError(null);
    setState("uploading");
    const path = clipPath(playerId, homeworkId, clipExtension(file.name, file.type));
    const up = await uploadClip(file, path);
    if (!up.ok) {
      setError(up.error);
      setState("error");
      return;
    }
    start(async () => {
      const res = await sendClip({ homeworkId, path });
      if (!res.ok) {
        setError(res.error ?? "Couldn't send the clip.");
        setState("error");
        return;
      }
      setState("sent");
    });
  }

  return (
    <div className={cn("mt-2", compact ? "pl-[52px]" : "")}>
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
      {state === "sent" ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
          <Check className="h-3.5 w-3.5" /> Clip sent. Your coach will take a look.
        </span>
      ) : (
        <button
          type="button"
          disabled={state === "uploading"}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-accent/50 hover:text-bone disabled:opacity-60"
          aria-label={`Send a clip of ${title}`}
        >
          {state === "uploading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Video className="h-3.5 w-3.5" />
          )}
          {state === "uploading" ? "Sending…" : "Send a clip"}
        </button>
      )}
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
