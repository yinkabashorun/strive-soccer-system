"use client";

import { useEffect, useRef } from "react";

const ROW = 50; // px, one row of the wheel

// One column of a scroll wheel (the mock, screen 10): the rows snap to the
// band in the middle, the chosen row is bright and the ones around it fade.
// A row can also be tapped, and the arrow keys move it one row.
export function WheelColumn<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
  className = "",
}: {
  label: string;
  options: T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.indexOf(value));
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start on the chosen row, and follow it when it changes from outside.
  useEffect(() => {
    const el = box.current;
    if (el && Math.round(el.scrollTop / ROW) !== index) el.scrollTo({ top: index * ROW });
  }, [index]);

  function onScroll() {
    const el = box.current;
    if (!el) return;
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ROW)));
      if (options[i] !== value) onChange(options[i]);
    }, 80);
  }

  function go(i: number) {
    const next = Math.min(options.length - 1, Math.max(0, i));
    box.current?.scrollTo({ top: next * ROW, behavior: "smooth" });
    onChange(options[next]);
  }

  return (
    <div
      ref={box}
      role="listbox"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          go(index + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          go(index - 1);
        }
      }}
      className={"no-scrollbar relative z-[1] h-[250px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-[100px] text-center focus:outline-none " + className}
    >
      {options.map((o, i) => {
        const d = Math.abs(i - index);
        return (
          <div
            key={String(o)}
            role="option"
            aria-selected={d === 0}
            onClick={() => go(i)}
            className={
              "flex h-[50px] snap-center items-center justify-center " +
              (d === 0
                ? "text-[22px] font-bold text-bone"
                : d === 1
                  ? "text-[19px] font-semibold text-bone opacity-50"
                  : "text-[16px] font-semibold text-bone opacity-25")
            }
          >
            {render ? render(o) : String(o)}
          </div>
        );
      })}
    </div>
  );
}

// The band behind the chosen row, and the columns side by side.
export function Wheel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-[22px] mt-10 flex h-[250px] gap-2.5">
      <div className="pointer-events-none absolute inset-x-0 top-[100px] h-[50px] rounded-[14px] bg-[#1e1e1e]" aria-hidden />
      {children}
    </div>
  );
}
