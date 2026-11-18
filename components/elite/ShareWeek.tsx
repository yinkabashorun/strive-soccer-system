"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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
export function ShareWeek({ stamp }: { stamp: string }) {
  const ready = useRef<Ready | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [again, setAgain] = useState(false);

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
    <div>
      <button
        type="button"
        onClick={onTap}
        disabled={busy}
        className="flex h-14 w-full items-center justify-center rounded-2xl border border-white/20 font-display text-xl font-black uppercase tracking-wide text-bone disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : again ? "Tap again to share" : "Share my week"}
      </button>
      {note && (
        <p className="mt-2 text-center text-sm text-white/60" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
