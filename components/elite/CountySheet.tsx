"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setClubCounty } from "@/lib/elite/club-teams-actions";
import { COUNTY_GROUPS, OPEN_TO_GAMES_LINE } from "@/lib/elite/club-teams";
import { ActionSheet } from "./ActionSheet";

// The captain's county and "Open to games" (077). The county is picked
// from the fixed list; nobody types a place here. Open to games lets the
// captains of other clubs in the county see this club's name, crest,
// record and player count, and send it a game.
export function CountySheet({
  clubId,
  county,
  open,
  onClose,
}: {
  clubId: string;
  county: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pick, setPick] = useState(county ?? "");
  const [on, setOn] = useState(open);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <ActionSheet label="County and games" title="County and games" onClose={onClose}>
      <div className="px-[22px] pb-2">
        <label className="block text-[13px] font-semibold text-white/70" htmlFor="club-county">
          Your club&apos;s county
        </label>
        <select
          id="club-county"
          value={pick}
          onChange={(e) => {
            setPick(e.target.value);
            if (!e.target.value) setOn(false);
          }}
          className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-black px-3 text-[16px] text-bone focus:border-white/30 focus:outline-none"
        >
          <option value="">Pick a county</option>
          {COUNTY_GROUPS.map((g) => (
            <optgroup key={g.state} label={g.label}>
              {g.counties.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={!pick}
          onClick={() => setOn(!on)}
          className="mt-4 flex min-h-[56px] w-full items-center justify-between gap-3 text-left disabled:opacity-50"
        >
          <span>
            <span className="block text-[16px] font-semibold">Open to games</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/60">{OPEN_TO_GAMES_LINE}</span>
          </span>
          <span className={"relative h-[30px] w-[50px] shrink-0 rounded-full " + (on ? "bg-accent" : "bg-[#333]")} aria-hidden>
            <span className={"absolute top-[3px] h-6 w-6 rounded-full bg-white transition-all " + (on ? "left-[23px]" : "left-[3px]")} />
          </span>
        </button>
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await setClubCounty(clubId, pick || null, on);
              if (!res.ok) return setError(res.error);
              onClose();
              router.refresh();
            })
          }
          className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-bone text-[15px] font-bold text-black disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </ActionSheet>
  );
}
