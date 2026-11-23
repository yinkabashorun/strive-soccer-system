"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

// One screen of a sign-up or set-up, the way the big apps do it (Instagram
// the model, Nov 23 2026): a back chevron top left, a thin progress line,
// one question, and the main button pinned to the bottom, riding just above
// the keyboard when it is up, so the thumb never has to look for it.
// Used by the member quiz, the photo and username set-up, Strive Pro
// sign-up and the free app's sign-up.

// How far the on-screen keyboard covers the page, in px. Safari and the
// app's web view both shrink the visual viewport, not the layout one, so a
// bar fixed to the bottom would sit under the keyboard without this.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => setInset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

export function StepProgress({ at, of }: { at: number; of: number }) {
  const frac = of > 0 ? Math.min(1, Math.max(0, at / of)) : 0;
  return (
    <div
      className="h-[3px] w-full overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={of}
      aria-valuenow={at}
      aria-label={`Step ${at} of ${of}`}
    >
      <div className="h-full rounded-full bg-bone transition-[width] duration-300 ease-out" style={{ width: `${frac * 100}%` }} />
    </div>
  );
}

export function OnboardingShell({
  onBack,
  progress,
  eyebrow,
  title,
  lead,
  children,
  action,
  footer,
  stepKey,
}: {
  onBack?: (() => void) | null;
  progress?: { at: number; of: number } | null;
  eyebrow?: string | null;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children?: React.ReactNode;
  // the pinned main button (and anything right under it)
  action?: React.ReactNode;
  // quiet links under everything (Account, Sign out)
  footer?: React.ReactNode;
  // a new key plays the step's entrance
  stepKey?: string | number;
}) {
  const kb = useKeyboardInset();
  return (
    <div className="flex min-h-[100svh] flex-col bg-black text-bone">
      <div className="sticky top-0 z-10 bg-black px-4 pb-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        <div className="flex h-11 items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="press -ml-2 grid h-11 w-11 place-items-center rounded-full text-bone"
            >
              <ChevronLeft className="h-7 w-7" strokeWidth={2} />
            </button>
          ) : (
            <span className="h-11 w-11" aria-hidden />
          )}
        </div>
        {progress && <StepProgress at={progress.at} of={progress.of} />}
      </div>

      <div key={stepKey} className="flex flex-1 flex-col px-6 pt-4 animate-step-in">
        {eyebrow && <p className="m-eyebrow">{eyebrow}</p>}
        <h1 className={cn("m-head text-[32px] leading-[1.02]", eyebrow && "mt-2")}>{title}</h1>
        {lead && <p className="mt-2.5 text-[15px] leading-relaxed text-white/65">{lead}</p>}
        <div className="mt-6 flex-1">{children}</div>
        {footer && <div className="pb-4 pt-6">{footer}</div>}
      </div>

      {action && (
        <div
          className="sticky z-10 bg-black px-6 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-3 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:h-6 before:bg-[linear-gradient(180deg,rgba(0,0,0,0),#000)] before:content-['']"
          style={{ bottom: kb }}
        >
          {action}
        </div>
      )}
    </div>
  );
}
