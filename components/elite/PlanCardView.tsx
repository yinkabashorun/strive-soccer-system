"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setImIn } from "@/lib/elite/club-teams-actions";
import { NEEDS_PLAYER_OK, inCountLine, organizedBy } from "@/lib/elite/club-teams";
import type { PlanCard } from "@/lib/elite/club-teams-server";
import { fmtDuration } from "@/lib/elite/time-trained";
import { Crest } from "./FreeAvatar";
import { IconCheck, IconLock } from "./FreeIcons";
import { PlayTermsSheet } from "./PlayTermsSheet";

// One session or game on a club page (the mock, screen 13): what it is,
// when and where, who organized it ("Organized by" a club, never Strive),
// how many are in, and the I'm in button. The card opens its own page.
export function PlanCardView({ card, perspective }: { card: PlanCard; perspective: string }) {
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const ours = card.opponent && card.opponent.id === perspective ? card.opponent : card.organizer;
  const theirs = card.opponent ? (ours.id === card.organizer.id ? card.opponent : card.organizer) : null;

  function toggle(next: boolean) {
    setError(null);
    start(async () => {
      const res = await setImIn(card.id, next).catch(() => ({ ok: false as const, error: "We could not reach the server. Try again in a minute." }));
      if (!res.ok) return res.error === NEEDS_PLAYER_OK ? setSheet(true) : setError(res.error);
      router.refresh();
    });
  }

  const label =
    card.kind === "training"
      ? "Club training · Members only"
      : card.status === "pending"
        ? "Game · Waiting on their captain"
        : card.result?.state === "confirmed"
          ? "Game · Final"
          : "Game · Club vs club";

  return (
    <div className="mx-[18px] rounded-[22px] bg-[#141414] px-[18px] pb-4 pt-[15px]">
      <Link href={`/log/plan/${card.id}`} className="block">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[2.2px] text-white/60">
          {card.kind === "training" && <IconLock size={13} />}
          {label}
        </span>
        {card.kind === "training" ? (
          <span className="mt-1.5 block font-display text-[24px] font-black uppercase leading-[1]">{card.title ?? "Club training"}</span>
        ) : (
          <span className="mt-2.5 flex items-center gap-2.5">
            <Crest club={ours} size={36} />
            <span className="min-w-0 truncate text-[15.5px] font-bold">{ours.name}</span>
            {card.result?.score ? (
              <b className="shrink-0 font-display text-[22px] font-black text-accent">
                {ours.id === card.organizer.id ? card.result.score[0] : card.result.score[1]}
                {" - "}
                {ours.id === card.organizer.id ? card.result.score[1] : card.result.score[0]}
              </b>
            ) : (
              <span className="shrink-0 font-display text-[15px] font-black text-white/50">VS</span>
            )}
            {theirs && <Crest club={theirs} size={36} />}
            {theirs && <span className="min-w-0 truncate text-[15.5px] font-bold">{theirs.name}</span>}
          </span>
        )}
        <span className="mt-2 block text-[14px] text-white/60">
          {card.when} · {fmtDuration(card.minutes)} · {card.place}
        </span>
        <span className="mt-1 block text-[12.5px] text-white/60">{organizedBy(card.organizer.name)}</span>
        {card.result?.line && <span className="mt-1 block text-[13px] text-accent">{card.result.line}</span>}
      </Link>
      {card.status === "on" && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-[#222] px-3 text-[13.5px] font-bold">
            <IconCheck size={15} />
            {inCountLine(card.ins)}
          </span>
          {card.canJoin && (
            <button
              type="button"
              disabled={busy}
              onClick={() => toggle(!card.imIn)}
              aria-pressed={card.imIn}
              className={
                "ml-auto h-11 rounded-xl px-5 text-[14.5px] font-bold disabled:opacity-60 " +
                (card.imIn ? "border border-white/20 text-bone" : "bg-bone text-black")
              }
            >
              {card.imIn ? "You're in" : "I'm in"}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[13px] text-red-400">{error}</p>}
      {sheet && (
        <PlayTermsSheet
          kind="player"
          onClose={() => setSheet(false)}
          then={() => {
            setSheet(false);
            toggle(true);
          }}
        />
      )}
    </div>
  );
}
