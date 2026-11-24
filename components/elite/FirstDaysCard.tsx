"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { FIRST_DAYS_HIDDEN_KEY, FIRST_DAYS_HIDE, type FirstDays, type FirstStepKey } from "@/lib/elite/first-days";
import { sendLink } from "./send-link";
import { cn } from "@/lib/utils";

// Your first days (lib/elite/first-days.ts): four things a new player does
// once, each one tap from here. A done row turns gold and stays. The list
// is gone when all four are done or the first days are over; "Hide this
// list" puts it away on this device.
export function FirstDaysCard({
  list,
  inviteLink,
  onPost,
}: {
  list: FirstDays;
  inviteLink: string;
  onPost: () => void;
}) {
  const [hidden, setHidden] = useState(true);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    try {
      setHidden(window.localStorage.getItem(FIRST_DAYS_HIDDEN_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;

  const hide = () => {
    try {
      window.localStorage.setItem(FIRST_DAYS_HIDDEN_KEY, "1");
    } catch {
      // nothing to keep; it shows again next time, which is harmless
    }
    setHidden(true);
  };
  const send = async () => {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const row = "flex min-h-[52px] w-full items-center gap-3 px-4 text-left";
  const inner = (key: FirstStepKey, label: string, note: string | null, done: boolean) => (
    <>
      <span
        aria-hidden
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-full",
          done ? "metal-disc" : "border border-white/25"
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
      </span>
      <span className={cn("min-w-0 flex-1 text-[15px] font-semibold", done ? "text-white/60" : "text-bone")}>
        {label}
        {done && <span className="sr-only">, done</span>}
      </span>
      {!done && (note || (key === "friends" && copied)) && (
        <span className="text-[13px] text-white/60">{key === "friends" && copied ? "Link copied" : note}</span>
      )}
      {!done && key !== "props" && <ChevronRight className="h-4 w-4 shrink-0 text-white/50" aria-hidden />}
    </>
  );

  return (
    <section className="m-card mx-[18px] mt-4 overflow-hidden" aria-label={list.title}>
      <div className="flex items-baseline justify-between px-4 pt-4">
        <h3 className="m-head text-[20px] leading-none">{list.title}</h3>
        <span className="text-[13px] text-white/60">
          {list.done} of {list.total}
        </span>
      </div>
      <ul className="mt-2 divide-y divide-white/[0.06]">
        {list.steps.map((s) => (
          <li key={s.key}>
            {s.done || s.key === "props" ? (
              <div className={row}>{inner(s.key, s.label, s.note, s.done)}</div>
            ) : s.key === "club" ? (
              <Link href="/log/week" className={cn(row, "press")}>
                {inner(s.key, s.label, s.note, s.done)}
              </Link>
            ) : (
              <button type="button" onClick={s.key === "post" ? onPost : send} className={cn(row, "press")}>
                {inner(s.key, s.label, s.note, s.done)}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={hide} className="min-h-[44px] w-full text-[13px] font-semibold text-white/60">
        {FIRST_DAYS_HIDE}
      </button>
    </section>
  );
}
