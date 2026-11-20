"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startClub } from "@/lib/elite/tracker-actions";
import {
  CLUB_CAP_MESSAGE,
  CLUB_NAME_MAX,
  CLUBS_PER_PLAYER,
  clubLink,
  clubPlaceLine,
  mayStartClub,
  type MyClub,
  type RankingRow,
} from "@/lib/elite/tracker";
import { ActionSheet } from "./ActionSheet";
import { Crest } from "./FreeAvatar";
import { IconChevron, IconPlus } from "./FreeIcons";
import { sendLink } from "./send-link";

type Sheet = null | { kind: "start" } | { kind: "started"; name: string; code: string };

// Your clubs, on My week (the mock, screen 12): one card each, with the
// crest, the name and the club's place this week, ending in a dashed
// "Start a club" card. A card opens the club's page; "Top clubs" opens the
// ranking. Up to three clubs a player.
export function ClubsSection({
  clubs,
  ranking,
  appUrl,
}: {
  clubs: MyClub[];
  ranking: { rows: RankingRow[]; total: number };
  appUrl: string;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const canStart = mayStartClub(clubs.length);
  const placeOf = new Map(ranking.rows.map((r) => [r.id, r.place]));

  function open(next: Sheet) {
    setError(null);
    setCopied(false);
    setSheet(next);
  }

  async function share(code: string) {
    if ((await sendLink(clubLink(appUrl, code))) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section className="mt-1">
      <div className="flex items-center justify-between pr-2">
        <h2 className="px-[18px] pb-2 pt-[22px] text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">Your clubs</h2>
        {ranking.rows.length > 0 && (
          <Link href="/log/clubs" className="mt-3 inline-flex min-h-[44px] items-center gap-1 px-2.5 text-[13px] font-semibold text-white/70">
            Top clubs
            <IconChevron size={16} />
          </Link>
        )}
      </div>
      <ul className="no-scrollbar flex gap-2.5 overflow-x-auto px-[18px]">
        {clubs.map((c) => {
          const line = clubPlaceLine(placeOf.get(c.id) ?? null, ranking.total);
          return (
            <li key={c.id} className="w-[152px] shrink-0">
              <Link href={`/log/club/${c.id}`} className="block h-full rounded-[20px] bg-[#141414] p-[14px]">
                <Crest club={c} size={46} className="mb-3" />
                <span className="line-clamp-2 block h-[34px] text-[14px] font-bold leading-[1.2]">{c.name}</span>
                <b className="mt-2 block font-display text-[24px] font-black leading-none">{line.big}</b>
                <span className="mt-[3px] block text-[11.5px] text-white/60">{c.ended ? "Ended" : line.small}</span>
              </Link>
            </li>
          );
        })}
        <li className="w-[152px] shrink-0">
          {canStart ? (
            <button
              type="button"
              onClick={() => {
                setName("");
                open({ kind: "start" });
              }}
              className="flex h-full min-h-[150px] w-full flex-col items-center justify-center gap-2.5 rounded-[20px] border-[1.5px] border-dashed border-[#2c2c2c] text-[14px] font-semibold text-white/60"
            >
              <IconPlus />
              Start a club
            </button>
          ) : (
            <p className="flex h-full min-h-[150px] items-center rounded-[20px] border-[1.5px] border-dashed border-[#2c2c2c] p-[14px] text-[13px] leading-snug text-white/60">
              {CLUB_CAP_MESSAGE}
            </p>
          )}
        </li>
      </ul>

      {sheet?.kind === "start" && (
        <ActionSheet label="Start a club" title="Start a club" onClose={() => open(null)}>
          <div className="px-[22px] pb-2">
            <p className="text-[14px] leading-relaxed text-white/70">
              Your club team, a tournament team, the players you train with. Send the club&apos;s link; you let in
              each player who asks, and they become friends with everyone on it. You can be in {CLUBS_PER_PLAYER} clubs.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, CLUB_NAME_MAX))}
              maxLength={CLUB_NAME_MAX}
              aria-label="Club name"
              placeholder="Club name"
              className="mt-3 h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-[16px] text-bone placeholder:text-white/50 focus:border-white/30 focus:outline-none"
            />
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              type="button"
              disabled={busy || !name.trim()}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const res = await startClub(name);
                  if (!res.ok) return setError(res.error);
                  open({ kind: "started", name: name.trim(), code: res.code });
                  router.refresh();
                })
              }
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
            >
              Start the club
            </button>
          </div>
        </ActionSheet>
      )}

      {sheet?.kind === "started" && (
        <ActionSheet label={sheet.name} title={sheet.name} onClose={() => open(null)}>
          <div className="px-[22px] pb-2">
            <p className="text-[14px] leading-relaxed text-white/70">
              Your club is ready. Send the link to your teammates; everyone who joins with it is in.
            </p>
            <button
              type="button"
              onClick={() => share(sheet.code)}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black"
            >
              {copied ? "Link copied" : "Send the club's link"}
            </button>
          </div>
        </ActionSheet>
      )}
    </section>
  );
}
