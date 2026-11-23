"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveUsername } from "@/lib/elite/profile-actions";
import { USERNAME_MESSAGES } from "@/lib/elite/username";
import { UsernameInput, useUsernameCheck } from "./ProfileSetup";

// Change the @username later (You, the free app's settings). The same
// check as at sign-up, as they type; Save only once it is theirs to take.
// No waiting period between changes; it always stays unique (081).
export function UsernameEditor({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const state = useUsernameCheck(value, current);
  const [busy, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const changed = value !== (current ?? "");

  function save() {
    if (state.kind !== "ok" || !changed) return;
    setNote(null);
    start(async () => {
      const res = await saveUsername(state.name).catch(() => null);
      if (!res) return setNote(USERNAME_MESSAGES.offline);
      if (!res.ok) return setNote(res.error);
      setNote("Saved.");
      router.refresh();
    });
  }

  return (
    <div className="px-[18px]">
      <p className="mb-2 text-[13px] font-semibold text-white/70">Username</p>
      <UsernameInput value={value} onChange={setValue} state={state} onEnter={save} />
      <button
        type="button"
        onClick={save}
        disabled={busy || !changed || state.kind !== "ok"}
        className="press mt-1 flex h-11 items-center justify-center rounded-xl bg-bone px-5 text-[15px] font-bold text-black disabled:opacity-40"
      >
        {busy ? "Saving" : "Save username"}
      </button>
      {note && (
        <p role="status" className={note === "Saved." ? "mt-2 text-[13px] text-white/60" : "mt-2 text-[13px] text-red-400"}>
          {note}
        </p>
      )}
    </div>
  );
}
