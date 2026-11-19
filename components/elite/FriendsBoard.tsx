"use client";

import { useState } from "react";
import { BOARD_EMPTY_LINE, BOARD_TITLE, friendsBoard, initialsOf, type BoardEntry } from "@/lib/elite/tracker";
import { usePostLauncher } from "./FreeShell";
import { sendLink } from "./send-link";
import { StarMark } from "./StarMark";

// The week next to your friends (mock screen 4): you and the friends you
// added, in order of training time this week. It starts again every
// Monday. Friends are made by the link only: there is no search, no list
// of other players and no requests. Tapping a name opens that friend's
// profile, where they can be taken off or blocked. Nothing here announces
// a change of place.
export function FriendsBoard({
  me,
  myMinutes,
  friends,
  inviteLink,
}: {
  me: { id: string; name: string };
  myMinutes: number; // this week's training, as the screen shows it now
  friends: BoardEntry[];
  inviteLink: string;
}) {
  const { profile } = usePostLauncher();
  const [copied, setCopied] = useState(false);
  const rows = friendsBoard([{ id: me.id, name: me.name, minutes: myMinutes }, ...friends], me.id);

  async function send() {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section className="mx-[18px] mt-[18px]">
      <h2 className="mb-1.5 text-[11px] font-bold uppercase tracking-[2.6px] text-white/60">{BOARD_TITLE}</h2>

      {friends.length === 0 ? (
        <p className="py-2 text-[15px] leading-relaxed text-white/70">{BOARD_EMPTY_LINE}</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.id} className="border-b border-white/[0.09] last:border-0">
              <button
                type="button"
                onClick={() => profile(r.id)}
                aria-label={`${r.me ? "Your" : `${r.name}'s`} profile, place ${r.place}, ${r.time} this week`}
                className="flex h-[50px] w-full items-center gap-3"
              >
                <span className={"w-[18px] shrink-0 font-display text-[22px] font-black " + (r.me ? "text-accent" : "text-white/60")}>
                  {r.place}
                </span>
                <span
                  className={
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-bold " +
                    (r.me ? "bg-accent text-black" : "bg-[#222] text-bone")
                  }
                  aria-hidden
                >
                  {initialsOf(r.name)}
                </span>
                <span className={"flex min-w-0 flex-1 items-center gap-1.5 text-left text-[15.5px] font-semibold " + (r.me ? "text-accent" : "text-bone")}>
                  <span className="truncate">{r.me ? "You" : r.name}</span>
                  {r.starred && <StarMark size={13} />}
                </span>
                <span className="font-display text-[24px] font-black tabular-nums text-bone">{r.time}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={send}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl border border-white/20 text-[15px] font-semibold text-bone"
      >
        {copied ? "Link copied" : "Send my link"}
      </button>
    </section>
  );
}
