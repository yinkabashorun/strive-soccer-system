"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FIRST_GROUP_AT,
  WAITLIST_ASK,
  WAITLIST_HEADLINE,
  WAITLIST_PERKS,
  inFirstGroup,
  maskedPhone,
  teammatesLine,
} from "@/lib/elite/waitlist";

// What a player on the waitlist sees when they open /join again on the
// same phone (migration 075): their own link to send, how many teammates
// joined with it (three boxes, filled in gold as they join), and when we
// text them. Nobody else's count, no ranking.
export function WaitlistStatus({
  first,
  link,
  phone,
  teammates,
}: {
  first: string;
  link: string;
  phone: string;
  teammates: number;
}) {
  const [copied, setCopied] = useState(false);
  const done = inFirstGroup(teammates);
  const shareText = `Get on the Strive app list with me: ${link}`;

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Strive Elite", text: shareText, url: link });
        return;
      } catch {
        /* closed the sheet: fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing to do */
    }
  }

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-md flex-col px-[22px] pb-[calc(32px+env(safe-area-inset-bottom))] pt-[calc(80px+env(safe-area-inset-top))]">
      <p className="font-display text-[15px] font-black tracking-[3px] text-bone">
        STRIVE <span className="text-accent">ELITE</span>
      </p>
      <h1 className="mt-4 font-display text-[52px] font-black uppercase leading-[0.88]">
        {WAITLIST_HEADLINE}, {first}.
      </h1>
      <p className="mt-3 text-[16px] leading-[1.4] text-white/75">
        {done ? "You're in the first group we let in." : WAITLIST_ASK}
      </p>

      <div className="mt-8 flex gap-2.5" aria-label={teammatesLine(teammates)}>
        {Array.from({ length: FIRST_GROUP_AT }, (_, i) => (
          <div
            key={i}
            className={
              "flex h-[64px] flex-1 items-center justify-center rounded-2xl border font-display text-[22px] font-black " +
              (i < teammates
                ? "border-transparent bg-[linear-gradient(135deg,#f0dca0,#c8a858_55%,#8c6d2c)] text-black"
                : "border-white/10 bg-[#141414] text-white/50")
            }
          >
            {i + 1}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[14px] text-white/60">{teammatesLine(teammates)}</p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#141414] p-4">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/50">Your link</p>
        <p className="mt-1.5 break-all text-[15px] text-bone">{link}</p>
      </div>

      <div className="mt-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/50">On the list you get</p>
        <ul className="mt-3 space-y-3">
          {WAITLIST_PERKS.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <div>
                <p className="text-[15px] font-semibold text-bone">{p.title}</p>
                <p className="mt-0.5 text-[14px] leading-[1.4] text-white/65">{p.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto pt-8">
        <button
          type="button"
          onClick={share}
          className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-bone font-display text-[23px] font-black uppercase tracking-[0.5px] text-black"
        >
          {copied ? "Link copied" : "Send to a teammate"}
        </button>
        <p className="mt-3 text-center text-[14px] text-white/60">
          We text {maskedPhone(phone)} the moment the app opens.
        </p>
        <p className="mt-2 text-center text-[14px] text-white/60">
          Already have an account?{" "}
          <Link href="/login" className="tap font-semibold text-bone">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
