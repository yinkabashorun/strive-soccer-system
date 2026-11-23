"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmClub } from "@/lib/elite/tracker-actions";
import { FREE_HOME, clubAskLine, clubAskQuestion, clubRequestSentLine } from "@/lib/elite/tracker";
import { TrackerSheet } from "./TrackerSheet";

// "Ask to join <club>?" The one way into a club while signed in: open its
// link, then send the request here. The captain (or the coaches, for a club
// a coach made) lets the player in (073); then they are friends with
// everyone on it. A player at the cap is told plainly, with nothing to tap
// but OK.
export function ClubAsk({
  ask,
}: {
  ask: { code: string; name: string; problem: string | null; byCoach?: boolean } | null;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(ask);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ name: string; byCoach: boolean } | null>(null);
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
      setSent(asking ? { name: asking.name, byCoach: Boolean(asking.byCoach) } : null);
      setAsking(null);
      router.replace(FREE_HOME);
    });
  }

  if (sent) {
    return (
      <TrackerSheet title="Request sent" onClose={() => setSent(null)}>
        <p className="text-[15px] leading-relaxed text-white/70">{clubRequestSentLine(sent.name, sent.byCoach)}</p>
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
          <p className="text-[15px] leading-relaxed text-white/70">{clubAskLine(Boolean(asking.byCoach))}</p>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={close}
              className="flex h-14 items-center justify-center rounded-2xl border border-white/15 text-[15px] font-semibold text-bone"
            >
              Not now
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={yes}
              className="flex h-14 items-center justify-center rounded-2xl bg-bone font-display text-xl font-black uppercase tracking-wide text-black disabled:opacity-60"
            >
              Ask to join
            </button>
          </div>
        </>
      )}
    </TrackerSheet>
  );
}
