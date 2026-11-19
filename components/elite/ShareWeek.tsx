"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { fmtDuration } from "@/lib/elite/time-trained";

const CARD_URL = "/api/elite/tracker/card";
const FILE_NAME = "my-week-strive-elite.png";

type Ready = { stamp: string; file: File };

async function fetchCard(): Promise<File | null> {
  try {
    const res = await fetch(CARD_URL, { cache: "no-store" });
    if (!res.ok) return null;
    return new File([await res.blob()], FILE_NAME, { type: "image/png" });
  } catch {
    return null;
  }
}

function canShareFile(file: File): boolean {
  try {
    return typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true;
  } catch {
    return false;
  }
}

function saveToPhone(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// "Share my week": the week as a story-size picture, handed to the
// phone's own share sheet (the player picks Instagram, then Story). Where
// a browser cannot share a picture, it is saved instead and the line says
// what to do with it. Nothing is ever posted for the player.
//
// The picture is made ahead of the tap, and again a moment after the week
// changes, because an iPhone only opens the share sheet straight from a
// tap, not after a wait.
export function ShareWeek({
  stamp,
  minutes,
  preview,
}: {
  stamp: string;
  minutes: number; // this week's training, for the card's line
  preview: string | null; // the player's latest photo this week, for the little story
}) {
  const ready = useRef<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [again, setAgain] = useState(false);
  const time = fmtDuration(minutes);

  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const file = await fetchCard();
      if (live && file) ready.current = { stamp, file };
    }, 1500);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [stamp]);

  async function hand(file: File): Promise<void> {
    if (!canShareFile(file)) {
      saveToPhone(file);
      setNote("Saved to this device. Add it to your story from your photos or downloads.");
      return;
    }
    try {
      await navigator.share({ files: [file] });
      setAgain(false);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      if (name === "AbortError") return; // they closed the sheet
      // The phone wants the sheet opened straight from a tap: ask for one.
      setAgain(true);
    }
  }

  async function onTap() {
    setNote(null);
    if (ready.current?.stamp === stamp) return hand(ready.current.file);
    setBusy(true);
    const file = await fetchCard();
    setBusy(false);
    if (!file) {
      setNote("We could not make your card just now. Try again in a minute.");
      return;
    }
    ready.current = { stamp, file };
    await hand(file);
  }

  return (
    <div className="flex items-center gap-[14px] rounded-[20px] bg-[#141414] p-3">
      <div className="relative h-[110px] w-[62px] shrink-0 overflow-hidden rounded-[10px] bg-black" aria-hidden>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover brightness-[.6]" />
        ) : (
          <div className="h-full w-full bg-gradient-to-b from-[#2a2618] to-black" />
        )}
        <b className="absolute bottom-[18px] left-[5px] font-display text-[20px] font-black uppercase leading-[0.9]">
          {time.split(" ").map((p) => (
            <span key={p} className="block">
              {p}
            </span>
          ))}
        </b>
        <span className="absolute bottom-[5px] left-[5px] origin-bottom-left scale-[.55] whitespace-nowrap text-[11px] font-bold leading-none tracking-[1px] text-accent">
          STRIVE ELITE
        </span>
      </div>
      <div className="min-w-0">
        <b className="block text-[16px] font-bold">Your week, ready to post</b>
        <span className="mt-[3px] block text-[13px] leading-[1.3] text-white/60">{time} so far. Put it on your story.</span>
        <button
          type="button"
          onClick={onTap}
          disabled={busy}
          className="mt-2.5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-bone px-4 text-[14px] font-bold text-black disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : again ? "Tap again to share" : "Share to my story"}
        </button>
        {note && (
          <p className="mt-2 text-[13px] text-white/60" aria-live="polite">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
