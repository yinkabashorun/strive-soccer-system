"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Play } from "lucide-react";
import { dropDue, dropSeenKey, parseSeenWeek } from "@/lib/elite/experience";
import { feel } from "@/lib/elite/native";
import { askToStartSession } from "./start-signal";
import { cn } from "@/lib/utils";

export type DropCard = { n: number; label: string; line: string; image: string | null };

// The drop (Nov 21 2026): "Your week is here." The first time a new week
// is opened, before anything in it is done, its sessions land one after
// another, then Home. Once per week, per phone: which week was last shown
// is kept in this browser's storage (a per-viewer convenience; nothing is
// recorded anywhere and nothing breaks without it). The rule is
// dropDue in lib/elite/experience.ts.
export function WeekDrop({
  playerId,
  week,
  range,
  line,
  lastLine = null,
  startLabel,
  cards,
  anyDone,
  replay = false,
}: {
  playerId: string;
  week: number;
  range: string | null; // "Nov 23 to Nov 29"
  line: string; // "Four sessions. Built from your answers."
  lastLine?: string | null; // "Last week you finished 3 sessions and trained 58m."
  startLabel: string; // "Start session 1"
  cards: DropCard[];
  anyDone: boolean;
  replay?: boolean; // the example player's tour only: show it again
}) {
  const [show, setShow] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let seen: number | null = null;
    try {
      seen = parseSeenWeek(window.localStorage.getItem(dropSeenKey(playerId)));
    } catch {
      // Storage blocked (a private window): the drop simply shows.
    }
    if (replay || dropDue({ seenWeek: seen, week, sessions: cards.length, anyDone })) {
      setShow(true);
      feel("drill");
    }
  }, [playerId, week, cards.length, anyDone, replay]);

  // The one button: the drop goes away and the week's first session opens.
  function startNow() {
    close();
    setTimeout(askToStartSession, 280);
  }

  function close() {
    try {
      window.localStorage.setItem(dropSeenKey(playerId), String(week));
    } catch {
      // Nothing to keep; it may show again next time, which is harmless.
    }
    setClosing(true);
    setTimeout(() => setShow(false), 260);
  }

  if (!show) return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Week ${week} is here`}
      className={cn(
        "member-ui fixed inset-0 z-[65] flex flex-col bg-black text-bone transition-opacity duration-300",
        closing ? "opacity-0" : "animate-fade-in"
      )}
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-[calc(env(safe-area-inset-top)+56px)]">
        <div className="m-eyebrow animate-rise">
          Week {week}
          {range ? ` · ${range}` : ""}
        </div>
        <h1 className="mt-2.5 m-head text-[52px] leading-[0.98] animate-rise [animation-delay:80ms]">
          Your week
          <br />
          is here.
        </h1>
        <p className="mt-3 text-[16px] leading-snug text-white/65 animate-rise [animation-delay:160ms]">{line}</p>
        {lastLine && (
          <p className="mt-2 text-[14px] leading-snug text-gold animate-rise [animation-delay:220ms]">{lastLine}</p>
        )}

        <ol className="mt-6 space-y-2.5 pb-6">
          {cards.map((c, i) => (
            <li
              key={c.n}
              className={cn(
                "relative flex h-[96px] overflow-hidden rounded-[24px] bg-fill opacity-0 animate-land",
                i === 0 && "shadow-[0_0_0_2.5px_#F5F4EF]"
              )}
              style={{ animationDelay: `${300 + i * 110}ms` }}
            >
              {c.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_45%] brightness-[0.55]" />
              )}
              <div className="relative flex flex-1 flex-col justify-between px-[18px] py-4">
                <span className="m-head text-[26px] leading-none">{c.label}</span>
                <span className="text-[13px] text-white/80">{c.line}</span>
              </div>
              {i === 0 && (
                <div className="relative grid w-[80px] place-items-center" aria-hidden>
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-bone text-black">
                    <Play className="ml-0.5 h-[18px] w-[18px]" fill="currentColor" />
                  </span>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="px-5 pt-2 pb-safe">
        <button
          onClick={startNow}
          className="m-button opacity-0 animate-rise"
          style={{ animationDelay: `${420 + cards.length * 110}ms` }}
        >
          <Play className="h-5 w-5" fill="currentColor" />
          {startLabel}
        </button>
        <button
          onClick={close}
          className="mb-2 mt-1 min-h-[44px] w-full text-[14px] font-semibold text-white/60 opacity-0 animate-rise"
          style={{ animationDelay: `${480 + cards.length * 110}ms` }}
        >
          Not now
        </button>
      </div>
    </div>,
    document.body
  );
}
