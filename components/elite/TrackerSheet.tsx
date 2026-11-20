"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";

// A small sheet that comes up from the bottom of the free training log:
// a day's entries, "Add Marcus B. as a friend?", taking a friend off. It
// closes on the X, on a tap outside it and on Escape. It does not slide
// or fade: it is simply there, then gone.
export function TrackerSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-t-3xl border border-white/10 bg-[#101010] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-black uppercase leading-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-11 w-11 shrink-0 place-items-center text-white/60"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}
