"use client";

import { useEffect, type ReactNode } from "react";

// Every menu in the free app is this: a sheet from the bottom with a
// grabber, rounded 26 px at the top, rows with an icon, the ones that
// remove or report something in red (the mock, screen 6). Optional big
// tiles above the rows (Profile, Props). It closes on a tap outside it
// and on Escape.
export type SheetRow = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  red?: boolean;
  checked?: boolean; // a choice in a list (the report reasons)
  disabled?: boolean;
};
export type SheetKey = { label: string; icon: ReactNode; onClick: () => void; on?: boolean };

export function ActionSheet({
  label,
  title,
  keys,
  rows,
  note,
  children,
  onClose,
}: {
  label: string; // what a screen reader hears this sheet is
  title?: string;
  keys?: SheetKey[];
  rows?: SheetRow[];
  note?: string;
  children?: ReactNode;
  onClose: () => void;
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[26px] bg-[#1a1a1a] pb-[calc(26px+env(safe-area-inset-bottom))] pt-[10px]"
      >
        <div className="mx-auto mb-[14px] h-[5px] w-[38px] rounded-[3px] bg-[#444]" aria-hidden />
        {title && <h2 className="px-[22px] pb-2 text-[17px] font-bold">{title}</h2>}
        {keys && keys.length > 0 && (
          <div className="flex gap-[10px] px-4 pb-3 pt-0.5">
            {keys.map((k) => (
              <button
                key={k.label}
                type="button"
                onClick={k.onClick}
                aria-pressed={k.on === undefined ? undefined : k.on}
                className={
                  "flex h-[82px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl text-[13px] font-semibold " +
                  (k.on ? "bg-[#2e2a1c] text-accent" : "bg-[#242424] text-bone")
                }
              >
                {k.icon}
                {k.label}
              </button>
            ))}
          </div>
        )}
        {keys && keys.length > 0 && rows && rows.length > 0 && <div className="my-1.5 h-px bg-white/[0.08]" />}
        {rows?.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.onClick}
            disabled={r.disabled}
            role={r.checked === undefined ? undefined : "menuitemradio"}
            aria-checked={r.checked === undefined ? undefined : r.checked}
            className={
              "flex h-14 w-full items-center gap-[14px] px-[22px] text-left text-[16.5px] font-semibold disabled:opacity-60 " +
              (r.red ? "text-[#ff5a4e]" : "text-bone")
            }
          >
            {r.icon}
            <span className="flex-1">{r.label}</span>
            {r.checked && (
              <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </button>
        ))}
        {children}
        {note && (
          <>
            <div className="my-1.5 h-px bg-white/[0.08]" />
            <p className="px-[22px] pb-1 pt-1.5 text-[14px] text-white/60">{note}</p>
          </>
        )}
      </div>
    </div>
  );
}
