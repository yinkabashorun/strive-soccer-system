"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Loader2, Play, X } from "lucide-react";
import { addPickedExtraSession, getExtraPicker } from "@/lib/elite/extra-actions";
import { EXTRA_PICK_MAX, pickBookendsLine, pickButtonLabel, type PickGroup } from "@/lib/elite/extra-pick";
import { cn } from "@/lib/utils";

type Loaded = { groups: PickGroup[]; warmUpMinutes: number; finisherMinutes: number; example: boolean };

// The full-screen drill picker for Extra Work (lib/elite/extra-pick.ts):
// every filmed drill the player can do, grouped by area, tap to tick in
// the order they want to train them, then one button. The warm-up is
// always added first; a finisher is added last when their plan needs one
// and they picked no strength drill. The server checks every pick again.
export function ExtraPicker({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  onAdded: (session: number | null) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picks, setPicks] = useState<string[]>([]);
  const [pending, start] = useTransition();

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    let live = true;
    getExtraPicker()
      .then((res) => {
        if (!live) return;
        if (res.ok) setData(res);
        else setLoadError(res.error);
      })
      .catch(() => live && setLoadError("The drills could not load. Close this and try again."));
    return () => {
      live = false;
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const all = data?.groups.flatMap((g) => g.drills) ?? [];
  const byId = new Map(all.map((d) => [d.id, d]));
  const strengthIds = new Set(data?.groups.find((g) => g.key === "strength")?.drills.map((d) => d.id) ?? []);
  const pickedStrength = picks.some((id) => strengthIds.has(id));
  const finisherAdded = Boolean(data && data.finisherMinutes > 0 && !pickedStrength);
  const minutes =
    picks.reduce((m, id) => m + (byId.get(id)?.minutes ?? 0), 0) +
    (data?.warmUpMinutes ?? 0) +
    (finisherAdded ? data?.finisherMinutes ?? 0 : 0);
  const full = picks.length >= EXTRA_PICK_MAX;

  function toggle(id: string) {
    setError(null);
    setPicks((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= EXTRA_PICK_MAX ? p : [...p, id]));
  }

  function submit() {
    if (picks.length === 0) return;
    setError(null);
    start(async () => {
      const res = await addPickedExtraSession(picks);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onAdded(res.session);
    });
  }

  if (!mounted) return null;
  const bookends = pickBookendsLine({ warmUp: (data?.warmUpMinutes ?? 0) > 0, finisherAdded });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick your drills"
      className="member-ui fixed inset-0 z-[70] flex flex-col bg-black text-bone"
    >
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+16px)]">
        <div>
          <h2 className="m-head text-[30px] leading-none">Pick your drills</h2>
          <p className="mt-1.5 text-[14px] text-white/65">
            Tap up to {EXTRA_PICK_MAX}, in the order you want to do them.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press grid h-11 w-11 shrink-0 place-items-center rounded-full bg-fill-2"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {!data && !loadError && (
          <div className="space-y-2.5 pt-2" aria-label="Loading the drills">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-2xl bg-fill" />
            ))}
          </div>
        )}
        {loadError && <p className="pt-4 text-[15px] text-white/70">{loadError}</p>}
        {data && data.groups.length === 0 && (
          <p className="pt-4 text-[15px] text-white/70">
            No drills fit your setup yet. Close this and tap an area instead, or ask your coach.
          </p>
        )}
        {data?.example && (
          <p className="mb-2 text-[13px] text-white/55">This is the example player, so nothing is saved.</p>
        )}
        {data?.groups.map((g) => (
          <section key={g.key} className="pt-4" aria-label={g.label}>
            <h3 className="m-eyebrow">{g.label}</h3>
            <ul className="mt-2 space-y-2">
              {g.drills.map((d) => {
                const order = picks.indexOf(d.id);
                const on = order >= 0;
                const off = !on && full;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      disabled={off || pending}
                      onClick={() => toggle(d.id)}
                      className={cn(
                        "press flex min-h-[72px] w-full items-center gap-3 rounded-2xl bg-fill p-2 pr-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]",
                        on && "shadow-[inset_0_0_0_1.5px_rgba(244,241,234,0.9)]",
                        off && "opacity-40"
                      )}
                    >
                      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-fill-2">
                        {d.poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={d.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <span className="grid h-full w-full place-items-center text-white/50">
                            <Play className="h-5 w-5" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold leading-snug">{d.title}</span>
                        <span className="mt-0.5 block text-[13px] text-white/55">
                          {d.minutes} min{d.doneBefore ? " · Done before" : ""}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px] font-bold",
                          on ? "bg-bone text-black" : "shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.25)]"
                        )}
                        aria-hidden="true"
                      >
                        {on ? order + 1 : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <footer className="border-t border-white/[0.07] bg-black px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3">
        {error && <p className="mb-2 text-[14px] text-red-400">{error}</p>}
        {data && (
          <p className="mb-2 text-[13px] text-white/60">
            {picks.length > 0 ? `About ${minutes} min. ` : ""}
            {bookends}
            {full ? ` ${EXTRA_PICK_MAX} is the most for one session.` : ""}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={picks.length === 0 || pending || !data}
          className="m-button press disabled:opacity-50"
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {pickButtonLabel(picks.length)}
        </button>
      </footer>
    </div>,
    document.body
  );
}
