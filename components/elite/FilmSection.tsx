"use client";

import { useRef, useState, useTransition } from "react";
import { CheckCircle2, Film, Loader2, MessageSquare, UploadCloud } from "lucide-react";
import type { FilmUpload } from "@/lib/elite/types";
import { createClient } from "@/lib/elite/supabase/client";
import { recordFilm } from "@/lib/elite/player-actions";
import { cn, timeAgo } from "@/lib/utils";

// Player-facing film area: an upload dropzone plus the list of uploads with
// coach notes. Uploads to Supabase Storage when configured; simulates in
// demo mode so the experience is intact either way.
export function FilmSection({
  initial,
  playerId,
}: {
  initial: FilmUpload[];
  playerId: string;
}) {
  const [films, setFilms] = useState<FilmUpload[]>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function onFile(file: File) {
    setBusy(true);
    setMsg(null);
    const title = file.name.replace(/\.[^.]+$/, "");
    const supabase = createClient();

    let url: string | null = null;
    if (supabase) {
      const path = `${playerId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("elite-film")
        .upload(path, file, { upsert: false });
      if (error) {
        setMsg("Upload failed: " + error.message);
        setBusy(false);
        return;
      }
      url = path;
      startTransition(() => {
        recordFilm({ title, url });
      });
    }

    const optimistic: FilmUpload = {
      id: `local-${Date.now()}`,
      player_id: playerId,
      title,
      url,
      thumbnail: null,
      coach_notes: null,
      status: "Uploaded",
      created_at: new Date().toISOString(),
    };
    setFilms((f) => [optimistic, ...f]);
    setBusy(false);
    setMsg("Uploaded. Your coach will review it and add notes.");
  }

  return (
    <div className="space-y-6">
      {/* Uploader */}
      <div
        onClick={() => !busy && inputRef.current?.click()}
        className={cn(
          "elite-card flex cursor-pointer flex-col items-center gap-3 border-dashed p-10 text-center transition-colors hover:border-accent/30 hover:bg-accent/[0.02]",
          busy && "pointer-events-none opacity-70"
        )}
      >
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent">
          {busy ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <div className="font-display text-xl font-bold uppercase tracking-tight">
          {busy ? "Uploading…" : "Upload game film"}
        </div>
        <p className="max-w-xs text-sm text-white/45">
          Tap to select a clip from your device. MP4 or MOV up to a few minutes
          works best.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {msg && (
        <div className="flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/[0.05] px-4 py-3 text-sm text-accent">
          <CheckCircle2 className="h-4 w-4" /> {msg}
        </div>
      )}

      {/* List */}
      {films.length === 0 ? (
        <div className="elite-card p-8 text-center text-white/45">
          No film yet. Upload your first clip to get coach notes.
        </div>
      ) : (
        <div className="space-y-3">
          {films.map((f) => (
            <div key={f.id} className="elite-card p-5">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-white/60">
                  <Film className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="truncate font-semibold text-bone">
                      {f.title}
                    </h4>
                    <StatusBadge status={f.status} />
                  </div>
                  <div className="mt-0.5 text-xs text-white/40">
                    {timeAgo(f.created_at)}
                  </div>
                  {f.coach_notes && (
                    <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                        <MessageSquare className="h-3 w-3" /> Coach notes
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                        {f.coach_notes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: FilmUpload["status"] }) {
  const styles: Record<FilmUpload["status"], string> = {
    Uploaded: "border-white/15 text-white/60",
    Analyzing: "border-blue-400/30 text-blue-300",
    Reviewed: "border-accent/30 text-accent",
  };
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        styles[status]
      )}
    >
      {status}
    </span>
  );
}
