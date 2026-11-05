"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Smartphone } from "lucide-react";
import { saveAlertPhone } from "@/lib/elite/coach-actions";

// Each coach sets their own number: it gets a text whenever a player
// uploads a video (a clip on a drill, a progress clip, Film Room clips).
export function AlertPhoneCard({ initial }: { initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await saveAlertPhone(phone);
      if (!res.ok) setError(res.error ?? "Couldn't save.");
      else setSaved(true);
    });
  }

  return (
    <div className="elite-card space-y-2 p-4">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
        <Smartphone className="h-3.5 w-3.5" /> Text me when a player uploads a video
      </div>
      <div className="flex gap-2">
        <input
          type="tel"
          inputMode="tel"
          placeholder="Your cell number"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSaved(false);
          }}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-bone placeholder:text-white/25 focus:border-accent/40 focus:outline-none"
          aria-label="Your cell number for upload texts"
        />
        <button onClick={save} disabled={pending || phone === initial && !saved} className="btn px-4 py-2 text-sm">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
        </button>
      </div>
      <p className="text-xs text-white/40">
        Coach Yinka and Coach Gary each add their own. One text per upload, with a link to watch it.
      </p>
      {saved && (
        <p className="flex items-center gap-1.5 text-xs text-accent">
          <Check className="h-3.5 w-3.5" /> Saved.
        </p>
      )}
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
