"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { answerGame, answerRoster, answerScore, answerTogether } from "@/lib/elite/club-teams-actions";
import { NEEDS_ORGANIZER_OK, WAIVER_MINOR_LINE, organizedBy, rosterAskLine, togetherAskLine } from "@/lib/elite/club-teams";
import type { TeamAsks } from "@/lib/elite/club-teams-server";
import { fmtDuration } from "@/lib/elite/time-trained";
import { AppLink } from "./AppLink";
import { Crest, FreeAvatar } from "./FreeAvatar";
import { PlayTermsSheet } from "./PlayTermsSheet";

// The one-tap cards a club asks of a player (077), under the friend
// requests on the Friends tab. In the app only: nothing is texted.
//   - a captain: another club sent a game (Accept or Pass), or entered a
//     score (Confirm or Not right; no answer in 24 hours and it counts)
//   - a player: their captain put them on a Strive event's roster ("I'm
//     in" accepts the event's waiver)
//   - a player: a teammate says they trained together (Add it to my week)
export function TeamRequests({ asks }: { asks: TeamAsks }) {
  const router = useRouter();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<(() => void) | null>(null);
  const [busy, start] = useTransition();
  const live = (k: string) => !gone.has(k);
  const any =
    asks.games.some((g) => live(`g:${g.id}`)) ||
    asks.scores.some((s) => live(`s:${s.id}`)) ||
    asks.rosters.some((r) => live(`r:${r.entryId}`)) ||
    asks.together.some((t) => live(`t:${t.logId}`));
  if (!any) return null;

  function act(key: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const res = await run().catch(() => ({ ok: false as const, error: "We could not reach the server. Try again in a minute." }));
      if (!res.ok) {
        if (res.error === NEEDS_ORGANIZER_OK) return setOrganizer(() => () => act(key, run));
        return setError(res.error);
      }
      setGone((g) => new Set([...g, key]));
      router.refresh();
    });
  }

  const card = "border-t border-white/[0.07] py-3 first:border-0";
  const no = "h-11 rounded-full border border-white/15 px-4 text-[14px] font-semibold text-white/70 disabled:opacity-60";
  const yes = "h-11 rounded-full bg-bone px-4 text-[14px] font-semibold text-black disabled:opacity-60";

  return (
    <section aria-label="Your clubs" className="mx-[18px] mt-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-2">
      <ul>
        {asks.games
          .filter((g) => live(`g:${g.id}`))
          .map((g) => (
            <li key={g.id} className={card}>
              <div className="flex items-center gap-3">
                <Crest club={{ id: g.fromId, name: g.from }} size={40} />
                <Link href={`/log/plan/${g.id}`} className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] text-bone">{g.from} wants a game</span>
                  <span className="block text-[12.5px] text-white/60">
                    {g.when} · {fmtDuration(g.minutes)} · {g.place}
                  </span>
                  <span className="block text-[12px] text-white/60">{organizedBy(g.from)}, against {g.to}.</span>
                </Link>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={busy} className={no} onClick={() => act(`g:${g.id}`, () => answerGame(g.id, false))}>
                  Pass
                </button>
                <button type="button" disabled={busy} className={yes} onClick={() => act(`g:${g.id}`, () => answerGame(g.id, true))}>
                  Accept
                </button>
              </div>
            </li>
          ))}
        {asks.scores
          .filter((s) => live(`s:${s.id}`))
          .map((s) => (
            <li key={s.id} className={card}>
              <Link href={`/log/plan/${s.id}`} className="block">
                <span className="block text-[15px] text-bone">
                  {s.from} {s.score[0]} - {s.score[1]} {s.to}
                </span>
                <span className="block text-[12.5px] text-white/60">{s.enteredBy}&apos;s captain entered the score. Is it right?</span>
              </Link>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={busy} className={no} onClick={() => act(`s:${s.id}`, () => answerScore(s.id, false))}>
                  Not right
                </button>
                <button type="button" disabled={busy} className={yes} onClick={() => act(`s:${s.id}`, () => answerScore(s.id, true))}>
                  Confirm
                </button>
              </div>
            </li>
          ))}
        {asks.rosters
          .filter((r) => live(`r:${r.entryId}`))
          .map((r) => (
            <li key={r.entryId} className={card}>
              <span className="block text-[15px] text-bone">{rosterAskLine(r.club, r.event)}</span>
              <span className="block text-[12.5px] text-white/60">{r.when}</span>
              <span className="mt-1 block text-[12.5px] text-white/70">
                Saying you&apos;re in means you accept the{" "}
                <AppLink href={r.waiverUrl} title="The waiver" className="tap text-bone underline underline-offset-2">
                  event&apos;s waiver
                </AppLink>
                .{r.minor ? ` ${WAIVER_MINOR_LINE}` : ""}
              </span>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={busy} className={no} onClick={() => act(`r:${r.entryId}`, () => answerRoster(r.entryId, false))}>
                  Not this time
                </button>
                <button type="button" disabled={busy} className={yes} onClick={() => act(`r:${r.entryId}`, () => answerRoster(r.entryId, true))}>
                  I&apos;m in
                </button>
              </div>
            </li>
          ))}
        {asks.together
          .filter((t) => live(`t:${t.logId}`))
          .map((t) => (
            <li key={t.logId} className={card}>
              <div className="flex items-center gap-3">
                <FreeAvatar photo={null} initials={t.initials} size={40} />
                <span className="min-w-0 flex-1 text-[15px] leading-snug text-bone">{togetherAskLine(t.from, t.minutes, t.kind)}</span>
              </div>
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={busy} className={no} onClick={() => act(`t:${t.logId}`, () => answerTogether(t.logId, false))}>
                  No
                </button>
                <button type="button" disabled={busy} className={yes} onClick={() => act(`t:${t.logId}`, () => answerTogether(t.logId, true))}>
                  Add it
                </button>
              </div>
            </li>
          ))}
      </ul>
      {error && <p className="pb-1 text-[13px] text-red-400">{error}</p>}
      {organizer && (
        <PlayTermsSheet
          kind="organizer"
          onClose={() => setOrganizer(null)}
          then={() => {
            const retry = organizer;
            setOrganizer(null);
            retry();
          }}
        />
      )}
    </section>
  );
}
