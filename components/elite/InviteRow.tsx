"use client";

import { useState } from "react";

// One plain row: the player's own link, a button that hands it to the
// phone's share sheet (or copies it), and how many teammates joined with
// it. It promises nothing for inviting.
export function InviteRow({ link, joined }: { link: string; joined: string }) {
  const [copied, setCopied] = useState(false);

  async function send() {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ url: link });
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // no share sheet and no clipboard: the link is on the screen to copy by hand
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-white/[0.07] pt-4">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-bone">Invite a teammate</div>
        <div className="mt-0.5 truncate text-sm text-white/60 select-all">{link.replace(/^https:\/\//, "")}</div>
        <div className="mt-0.5 text-sm text-white/60">{joined}</div>
      </div>
      <button
        type="button"
        onClick={send}
        className="flex h-11 shrink-0 items-center justify-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-bone"
      >
        {copied ? "Link copied" : "Send my link"}
      </button>
    </div>
  );
}
