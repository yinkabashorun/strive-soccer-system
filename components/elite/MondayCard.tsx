"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { recapDue, type WeekRecap } from "@/lib/elite/week-recap";

// The Monday moment on the website's My week (lib/elite/week-recap.ts
// decides every word; the iPhone app draws the same lines). "Got it" is
// remembered in this browser for the week, so the card shows once a week
// and is gone when put away. Storage can be missing or blocked: then the
// card simply shows until the tab is closed. Nothing is ever sent.
const KEY = "strive.recapSeen";

export function MondayCard({ recap }: { recap: WeekRecap | null }) {
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
  if (seen === undefined || !recap || !recapDue(recap, seen)) return null;

  function dismiss() {
    if (!recap) return;
    try {
      window.localStorage.setItem(KEY, recap.week);
    } catch {
      // storage blocked: hidden for now all the same
    }
    setSeen(recap.week);
  }

  return (
    <section className="mx-[18px] mt-[18px] rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[17px] font-semibold">{recap.trained}</p>
      {recap.gym ? <p className="mt-1 text-[14px] text-white/60">{recap.gym}</p> : null}
      {recap.place ? <p className="mt-1.5 text-[14.5px]">{recap.place}</p> : null}
      {recap.best ? (
        <p className="mt-2 flex items-center gap-1.5 text-[14.5px] font-semibold text-[#D4AF37]">
          <Star aria-hidden className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
          {recap.best}
        </p>
      ) : null}
      <button type="button" onClick={dismiss} className="mt-1 min-h-[44px] text-[14px] text-white/60">
        {recap.dismiss}
      </button>
    </section>
  );
}
