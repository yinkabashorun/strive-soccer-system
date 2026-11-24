"use client";

import { useState } from "react";
import type { MatchupView } from "@/lib/elite/club-matchups";
import {
  MATCHUP_HOW_LINES,
  MATCHUP_HOW_LINK,
  MATCHUP_HOW_TITLE,
  MATCHUP_LAST_WEEK,
  MATCHUP_PER_PLAYER,
  MATCHUP_TITLE,
} from "@/lib/elite/club-matchup-words";
import { ActionSheet } from "./ActionSheet";
import { Crest } from "./FreeAvatar";

// The weekly club matchup on a club's page (083), right under the club's
// week: both crests and names, each club's time per player as two big
// numbers, and one plain line that says who is ahead (or who won the
// week). Every word comes from lib/elite/club-matchup-words.ts, the same
// file the iPhone app reads; the numbers come from the same server
// function. Positive only: nothing here lists a player.
export function MatchupCard({ matchup }: { matchup: MatchupView }) {
  const [how, setHow] = useState(false);
  return (
    <section className="mx-[18px] mt-3 rounded-[22px] bg-[#141414] px-[18px] pb-3 pt-[15px]" aria-label={MATCHUP_TITLE}>
      <h2 className="text-[11px] font-bold uppercase tracking-[2.2px] text-white/60">{MATCHUP_TITLE}</h2>
      {matchup.mine && matchup.theirs && (
        <div className="mt-3 flex items-start gap-3">
          {[matchup.mine, matchup.theirs].map((side) => (
            <div key={side.id} className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Crest club={side} size={32} />
                <span className="min-w-0 truncate text-[14.5px] font-bold">{side.name}</span>
              </div>
              <b className="mt-2 block font-display text-[34px] font-black leading-none">{side.time}</b>
              <span className="text-[12px] text-white/60">{MATCHUP_PER_PLAYER}</span>
            </div>
          ))}
        </div>
      )}
      <p className={"text-[15px] font-semibold " + (matchup.mine ? "mt-3" : "mt-2")}>{matchup.line}</p>
      {matchup.last && (
        <p className="mt-1.5 text-[13px] text-white/60">
          {MATCHUP_LAST_WEEK}: {matchup.last}
        </p>
      )}
      <button type="button" onClick={() => setHow(true)} className="mt-1 flex min-h-[44px] items-center text-[13.5px] font-semibold text-white/70">
        {MATCHUP_HOW_LINK}
      </button>
      {how && (
        <ActionSheet label={MATCHUP_HOW_TITLE} title={MATCHUP_HOW_TITLE} onClose={() => setHow(false)}>
          <div className="space-y-3 px-[22px] pb-4">
            {MATCHUP_HOW_LINES.map((line) => (
              <p key={line} className="text-[15px] leading-relaxed text-white/80">
                {line}
              </p>
            ))}
          </div>
        </ActionSheet>
      )}
    </section>
  );
}
