"use client";

import { useState } from "react";
import Link from "next/link";
import { Crest, FreeAvatar } from "./FreeAvatar";
import { JOIN_PHOTO, type JoinInvite } from "./JoinLanding";
import {
  GET_APP_BODY,
  GET_APP_BODY_NO_CODE,
  GET_APP_BUTTON,
  GET_APP_CODE_LABEL,
  GET_APP_TITLE,
  GET_APP_WEB,
} from "@/lib/elite/app-version";

// An invite opened on an iPhone, once the coaches have saved the link to
// the app (lib/elite/app-version.ts): the same welcome as /join, but the
// one button gets the APP, and the code from the invite is shown to type
// at the app's door (lib/elite/free-door.ts). Training is timed in the
// app and only timed training counts on the board, so a teammate who
// taps an invite must not end up in a website sign-up by default.
// The website sign-up is still one tap away, for a player with no iPhone.
export function GetTheApp({
  invite,
  code,
  link,
  webHref,
}: {
  invite: JoinInvite;
  code: string | null;
  link: string;
  webHref: string;
}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // the code is on the screen to read
    }
  }
  return (
    <div className="relative mx-auto min-h-[100svh] w-full max-w-md overflow-hidden">
      <div className="absolute inset-0" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={JOIN_PHOTO} alt="" className="h-full w-full object-cover object-[50%_20%]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.6)_0,rgba(0,0,0,0)_22%,rgba(0,0,0,0)_32%,rgba(0,0,0,.92)_58%,#000)]" />
      </div>

      {invite && (
        <div className="absolute inset-x-[18px] top-[calc(60px+env(safe-area-inset-top))] z-[2] flex justify-center">
          <div className="flex max-w-full items-center gap-2.5 rounded-[30px] border border-white/15 bg-black/45 py-1.5 pl-1.5 pr-4 text-[14px] font-semibold backdrop-blur-md">
            {invite.kind === "friend" ? (
              <FreeAvatar photo={null} initials={invite.initials} size={34} />
            ) : (
              <Crest club={{ id: invite.clubId, name: invite.name }} size={34} />
            )}
            <span className="truncate">
              {invite.kind === "friend" ? `${invite.first} invited you` : `Join ${invite.name}`}
            </span>
          </div>
        </div>
      )}

      <div className="absolute inset-x-[22px] bottom-[calc(32px+env(safe-area-inset-bottom))] z-[2]">
        <p className="font-display text-[15px] font-black tracking-[3px] text-bone">
          STRIVE <span className="text-accent">ELITE</span>
        </p>
        <h1 className="mt-3 font-display text-[40px] font-black uppercase leading-[0.92] tracking-[-0.5px]">{GET_APP_TITLE}</h1>
        <p className="mt-3.5 text-[16px] leading-[1.4] text-white/80">{code ? GET_APP_BODY : GET_APP_BODY_NO_CODE}</p>

        {code && (
          <button
            type="button"
            onClick={copy}
            className="mt-5 flex min-h-[64px] w-full items-center justify-between rounded-[18px] border border-white/15 bg-white/[0.06] px-4 text-left"
            aria-label={`${GET_APP_CODE_LABEL}: ${code}. Tap to copy.`}
          >
            <span>
              <span className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-white/55">{GET_APP_CODE_LABEL}</span>
              <span className="mt-0.5 block select-all font-display text-[26px] font-black tracking-[3px] text-bone">{code}</span>
            </span>
            <span className="text-[14px] font-semibold text-white/70">{copied ? "Copied" : "Copy"}</span>
          </button>
        )}

        <a
          href={link}
          className="mt-4 flex h-[58px] w-full items-center justify-center rounded-[18px] bg-bone font-display text-[23px] font-black uppercase tracking-[0.5px] text-black"
        >
          {GET_APP_BUTTON}
        </a>
        <p className="mt-2 text-center text-[15px] font-semibold text-white/60">
          <Link href={webHref} className="tap inline-flex min-h-[44px] items-center text-bone">
            {GET_APP_WEB}
          </Link>
        </p>
      </div>
    </div>
  );
}
