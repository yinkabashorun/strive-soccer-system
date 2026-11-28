"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { weekCardDue, type WeekCard } from "@/lib/elite/week-recap";

// The week's card on the website's My week (lib/elite/week-recap.ts
// weekCard decides every word, and when: Sunday from noon New York about
// the week so far, Monday about the week closed; the iPhone app draws the
// same lines). "Got it" is remembered in this browser for the week the
// card is about, so one tap covers Sunday's card and Monday's. Storage can
// be missing or blocked: then the card simply shows until the tab is
// closed. Nothing is ever sent.
const KEY = "strive.recapSeen";

export function MondayCard({ card }: { card: WeekCard | null }) {
  // undefined until the browser's storage is read, so the card never
  // flashes on and off for a player who already put it away
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    try {
      setSeen(window.localStorage.getItem(KEY));
    } catch {
      setSeen(null);
    }
  }, []);
  if (seen === undefined || !card || !weekCardDue(card, seen)) return null;

  function dismiss() {
    if (!card) return;
    try {
      window.localStorage.setItem(KEY, card.week);
    } catch {
      // storage blocked: hidden for now all the same
    }
    setSeen(card.week);
  }

  return (
    <section className="mx-[18px] mt-[18px] rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      {card.best ? (
        <p className="flex items-center gap-1.5 text-[17px] font-semibold text-[#D4AF37]">
          <Star aria-hidden className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
          {card.headline}
        </p>
      ) : (
        <p className="text-[17px] font-semibold">{card.headline}</p>
      )}
      {card.gym ? <p className="mt-1 text-[14px] text-white/60">{card.gym}</p> : null}
      {card.friends ? <p className="mt-1.5 text-[14.5px]">{card.friends}</p> : null}
      <p className="mt-1.5 text-[14.5px] font-semibold">{card.close}</p>
      <button type="button" onClick={dismiss} className="mt-1 min-h-[44px] text-[14px] text-white/60">
        {card.dismiss}
      </button>
    </section>
  );
}
