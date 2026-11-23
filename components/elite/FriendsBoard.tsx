"use client";

import { useState } from "react";
import { BOARD_EMPTY_LINE, BOARD_TITLE, friendsBoard, initialsOf, type BoardEntry } from "@/lib/elite/tracker";
import { usePostLauncher } from "./FreeShell";
import { FreeAvatar } from "./FreeAvatar";
import { IconPlus } from "./FreeIcons";
import { sendLink } from "./send-link";
import { StarMark } from "./StarMark";

// The week next to your friends (the mock, screens 4 and 12): you and the
// friends you added, in order of training time this week, each with their
// photo and a thin bar against the week's leader (gold for you). It starts
// again every Monday. Friends are made by the link only: there is no
// search, no list of other players and no requests. Tapping a name opens
// that friend's profile. Nothing here announces a change of place.
export function FriendsBoard({
  me,
  myMinutes,
  friends,
  inviteLink,
}: {
  me: { id: string; name: string; photo?: string | null };
  myMinutes: number; // this week's training, as the screen shows it now
  friends: BoardEntry[];
  inviteLink: string;
}) {
  const { profile } = usePostLauncher();
  const [copied, setCopied] = useState(false);
  const rows = friendsBoard([{ id: me.id, name: me.name, minutes: myMinutes, photo: me.photo }, ...friends], me.id);
  const most = Math.max(1, ...rows.map((r) => r.minutes));

  async function send() {
    if ((await sendLink(inviteLink)) === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <section className="mt-[22px]">
      <h2 className="px-[18px] pb-2 text-[11px] font-bold uppercase tracking-[2.4px] text-white/60">{BOARD_TITLE}</h2>

      {friends.length === 0 ? (
        <p className="px-[18px] py-2 text-[15px] leading-relaxed text-white/70">{BOARD_EMPTY_LINE}</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => profile(r.id)}
                aria-label={`${r.me ? "Your" : `${r.name}'s`} profile, place ${r.place}, ${r.time} this week`}
                className="flex h-[54px] w-full items-center gap-3 px-[18px]"
              >
                <span className={"w-[18px] shrink-0 font-display text-[22px] font-black " + (r.me ? "text-accent" : "text-white/60")}>
                  {r.place}
                </span>
                <FreeAvatar photo={r.photo} initials={initialsOf(r.name)} size={38} you={r.me} />
                <span className={"flex min-w-0 flex-1 items-center gap-[5px] text-left text-[15.5px] font-semibold " + (r.me ? "text-accent" : "text-bone")}>
                  <span className="truncate">{r.me ? "You" : r.name}</span>
                  {r.starred && <StarMark size={15} />}
                </span>
                <span className="font-display text-[24px] font-black text-bone">{r.time}</span>
              </button>
              <div className="ml-12 mr-[18px] h-[3px] overflow-hidden rounded-sm bg-[#1f1f1f]" aria-hidden>
                <i className={"block h-full " + (r.me ? "bg-accent" : "bg-[#3a3a3a]")} style={{ width: `${Math.round((r.minutes / most) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <button type="button" onClick={send} className="flex h-[54px] w-full items-center gap-3 px-[18px] text-[15px] font-semibold text-bone">
        <span className="grid h-[38px] w-[38px] place-items-center rounded-full border-[1.5px] border-dashed border-[#444]">
          <IconPlus size={18} />
        </span>
        {copied ? "Link copied. Send it to a teammate." : "Add a friend"}
      </button>
    </section>
  );
}
