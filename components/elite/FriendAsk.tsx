"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmFriend } from "@/lib/elite/tracker-actions";
import { FREE_HOME, addFriendQuestion } from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";

// "Add Marcus B. as a friend?" The one way to make a friend while signed
// in: open a teammate's link, then say yes here. Asked once; either answer
// takes the code out of the address. There is no search, no list of other
// players and no requests.
export function FriendAsk({ ask }: { ask: { code: string; name: string } | null }) {
  const router = useRouter();
  const [asking, setAsking] = useState(ask);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // A link opened while this screen is already up brings its own question.
  const askCode = ask?.code ?? null;
  useEffect(() => {
    setAsking(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askCode]);

  function answer(yes: boolean) {
    const code = asking?.code;
    setError(null);
    if (!yes || !code) {
      setAsking(null);
      router.replace(FREE_HOME);
      return;
    }
    start(async () => {
      const res = await confirmFriend(code);
      if (!res.ok) return setError(res.error);
      setAsking(null);
      router.replace(FREE_HOME);
      router.refresh();
    });
  }

  if (!asking) return null;
  return (
    <TrackerSheet title={addFriendQuestion(asking.name)} onClose={() => answer(false)}>
      <p className="text-[15px] leading-relaxed text-white/70">
        You will see each other&apos;s training and the photos you post. You can take a friend off or block them
        at any time.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(false)}
          className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
        >
          No
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(true)}
          className="flex h-14 items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
        >
          Yes
        </button>
      </div>
    </TrackerSheet>
  );
}
