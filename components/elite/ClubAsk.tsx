"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmClub } from "@/lib/elite/tracker-actions";
import { FREE_HOME, FREE_WEEK, clubAskQuestion } from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";

// "Join <club>?" The one way into a club while signed in: open its link,
// then say yes here. Joining makes you friends with everyone on it. A
// player at the cap is told plainly, with nothing to tap but OK.
export function ClubAsk({ ask }: { ask: { code: string; name: string; problem: string | null } | null }) {
  const router = useRouter();
  const [asking, setAsking] = useState(ask);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const askCode = ask?.code ?? null;
  useEffect(() => {
    setAsking(ask);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askCode]);

  function close() {
    setAsking(null);
    router.replace(FREE_HOME);
  }

  function yes() {
    const code = asking?.code;
    if (!code) return close();
    setError(null);
    start(async () => {
      const res = await confirmClub(code);
      if (!res.ok) return setError(res.error);
      setAsking(null);
      router.replace(FREE_WEEK);
      router.refresh();
    });
  }

  if (!asking) return null;
  return (
    <TrackerSheet title={clubAskQuestion(asking.name)} onClose={close}>
      {asking.problem ? (
        <>
          <p className="text-[15px] leading-relaxed text-white/70">{asking.problem}</p>
          <button
            type="button"
            onClick={close}
            className="mt-5 flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
          >
            OK
          </button>
        </>
      ) : (
        <>
          <p className="text-[15px] leading-relaxed text-white/70">
            You become friends with everyone in the club, and the club shows on your profile.
          </p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              No
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={yes}
              className="flex h-14 items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
            >
              Join
            </button>
          </div>
        </>
      )}
    </TrackerSheet>
  );
}
