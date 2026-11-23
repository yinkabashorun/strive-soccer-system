"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmFriend } from "@/lib/elite/tracker-actions";
import { FREE_HOME, addFriendQuestion, friendRequestLine, requestSentLine } from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";

// "Send Marcus B. a friend request?" The one way to ask for a friend while
// signed in: open a teammate's link, then send the request here. They are
// friends once Marcus accepts (072). Asked once; either answer takes the
// code out of the address. There is no search and no list of other players.
export function FriendAsk({ ask }: { ask: { code: string; name: string } | null }) {
  const router = useRouter();
  const [asking, setAsking] = useState(ask);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
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
      if (res.result === "sent") {
        setSent(asking?.name ?? null);
        setAsking(null);
        router.replace(FREE_HOME);
        return;
      }
      setAsking(null);
      router.replace(FREE_HOME);
      router.refresh();
    });
  }

  if (sent) {
    return (
      <TrackerSheet title="Request sent" onClose={() => setSent(null)}>
        <p className="text-[15px] leading-relaxed text-white/70">{requestSentLine(sent)}</p>
        <button
          type="button"
          onClick={() => setSent(null)}
          className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black"
        >
          Done
        </button>
      </TrackerSheet>
    );
  }
  if (!asking) return null;
  return (
    <TrackerSheet title={addFriendQuestion(asking.name)} onClose={() => answer(false)}>
      <p className="text-[15px] leading-relaxed text-white/70">
        {friendRequestLine(asking.name)} You can take a friend off or block them at any time.
      </p>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(false)}
          className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
        >
          Not now
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => answer(true)}
          className="flex h-14 items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
        >
          Send request
        </button>
      </div>
    </TrackerSheet>
  );
}
