"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPlayingFor } from "@/lib/elite/tracker-actions";
import { PLAYING_FOR_MAX } from "@/lib/elite/tracker";

// The one line a free player writes for their profile: who they play for.
// Friends and coaches see it; blank takes it off.
export function PlayingForField({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const changed = value.trim() !== (initial ?? "");

  return (
    <form
      className="p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await setPlayingFor(value);
          if (!res.ok) return setError(res.error);
          setSaved(true);
          router.refresh();
        });
      }}
    >
      <label className="block">
        <span className="mb-2 block text-[15px] font-semibold text-bone">Playing for</span>
        <input
          value={value}
          maxLength={PLAYING_FOR_MAX}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Your club or school team"
          className="h-12 w-full rounded-xl border border-white/15 bg-black px-3 text-[16px] text-bone placeholder:text-white/50"
        />
      </label>
      <p className="mt-2 text-[13px] text-white/60">Your friends see this on your profile. Leave it blank to take it off.</p>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || !changed}
        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-white/15 text-[15px] font-semibold text-bone disabled:opacity-60"
      >
        {saved && !changed ? "Saved" : "Save"}
      </button>
    </form>
  );
}
